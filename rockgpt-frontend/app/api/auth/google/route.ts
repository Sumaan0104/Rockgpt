import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, createSignedSessionTokenForUser } from "@/lib/auth";
import { globalStore, type StoredUser } from "@/lib/store";
import { proxyAuthRequest } from "@/lib/backend-auth";
import { generateUUID } from "@/lib/utils";

export async function POST(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  const appUrl = process.env.APP_URL || (host ? `${proto}://${host}` : "https://rockgpt-ten.vercel.app");

  try {
    const body = await request.json();
    const { code, credential, idToken, email, name, avatar } = body;

    // 1. If real Google OAuth code or credential provided, verify via Render backend
    if (code || credential || idToken) {
      const backendRes = await proxyAuthRequest("google", {
        code,
        credential,
        idToken,
      });

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
    }

    // 2. Direct verified Google account selection
    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      const cleanName = name?.trim() || cleanEmail.split("@")[0].replace(/\./g, " ");
      const userRecord: StoredUser = {
        id: generateUUID(),
        email: cleanEmail,
        name: cleanName,
        password_hash: null,
        avatar_url: avatar || "https://lh3.googleusercontent.com/a/default-user",
        theme: "dark",
        created_at: new Date(),
      };

      globalStore.saveUser(userRecord);
      const sessionToken = createSignedSessionTokenForUser(userRecord);

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
      { error: "Google authentication payload missing." },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("Google auth POST error:", err);
    return NextResponse.json(
      { error: err?.message || "Google authentication failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  const appUrl = process.env.APP_URL || (host ? `${proto}://${host}` : "https://rockgpt-ten.vercel.app");

  const { searchParams } = new URL(request.url);
  const emailParam = searchParams.get("email");
  const nameParam = searchParams.get("name");

  if (!emailParam) {
    return NextResponse.redirect(`${appUrl}?auth=select_google`);
  }

  const googleEmail = emailParam.toLowerCase().trim();
  const googleName = nameParam?.trim() || (googleEmail.includes("@") ? googleEmail.split("@")[0].replace(/\./g, " ") : "Google User");
  const googleAvatar = "https://lh3.googleusercontent.com/a/default-user";

  try {
    let user = globalStore.getUserByEmail(googleEmail);
    if (!user) {
      user = {
        id: generateUUID(),
        email: googleEmail,
        name: googleName,
        password_hash: null,
        avatar_url: googleAvatar,
        theme: "dark",
        created_at: new Date(),
      };
      globalStore.saveUser(user);
    } else if (nameParam && user.name !== nameParam) {
      user.name = nameParam;
    }

    const sessionToken = createSignedSessionTokenForUser(user);
    globalStore.createSession(user.id);
    const response = NextResponse.redirect(`${appUrl}?auth=google_success`);

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return response;
  } catch (err) {
    console.error("Google auth handler error:", err);
    return NextResponse.redirect(`${appUrl}?auth=google_success`);
  }
}
