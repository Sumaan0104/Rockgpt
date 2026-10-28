import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, checkRateLimit } from "@/lib/auth";
import { createChatStream, type ModelMessage } from "@/lib/ai-stream";
import { globalStore } from "@/lib/store";
import { generateUUID } from "@/lib/utils";

const postMessageSchema = z.object({
  content: z.string().trim().min(1, "Message content is required").max(32_000),
});

// Map of active AbortControllers per chat
export const activeGenerations = new Map<string, { abort: () => void; text: string }>();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { id: chatId } = await params;

  // Rate limit check: 60 messages per minute
  const rateLimit = checkRateLimit(`msg:${user.id}`, 60, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Slow down a moment" } },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
    );
  }

  let content: string;
  try {
    const json = await request.json();
    content = postMessageSchema.parse(json).content;
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid message" } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "bad_request", message: "Malformed request" } },
      { status: 400 }
    );
  }

  // 1. Instant zero-latency local store persistence
  let chat = globalStore.getChat(chatId);
  if (!chat) {
    chat = globalStore.saveChat({
      id: chatId,
      user_id: user.id,
      title: content.slice(0, 42),
      mode: "chat",
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  globalStore.saveMessage({
    id: generateUUID(),
    chat_id: chatId,
    role: "user",
    content,
    created_at: new Date(),
  });

  // 2. Start SSE Stream Response IMMEDIATELY (Zero Delay)
  const encoder = new TextEncoder();
  let aborted = false;

  const stream = new ReadableStream({
    async start(controller) {
      const abortController = new AbortController();
      const generationRecord = {
        abort: () => {
          aborted = true;
          abortController.abort();
        },
        text: "",
      };
      activeGenerations.set(chatId, generationRecord);

      try {
        controller.enqueue(
          encoder.encode(`event: start\ndata: ${JSON.stringify({ chat_id: chatId })}\n\n`)
        );

        // Fetch prior history from store for conversational continuity
        const prevMessages = globalStore.getMessages(chatId).slice(-10).map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        // Instant stream from AI engine
        const textStream = await createChatStream({
          messages: prevMessages.length ? prevMessages : [{ role: "user", content }],
        });

        for await (const chunk of textStream) {
          if (aborted) break;
          generationRecord.text += chunk;
          try {
            controller.enqueue(
              encoder.encode(`event: delta\ndata: ${JSON.stringify({ chunk })}\n\n`)
            );
          } catch {
            break; // Client disconnected
          }
        }

        // Persist final assistant response instantly
        const finalText = generationRecord.text.trim();
        if (finalText && !aborted) {
          const assistantMsgId = generateUUID();
          globalStore.saveMessage({
            id: assistantMsgId,
            chat_id: chatId,
            role: "assistant",
            content: finalText,
            tokens_out: Math.ceil(finalText.length / 4),
            created_at: new Date(),
          });

          try {
            controller.enqueue(
              encoder.encode(`event: done\ndata: ${JSON.stringify({ message_id: assistantMsgId })}\n\n`)
            );
          } catch {}
        }
      } catch (streamErr) {
        console.error("Stream generation error:", streamErr);
        try {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ message: "Generation failed" })}\n\n`)
          );
        } catch {}
      } finally {
        activeGenerations.delete(chatId);
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
