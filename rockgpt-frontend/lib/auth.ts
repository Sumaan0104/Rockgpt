import { cookies } from "next/headers";
import { compare, hash } from "bcrypt-ts";
import crypto from "crypto";
import { generateUUID } from "./utils";
import { globalStore, type StoredUser } from "./store";
import type { User } from "./db/schema";

export const SESSION_COOKIE_NAME = "rockgpt_session";
export const OTP_COOKIE_NAME = "rockgpt_otp_pending";
export const GUEST_TRIAL_SECONDS = 180;
const SESSION_DURATION_DAYS = 7;
const MAX_RATE_LIMIT_KEYS = 10_000;

function getSecret(): string {
  const s = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!s) {
    throw new Error("AUTH_SECRET environment variable is missing.");
  }
  return s;
}

// Stateless HMAC signing for instant multi-instance Vercel Lambdas
export function signToken(data: any): string {
  const secret = getSecret();
  const jsonStr = JSON.stringify(data);
  const base64 = Buffer.from(jsonStr).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(base64).digest("hex");
  return `${base64}.${sig}`;
}

export function verifyToken<T = any>(token: string | undefined | null): T | null {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret || !token || typeof token !== "string" || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [base64, sig] = parts;
  const expected = crypto.createHmac("sha256", secret).update(base64).digest("hex");
  if (typeof sig !== "string" || typeof expected !== "string") return null;
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const jsonStr = Buffer.from(base64, "base64url").toString("utf-8");
    const data = JSON.parse(jsonStr);
    if (data.exp && data.exp < Date.now()) return null;
    return data as T;
  } catch {
    return null;
  }
}

// Bounded in-memory rate limiter per IP / identifier (evicts stale keys to prevent memory exhaustion)
const rateLimits = new Map<string, { count: number; resetTime: number }>();

function pruneRateLimits(now: number) {
  if (rateLimits.size < MAX_RATE_LIMIT_KEYS) return;
  for (const [k, v] of rateLimits.entries()) {
    if (now > v.resetTime) rateLimits.delete(k);
  }
  while (rateLimits.size >= MAX_RATE_LIMIT_KEYS) {
    const oldestKey = rateLimits.keys().next().value;
    if (oldestKey === undefined) break;
    rateLimits.delete(oldestKey);
  }
}

export function checkRateLimit(
  key: string,
  maxRequests = 30,
  windowMs = 60_000
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  pruneRateLimits(now);
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
  backend_refresh_token?: string | null;
  guest_started_at?: number;
  guest_expires_at?: number;
}): string {
  const now = Date.now();
  const isGuest = user.email.startsWith("guest-");
  const expiresAt = isGuest
    ? new Date(now + 24 * 60 * 60 * 1000) // Cookie persists 24h so expired guest trials remain inspectable server-side
    : new Date(now + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  return signToken({
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url || null,
    theme: user.theme || "dark",
    backend_token: user.backend_token || null,
    backend_refresh_token: user.backend_refresh_token || null,
    is_guest: isGuest,
    ...(isGuest
      ? {
          guest_started_at: user.guest_started_at ?? now,
          guest_expires_at: user.guest_expires_at ?? now + GUEST_TRIAL_SECONDS * 1000,
        }
      : {}),
    exp: expiresAt.getTime(),
  });
}

export async function createSession(userId: string): Promise<string> {
  const user = globalStore.getUserById(userId);
  const now = Date.now();
  const token = user
    ? createSignedSessionTokenForUser(user)
    : signToken({
        id: userId,
        email: `user-${userId.slice(0, 8)}@rockgpt.local`,
        name: "User",
        theme: "dark",
        is_guest: false,
        exp: now + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000,
      });

  globalStore.createSession(userId);

  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(now + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000),
    });
  } catch {
    // Caller sets cookies directly on response when needed
  }

  return token;
}

export type SessionStateResult = {
  user: (User & { backend_token?: string | null; backend_refresh_token?: string | null }) | null;
  isGuest: boolean;
  guestExpired: boolean;
  guestRemainingSeconds: number | null;
  newCookieToken?: string;
};

