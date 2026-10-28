import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, signToken, OTP_COOKIE_NAME } from "@/lib/auth";
import { globalStore } from "@/lib/store";
import { proxyAuthRequest } from "@/lib/backend-auth";

const forgotSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const rateLimit = checkRateLimit(`forgot:${ip}`, 5, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many attempts. Please wait a moment." } },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
    );
  }

  try {
    const json = await request.json();
    const { email } = forgotSchema.parse(json);
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Dispatch through Backend Live Email Engine
    const backendResult = await proxyAuthRequest("forgot", {
      email: normalizedEmail,
    });

    if (backendResult.ok && backendResult.data?.success) {
      const data = backendResult.data;
      const otpToken = signToken({
        email: normalizedEmail,
        type: "reset",
        exp: Date.now() + 10 * 60 * 1000,
      });

      const response = NextResponse.json({
        success: true,
        message: data.message || `Password recovery code dispatched to ${normalizedEmail}. Please check your inbox.`,
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

    if (backendResult.status === 404 || backendResult.status === 400) {
      return NextResponse.json(
        { error: { code: "user_not_found", message: backendResult.data?.error || "No account found with this email." } },
        { status: backendResult.status }
      );
    }

    // 2. Resilient local fallback
    const user = globalStore.getUserByEmail(normalizedEmail);
    if (!user) {
      return NextResponse.json(
        { error: { code: "user_not_found", message: "No account found with this email address." } },
        { status: 404 }
      );
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    globalStore.saveOtp(normalizedEmail, resetCode, "reset");

    const otpToken = signToken({
      email: normalizedEmail,
      type: "reset",
      exp: Date.now() + 10 * 60 * 1000,
    });

    const response = NextResponse.json({
      success: true,
      message: `Password recovery code dispatched to ${normalizedEmail}. Please check your inbox.`,
      email: normalizedEmail,
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
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid email" } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to process forgot password request" } },
      { status: 500 }
    );
  }
}
