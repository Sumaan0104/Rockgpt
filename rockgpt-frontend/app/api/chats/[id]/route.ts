import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { globalStore } from "@/lib/store";
import { proxyBackendRequest } from "@/lib/backend-auth";

const patchChatSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  project_id: z.string().uuid().nullable().optional(),
});

export async function GET(
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

  // 1. Fetch from persistent MongoDB Atlas via Render Backend
  const backendResult = await proxyBackendRequest(`/api/chats/${id}`, {
    method: "GET",
    user,
  });

  if (backendResult.ok && backendResult.data) {
    const data = backendResult.data;
    const chat = {
      id: data.id || data._id || id,
      title: data.title || "Untitled Conversation",
      user_id: user.id,
      project_id: null,
      mode: "chat" as const,
      created_at: data.createdAt ? new Date(data.createdAt) : new Date(),
      updated_at: data.updatedAt ? new Date(data.updatedAt) : new Date(),
    };
    const messages = (data.messages || []).map((m: any) => ({
      id: m.id || m._id,
      chat_id: id,
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      created_at: m.createdAt ? new Date(m.createdAt) : new Date(),
    }));

    // Cache locally
    globalStore.saveChat(chat);
    messages.forEach((m: any) => globalStore.saveMessage(m));

    return NextResponse.json({
      chat,
      messages,
    });
  }

  // 2. Fallback to local store if backend is sleeping or offline
  const chat = globalStore.getChat(id);
  if (!chat) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Chat not found" } },
      { status: 404 }
    );
  }

  if (chat.user_id !== user.id) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "You do not have permission to access this chat" } },
      { status: 403 }
    );
  }

  const chatMessages = globalStore.getMessages(id);
  return NextResponse.json({
    chat,
    messages: chatMessages,
  });
}

export async function PATCH(
  request: Request,
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

  try {
    const json = await request.json().catch(() => ({}));
    const parsed = patchChatSchema.parse(json);

    // 1. Rename in persistent MongoDB Atlas via Render Backend
    if (parsed.title) {
      await proxyBackendRequest(`/api/chats/${id}`, {
        method: "PATCH",
        body: { title: parsed.title },
        user,
      });
    }

    const chat = globalStore.getChat(id);
    if (chat) {
      if (parsed.title !== undefined) chat.title = parsed.title;
      if (parsed.project_id !== undefined) chat.project_id = parsed.project_id;
      chat.updated_at = new Date();
    }

    return NextResponse.json({
      chat: chat || { id, title: parsed.title || "Renamed chat" },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid input" } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to update chat" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

  // Delete from persistent MongoDB Atlas via Render Backend
  await proxyBackendRequest(`/api/chats/${id}`, {
    method: "DELETE",
    user,
  });

  globalStore.deleteChat(id);
  return NextResponse.json({ success: true, message: "Chat deleted successfully." });
}