export async function getSessionState(createGuestIfMissing = false): Promise<SessionStateResult> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      const verified = verifyToken<{
        id: string;
        email: string;
        name: string;
        avatar_url?: string | null;
        theme?: string;
        backend_token?: string | null;
        backend_refresh_token?: string | null;
        is_guest?: boolean;
        guest_started_at?: number;
        guest_expires_at?: number;
      }>(token);

      if (verified && verified.id) {
        const isGuest = Boolean(verified.is_guest || verified.email?.startsWith("guest-"));
        let guestExpired = false;
        let guestRemainingSeconds: number | null = null;

        if (isGuest) {
          const expMs = verified.guest_expires_at || (verified.guest_started_at ? verified.guest_started_at + GUEST_TRIAL_SECONDS * 1000 : Date.now() + GUEST_TRIAL_SECONDS * 1000);
          const remMs = expMs - Date.now();
          guestExpired = remMs <= 0;
          guestRemainingSeconds = Math.max(0, Math.ceil(remMs / 1000));
        }

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
            backend_refresh_token: verified.backend_refresh_token || null,
            created_at: new Date(),
          });
        }

        return {
          user: {
            id: verified.id,
            email: verified.email,
            name: verified.name,
            password_hash: null,
            avatar_url: verified.avatar_url || null,
            theme: verified.theme || "dark",
            backend_token: verified.backend_token || (existing ? existing.backend_token : null),
            backend_refresh_token: verified.backend_refresh_token || (existing ? existing.backend_refresh_token : null),
            created_at: existing ? existing.created_at : new Date(),
          } as any,
          isGuest,
          guestExpired,
          guestRemainingSeconds,
        };
      }

      // Fallback in-memory lookup
      const session = globalStore.getSession(token);
      if (session) {
        const u = globalStore.getUserById(session.user_id);
        if (u) {
          const isGuest = u.email.startsWith("guest-");
          return {
            user: {
              id: u.id,
              email: u.email,
              name: u.name,
              password_hash: u.password_hash,
              avatar_url: u.avatar_url,
              google_id: null,
              theme: u.theme || "dark",
              created_at: u.created_at,
            },
            isGuest,
            guestExpired: false,
            guestRemainingSeconds: isGuest ? GUEST_TRIAL_SECONDS : null,
          };
        }
      }
    }

    if (!createGuestIfMissing) {
      return { user: null, isGuest: false, guestExpired: false, guestRemainingSeconds: null };
    }

    const now = Date.now();
    const guestId = generateUUID().slice(0, 8);
    const guestUser: StoredUser & { guest_started_at?: number; guest_expires_at?: number } = {
      id: generateUUID(),
      email: `guest-${guestId}@rockgpt.local`,
      name: "Guest",
      password_hash: null,
      avatar_url: null,
      theme: "dark",
      created_at: new Date(now),
      guest_started_at: now,
      guest_expires_at: now + GUEST_TRIAL_SECONDS * 1000,
    };

    globalStore.saveUser(guestUser);
    const newCookieToken = createSignedSessionTokenForUser(guestUser);
    globalStore.createSession(guestUser.id);

    try {
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE_NAME, newCookieToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: new Date(now + 24 * 60 * 60 * 1000),
      });
    } catch {}

    return {
      user: {
        id: guestUser.id,
        email: guestUser.email,
        name: guestUser.name,
        password_hash: guestUser.password_hash,
        avatar_url: guestUser.avatar_url,
        google_id: null,
        theme: guestUser.theme,
        created_at: guestUser.created_at,
      },
      isGuest: true,
      guestExpired: false,
      guestRemainingSeconds: GUEST_TRIAL_SECONDS,
      newCookieToken,
    };
  } catch (err) {
    console.error("Error retrieving session user:", err);
    return { user: null, isGuest: false, guestExpired: false, guestRemainingSeconds: null };
  }
}

export async function getSessionUser(createIfMissing = false): Promise<(User & { backend_token?: string | null }) | null> {
  const state = await getSessionState(createIfMissing);
  return state.user;
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
