import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getSessionUser } from "@/lib/auth";
import { chats } from "@/lib/db/schema";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

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

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor"); // updated_at ISO string
  const limit = Math.min(Number(searchParams.get("limit") || 30), 50);

  const conditions = [eq(chats.user_id, user.id)];
  if (cursor) {
    conditions.push(lt(chats.updated_at, new Date(cursor)));
  }

  const userChats = await db
    .select({
      id: chats.id,
      title: chats.title,
      project_id: chats.project_id,
      mode: chats.mode,
      created_at: chats.created_at,
      updated_at: chats.updated_at,
    })
    .from(chats)
    .where(and(...conditions))
    .orderBy(desc(chats.updated_at))
    .limit(limit + 1);

  const hasMore = userChats.length > limit;
  const items = hasMore ? userChats.slice(0, limit) : userChats;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].updated_at.toISOString() : null;

  return NextResponse.json({
    chats: items,
    nextCursor,
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

    const [newChat] = await db
      .insert(chats)
      .values({
        user_id: user.id,
        title,
        project_id: project_id ?? null,
        mode,
      })
      .returning();

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
