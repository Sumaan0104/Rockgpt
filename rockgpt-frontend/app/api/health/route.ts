import { NextResponse } from "next/server";
import postgres from "postgres";

export async function GET() {
  try {
    const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
    await sql`SELECT 1`;
    await sql.end({ timeout: 2 });
    return NextResponse.json({ status: "ok", database: "connected" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: { code: "service_unavailable", message: "Database connection failed" } }, { status: 503 });
  }
}
