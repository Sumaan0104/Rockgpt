import { cookies } from "next/headers";
import { compare, hash } from "bcrypt-ts";
import { generateUUID } from "./utils";
import { globalStore, type StoredUser } from "./store";
import type { User } from "./db/schema";

export const SESSION_COOKIE_NAME = "rockgpt_session";
const SESSION_DURATION_DAYS = 30;

// In-memory rate limiter per IP / identifier
const rateLimits = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(key: string, maxRequests = 30, windowMs = 60_000): { allowed: boolean; retryAfter?: number } {
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
  try {
    return await compare(plainText, hashString);
  } catch {
    return false;
  }
}

export async function createSession(userId: string): Promise<string> {
  const session = globalStore.createSession(userId);
  const sessionId = session.id;
  const expiresAt = session.expires_at;

  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
  } catch (err) {
    // If called in a context where cookies() cannot be directly mutated,
    // the caller sets cookies on the NextResponse object directly.
  }

  return sessionId;
}

export async function getSessionUser(createIfMissing = true): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (sessionId) {
      const session = globalStore.getSession(sessionId);
      if (session) {
        const user = globalStore.getUserById(session.user_id);
        if (user) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            password_hash: user.password_hash,
            avatar_url: user.avatar_url,
            theme: user.theme || "dark",
            created_at: user.created_at,
          };
        }
      }
    }

    if (!createIfMissing) return null;

    // Automatically provision guest user with zero latency
    const guestId = generateUUID().slice(0, 8);
    const guestUser: StoredUser = {
      id: generateUUID(),
      email: `guest-${guestId}@rockgpt.local`,
      name: "Suman",
      password_hash: null,
      avatar_url: null,
      theme: "dark",
      created_at: new Date(),
    };

    globalStore.saveUser(guestUser);
    await createSession(guestUser.id);

    return {
      id: guestUser.id,
      email: guestUser.email,
      name: guestUser.name,
      password_hash: guestUser.password_hash,
      avatar_url: guestUser.avatar_url,
      theme: guestUser.theme,
      created_at: guestUser.created_at,
    };
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
      globalStore.deleteSession(sessionId);
    }
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch (err) {
    console.error("Error destroying session:", err);
  }
}
