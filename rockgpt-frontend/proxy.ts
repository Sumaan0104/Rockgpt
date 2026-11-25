import { type NextRequest, NextResponse } from "next/server";
import { getCorsOriginHeader, isTrustedOrigin, SECURITY_HEADERS } from "@/lib/security";

function buildCspHeader(): string {
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://accounts.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://rockgpt.onrender.com https://generativelanguage.googleapis.com https://api.groq.com https://image.pollinations.ai https://accounts.google.com https://oauth2.googleapis.com https://vitals.vercel-insights.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
  ];
  return directives.join("; ");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const method = request.method.toUpperCase();

  if (isApi) {
    const corsOrigin = getCorsOriginHeader(request);

    // Handle preflight strictly against trusted origins only
    if (method === "OPTIONS") {
      if (request.headers.get("origin") && !corsOrigin) {
        return new NextResponse(null, { status: 403, headers: SECURITY_HEADERS });
      }
      const preflightHeaders = new Headers(SECURITY_HEADERS);
      if (corsOrigin) {
        preflightHeaders.set("Access-Control-Allow-Origin", corsOrigin);
        preflightHeaders.set("Access-Control-Allow-Credentials", "true");
        preflightHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        preflightHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Key");
        preflightHeaders.set("Vary", "Origin");
      }
      return new NextResponse(null, { status: 204, headers: preflightHeaders });
    }

    // CSRF Origin verification for state-changing API routes
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && !isTrustedOrigin(request)) {
      return NextResponse.json(
        { error: { code: "forbidden_origin", message: "Cross-origin request rejected." } },
        { status: 403, headers: SECURITY_HEADERS }
      );
    }

    const res = NextResponse.next();
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
      res.headers.set(k, v);
    }
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    if (corsOrigin) {
      res.headers.set("Access-Control-Allow-Origin", corsOrigin);
      res.headers.set("Access-Control-Allow-Credentials", "true");
      res.headers.set("Vary", "Origin");
    }
    return res;
  }

  const res = NextResponse.next();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(k, v);
  }
  res.headers.set("Content-Security-Policy", buildCspHeader());
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
