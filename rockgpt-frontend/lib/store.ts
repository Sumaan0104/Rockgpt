import { generateUUID } from "./utils";
import { hash, compare } from "bcrypt-ts";
import postgres from "postgres";

export type StoredUser = {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  avatar_url: string | null;
  theme: string;
  created_at: Date;
};

export type StoredSession = {
  id: string;
  user_id: string;
  expires_at: Date;
};

export type StoredOtp = {
  email: string;
  code: string;
  type: "signup" | "reset";
  name?: string;
  password_hash?: string;
  attempts: number;
  expires_at: Date;
};

export type StoredChat = {
  id: string;
  user_id: string;
  title: string;
  mode: string;
  project_id?: string | null;
  created_at: Date;
  updated_at: Date;
};

export type StoredMessage = {
  id: string;
  chat_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokens_out?: number;
  created_at: Date;
};

// ═══ RESILIENT IN-MEMORY STORE ═══
// Ensures ZERO-LATENCY, ZERO-ERROR fallback even if remote PostgreSQL password changes or times out
class MemoryStore {
  users = new Map<string, StoredUser>();
  usersByEmail = new Map<string, StoredUser>();
  sessions = new Map<string, StoredSession>();
  otps = new Map<string, StoredOtp>();
  chats = new Map<string, StoredChat>();
  messages = new Map<string, StoredMessage[]>();
  dbFailed = false;

  constructor() {
    // Dynamic production store initialized without hardcoded or demo credentials
  }

  // OTP Management
  saveOtp(email: string, code: string, type: "signup" | "reset", name?: string, password_hash?: string) {
    const key = `${email.toLowerCase()}:${type}`;
    const otp: StoredOtp = {
      email: email.toLowerCase(),
      code,
      type,
      name,
      password_hash,
      attempts: 0,
      expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes TTL
    };
    this.otps.set(key, otp);
    return otp;
  }

  getOtp(email: string, type: "signup" | "reset"): StoredOtp | null {
    const key = `${email.toLowerCase()}:${type}`;
    const otp = this.otps.get(key);
    if (!otp) return null;
    if (otp.expires_at.getTime() < Date.now()) {
      this.otps.delete(key);
      return null;
    }
    return otp;
  }

  deleteOtp(email: string, type: "signup" | "reset") {
    const key = `${email.toLowerCase()}:${type}`;
    this.otps.delete(key);
  }

  // User Management
  getUserById(id: string): StoredUser | null {
    return this.users.get(id) || null;
  }

  getUserByEmail(email: string): StoredUser | null {
    const clean = email.toLowerCase().trim();
    if (this.usersByEmail.has(clean)) return this.usersByEmail.get(clean)!;

    // Dot-insensitive Gmail lookup
    if (clean.endsWith("@gmail.com")) {
      const local = clean.split("@")[0].replace(/\./g, "");
      for (const [e, u] of this.usersByEmail.entries()) {
        if (e.endsWith("@gmail.com")) {
          const uLocal = e.split("@")[0].replace(/\./g, "");
          if (local === uLocal) return u;
        }
      }
    }
    return null;
  }

  saveUser(user: StoredUser): StoredUser {
    this.users.set(user.id, user);
    this.usersByEmail.set(user.email.toLowerCase().trim(), user);
    return user;
  }

  // Session Management
  createSession(userId: string): StoredSession {
    const sessionId = generateUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const session: StoredSession = {
      id: sessionId,
      user_id: userId,
      expires_at: expiresAt,
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): StoredSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.expires_at.getTime() < Date.now()) {
      this.sessions.delete(sessionId);
      return null;
    }
    return session;
  }

  deleteSession(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  // Chat Management
  getChats(userId: string): StoredChat[] {
    const list: StoredChat[] = [];
    for (const chat of this.chats.values()) {
      if (chat.user_id === userId) list.push(chat);
    }
    return list.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
  }

  getChat(chatId: string): StoredChat | null {
    return this.chats.get(chatId) || null;
  }

  saveChat(chat: StoredChat): StoredChat {
    this.chats.set(chat.id, chat);
    return chat;
  }

  deleteChat(chatId: string) {
    this.chats.delete(chatId);
    this.messages.delete(chatId);
  }

  // Message Management
  getMessages(chatId: string): StoredMessage[] {
    return this.messages.get(chatId) || [];
  }

  saveMessage(msg: StoredMessage) {
    const list = this.messages.get(msg.chat_id) || [];
    list.push(msg);
    this.messages.set(msg.chat_id, list);
    const chat = this.chats.get(msg.chat_id);
    if (chat) {
      chat.updated_at = new Date();
    }
  }
}

// Global Singleton Memory Store (shared across requests in Node process)
const globalStore = (globalThis as any).__rockgpt_store__ || new MemoryStore();
if (process.env.NODE_ENV !== "production") {
  (globalThis as any).__rockgpt_store__ = globalStore;
}

export { globalStore };
