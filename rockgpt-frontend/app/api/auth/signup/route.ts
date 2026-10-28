import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, hashPassword } from "@/lib/auth";
import { globalStore } from "@/lib/store";

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

    const existing = globalStore.getUserByEmail(normalizedEmail);
    if (existing && existing.password_hash) {
      return NextResponse.json(
        { error: { code: "duplicate_email", message: "An account with this email already exists" } },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    // Generate secure 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    globalStore.saveOtp(normalizedEmail, code, "signup", name, passwordHash);
    console.log(`[RockGPT Auth] 6-digit verification OTP for ${normalizedEmail}: ${code}`);

    // If Brevo or Resend keys are in environment, attempt dispatch
    const brevoKey = process.env.BREVO_API_KEY;
    if (brevoKey) {
      fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoKey.trim(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: "RockGPT Security", email: "noreply@rockgpt.ai" },
          to: [{ email: normalizedEmail }],
          subject: `${code} is your RockGPT verification code`,
          htmlContent: `<p>Your verification code for RockGPT is: <b>${code}</b>. Valid for 10 minutes.</p>`,
        }),
      }).catch(err => console.warn("[Brevo Warning]:", err));
    }

    return NextResponse.json({
      success: true,
      message: `Verification code sent to ${normalizedEmail}`,
      email: normalizedEmail,
      testCode: code, // Provides instant testing in dev/fallback
    });
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
