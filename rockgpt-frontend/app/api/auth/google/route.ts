import { NextResponse } from "next/server";
import crypto from "crypto";
import { SESSION_COOKIE_NAME, createSignedSessionTokenForUser } from "@/lib/auth";
import { globalStore, type StoredUser } from "@/lib/store";
import { proxyAuthRequest } from "@/lib/backend-auth";
import { generateUUID } from "@/lib/utils";

export const OAUTH_STATE_COOKIE = "rockgpt_oauth_state";

export async function GET(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  const appUrl = process.env.APP_URL || (host ? `${proto}://${host}` : "https://rockgpt-ten.vercel.app");

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    console.warn("Google OAuth Client ID is not configured.");
    return NextResponse.redirect(`${appUrl}?error=google_not_configured`);
  }

  // Generate cryptographic CSRF state token
  const state = crypto.randomBytes(24).toString("hex");
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("access_type", "offline");
  googleAuthUrl.searchParams.set("prompt", "select_account");
  googleAuthUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(googleAuthUrl.toString());

  // Store CSRF state in secure HTTP-only cookie
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  return response;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, credential, idToken } = body;

    const tokenToVerify = credential || idToken;

    // 1. If Google ID Token provided (Google One Tap / Identity Services)
    if (tokenToVerify) {
      const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenToVerify)}`);
      if (!verifyRes.ok) {
        return NextResponse.json(
          { error: { code: "invalid_token", message: "Google ID token validation failed." } },
          { status: 401 }
        );
      }

      const tokenData = await verifyRes.json();

      // Check email verification status from Google
      if (tokenData.email_verified !== "true" && tokenData.email_verified !== true) {
        return NextResponse.json(
          { error: { code: "unverified_email", message: "Google account email is not verified." } },
          { status: 403 }
        );
      }

      const verifiedEmail = (tokenData.email || "").toLowerCase().trim();
      if (!verifiedEmail) {
        return NextResponse.json(
          { error: { code: "missing_email", message: "No email address associated with Google account." } },
          { status: 400 }
        );
      }

      let user = globalStore.getUserByEmail(verifiedEmail);
      if (!user) {
        user = {
          id: generateUUID(),
          email: verifiedEmail,
          name: tokenData.name || verifiedEmail.split("@")[0],
          password_hash: null,
          avatar_url: tokenData.picture || "https://lh3.googleusercontent.com/a/default-user",
          theme: "dark",
          created_at: new Date(),
        };
        globalStore.saveUser(user);
      }

      const sessionToken = createSignedSessionTokenForUser(user);
      globalStore.createSession(user.id);

      const response = NextResponse.json({
        success: true,
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

      return response;
    }

    // 2. If OAuth authorization code provided
    if (code) {
      const backendRes = await proxyAuthRequest("google", { code });
      if (backendRes.ok && backendRes.data?.user) {
        const bUser = backendRes.data.user;
        const userRecord: StoredUser = {
          id: bUser.id || generateUUID(),
          email: bUser.email.toLowerCase().trim(),
          name: bUser.name || "Google User",
          password_hash: null,
          avatar_url: bUser.avatar_url || bUser.picture || "https://lh3.googleusercontent.com/a/default-user",
          theme: "dark",
          created_at: new Date(),
        };

        globalStore.saveUser(userRecord);
        const sessionToken = createSignedSessionTokenForUser(userRecord);
        globalStore.createSession(userRecord.id);

        const response = NextResponse.json({
          success: true,
          user: userRecord,
        });

        response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });

        return response;
      }

      return NextResponse.json(
        { error: { code: "google_auth_failed", message: backendRes.data?.error || "Google authorization code verification failed." } },
        { status: backendRes.status || 400 }
      );
    }

    // Reject any request without real cryptographic token or authorization code
    return NextResponse.json(
      { error: { code: "missing_credentials", message: "Real Google authorization code or cryptographic ID token is required." } },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("Google auth POST error:", err);
    return NextResponse.json(
      { error: { code: "server_error", message: err?.message || "Google authentication failed" } },
      { status: 500 }
    );
  }
}
