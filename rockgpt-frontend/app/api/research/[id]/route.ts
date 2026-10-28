import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getSessionUser } from "@/lib/auth";
import { researchRuns } from "@/lib/db/schema";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

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

  const [run] = await db
    .select()
    .from(researchRuns)
    .where(and(eq(researchRuns.id, id), eq(researchRuns.user_id, user.id)))
    .limit(1);

  if (!run) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Research run not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ run });
}
