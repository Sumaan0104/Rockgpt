import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getSessionUser } from "@/lib/auth";
import { canvasDocs } from "@/lib/db/schema";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

// 200 KB max limit
const MAX_CANVAS_BYTES = 200 * 1024;

const putCanvasSchema = z.object({
  title: z.string().max(255).default(""),
  content: z.string().max(MAX_CANVAS_BYTES, "Canvas size limit exceeded (200 KB)").default(""),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const [doc] = await db
    .select()
    .from(canvasDocs)
    .where(eq(canvasDocs.user_id, user.id))
    .limit(1);

  if (!doc) {
    return NextResponse.json({
      canvas: {
        title: "",
        content: "",
        updated_at: new Date().toISOString(),
      },
    });
  }

  return NextResponse.json({ canvas: doc });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  try {
    const json = await request.json();
    const { title, content } = putCanvasSchema.parse(json);

    const [existing] = await db
      .select({ id: canvasDocs.id })
      .from(canvasDocs)
      .where(eq(canvasDocs.user_id, user.id))
      .limit(1);

    const now = new Date();
    if (existing) {
      await db
        .update(canvasDocs)
        .set({ title, content, updated_at: now })
        .where(eq(canvasDocs.id, existing.id));
    } else {
      await db.insert(canvasDocs).values({
        user_id: user.id,
        title,
        content,
        updated_at: now,
      });
    }

    return NextResponse.json({ success: true, updated_at: now.toISOString() });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid content" } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to save canvas" } },
      { status: 500 }
    );
  }
}
