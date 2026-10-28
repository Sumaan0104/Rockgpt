import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { globalStore } from "@/lib/store";

const patchChatSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  project_id: z.string().uuid().nullable().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  let chat = globalStore.getChat(id);

  if (!chat) {
    // Return empty placeholder chat if not found
    chat = {
      id,
      user_id: user.id,
      title: "Conversation",
      mode: "chat",
      project_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
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
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const chat = globalStore.getChat(id);

  if (!chat) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Chat not found" } },
      { status: 404 }
    );
  }

  try {
    const json = await request.json();
    const parsed = patchChatSchema.parse(json);

    if (parsed.title !== undefined) chat.title = parsed.title;
    if (parsed.project_id !== undefined) chat.project_id = parsed.project_id;
    chat.updated_at = new Date();

    return NextResponse.json({ chat });
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
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  globalStore.deleteChat(id);
  return NextResponse.json({ success: true });
}
