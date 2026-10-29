import { cookies } from "next/headers";
import { compare, hash } from "bcrypt-ts";
import crypto from "crypto";
import { generateUUID } from "./utils";
import { globalStore, type StoredUser } from "./store";
import type { User } from "./db/schema";

export const SESSION_COOKIE_NAME = "rockgpt_session";
export const OTP_COOKIE_NAME = "rockgpt_otp_pending";
const SESSION_DURATION_DAYS = 30;

const SECRET = process.env.AUTH_SECRET || "5f95876a94d086a6498b4a0504e8be19";

// Stateless HMAC signing for instant multi-instance Vercel Lambdas
export function signToken(data: any): string {
  const jsonStr = JSON.stringify(data);
  const base64 = Buffer.from(jsonStr).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(base64).digest("hex");
  return `${base64}.${sig}`;
}

export function verifyToken<T = any>(token: string | undefined | null): T | null {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [base64, sig] = parts;
  const expected = crypto.createHmac("sha256", SECRET).update(base64).digest("hex");
  if (sig !== expected) return null;
  try {
    const jsonStr = Buffer.from(base64, "base64url").toString("utf-8");
    const data = JSON.parse(jsonStr);
    if (data.exp && data.exp < Date.now()) return null;
    return data as T;
  } catch {
    return null;
  }
}

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

export function createSignedSessionTokenForUser(user: {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
  theme?: string;
  backend_token?: string | null;
}): string {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
  return signToken({
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url || null,
    theme: user.theme || "dark",
    backend_token: user.backend_token || null,
    is_guest: user.email.startsWith("guest-"),
    exp: expiresAt.getTime(),
  });
}

export async function createSession(userId: string): Promise<string> {
  const user = globalStore.getUserById(userId);
  const token = user
    ? createSignedSessionTokenForUser(user)
    : signToken({
        id: userId,
        email: `user-${userId.slice(0, 8)}@rockgpt.local`,
        name: "User",
        theme: "dark",
        is_guest: false,
        exp: Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000,
      });

  globalStore.createSession(userId);

  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000),
    });
  } catch (err) {
    // If called where cookies() cannot be directly mutated,
    // the caller sets cookies on the NextResponse object directly.
  }

  return token;
}

export async function getSessionUser(createIfMissing = false): Promise<(User & { backend_token?: string | null }) | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      // 1. Try decoding signed stateless session token
      const verified = verifyToken<{
        id: string;
        email: string;
        name: string;
        avatar_url?: string | null;
        theme?: string;
        backend_token?: string | null;
        is_guest?: boolean;
      }>(token);
      if (verified && verified.id) {
        const existing = globalStore.getUserById(verified.id);
        if (!existing) {
          globalStore.saveUser({
            id: verified.id,
            email: verified.email,
            name: verified.name,
            password_hash: null,
            avatar_url: verified.avatar_url || null,
            theme: verified.theme || "dark",
            backend_token: verified.backend_token || null,
            created_at: new Date(),
          });
        }
        return {
          id: verified.id,
          email: verified.email,
          name: verified.name,
          password_hash: null,
          avatar_url: verified.avatar_url || null,
          theme: verified.theme || "dark",
          backend_token: verified.backend_token || (existing ? existing.backend_token : null),
          created_at: existing ? existing.created_at : new Date(),
        } as any;
      }

      // 2. Fallback to in-memory lookup if plain UUID
      const session = globalStore.getSession(token);
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

    // Automatically provision guest user with zero latency and signed token
    const guestId = generateUUID().slice(0, 8);
    const guestUser: StoredUser = {
      id: generateUUID(),
      email: `guest-${guestId}@rockgpt.local`,
      name: "Guest",
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
