import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, signToken, OTP_COOKIE_NAME, SESSION_COOKIE_NAME, createSignedSessionTokenForUser } from "@/lib/auth";
import { globalStore } from "@/lib/store";
import { proxyAuthRequest } from "@/lib/backend-auth";
import { generateUUID } from "@/lib/utils";
import { getClientIp, sanitizePayload } from "@/lib/security";
import { hash } from "bcrypt-ts";

// Strict RFC 5322 compliant email regex
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(64, "Name cannot exceed 64 characters"),
  email: z
    .string()
    .trim()
    .regex(EMAIL_REGEX, "Invalid email address format. Please enter a valid email.")
    .max(255, "Email is too long"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password cannot exceed 128 characters"),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`signup:${ip}`, 10, 15 * 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many registration attempts. Please try again later." } },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
    );
  }

  try {
    const rawJson = await request.json();
    const json = sanitizePayload(rawJson);
    const { name, email, password } = signupSchema.parse(json);
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Dispatch registration to backend with active SMTP OTP email verification
    const backendResult = await proxyAuthRequest(
      "signup",
      { name, email: normalizedEmail, password },
      35_000,
      ip
    );

    if (backendResult.ok && backendResult.data?.success) {
      const data = backendResult.data;
      const userId = data.user?.id || generateUUID();
      const localHash = await hash(password, 10);

      // Handle alreadyActive accounts (user already registered & verified with matching password)
      if (data.alreadyActive && data.user) {
        const userRecord = {
          id: userId,
          email: normalizedEmail,
          name: data.user.name || name,
          password_hash: localHash,
          avatar_url: data.user.avatar_url || null,
          theme: "dark",
          created_at: new Date(),
          backend_token: data.token || null,
        };
        globalStore.saveUser(userRecord);
        const sessionToken = createSignedSessionTokenForUser(userRecord);

        const response = NextResponse.json({
          success: true,
          alreadyActive: true,
          message: data.message || "Account already exists with this password. Signed in successfully!",
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

      const otpToken = signToken({
        email: normalizedEmail,
        type: "signup",
        name,
        exp: Date.now() + 10 * 60 * 1000,
      });

      const response = NextResponse.json({
        success: true,
        message:
          data.message ||
          `A 6-digit verification code has been sent to ${normalizedEmail}. Please check your inbox.`,
        email: normalizedEmail,
        emailSent: Boolean(data.emailSent),
      });

      response.cookies.set(OTP_COOKIE_NAME, otpToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: new Date(Date.now() + 10 * 60 * 1000),
      });

      return response;
    }

    if (backendResult.status && backendResult.status !== 503) {
      return NextResponse.json(
        {
          error: {
            code: "signup_error",
            message: backendResult.data?.error || "Registration could not be completed.",
          },
        },
        { status: backendResult.status }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "service_unavailable",
          message: "Authentication server is waking up. Please try again in a few seconds.",
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
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "An unexpected error occurred during registration" } },
      { status: 500 }
    );
  }
}
