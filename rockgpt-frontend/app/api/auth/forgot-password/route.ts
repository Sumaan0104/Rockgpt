import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, signToken, OTP_COOKIE_NAME } from "@/lib/auth";
import { proxyAuthRequest } from "@/lib/backend-auth";
import { getClientIp, sanitizePayload } from "@/lib/security";

const forgotSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`forgot:${ip}`, 8, 15 * 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many recovery attempts. Please wait a moment." } },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
    );
  }

  try {
    const rawJson = await request.json();
    const json = sanitizePayload(rawJson);
    const { email } = forgotSchema.parse(json);
    const normalizedEmail = email.toLowerCase().trim();

    const backendResult = await proxyAuthRequest(
      "forgot",
      { email: normalizedEmail },
      35_000,
      ip
    );

    if (backendResult.ok && backendResult.data?.success) {
      const data = backendResult.data;
      const otpToken = signToken({
        email: normalizedEmail,
        type: "reset",
        exp: Date.now() + 10 * 60 * 1000,
      });

      const response = NextResponse.json({
        success: true,
        message:
          data.message ||
          `Password recovery code dispatched to ${normalizedEmail}. Please check your inbox.`,
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
            code: backendResult.status === 404 ? "user_not_found" : "forgot_error",
            message: backendResult.data?.error || "Could not dispatch password recovery code.",
          },
        },
        { status: backendResult.status }
      );
    }

    return NextResponse.json(
      { error: { code: "service_unavailable", message: "Recovery server is starting up. Please retry in a few seconds." } },
      { status: 503 }
    );
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
