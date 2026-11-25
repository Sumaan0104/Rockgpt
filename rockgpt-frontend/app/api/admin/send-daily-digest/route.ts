import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend-auth";
import { sanitizePayload } from "@/lib/security";

export async function POST(request: Request) {
  try {
    const adminKey =
      request.headers.get("x-admin-key") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";

    let bodyJson = {};
    try {
      const raw = await request.json();
      bodyJson = sanitizePayload(raw);
    } catch {
      bodyJson = {};
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (adminKey) {
      headers["x-admin-key"] = adminKey;
    }

    const backendUrl = await getBackendUrl();
    const backendRes = await fetch(`${backendUrl}/api/admin/send-daily-digest`, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyJson),
      signal: AbortSignal.timeout(60_000),
    });

    const data = await backendRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: backendRes.status });
  } catch {
    return NextResponse.json(
      { error: "Failed to communicate with RockGPT backend" },
      { status: 502 }
    );
  }
}
