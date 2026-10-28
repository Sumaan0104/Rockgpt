import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { checkRateLimit, createSession, hashPassword } from "@/lib/auth";
import { users } from "@/lib/db/schema";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(64),
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const rateLimit = checkRateLimit(`auth:${ip}`, 10, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many attempts. Please try again later." } },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
    );
  }

  try {
    const json = await request.json();
    const { name, email, password } = signupSchema.parse(json);
    const normalizedEmail = email.toLowerCase();

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: { code: "duplicate_email", message: "An account with this email already exists" } },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email: normalizedEmail,
        password_hash: passwordHash,
        theme: "dark",
      })
      .returning();

    await createSession(newUser.id);

    return NextResponse.json({
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        theme: newUser.theme,
        avatar_url: newUser.avatar_url,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid input" } },
        { status: 400 }
      );
    }
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to create account" } },
      { status: 500 }
    );
  }
}
