import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { globalStore } from "@/lib/store";
import { generateUUID } from "@/lib/utils";

const createChatSchema = z.object({
  title: z.string().trim().min(1).max(120).optional().default("New chat"),
  project_id: z.string().uuid().nullable().optional(),
  mode: z.enum(["chat", "deep"]).optional().default("chat"),
});

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

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
    const { title, project_id, mode } = createChatSchema.parse(json);

    const newChat = globalStore.saveChat({
      id: generateUUID(),
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
