import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/auth";
import { globalStore } from "@/lib/store";

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

    const user = globalStore.getUserByEmail(normalizedEmail);
    if (!user) {
      // Return helpful message
      return NextResponse.json(
        { error: { code: "user_not_found", message: "No account found with this email address." } },
        { status: 404 }
      );
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    globalStore.saveOtp(normalizedEmail, resetCode, "reset");

    console.log(`[RockGPT Auth] Password reset 6-digit code for ${normalizedEmail}: ${resetCode}`);

    return NextResponse.json({
      success: true,
      message: `Recovery code sent to ${normalizedEmail}`,
      email: normalizedEmail,
      testCode: resetCode,
    });
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
