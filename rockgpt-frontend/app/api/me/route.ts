import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getSessionUser } from "@/lib/auth";
import { users } from "@/lib/db/schema";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

const patchMeSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  theme: z.enum(["dark", "light"]).optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      theme: user.theme,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
    },
  });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  try {
    const json = await request.json();
    const parsed = patchMeSchema.parse(json);

    const updateData: Partial<typeof users.$inferInsert> = {};
    if (parsed.name !== undefined) updateData.name = parsed.name;
    if (parsed.theme !== undefined) updateData.theme = parsed.theme;

    if (Object.keys(updateData).length > 0) {
      await db.update(users).set(updateData).where(eq(users.id, user.id));
    }

    const [updatedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    return NextResponse.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        theme: updatedUser.theme,
        avatar_url: updatedUser.avatar_url,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid input" } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to update profile" } },
      { status: 500 }
    );
  }
}
