import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { proxyBackendRequest } from "@/lib/backend-auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(false);
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { id } = await params;

  // Restore chat in MongoDB Atlas via Backend
  const backendResult = await proxyBackendRequest(`/api/chats/${id}/restore`, {
    method: "POST",
    user,
  });

  if (backendResult.ok) {
    return NextResponse.json({ ok: true, message: "Chat restored", chat: backendResult.data?.chat });
  }

  return NextResponse.json(
    { error: { code: "restore_failed", message: "Failed to restore chat" } },
    { status: backendResult.status || 500 }
  );
}
