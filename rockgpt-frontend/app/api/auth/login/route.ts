import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, createSignedSessionTokenForUser, verifyPassword, SESSION_COOKIE_NAME } from "@/lib/auth";
import { globalStore } from "@/lib/store";
import { proxyAuthRequest } from "@/lib/backend-auth";
import { generateUUID } from "@/lib/utils";
import { getClientIp, sanitizePayload } from "@/lib/security";
import { hash } from "bcrypt-ts";

const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string().min(1, "Password is required").max(128),
  remember: z.boolean().optional().default(true),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const ipLimit = checkRateLimit(`login:ip:${ip}`, 25, 15 * 60_000);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many login attempts. Please wait a few minutes and try again." } },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter ?? 60) } }
    );
  }

  try {
    const rawJson = await request.json();
    const json = sanitizePayload(rawJson);
    const { email, password, remember } = loginSchema.parse(json);
    const normalizedEmail = email.toLowerCase().trim();

    const accountLimit = checkRateLimit(`login:acct:${normalizedEmail}:${ip}`, 15, 15 * 60_000);
    if (!accountLimit.allowed) {
      return NextResponse.json(
        { error: { code: "rate_limited", message: "Too many attempts for this account. Please try again shortly." } },
        { status: 429, headers: { "Retry-After": String(accountLimit.retryAfter ?? 60) } }
      );
    }

    // 1. Verify against Persistent MongoDB Database via Backend
    const backendResult = await proxyAuthRequest(
      "signin",
      { email: normalizedEmail, password },
      35_000,
      ip
    );

    if (backendResult.ok && backendResult.data?.success) {
      const data = backendResult.data;
      const bUser = data.user;
      const userId = bUser?.id || generateUUID();
      const localHash = await hash(password, 10);

      const userRecord = {
        id: userId,
        email: bUser?.email || normalizedEmail,
        name: bUser?.name || "User",
        password_hash: localHash,
        avatar_url: bUser?.avatar_url || null,
        theme: "dark",
        created_at: new Date(),
        backend_token: data.token || null,
        backend_refresh_token: data.refreshToken || null,
      };

      globalStore.saveUser(userRecord);
      const sessionToken = createSignedSessionTokenForUser(userRecord);

      const response = NextResponse.json({
        success: true,
        user: {
          id: userRecord.id,
          email: userRecord.email,
          name: userRecord.name,
          theme: userRecord.theme,
          avatar_url: userRecord.avatar_url,
        },
      });

      response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        ...(remember ? { expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } : {}),
      });

      return response;
    }

    if (backendResult.status === 429) {
      return NextResponse.json(
        {
          error: {
            code: "locked",
            message: backendResult.data?.error || "Account is temporarily locked due to multiple failed attempts. Try again later.",
          },
        },
        { status: 429 }
      );
    }

    if (backendResult.status === 400 || backendResult.status === 401 || backendResult.status === 403) {
      return NextResponse.json(
        {
          error: {
            code: "invalid_credentials",
            message: backendResult.data?.error || "Invalid email or password",
          },
        },
        { status: backendResult.status === 401 ? 401 : backendResult.status }
      );
    }

    // 2. Local development fallback ONLY when backend is unreachable (503) in non-production
    if (process.env.NODE_ENV !== "production") {
      const localUser = globalStore.getUserByEmail(normalizedEmail);
      if (localUser && localUser.password_hash) {
        const isValid = await verifyPassword(password, localUser.password_hash);
        if (isValid) {
          const sessionToken = createSignedSessionTokenForUser(localUser);
          globalStore.createSession(localUser.id);
          const response = NextResponse.json({
            success: true,
            user: {
              id: localUser.id,
              email: localUser.email,
              name: localUser.name,
              theme: localUser.theme,
              avatar_url: localUser.avatar_url,
            },
          });
          response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            path: "/",
            ...(remember ? { expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } : {}),
          });
          return response;
        }
      }
    }

    return NextResponse.json(
      {
        error: {
          code: "service_unavailable",
          message: "Authentication server is starting up. Please try again in a few seconds.",
        },
      },
      { status: 503 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid input" } },
        { status: 400 }
      );
    }
    console.error("Login route error:", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "An unexpected error occurred during login" } },
      { status: 500 }
    );
  }
}
