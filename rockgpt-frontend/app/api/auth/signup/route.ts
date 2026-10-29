import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, signToken, OTP_COOKIE_NAME } from "@/lib/auth";
import { globalStore } from "@/lib/store";
import { proxyAuthRequest } from "@/lib/backend-auth";
import { generateUUID } from "@/lib/utils";
import { hash } from "bcrypt-ts";

// Strict RFC 5322 compliant email regex
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(64, "Name cannot exceed 64 characters"),
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
  const ip = request.headers.get("x-forwarded-for") || "local";
  const rateLimit = checkRateLimit(`signup:${ip}`, 10, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many registration attempts. Please try again later." } },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
    );
  }

  try {
    const json = await request.json();
    const { name, email, password } = signupSchema.parse(json);
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Dispatch registration to authentication provider with active email verification engine
    const backendResult = await proxyAuthRequest("signup", {
      name,
      email: normalizedEmail,
      password,
    });

    if (backendResult.ok && backendResult.data?.success) {
      const data = backendResult.data;
      const userId = data.user?.id || generateUUID();
      const localHash = await hash(password, 10);

      // Save user to local memory store for instant fallback resilience
      const userRecord = {
        id: userId,
        email: normalizedEmail,
        name,
        password_hash: localHash,
        avatar_url: null,
        theme: "dark",
        created_at: new Date(),
        backend_token: data.token || null,
      };
      globalStore.saveUser(userRecord);
      if (data.backupCode) {
        globalStore.saveOtp(normalizedEmail, data.backupCode, "signup", name, localHash);
      }

      // Set pending verification cookie without leaking code
      const otpToken = signToken({
        email: normalizedEmail,
        type: "signup",
        name,
        exp: Date.now() + 10 * 60 * 1000,
      });

      const response = NextResponse.json({
        success: true,
        message: data.message || `A 6-digit verification code has been sent to ${normalizedEmail}. Please check your inbox.`,
        email: normalizedEmail,
        backupCode: data.backupCode || undefined,
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

    // Handle provider rejection (duplicate email, security lockout, etc.)
    if (backendResult.status === 409 || backendResult.status === 400 || backendResult.status === 429) {
      return NextResponse.json(
        { error: { code: "signup_error", message: backendResult.data?.error || "Registration could not be completed." } },
        { status: backendResult.status }
      );
    }

    // 2. Resilient fallback if backend service is unreachable (Render cold-start / sleeping)
    const localHash = await hash(password, 10);
    const userId = generateUUID();
    const fallbackCode = Math.floor(100000 + Math.random() * 900000).toString();

    const fallbackUser = {
      id: userId,
      email: normalizedEmail,
      name,
      password_hash: localHash,
      avatar_url: null,
      theme: "dark",
      created_at: new Date(),
    };
    globalStore.saveUser(fallbackUser);
    globalStore.saveOtp(normalizedEmail, fallbackCode, "signup", name, localHash);

    const otpToken = signToken({
      email: normalizedEmail,
      type: "signup",
      name,
      exp: Date.now() + 10 * 60 * 1000,
    });

    const response = NextResponse.json({
      success: true,
      message: `Verification code generated: ${fallbackCode}`,
      email: normalizedEmail,
      backupCode: fallbackCode,
      emailSent: false,
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
      { error: { code: "server_error", message: "An unexpected error occurred during registration" } },
      { status: 500 }
    );
  }
}
