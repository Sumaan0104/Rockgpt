import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "RockGPT Neural Engine",
    version: "5.0.0",
    uptime: process.uptime(),
  }, { status: 200 });
}
