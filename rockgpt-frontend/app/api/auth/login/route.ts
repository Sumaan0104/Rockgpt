import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, createSignedSessionTokenForUser, verifyPassword, SESSION_COOKIE_NAME } from "@/lib/auth";
import { globalStore } from "@/lib/store";
import { proxyAuthRequest } from "@/lib/backend-auth";
import { generateUUID } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const rateLimit = checkRateLimit(`login:${ip}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many attempts. Please try again later." } },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
    );
  }

  try {
    const json = await request.json();
    const { email, password } = loginSchema.parse(json);
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Verify against Persistent Database on Render Backend
    const backendResult = await proxyAuthRequest("signin", {
      email: normalizedEmail,
      password,
    });

    if (backendResult.ok && backendResult.data?.success) {
      const data = backendResult.data;
      const bUser = data.user;
      const userId = bUser?.id || generateUUID();

      const userRecord = {
        id: userId,
        email: bUser?.email || normalizedEmail,
        name: bUser?.name || "User",
        password_hash: null, // Password verified by backend
        avatar_url: bUser?.avatar_url || null,
        theme: "dark",
        created_at: new Date(),
        backend_token: data.token || null,
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
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      return response;
    }

    if (backendResult.status === 401 || backendResult.status === 429) {
      return NextResponse.json(
        { error: { code: "invalid_credentials", message: backendResult.data?.error || "Invalid email or password" } },
        { status: backendResult.status }
      );
    }

    // 2. Resilient local fallback
    const user = globalStore.getUserByEmail(normalizedEmail);
    if (!user || !user.password_hash) {
      return NextResponse.json(
        { error: { code: "invalid_credentials", message: "Invalid email or password" } },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: { code: "invalid_credentials", message: "Invalid email or password" } },
        { status: 401 }
      );
    }

    const sessionToken = createSignedSessionTokenForUser(user);
    globalStore.createSession(user.id);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        theme: user.theme,
        avatar_url: user.avatar_url,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return response;
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid input" } },
        { status: 400 }
      );
    }
    console.error("Login error:", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to log in" } },
      { status: 500 }
    );
  }
}
