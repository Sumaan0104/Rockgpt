import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, createSignedSessionTokenForUser } from "@/lib/auth";
import { globalStore, type StoredUser } from "@/lib/store";
import { proxyAuthRequest } from "@/lib/backend-auth";
import { generateUUID } from "@/lib/utils";
import { OAUTH_STATE_COOKIE } from "../route";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  const appUrl = process.env.APP_URL || (host ? `${proto}://${host}` : "https://rockgpt-ten.vercel.app");

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // 1. Handle OAuth cancellation and denied permissions
  if (error) {
    console.warn("Google OAuth callback returned error:", error, errorDescription);
    if (error === "access_denied") {
      return NextResponse.redirect(`${appUrl}?error=google_cancelled`);
    }
    return NextResponse.redirect(`${appUrl}?error=google_${encodeURIComponent(error)}`);
  }

  // 2. CSRF State Validation
  const cookieStore = await cookies();
  const storedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;

  if (!state || !storedState || state !== storedState) {
    console.error("OAuth state mismatch. Possible CSRF attack detected.");
    return NextResponse.redirect(`${appUrl}?error=invalid_oauth_state`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Google OAuth client ID or secret is not configured in environment variables.");
    return NextResponse.redirect(`${appUrl}?error=google_not_configured`);
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}?error=missing_auth_code`);
  }

  try {
    const redirectUri = `${appUrl}/api/auth/google/callback`;

    // 3. Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("Google token exchange error:", tokenRes.status, errBody);
      return NextResponse.redirect(`${appUrl}?error=token_exchange_failed`);
    }

    const tokenData = await tokenRes.json();

    // 4. Fetch user identity using the access token
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      console.error("Google userinfo fetch failed:", userRes.status);
      return NextResponse.redirect(`${appUrl}?error=user_info_failed`);
    }

    const googleUser = await userRes.json();

    // 5. Verify email ownership and verified status from Google
    const isVerified = googleUser.verified_email === true || googleUser.email_verified === true;
    if (!isVerified) {
      console.error("Google account email is unverified:", googleUser.email);
      return NextResponse.redirect(`${appUrl}?error=unverified_google_email`);
    }

    const normalizedEmail = (googleUser.email || "").toLowerCase().trim();
    if (!normalizedEmail) {
      return NextResponse.redirect(`${appUrl}?error=no_email_provided`);
    }

    // 6. Secure user retrieval or creation
    let userRecord = globalStore.getUserByEmail(normalizedEmail);
    if (!userRecord) {
      userRecord = {
        id: generateUUID(),
        email: normalizedEmail,
        name: googleUser.name || normalizedEmail.split("@")[0],
        password_hash: null,
        avatar_url: googleUser.picture || "https://lh3.googleusercontent.com/a/default-user",
        theme: "dark",
        created_at: new Date(),
      };
      globalStore.saveUser(userRecord);
    } else if (googleUser.picture && userRecord.avatar_url !== googleUser.picture) {
      userRecord.avatar_url = googleUser.picture;
      globalStore.saveUser(userRecord);
    }

    // Forward sync to backend provider if available
    try {
      await proxyAuthRequest("google", {
        code,
        idToken: tokenData.id_token,
      });
    } catch {
      // Non-blocking sync
    }

    // 7. Issue signed session cookie
    const sessionToken = createSignedSessionTokenForUser(userRecord);
    globalStore.createSession(userRecord.id);

    const response = NextResponse.redirect(`${appUrl}?auth=google_success`);

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    // Clean up CSRF state cookie
    response.cookies.delete(OAUTH_STATE_COOKIE);

    return response;
  } catch (err) {
    console.error("Google OAuth callback exception:", err);
    return NextResponse.redirect(`${appUrl}?error=server_error`);
  }
}
