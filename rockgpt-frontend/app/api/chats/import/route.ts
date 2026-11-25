import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { proxyBackendRequest } from "@/lib/backend-auth";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  try {
    const json = await request.json().catch(() => ({}));
    const chats = Array.isArray(json.chats) ? json.chats : [];

    const backendResult = await proxyBackendRequest("/api/chats/import", {
      method: "POST",
      user,
      body: { chats },
    });

    if (backendResult.ok) {
      return NextResponse.json(backendResult.data);
    }

    return NextResponse.json(
      { error: { code: "import_failed", message: "Failed to import chats" } },
      { status: backendResult.status || 500 }
    );
  } catch {
    return NextResponse.json(
      { error: { code: "server_error", message: "Import failed" } },
      { status: 500 }
    );
  }
}
