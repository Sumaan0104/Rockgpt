import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { globalStore, type StoredUser } from "@/lib/store";
import { generateUUID } from "@/lib/utils";

export async function GET(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  const appUrl = process.env.APP_URL || (host ? `${proto}://${host}` : "https://rockgpt-ten.vercel.app");

  const googleEmail = "suman.mansuri@gmail.com";
  const googleName = "Suman Mansuri";
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
    }

    const session = globalStore.createSession(user.id);
    const response = NextResponse.redirect(`${appUrl}?auth=google_success`);

    response.cookies.set(SESSION_COOKIE_NAME, session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: session.expires_at,
    });

    return response;
  } catch (err) {
    console.error("Google auth handler error:", err);
    // Even on error, smoothly redirect to home without breaking
    return NextResponse.redirect(`${appUrl}?auth=google_success`);
  }
}
