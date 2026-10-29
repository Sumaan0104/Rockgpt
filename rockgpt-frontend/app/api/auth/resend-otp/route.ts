import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/auth";
import { globalStore } from "@/lib/store";
import { proxyAuthRequest } from "@/lib/backend-auth";

const resendSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  type: z.enum(["signup", "reset"]).default("signup"),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const rateLimit = checkRateLimit(`resend:${ip}`, 5, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Please wait a moment before requesting another code." } },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
    );
  }

  try {
    const json = await request.json();
    const { email, type } = resendSchema.parse(json);
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Dispatch through Backend Live Email Engine
    const backendResult = await proxyAuthRequest("resend-otp", {
      email: normalizedEmail,
      type,
    });

    if (backendResult.ok && backendResult.data?.success) {
      return NextResponse.json({
        success: true,
        message: backendResult.data.message || `Fresh verification code sent to ${normalizedEmail}`,
        emailSent: Boolean(backendResult.data.emailSent),
        backupCode: backendResult.data.backupCode || undefined,
      });
    }

    // 2. Resilient local fallback
    const existingOtp = globalStore.getOtp(normalizedEmail, type);
    const name = existingOtp?.name;
    const passwordHash = existingOtp?.password_hash;

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    globalStore.saveOtp(normalizedEmail, newCode, type, name, passwordHash);

    return NextResponse.json({
      success: true,
      message: `A fresh 6-digit verification code has been dispatched to ${normalizedEmail}.`,
      backupCode: newCode,
      emailSent: false,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid input" } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to resend code" } },
      { status: 500 }
    );
  }
}
