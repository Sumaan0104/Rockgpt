import { NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE_NAME, OTP_COOKIE_NAME, createSignedSessionTokenForUser } from "@/lib/auth";
import { globalStore } from "@/lib/store";
import { proxyAuthRequest } from "@/lib/backend-auth";
import { generateUUID } from "@/lib/utils";

const verifySchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  code: z.string().trim().regex(/^\d{6}$/, "Verification code must be exactly 6 digits"),
  type: z.enum(["signup", "reset"]).default("signup"),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { email, code, type } = verifySchema.parse(json);
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Verify code against persistent authentication provider
    if (type === "signup") {
      const backendResult = await proxyAuthRequest("verify", {
        email: normalizedEmail,
        code,
      });

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
          message: "Account verified successfully! Welcome to RockGPT.",
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

        response.cookies.delete(OTP_COOKIE_NAME);
        return response;
      }

      return NextResponse.json(
        { error: { code: "verification_failed", message: backendResult.data?.error || "Incorrect or expired verification code." } },
        { status: backendResult.status || 400 }
      );
    }

    // Reset password code verification
    const resetResult = await proxyAuthRequest("resend-otp", {
      email: normalizedEmail,
      type: "reset",
    });

    return NextResponse.json(
      { error: { code: "invalid_request", message: "Invalid verification type." } },
      { status: 400 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid verification code" } },
        { status: 400 }
      );
    }
    console.error("OTP verification error:", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Verification failed. Please try again." } },
      { status: 500 }
    );
  }
}
