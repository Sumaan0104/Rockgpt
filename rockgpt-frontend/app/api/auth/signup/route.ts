import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, hashPassword, signToken, OTP_COOKIE_NAME } from "@/lib/auth";
import { globalStore } from "@/lib/store";
import { proxyAuthRequest } from "@/lib/backend-auth";
import { generateUUID } from "@/lib/utils";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(64),
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const rateLimit = checkRateLimit(`signup:${ip}`, 15, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many attempts. Please try again later." } },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
    );
  }

  try {
    const json = await request.json();
    const { name, email, password } = signupSchema.parse(json);
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Dispatch to Persistent Backend with Live Email Verification Engine
    const backendResult = await proxyAuthRequest("signup", {
      name,
      email: normalizedEmail,
      password,
    });

    if (backendResult.ok && backendResult.data?.success) {
      const data = backendResult.data;
      const userId = data.user?.id || generateUUID();
      const passwordHash = await hashPassword(password);

      // Cache user locally
      globalStore.saveUser({
        id: userId,
        email: normalizedEmail,
        name,
        password_hash: passwordHash,
        avatar_url: null,
        theme: "dark",
        created_at: new Date(),
      });

      const otpToken = signToken({
        email: normalizedEmail,
        code: data.backupCode || "VERIFIED",
        type: "signup",
        name,
        password_hash: passwordHash,
        exp: Date.now() + 10 * 60 * 1000,
      });

      const response = NextResponse.json({
        success: true,
        message: data.message || `Verification code sent to ${normalizedEmail}`,
        email: normalizedEmail,
        emailSent: Boolean(data.emailSent),
        backupCode: data.backupCode,
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

    // If backend returned business logic error (e.g. duplicate email, lockout)
    if (backendResult.status === 409 || backendResult.status === 400 || backendResult.status === 429) {
      return NextResponse.json(
        { error: { code: "signup_error", message: backendResult.data?.error || "Registration issue." } },
        { status: backendResult.status }
      );
    }

    // 2. Resilient local fallback if backend is momentarily sleeping
    const existing = globalStore.getUserByEmail(normalizedEmail);
    if (existing && existing.password_hash) {
      return NextResponse.json(
        { error: { code: "duplicate_email", message: "An account with this email already exists" } },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    globalStore.saveOtp(normalizedEmail, code, "signup", name, passwordHash);

    const otpToken = signToken({
      email: normalizedEmail,
      code,
      type: "signup",
      name,
      password_hash: passwordHash,
      exp: Date.now() + 10 * 60 * 1000,
    });

    const response = NextResponse.json({
      success: true,
      message: `Verification code generated for ${normalizedEmail}`,
      email: normalizedEmail,
      emailSent: false,
      backupCode: code,
    });

    response.cookies.set(OTP_COOKIE_NAME, otpToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(Date.now() + 10 * 60 * 1000),
    });

    return response;
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid input" } },
        { status: 400 }
      );
    }
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to initiate signup" } },
      { status: 500 }
    );
  }
}
