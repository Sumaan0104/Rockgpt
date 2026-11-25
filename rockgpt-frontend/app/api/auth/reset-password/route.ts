import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, SESSION_COOKIE_NAME, OTP_COOKIE_NAME, createSignedSessionTokenForUser } from "@/lib/auth";
import { globalStore } from "@/lib/store";
import { proxyAuthRequest } from "@/lib/backend-auth";
import { generateUUID } from "@/lib/utils";
import { getClientIp, sanitizePayload } from "@/lib/security";

const resetPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255),
  code: z.string().trim().regex(/^\d{6}$/, "Code must be 6 digits"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`reset:${ip}`, 10, 15 * 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many reset attempts. Please try again later." } },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
    );
  }

  try {
    const rawJson = await request.json();
    const json = sanitizePayload(rawJson);
    const { email, code, newPassword } = resetPasswordSchema.parse(json);
    const normalizedEmail = email.toLowerCase().trim();

    const backendResult = await proxyAuthRequest(
      "reset-password",
      { email: normalizedEmail, code, newPassword },
      35_000,
      ip
    );

    if (backendResult.ok && backendResult.data?.success) {
      const bUser = backendResult.data.user;
      const userRecord = {
        id: bUser?.id || generateUUID(),
        email: bUser?.email || normalizedEmail,
        name: bUser?.name || "User",
        password_hash: null,
        avatar_url: bUser?.avatar_url || null,
        theme: "dark",
        created_at: new Date(),
        backend_token: backendResult.data.token || null,
      };

      globalStore.saveUser(userRecord);
      const sessionToken = createSignedSessionTokenForUser(userRecord);

      const response = NextResponse.json({
        success: true,
        message: "Password reset successful! You are now logged in.",
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

      response.cookies.delete("rockgpt_reset_verified");
      response.cookies.delete(OTP_COOKIE_NAME);
      return response;
    }

    if (backendResult.status && backendResult.status !== 503) {
      return NextResponse.json(
        { error: { code: "reset_error", message: backendResult.data?.error || "Password reset failed." } },
        { status: backendResult.status }
      );
    }

    return NextResponse.json(
      { error: { code: "service_unavailable", message: "Authentication server unavailable. Please retry in a few seconds." } },
      { status: 503 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid input" } },
        { status: 400 }
      );
    }
    console.error("Reset password error:", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to reset password" } },
      { status: 500 }
    );
  }
}
