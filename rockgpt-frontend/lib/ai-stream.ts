import { generateStructuredResponse, type ModelMessage } from "./ai-knowledge";

export const SYSTEM_PROMPT = "You are RockGPT, a sleek, intelligent, concise and helpful AI assistant.";
export { type ModelMessage };

const BACKEND_URL = process.env.VITE_BACKEND_URL || process.env.BACKEND_URL || "https://rockgpt.onrender.com";
const INTERNAL_SERVICE_KEY = process.env.JWT_SECRET || "rockgpt_super_secure_jwt_secret_production_2026";

let cachedBackendToken: { token: string; expiresAt: number } | null = null;

async function getBackendGuestToken(): Promise<string | null> {
  if (cachedBackendToken && cachedBackendToken.expiresAt > Date.now()) {
    return cachedBackendToken.token;
  }
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/guest-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.guestToken) {
        cachedBackendToken = {
          token: data.guestToken,
          expiresAt: Date.now() + ((data.expiresInSeconds || 150) - 20) * 1000,
        };
        return data.guestToken;
      }
    }
  } catch (err) {
    console.warn("[Backend Guest Token Fetch Error]:", err);
  }
  return null;
}

export async function createChatStream({
  messages,
  projectName,
  user,
  chatId,
}: {
  messages: ModelMessage[];
  projectName?: string | null;
  user?: {
    id: string;
    email: string;
    name: string;
    backend_token?: string | null;
  } | null;
  chatId?: string;
}) {
  async function* fallbackGenerator() {
    const lastUser = messages.filter(m => m.role === "user").pop()?.content || "";
    const structuredReply = generateStructuredResponse(lastUser, messages, projectName);

    const parts = structuredReply.split(/(\s+)/);
    for (let i = 0; i < parts.length; i++) {
      yield parts[i];
      if (parts[i].trim()) {
        await new Promise(r => setTimeout(r, 6));
      }
    }
  }

  // 1. Direct Live AI Streaming from connected Neural Backend (Render / Groq / Gemini)
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-service-key": INTERNAL_SERVICE_KEY,
      "x-client-session": user?.id || (chatId ? `chat_${chatId}` : "anon_session"),
    };

    if (user?.backend_token) {
      headers["Authorization"] = `Bearer ${user.backend_token}`;
    } else {
      const guestToken = await getBackendGuestToken();
      if (guestToken) {
        headers["x-guest-token"] = guestToken;
        headers["Authorization"] = `Bearer ${guestToken}`;
      }
    }

    const resp = await fetch(`${BACKEND_URL}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        chatId,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      }),
      signal: AbortSignal.timeout(25000), // Generous 25s timeout for Render cold-starts
    });

    if (resp.ok && resp.body) {
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();

      async function* streamFromBackend() {
        let buffer = "";
        let streamedAny = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const dataStr = trimmed.slice(5).trim();
            if (!dataStr || dataStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.token) {
                streamedAny = true;
                yield parsed.token;
              } else if (parsed.content) {
                streamedAny = true;
                yield parsed.content;
              }
            } catch {}
          }
        }

        if (!streamedAny) {
          yield* fallbackGenerator();
        }
      }

      return streamFromBackend();
    } else {
      console.warn(`[Backend Live Stream Status ${resp.status}]: Switching to intelligent fallback.`);
    }
  } catch (err) {
    console.warn("[Backend Live Stream Error]: Switching to intelligent fallback:", err);
  }

  // 2. Resilient fallback generator
  return fallbackGenerator();
}
