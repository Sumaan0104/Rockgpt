import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { globalStore, type StoredUser } from "@/lib/store";
import { generateUUID } from "@/lib/utils";

const verifySchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  code: z.string().trim().min(6, "Code must be 6 digits").max(6),
  type: z.enum(["signup", "reset"]).default("signup"),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { email, code, type } = verifySchema.parse(json);
    const normalizedEmail = email.toLowerCase().trim();

    const otp = globalStore.getOtp(normalizedEmail, type);
    if (!otp) {
      return NextResponse.json(
        { error: { code: "otp_expired", message: "Verification code has expired or does not exist. Please request a new one." } },
        { status: 400 }
      );
    }

    if (otp.code !== code.trim()) {
      otp.attempts += 1;
      if (otp.attempts >= 5) {
        globalStore.deleteOtp(normalizedEmail, type);
        return NextResponse.json(
          { error: { code: "too_many_attempts", message: "Too many incorrect attempts. Please request a new code." } },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: { code: "invalid_code", message: "Incorrect verification code. Please check and try again." } },
        { status: 400 }
      );
    }

    // Code matched!
    if (type === "signup") {
      let user = globalStore.getUserByEmail(normalizedEmail);
      if (!user) {
        user = {
          id: generateUUID(),
          email: normalizedEmail,
          name: otp.name || "User",
          password_hash: otp.password_hash || null,
          avatar_url: null,
          theme: "dark",
          created_at: new Date(),
        };
        globalStore.saveUser(user);
      } else if (otp.password_hash) {
        user.password_hash = otp.password_hash;
        if (otp.name) user.name = otp.name;
      }

      globalStore.deleteOtp(normalizedEmail, "signup");
      await createSession(user.id);

      return NextResponse.json({
        success: true,
        message: "Account verified successfully",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          theme: user.theme,
          avatar_url: user.avatar_url,
        },
      });
    }

    // Type === "reset"
    return NextResponse.json({
      success: true,
      message: "Reset code verified",
      verified: true,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid code" } },
        { status: 400 }
      );
    }
    console.error("OTP verification error:", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Verification failed" } },
      { status: 500 }
    );
  }
}
