import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { generateUUID } from "@/lib/utils";

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(28, "Name max 28 characters"),
});

type StoredProject = {
  id: string;
  user_id: string;
  name: string;
  chat_count: number;
  created_at: Date;
  updated_at: Date;
};

const projectStore = new Map<string, StoredProject[]>();

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const list = projectStore.get(user.id) || [];
  return NextResponse.json({ projects: list });
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

    const list = projectStore.get(user.id) || [];
    const newProject: StoredProject = {
      id: generateUUID(),
      user_id: user.id,
      name,
      chat_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };

    list.unshift(newProject);
    projectStore.set(user.id, list);

    return NextResponse.json({ project: newProject }, { status: 201 });
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
