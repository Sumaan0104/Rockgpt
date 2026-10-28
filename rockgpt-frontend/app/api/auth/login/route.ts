import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { checkRateLimit, createSession, verifyPassword } from "@/lib/auth";
import { users } from "@/lib/db/schema";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

// Dummy hash for constant-time comparison when user doesn't exist
const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
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
    const { email, password } = loginSchema.parse(json);
    const normalizedEmail = email.toLowerCase();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user || !user.password_hash) {
      // Fake verify to prevent timing attacks
      await verifyPassword(password, DUMMY_HASH);
      return NextResponse.json(
        { error: { code: "invalid_credentials", message: "Invalid email or password" } },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: { code: "invalid_credentials", message: "Invalid email or password" } },
        { status: 401 }
      );
    }

    await createSession(user.id);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        theme: user.theme,
        avatar_url: user.avatar_url,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid input" } },
        { status: 400 }
      );
    }
    console.error("Login error:", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to log in" } },
      { status: 500 }
    );
  }
}
