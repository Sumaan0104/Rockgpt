import { generateStructuredResponse, type ModelMessage } from "./ai-knowledge";

export const SYSTEM_PROMPT = "You are RockGPT, a sleek, intelligent, concise and helpful AI assistant.";
export { type ModelMessage };

const BACKEND_URL = process.env.VITE_BACKEND_URL || process.env.BACKEND_URL || "https://rockgpt.onrender.com";

let cachedBackendToken: { token: string; expiresAt: number } | null = null;

async function getBackendToken(): Promise<string | null> {
  if (cachedBackendToken && cachedBackendToken.expiresAt > Date.now()) {
    return cachedBackendToken.token;
  }
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/guest-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(4000),
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
    console.warn("[Backend Token Fetch Error]:", err);
  }
  return null;
}

export async function createChatStream({
  messages,
  projectName,
}: {
  messages: ModelMessage[];
  projectName?: string | null;
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

  // 1. Direct Live AI Streaming from connected Neural Backend (Render / Gemini / Groq)
  try {
    const token = await getBackendToken();
    if (token) {
      const resp = await fetch(`${BACKEND_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guest-token": token,
        },
        body: JSON.stringify({
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: AbortSignal.timeout(10000),
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
              if (!dataStr) continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.token) {
                  streamedAny = true;
                  yield parsed.token;
                }
              } catch {}
            }
          }

          if (!streamedAny) {
            yield* fallbackGenerator();
          }
        }

        return streamFromBackend();
      }
    }
  } catch (err) {
    console.warn("[Backend Live Stream Error]: Switching to intelligent fallback:", err);
  }

  // 2. Resilient fallback generator
  return fallbackGenerator();
}
