import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/auth";
import { proxyAuthRequest } from "@/lib/backend-auth";
import { getClientIp, sanitizePayload } from "@/lib/security";

const resendSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255),
  type: z.enum(["signup", "reset"]).default("signup"),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`resend:${ip}`, 8, 15 * 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Please wait a moment before requesting another code." } },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
    );
  }

  try {
    const rawJson = await request.json();
    const json = sanitizePayload(rawJson);
    const { email, type } = resendSchema.parse(json);
    const normalizedEmail = email.toLowerCase().trim();

    const backendResult = await proxyAuthRequest(
      "resend-otp",
      { email: normalizedEmail, type },
      35_000,
      ip
    );

    if (backendResult.ok && backendResult.data?.success) {
      return NextResponse.json({
        success: true,
        message: backendResult.data.message || `Fresh verification code sent to ${normalizedEmail}`,
        emailSent: Boolean(backendResult.data.emailSent),
      });
    }

    if (backendResult.status && backendResult.status !== 503) {
      return NextResponse.json(
        {
          error: {
            code: backendResult.status === 429 ? "cooldown" : "resend_error",
            message: backendResult.data?.error || "Failed to resend verification code.",
          },
        },
        { status: backendResult.status }
      );
    }

    return NextResponse.json(
      { error: { code: "service_unavailable", message: "Email server temporarily unreachable. Please retry shortly." } },
      { status: 503 }
    );
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
