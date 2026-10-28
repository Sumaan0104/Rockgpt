import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createSession } from "@/lib/auth";
import { users } from "@/lib/db/schema";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  const appUrl = process.env.APP_URL || (host ? `${proto}://${host}` : "https://rockgpt-ten.vercel.app");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!code || !clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}?error=google_auth_failed`);
  }

  try {
    const redirectUri = `${appUrl}/api/auth/google/callback`;
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
      return NextResponse.redirect(`${appUrl}?error=token_exchange_failed`);
    }

    const tokenData = await tokenRes.json();
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(`${appUrl}?error=user_info_failed`);
    }

    const googleUser = await userRes.json();
    const normalizedEmail = (googleUser.email || "").toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.redirect(`${appUrl}?error=no_email_provided`);
    }

    let [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!existingUser) {
      [existingUser] = await db
        .insert(users)
        .values({
          email: normalizedEmail,
          name: googleUser.name || "Google User",
          avatar_url: googleUser.picture,
          theme: "dark",
        })
        .returning();
    } else if (!existingUser.avatar_url && googleUser.picture) {
      await db
        .update(users)
        .set({ avatar_url: googleUser.picture })
        .where(eq(users.id, existingUser.id));
    }

    await createSession(existingUser.id);
    return NextResponse.redirect(appUrl);
  } catch (err) {
    console.error("Google callback error:", err);
    return NextResponse.redirect(`${appUrl}?error=server_error`);
  }
}
