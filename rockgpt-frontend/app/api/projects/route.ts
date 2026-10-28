import { NextResponse } from "next/server";
import { z } from "zod";
import { count, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getSessionUser } from "@/lib/auth";
import { chats, projects } from "@/lib/db/schema";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(28, "Name max 28 characters"),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  // Load projects and count of associated chats
  const userProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      created_at: projects.created_at,
      updated_at: projects.updated_at,
    })
    .from(projects)
    .where(eq(projects.user_id, user.id))
    .orderBy(desc(projects.created_at));

  const projectsWithCounts = await Promise.all(
    userProjects.map(async (p) => {
      const [chatCount] = await db
        .select({ count: count() })
        .from(chats)
        .where(eq(chats.project_id, p.id));
      return {
        ...p,
        chat_count: Number(chatCount?.count || 0),
      };
    })
  );

  return NextResponse.json({ projects: projectsWithCounts });
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
    const json = await request.json();
    const { name } = createProjectSchema.parse(json);

    const [newProject] = await db
      .insert(projects)
      .values({
        user_id: user.id,
        name,
      })
      .returning();

    return NextResponse.json({
      project: {
        ...newProject,
        chat_count: 0,
      },
    }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid project name" } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to create project" } },
      { status: 500 }
    );
  }
}
