import { NextResponse } from "next/server";
import crypto from "crypto";
import { checkRateLimit, SESSION_COOKIE_NAME, createSignedSessionTokenForUser } from "@/lib/auth";
import { globalStore, type StoredUser } from "@/lib/store";
import { proxyAuthRequest } from "@/lib/backend-auth";
import { generateUUID } from "@/lib/utils";
import { getClientIp, sanitizePayload } from "@/lib/security";

export const OAUTH_STATE_COOKIE = "rockgpt_oauth_state";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  const appUrl = process.env.APP_URL || (host ? `${proto}://${host}` : "https://rockgpt-ten.vercel.app");

  const clientId = (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.VITE_GOOGLE_CLIENT_ID ||
    ""
  ).trim();

  if (searchParams.get("mode") === "config") {
    return NextResponse.json({
      configured: Boolean(clientId),
      clientId: clientId || null,
    });
  }

  if (!clientId) {
    console.warn("Google OAuth Client ID is not configured.");
    return NextResponse.redirect(`${appUrl}?error=google_not_configured`);
  }

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
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return response;
}

function isMatchingGoogleProject(audOrAzp: string | undefined, configuredClientId: string): boolean {
  if (!configuredClientId) return true;
  if (!audOrAzp) return false;
  if (audOrAzp === configuredClientId) return true;
  const dashIdx = configuredClientId.indexOf("-");
  const prefix = dashIdx > 0 ? configuredClientId.slice(0, dashIdx + 1) : "";
  return Boolean(prefix && audOrAzp.startsWith(prefix));
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`google:${ip}`, 20, 15 * 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many Google authentication requests." } },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
    );
  }

  try {
    const rawBody = await request.json();
    const body = sanitizePayload(rawBody);
    const { code, credential, idToken, accessToken, redirectUri } = body;
    const tokenToVerify = credential || idToken;
    const configuredClientId = (
      process.env.GOOGLE_CLIENT_ID ||
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      process.env.VITE_GOOGLE_CLIENT_ID ||
      ""
    ).trim();

    if (accessToken && typeof accessToken === "string") {
      const [tokenInfoRes, userInfoRes] = await Promise.all([
        fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`),
        fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      const tokenInfo = await tokenInfoRes.json().catch(() => ({}));
      const userInfo = await userInfoRes.json().catch(() => ({}));

      if (!tokenInfoRes.ok || tokenInfo.error || !userInfoRes.ok || !userInfo?.email) {
        return NextResponse.json(
          { error: { code: "invalid_token", message: "Google sign-in token could not be verified. Please try again." } },
          { status: 401 }
        );
      }

      if (!isMatchingGoogleProject(tokenInfo.aud || tokenInfo.azp, configuredClientId)) {
        return NextResponse.json(
          { error: { code: "invalid_audience", message: "Google token audience mismatch." } },
          { status: 401 }
        );
      }

      const emailVerified =
        userInfo.email_verified === true ||
        userInfo.email_verified === "true" ||
        tokenInfo.email_verified === true ||
        tokenInfo.email_verified === "true";

      if (!emailVerified) {
        return NextResponse.json(
          { error: { code: "unverified_email", message: "Google account email is not verified." } },
          { status: 403 }
        );
      }

      const verifiedEmail = String(userInfo.email).toLowerCase().trim();
      const bRes = await proxyAuthRequest("google", { accessToken }, 25_000, ip);

      if (!bRes.ok && bRes.status !== 503) {
        return NextResponse.json(
          {
            error: {
              code: "google_auth_failed",
              message: bRes.data?.error || "Could not complete Google authentication on server.",
            },
          },
          { status: bRes.status || 400 }
        );
      }

      const bUser = bRes.ok ? bRes.data?.user : null;
      const userRecord: StoredUser = {
        id: bUser?.id || generateUUID(),
        email: (bUser?.email || verifiedEmail).toLowerCase().trim(),
        name: bUser?.name || userInfo.name || verifiedEmail.split("@")[0],
        password_hash: null,
        avatar_url: userInfo.picture || "https://lh3.googleusercontent.com/a/default-user",
        theme: "dark",
        created_at: new Date(),
        backend_token: bRes.ok ? bRes.data?.token || null : null,
        backend_refresh_token: bRes.ok ? bRes.data?.refreshToken || null : null,
      };
      globalStore.saveUser(userRecord);

      const sessionToken = createSignedSessionTokenForUser(userRecord);
      globalStore.createSession(userRecord.id);

      const response = NextResponse.json({
        success: true,
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
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      return response;
    }

    if (tokenToVerify) {
      const verifyRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenToVerify)}`
      );
      if (!verifyRes.ok) {
        return NextResponse.json(
          { error: { code: "invalid_token", message: "Google ID token validation failed." } },
          { status: 401 }
        );
      }

      const tokenData = await verifyRes.json();

      if (!isMatchingGoogleProject(tokenData.aud || tokenData.azp, configuredClientId)) {
        return NextResponse.json(
          { error: { code: "invalid_audience", message: "Google token audience mismatch." } },
          { status: 401 }
        );
      }

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

      // Sync to backend MongoDB user record when reachable
      const bRes = await proxyAuthRequest("google", { idToken: tokenToVerify }, 25_000, ip);
      if (!bRes.ok && bRes.status !== 503) {
        return NextResponse.json(
          {
            error: {
              code: "google_auth_failed",
              message: bRes.data?.error || "Could not complete Google authentication on server.",
            },
          },
          { status: bRes.status || 400 }
        );
      }
      const userRecord: StoredUser = {
        id: bRes.ok && bRes.data?.user?.id ? bRes.data.user.id : generateUUID(),
        email: verifiedEmail,
        name: bRes.data?.user?.name || tokenData.name || verifiedEmail.split("@")[0],
        password_hash: null,
        avatar_url: tokenData.picture || "https://lh3.googleusercontent.com/a/default-user",
        theme: "dark",
        created_at: new Date(),
        backend_token: bRes.ok ? bRes.data?.token || null : null,
        backend_refresh_token: bRes.ok ? bRes.data?.refreshToken || null : null,
      };
      globalStore.saveUser(userRecord);

      const sessionToken = createSignedSessionTokenForUser(userRecord);
      globalStore.createSession(userRecord.id);

      const response = NextResponse.json({
        success: true,
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
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      return response;
    }

    if (code) {
      // If frontend has client secret, exchange directly first so any Google OAuth client works reliably
      const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
      if (clientSecret && configuredClientId) {
        const tokenExchange = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: configuredClientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri || "postmessage",
            grant_type: "authorization_code",
          }),
        });
        const exchanged = await tokenExchange.json().catch(() => ({}));
        if (exchanged.access_token || exchanged.id_token) {
          const syncRes = await proxyAuthRequest(
            "google",
            {
              ...(exchanged.access_token ? { accessToken: exchanged.access_token } : {}),
              ...(exchanged.id_token ? { idToken: exchanged.id_token } : {}),
            },
            25_000,
            ip
          );
          if (syncRes.ok && syncRes.data?.user) {
            const bUser = syncRes.data.user;
            const userRecord: StoredUser = {
              id: bUser.id || generateUUID(),
              email: bUser.email.toLowerCase().trim(),
              name: bUser.name || "Google User",
              password_hash: null,
              avatar_url: bUser.avatar_url || bUser.picture || "https://lh3.googleusercontent.com/a/default-user",
              theme: "dark",
              created_at: new Date(),
              backend_token: syncRes.data.token || null,
              backend_refresh_token: syncRes.data.refreshToken || null,
            };
            globalStore.saveUser(userRecord);
            const sessionToken = createSignedSessionTokenForUser(userRecord);
            globalStore.createSession(userRecord.id);
            const response = NextResponse.json({
              success: true,
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
              expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            });
            return response;
          }
        }
      }

      const backendPayload = redirectUri ? { code, redirectUri } : { code };
      const backendRes = await proxyAuthRequest("google", backendPayload, 25_000, ip);
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
          backend_token: backendRes.data.token || null,
          backend_refresh_token: backendRes.data.refreshToken || null,
        };

        globalStore.saveUser(userRecord);
        const sessionToken = createSignedSessionTokenForUser(userRecord);
        globalStore.createSession(userRecord.id);

        const response = NextResponse.json({
          success: true,
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
          expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        return response;
      }

      return NextResponse.json(
        {
          error: {
            code: "google_auth_failed",
            message: backendRes.data?.error || "Google authentication could not be completed. Please try again.",
          },
        },
        { status: backendRes.status || 400 }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "missing_credentials",
          message: "Real Google authorization code or cryptographic ID token is required.",
        },
      },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("Google auth POST error:", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Google authentication failed" } },
      { status: 500 }
    );
  }
}
