import { streamText } from "ai";
import { getLanguageModel } from "./ai/providers";
import { DEFAULT_CHAT_MODEL } from "./ai/models";
import { generateStructuredResponse, type ModelMessage } from "./ai-knowledge";

export const SYSTEM_PROMPT = "You are RockGPT, a sleek, intelligent, concise and helpful AI assistant.";

export { type ModelMessage };

export async function createChatStream({
  messages,
  projectName,
}: {
  messages: ModelMessage[];
  projectName?: string | null;
}) {
  const fullSystemPrompt = projectName
    ? `${SYSTEM_PROMPT}\nActive Project Context: ${projectName}`
    : SYSTEM_PROMPT;

  // Trim conversation history: keep system prompt and last 20 messages
  const recentMessages = messages.slice(-20);
  const formattedMessages = [
    { role: "system" as const, content: fullSystemPrompt },
    ...recentMessages.filter(m => m.role !== "system"),
  ];

  async function* fallbackGenerator() {
    const lastUser = messages.filter(m => m.role === "user").pop()?.content || "";
    const structuredReply = generateStructuredResponse(lastUser, messages, projectName);

    // High-momentum instant streaming (~140 words/second) with zero initial delay
    const parts = structuredReply.split(/(\s+)/);
    for (let i = 0; i < parts.length; i++) {
      yield parts[i];
      if (parts[i].trim()) {
        await new Promise(r => setTimeout(r, 6));
      }
    }
  }

  // If AI Gateway is unverified/requires card, use instant intelligent stream
  const hasVerifiedGateway = process.env.ENABLE_AI_GATEWAY === "true";

  if (!hasVerifiedGateway) {
    return fallbackGenerator();
  }

  try {
    const model = getLanguageModel(DEFAULT_CHAT_MODEL);
    const result = streamText({
      model,
      messages: formattedMessages,
      abortSignal: AbortSignal.timeout(1800),
    });

    async function* guardedStream() {
      try {
        let produced = false;
        for await (const chunk of result.textStream) {
          produced = true;
          yield chunk;
        }
        if (!produced) {
          yield* fallbackGenerator();
        }
      } catch (err) {
        console.warn("AI Gateway stream error, activating instant fallback:", err);
        yield* fallbackGenerator();
      }
    }

    return guardedStream();
  } catch (err) {
    console.warn("AI Gateway streaming fallback activated immediately:", err);
    return fallbackGenerator();
  }
}
