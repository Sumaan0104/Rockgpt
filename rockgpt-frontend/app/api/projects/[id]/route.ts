import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getSessionUser } from "@/lib/auth";
import { chats, projects } from "@/lib/db/schema";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

const updateProjectSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(28, "Name max 28 characters"),
});

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

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.user_id, user.id)))
    .limit(1);

  if (!project) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Project not found" } },
      { status: 404 }
    );
  }

  try {
    const json = await request.json();
    const { name } = updateProjectSchema.parse(json);

    const [updated] = await db
      .update(projects)
      .set({ name, updated_at: new Date() })
      .where(eq(projects.id, id))
      .returning();

    return NextResponse.json({ project: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid input" } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to update project" } },
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

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.user_id, user.id)))
    .limit(1);

  if (!project) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Project not found" } },
      { status: 404 }
    );
  }

  // Unassign chats
  await db
    .update(chats)
    .set({ project_id: null })
    .where(eq(chats.project_id, id));

  await db.delete(projects).where(eq(projects.id, id));

  return NextResponse.json({ success: true });
}
