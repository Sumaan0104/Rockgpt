import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { SESSION_COOKIE_NAME, OTP_COOKIE_NAME, createSignedSessionTokenForUser, verifyToken, signToken } from "@/lib/auth";
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

    // 1. Check in-memory store
    let otp = globalStore.getOtp(normalizedEmail, type);
    let otpTokenData: any = null;

    // 2. Check signed cookie fallback for multi-lambda Vercel execution
    if (!otp) {
      const cookieStore = await cookies();
      const rawCookie = cookieStore.get(OTP_COOKIE_NAME)?.value;
      if (rawCookie) {
        const decoded = verifyToken<{ email: string; code: string; type: string; name?: string; password_hash?: string }>(rawCookie);
        if (decoded && decoded.email === normalizedEmail && decoded.type === type) {
          otpTokenData = decoded;
        }
      }
    }

    const targetCode = otp ? otp.code : (otpTokenData ? otpTokenData.code : null);

    if (!targetCode) {
      return NextResponse.json(
        { error: { code: "otp_expired", message: "Verification code has expired or does not exist. Please request a new one." } },
        { status: 400 }
      );
    }

    if (targetCode !== code.trim()) {
      if (otp) {
        otp.attempts += 1;
        if (otp.attempts >= 5) {
          globalStore.deleteOtp(normalizedEmail, type);
        }
      }
      return NextResponse.json(
        { error: { code: "invalid_code", message: "Incorrect verification code. Please check and try again." } },
        { status: 400 }
      );
    }

    // Code matched!
    if (type === "signup") {
      let user = globalStore.getUserByEmail(normalizedEmail);
      const name = (otp && otp.name) || (otpTokenData && otpTokenData.name) || "User";
      const passwordHash = (otp && otp.password_hash) || (otpTokenData && otpTokenData.password_hash) || null;

      if (!user) {
        user = {
          id: generateUUID(),
          email: normalizedEmail,
          name,
          password_hash: passwordHash,
          avatar_url: null,
          theme: "dark",
          created_at: new Date(),
        };
        globalStore.saveUser(user);
      } else if (passwordHash) {
        user.password_hash = passwordHash;
        if (name) user.name = name;
      }

      globalStore.deleteOtp(normalizedEmail, "signup");
      const sessionToken = createSignedSessionTokenForUser(user);

      const response = NextResponse.json({
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

      response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      response.cookies.delete(OTP_COOKIE_NAME);

      return response;
    }

    // Type === "reset"
    const resetVerifiedToken = signToken({
      email: normalizedEmail,
      exp: Date.now() + 15 * 60 * 1000,
    });

    const response = NextResponse.json({
      success: true,
      message: "Reset code verified",
      verified: true,
    });

    response.cookies.set("rockgpt_reset_verified", resetVerifiedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(Date.now() + 15 * 60 * 1000),
    });

    response.cookies.delete(OTP_COOKIE_NAME);

    return response;
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
