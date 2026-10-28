import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";

const MAX_CANVAS_BYTES = 200 * 1024;

const putCanvasSchema = z.object({
  title: z.string().max(255).default(""),
  content: z.string().max(MAX_CANVAS_BYTES, "Canvas size limit exceeded (200 KB)").default(""),
});

// Resilient memory canvas map
const canvasStore = new Map<string, { title: string; content: string; updated_at: string }>();

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const doc = canvasStore.get(user.id) || {
    title: "",
    content: "",
    updated_at: new Date().toISOString(),
  };

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
    const now = new Date().toISOString();

    canvasStore.set(user.id, { title, content, updated_at: now });

    return NextResponse.json({ success: true, updated_at: now });
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
