import { NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getSessionUser } from "@/lib/auth";
import { chats, messages } from "@/lib/db/schema";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

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

  const [chat] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, id), eq(chats.user_id, user.id)))
    .limit(1);

  if (!chat) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Chat not found" } },
      { status: 404 }
    );
  }

  const chatMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.chat_id, id))
    .orderBy(asc(messages.created_at));

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

  const [chat] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, id), eq(chats.user_id, user.id)))
    .limit(1);

  if (!chat) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Chat not found" } },
      { status: 404 }
    );
  }

  try {
    const json = await request.json();
    const parsed = patchChatSchema.parse(json);

    const updateData: Partial<typeof chats.$inferInsert> = {
      updated_at: new Date(),
    };
    if (parsed.title !== undefined) updateData.title = parsed.title;
    if (parsed.project_id !== undefined) updateData.project_id = parsed.project_id;

    await db.update(chats).set(updateData).where(eq(chats.id, id));

    const [updatedChat] = await db
      .select()
      .from(chats)
      .where(eq(chats.id, id))
      .limit(1);

    return NextResponse.json({ chat: updatedChat });
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

  const [chat] = await db
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.id, id), eq(chats.user_id, user.id)))
    .limit(1);

  if (!chat) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Chat not found" } },
      { status: 404 }
    );
  }

  await db.delete(chats).where(eq(chats.id, id));
  return NextResponse.json({ success: true });
}
