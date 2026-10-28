import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getSessionUser } from "@/lib/auth";
import { chats, messages } from "@/lib/db/schema";
import { activeGenerations } from "../messages/route";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

export async function POST(
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

  const { id: chatId } = await params;

  // Check chat ownership
  const [chat] = await db
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.user_id, user.id)))
    .limit(1);

  if (!chat) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Chat not found" } },
      { status: 404 }
    );
  }

  const gen = activeGenerations.get(chatId);
  if (gen) {
    const partialText = gen.text.trim();
    gen.abort();
    activeGenerations.delete(chatId);

    // Save partial text if not already saved
    if (partialText) {
      await db.insert(messages).values({
        chat_id: chatId,
        role: "assistant",
        content: partialText,
      });
    }
  }

  return NextResponse.json({ success: true, stopped: Boolean(gen) });
}
