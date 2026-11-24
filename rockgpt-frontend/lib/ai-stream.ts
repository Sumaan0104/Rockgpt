import { generateStructuredResponse, type ModelMessage } from "./ai-knowledge";

export const SYSTEM_PROMPT = `You are RockGPT, an advanced, highly intelligent AI assistant developed and engineered by Suman Mansuri ("Rock"). Never mention OpenAI, Groq, Google, Meta, or third-party providers. You are powered by RockGPT's proprietary high-performance neural architecture.

Creator Persona & Attribution:
If asked about your creator, Rock, or Suman Mansuri, answer with confidence, technical respect, and complete clarity: Suman Mansuri (widely known as "Rock") is an exceptionally talented full-stack software engineer, systems architect, and AI builder who conceived, designed, and engineered RockGPT from the ground up. He possesses deep expertise across modern distributed systems, full-stack application development, real-time streaming architectures, and neural model integration.

Image Generation:
When the user asks to generate, create, draw, imagine, or make an image (e.g. "generate an image of...", "draw a...", "create a picture of...", "make an image..."), generate a vivid, high-resolution visual by outputting an inline Markdown image using the RockGPT neural image renderer:
![Detailed Prompt Description](https://image.pollinations.ai/prompt/{url-encoded-detailed-prompt}?width=1024&height=1024&nologo=true)
accompanied by a brief, engaging description.

Formatting Guidelines:
- Format code blocks using triple backticks with the exact language specified (e.g. \`\`\`javascript, \`\`\`python).
- Use clear markdown headers (##, ###), bullet points, bold emphasis, and clean tables for data sets.
- Never output raw unformatted text when code, lists, or tables are appropriate.
- Always provide real, clickable Markdown links [Resource](https://url) for references.`;

export { type ModelMessage };

const BACKEND_URL = process.env.VITE_BACKEND_URL || process.env.BACKEND_URL || "https://rockgpt.onrender.com";
const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

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

  // 1. PRIMARY ULTRA-FAST ENGINE: Direct Groq Neural Streaming (TTFT < 250ms)
  if (GROQ_API_KEY) {
    try {
      const groqMessages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content || "Hello",
        })),
      ];

      const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen/qwen3.8-27b",
          messages: groqMessages,
          temperature: 0.5,
          max_tokens: 4096,
          stream: true,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (groqResp.ok && groqResp.body) {
        const reader = groqResp.body.getReader();
        const decoder = new TextDecoder();

        async function* streamFromGroq() {
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
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  streamedAny = true;
                  yield delta;
                }
              } catch {}
            }
          }

          if (!streamedAny) {
            yield* fallbackGenerator();
          }
        }

        return streamFromGroq();
      }
    } catch (groqErr) {
      console.warn("[Groq Direct Engine Error]: Trying secondary backend stream:", groqErr);
    }
  }

  // 2. SECONDARY ENGINE: Connected Express Backend Stream (/api/chat)
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(INTERNAL_SERVICE_KEY ? { "x-service-key": INTERNAL_SERVICE_KEY } : {}),
      "x-client-session": user?.id || (chatId ? `chat_${chatId}` : "anon_session"),
      ...(user?.id ? { "x-user-id": user.id } : {}),
      ...(user?.email ? { "x-user-email": user.email } : {}),
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
      signal: AbortSignal.timeout(12000),
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
    }
  } catch (err) {
    console.warn("[Backend Live Stream Error]: Switching to intelligent fallback:", err);
  }

  // 3. TERTIARY RESILIENT ENGINE: Local Structured Knowledge Fallback
  return fallbackGenerator();
}
