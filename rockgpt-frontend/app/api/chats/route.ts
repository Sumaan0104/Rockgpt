import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { globalStore, type StoredChat, type StoredMessage } from "@/lib/store";
import { proxyBackendRequest } from "@/lib/backend-auth";
import { generateUUID } from "@/lib/utils";
import { getClientIp } from "@/lib/security";

const createChatSchema = z.object({
  title: z.string().trim().min(1).max(120).optional().default("New chat"),
  project_id: z.string().uuid().nullable().optional(),
  mode: z.enum(["chat", "deep"]).optional().default("chat"),
  id: z.string().optional(),
});

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || user.email.startsWith("guest-")) {
    return NextResponse.json({
      chats: [],
      nextCursor: null,
    });
  }

  const urlObj = new URL(request.url);
  const q = urlObj.searchParams.get("q") || "";
  const limit = urlObj.searchParams.get("limit") || "50";
  const cursor = urlObj.searchParams.get("cursor") || "";

  const qs = new URLSearchParams();
  if (limit) qs.set("limit", limit);
  if (cursor) qs.set("cursor", cursor);
  if (q) qs.set("q", q);

  // 1. Fetch from persistent MongoDB database via Backend
  const clientIp = getClientIp(request);
  const backendResult = await proxyBackendRequest(`/api/chats?${qs.toString()}`, {
    method: "GET",
    user,
    clientIp,
  });

  if (backendResult.ok && Array.isArray(backendResult.data)) {
    const backendChats = backendResult.data.map((c: any) => ({
      id: c.id || c._id,
      title: c.title || "Untitled Conversation",
      pinned: Boolean(c.pinned),
      lastMessageAt: c.lastMessageAt || c.updatedAt || c.createdAt,
      project_id: null,
      mode: "chat",
      created_at: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
      updated_at: c.updatedAt ? new Date(c.updatedAt).toISOString() : new Date().toISOString(),
    }));

    // Synchronize to local memory store when unfiltered
    if (!q) {
      backendChats.forEach((c: any) => {
        globalStore.saveChat({
          id: c.id,
          user_id: user.id,
          title: c.title,
          project_id: null,
          mode: "chat",
          created_at: new Date(c.created_at),
          updated_at: new Date(c.updated_at),
        });
      });
    }

    return NextResponse.json({
      chats: backendChats,
      nextCursor: null,
    });
  }

  if (backendResult.status === 401) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Session expired. Please sign in again." } },
      { status: 401 }
    );
  }

  // 2. Fallback to strict owner-scoped local store ONLY if backend is unreachable (503)
  if (backendResult.status !== 503) {
    return NextResponse.json(
      { error: { code: "backend_error", message: backendResult.data?.error || "Failed to load chats." } },
      { status: backendResult.status || 502 }
    );
  }
  const qLower = q.trim().toLowerCase();
  const userChats = globalStore.getChats(user.id).filter((c: StoredChat) => {
    if (!qLower) return true;
    if (c.title.toLowerCase().includes(qLower)) return true;
    return globalStore.getMessages(c.id).some((m: StoredMessage) => (m.content || "").toLowerCase().includes(qLower));
  });

  return NextResponse.json({
    chats: userChats.map((c: StoredChat) => ({
      id: c.id,
      title: c.title,
      pinned: Boolean((c as any).pinned),
      project_id: c.project_id ?? null,
      mode: c.mode,
      created_at: c.created_at.toISOString(),
      updated_at: c.updated_at.toISOString(),
    })),
    nextCursor: null,
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser(true);
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  try {
    const json = await request.json().catch(() => ({}));
    const { title, project_id, mode, id } = createChatSchema.parse(json);

    let chatId = id || generateUUID();

    if (!user.email.startsWith("guest-")) {
      const backendResult = await proxyBackendRequest("/api/chats", {
        method: "POST",
        body: { title, id: chatId },
        user,
      });
      if (backendResult.ok && (backendResult.data?.id || backendResult.data?._id)) {
        chatId = backendResult.data.id || backendResult.data._id;
      }
    }

    const newChat = globalStore.saveChat({
      id: chatId,
      user_id: user.id,
      title,
      project_id: project_id ?? null,
      mode,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return NextResponse.json({ chat: newChat }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid input" } },
        { status: 400 }
      );
    }
    console.error("Create chat error:", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to create chat" } },
      { status: 500 }
    );
  }
}
