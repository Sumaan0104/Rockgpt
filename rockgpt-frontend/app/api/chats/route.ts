import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { globalStore } from "@/lib/store";
import { proxyBackendRequest } from "@/lib/backend-auth";
import { generateUUID } from "@/lib/utils";

const createChatSchema = z.object({
  title: z.string().trim().min(1).max(120).optional().default("New chat"),
  project_id: z.string().uuid().nullable().optional(),
  mode: z.enum(["chat", "deep"]).optional().default("chat"),
  id: z.string().optional(),
});

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  // 1. Fetch from persistent MongoDB database via Render backend
  const backendResult = await proxyBackendRequest("/api/chats", {
    method: "GET",
    user,
  });

  if (backendResult.ok && Array.isArray(backendResult.data)) {
    const backendChats = backendResult.data.map((c: any) => ({
      id: c.id || c._id,
      title: c.title || "Untitled Conversation",
      project_id: null,
      mode: "chat",
      created_at: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
      updated_at: c.updatedAt ? new Date(c.updatedAt).toISOString() : new Date().toISOString(),
    }));

    // Synchronize to local memory store
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

    return NextResponse.json({
      chats: backendChats,
      nextCursor: null,
    });
  }

  // 2. Fallback to local store if backend is offline/sleeping
  const userChats = globalStore.getChats(user.id);

  return NextResponse.json({
    chats: userChats.map(c => ({
      id: c.id,
      title: c.title,
      project_id: c.project_id ?? null,
      mode: c.mode,
      created_at: c.created_at.toISOString(),
      updated_at: c.updated_at.toISOString(),
    })),
    nextCursor: null,
  });
}

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
    const { title, project_id, mode, id } = createChatSchema.parse(json);

    // 1. Create in persistent MongoDB database via Render backend
    const backendResult = await proxyBackendRequest("/api/chats", {
      method: "POST",
      body: { title, id },
      user,
    });

    const chatId = (backendResult.ok && (backendResult.data?.id || backendResult.data?._id))
      ? (backendResult.data.id || backendResult.data._id)
      : (id || generateUUID());

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
