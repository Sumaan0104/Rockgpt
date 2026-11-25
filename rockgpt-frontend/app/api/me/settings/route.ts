import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { proxyBackendRequest } from "@/lib/backend-auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const backendResult = await proxyBackendRequest("/api/me/settings", {
    method: "GET",
    user,
  });

  if (backendResult.ok) {
    return NextResponse.json(backendResult.data);
  }

  return NextResponse.json({
    settings: {
      instructions: "",
      fast: false,
      textSize: "m",
    },
  });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const backendResult = await proxyBackendRequest("/api/me/settings", {
      method: "PUT",
      user,
      body,
    });

    if (backendResult.ok) {
      return NextResponse.json(backendResult.data);
    }

    return NextResponse.json(
      { error: { code: "save_failed", message: "Failed to save settings" } },
      { status: backendResult.status || 500 }
    );
  } catch {
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to update settings" } },
      { status: 500 }
    );
  }
}
