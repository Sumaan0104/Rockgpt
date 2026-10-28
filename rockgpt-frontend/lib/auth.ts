import { cookies } from "next/headers";
import { compare, hash } from "bcrypt-ts";
import { and, eq, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { authSessions, users, type User } from "./db/schema";
import { generateUUID } from "./utils";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

export const SESSION_COOKIE_NAME = "rockgpt_session";
const SESSION_DURATION_DAYS = 30;

// In-memory rate limiter per IP / identifier
const rateLimits = new Map<string, { count: number; resetTime: number }>();

// In-memory session user cache to avoid transatlantic database round-trips on every request
const sessionUserCache = new Map<string, { user: User; expires: number }>();

export function invalidateSessionUserCache(sessionId?: string) {
  if (sessionId) sessionUserCache.delete(sessionId);
  else sessionUserCache.clear();
}

export function checkRateLimit(key: string, maxRequests = 10, windowMs = 60_000): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimits.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count += 1;
  return { allowed: true };
}

export async function hashPassword(plainText: string): Promise<string> {
  return hash(plainText, 10);
}

export async function verifyPassword(plainText: string, hashString: string): Promise<boolean> {
  return compare(plainText, hashString);
}

export async function createSession(userId: string): Promise<string> {
  const sessionId = generateUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(authSessions).values({
    id: sessionId,
    user_id: userId,
    expires_at: expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return sessionId;
}

export async function getSessionUser(createIfMissing = true): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (sessionId) {
      // 1. Check in-memory cache for instant zero-latency response
      const cached = sessionUserCache.get(sessionId);
      if (cached && cached.expires > Date.now()) {
        return cached.user;
      }

      const [session] = await db
        .select({
          id: authSessions.id,
          user_id: authSessions.user_id,
          expires_at: authSessions.expires_at,
        })
        .from(authSessions)
        .where(and(eq(authSessions.id, sessionId), gt(authSessions.expires_at, new Date())))
        .limit(1);

      if (session) {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, session.user_id))
          .limit(1);

        if (user) {
          // Cache for 5 minutes
          sessionUserCache.set(sessionId, { user, expires: Date.now() + 300_000 });
          return user;
        }
      }
    }

    if (!createIfMissing) return null;

    // Automatically create guest user so interactions are saved to database
    const guestId = generateUUID().slice(0, 8);
    const [newUser] = await db
      .insert(users)
      .values({
        email: `guest-${guestId}@rockgpt.local`,
        name: "Suman",
        theme: "dark",
      })
      .returning();

    const newSessionId = await createSession(newUser.id);
    sessionUserCache.set(newSessionId, { user: newUser, expires: Date.now() + 300_000 });
    return newUser;
  } catch (err) {
    console.error("Error retrieving session user:", err);
    return null;
  }
}

export async function destroySession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (sessionId) {
      sessionUserCache.delete(sessionId);
      await db.delete(authSessions).where(eq(authSessions.id, sessionId));
    }
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch (err) {
    console.error("Error destroying session:", err);
  }
}
