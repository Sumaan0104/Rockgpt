import { NextResponse } from "next/server";
import { destroySession, getSessionUser, SESSION_COOKIE_NAME } from "@/lib/auth";
import { proxyBackendRequest } from "@/lib/backend-auth";

export async function POST() {
  const user = await getSessionUser();
  if (user && !user.email.startsWith("guest-")) {
    await proxyBackendRequest("/api/auth/logout", {
      method: "POST",
      user,
      timeoutMs: 5000,
    }).catch(() => {});
  }
  await destroySession();
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}
