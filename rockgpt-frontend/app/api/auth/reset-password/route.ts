import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, hashPassword } from "@/lib/auth";
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

    const otp = globalStore.getOtp(normalizedEmail, "reset");
    if (!otp) {
      return NextResponse.json(
        { error: { code: "otp_expired", message: "Recovery code has expired or was not requested. Please request a new one." } },
        { status: 400 }
      );
    }

    if (otp.code !== code.trim()) {
      otp.attempts += 1;
      if (otp.attempts >= 5) {
        globalStore.deleteOtp(normalizedEmail, "reset");
        return NextResponse.json(
          { error: { code: "too_many_attempts", message: "Too many incorrect attempts. Please request a new code." } },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: { code: "invalid_code", message: "Incorrect recovery code. Please check and try again." } },
        { status: 400 }
      );
    }

    const user = globalStore.getUserByEmail(normalizedEmail);
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

    await createSession(user.id);

    return NextResponse.json({
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
