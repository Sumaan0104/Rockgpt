import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend-auth";

export async function POST(request: Request) {
  try {
    const adminKey =
      request.headers.get("x-admin-key") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";

    let bodyJson = {};
    try {
      bodyJson = await request.json();
    } catch {
      bodyJson = {};
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (adminKey) {
      headers["x-admin-key"] = adminKey;
    }

    const backendRes = await fetch(`${BACKEND_URL}/api/admin/send-daily-digest`, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyJson),
      signal: AbortSignal.timeout(60000), // Allow up to 60s for batch dispatches
    });

    const data = await backendRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err: any) {
    console.error("[Next.js Admin Digest Proxy Error]:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Failed to communicate with RockGPT backend" },
      { status: 502 }
    );
  }
}
