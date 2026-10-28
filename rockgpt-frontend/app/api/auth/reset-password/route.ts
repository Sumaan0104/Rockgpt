import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { SESSION_COOKIE_NAME, OTP_COOKIE_NAME, createSignedSessionTokenForUser, hashPassword, verifyToken } from "@/lib/auth";
import { globalStore } from "@/lib/store";

const resetPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  code: z.string().trim().min(6, "Code must be 6 digits").max(6),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { email, code, newPassword } = resetPasswordSchema.parse(json);
    const normalizedEmail = email.toLowerCase().trim();

    let otp = globalStore.getOtp(normalizedEmail, "reset");
    let isResetCookieVerified = false;

    if (!otp) {
      const cookieStore = await cookies();
      const verifiedCookie = cookieStore.get("rockgpt_reset_verified")?.value;
      if (verifiedCookie) {
        const decoded = verifyToken<{ email: string }>(verifiedCookie);
        if (decoded && decoded.email === normalizedEmail) {
          isResetCookieVerified = true;
        }
      }

      const pendingOtpCookie = cookieStore.get(OTP_COOKIE_NAME)?.value;
      if (pendingOtpCookie) {
        const decoded = verifyToken<{ email: string; code: string; type: string }>(pendingOtpCookie);
        if (decoded && decoded.email === normalizedEmail && decoded.type === "reset" && decoded.code === code.trim()) {
          isResetCookieVerified = true;
        }
      }
    }

    if (!otp && !isResetCookieVerified) {
      return NextResponse.json(
        { error: { code: "otp_expired", message: "Recovery code has expired or was not requested. Please request a new one." } },
        { status: 400 }
      );
    }

    if (otp && !isResetCookieVerified && otp.code !== code.trim()) {
      otp.attempts += 1;
      if (otp.attempts >= 5) {
        globalStore.deleteOtp(normalizedEmail, "reset");
      }
      return NextResponse.json(
        { error: { code: "invalid_code", message: "Incorrect recovery code. Please check and try again." } },
        { status: 400 }
      );
    }

    let user = globalStore.getUserByEmail(normalizedEmail);
    if (!user) {
      return NextResponse.json(
        { error: { code: "user_not_found", message: "User account not found." } },
        { status: 404 }
      );
    }

    const newHash = await hashPassword(newPassword);
    user.password_hash = newHash;
    globalStore.saveUser(user);
    globalStore.deleteOtp(normalizedEmail, "reset");

    const sessionToken = createSignedSessionTokenForUser(user);

    const response = NextResponse.json({
      success: true,
      message: "Password reset successfully. You are now signed in.",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        theme: user.theme,
        avatar_url: user.avatar_url,
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
