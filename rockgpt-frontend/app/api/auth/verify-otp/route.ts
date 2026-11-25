import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, SESSION_COOKIE_NAME, OTP_COOKIE_NAME, createSignedSessionTokenForUser } from "@/lib/auth";
import { globalStore } from "@/lib/store";
import { proxyAuthRequest } from "@/lib/backend-auth";
import { generateUUID } from "@/lib/utils";
import { getClientIp, sanitizePayload } from "@/lib/security";

const verifySchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255),
  code: z.string().trim().regex(/^\d{6}$/, "Verification code must be exactly 6 digits"),
  type: z.enum(["signup", "reset"]).default("signup"),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const ipLimit = checkRateLimit(`verify:${ip}`, 15, 15 * 60_000);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many verification attempts. Please wait a few minutes." } },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter ?? 60) } }
    );
  }

  try {
    const rawJson = await request.json();
    const json = sanitizePayload(rawJson);
    const { email, code, type } = verifySchema.parse(json);
    const normalizedEmail = email.toLowerCase().trim();

    if (type === "reset") {
      const resetVerify = await proxyAuthRequest(
        "verify-reset",
        { email: normalizedEmail, code },
        30_000,
        ip
      );

      if (resetVerify.ok && resetVerify.data?.success) {
        return NextResponse.json({
          success: true,
          verified: true,
          message: resetVerify.data.message || "Recovery code verified.",
        });
      }

      return NextResponse.json(
        {
          error: {
            code: "verification_failed",
            message: resetVerify.data?.error || "Incorrect or expired recovery code.",
          },
        },
        { status: resetVerify.status || 400 }
      );
    }

    // Signup OTP verification strictly enforced against MongoDB HMAC OTP hash
    const backendResult = await proxyAuthRequest(
      "verify",
      { email: normalizedEmail, code },
      30_000,
      ip
    );

    if (backendResult.ok && backendResult.data?.success) {
      const bUser = backendResult.data.user;
      const existingLocal = globalStore.getUserByEmail(normalizedEmail);
      const userRecord = {
        id: bUser?.id || existingLocal?.id || generateUUID(),
        email: bUser?.email || normalizedEmail,
        name: bUser?.name || existingLocal?.name || "User",
        password_hash: existingLocal?.password_hash || null,
        avatar_url: bUser?.avatar_url || null,
        theme: "dark",
        created_at: new Date(),
        backend_token: backendResult.data.token || null,
      };

      globalStore.saveUser(userRecord);
      const sessionToken = createSignedSessionTokenForUser(userRecord);

      const response = NextResponse.json({
        success: true,
        message: "Account verified successfully! Welcome to RockGPT.",
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

      response.cookies.delete(OTP_COOKIE_NAME);
      return response;
    }

    return NextResponse.json(
      {
        error: {
          code: backendResult.status === 429 ? "locked" : "verification_failed",
          message: backendResult.data?.error || "Incorrect or expired verification code.",
        },
      },
      { status: backendResult.status && backendResult.status !== 503 ? backendResult.status : 503 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid verification code" } },
        { status: 400 }
      );
    }
    console.error("OTP verification error:", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Verification failed. Please try again." } },
      { status: 500 }
    );
  }
}
