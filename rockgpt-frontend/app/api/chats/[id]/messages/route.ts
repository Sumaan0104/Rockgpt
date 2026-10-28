import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";
import { getSessionUser, checkRateLimit } from "@/lib/auth";
import { chats, messages, projects } from "@/lib/db/schema";
import { createChatStream, type ModelMessage } from "@/lib/ai-stream";

const client = postgres(process.env.POSTGRES_URL ?? "", { max: 10, idle_timeout: 20 });
const db = drizzle(client);

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

  // Rate limit check: 30 messages per minute
  const rateLimit = checkRateLimit(`msg:${user.id}`, 30, 60_000);
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

  // 1. Concurrent Background Database Persistence
  // Runs in the background and DOES NOT block initial token streaming
  const dbSyncPromise = (async () => {
    try {
      let [chat] = await db
        .select()
        .from(chats)
        .where(and(eq(chats.id, chatId), eq(chats.user_id, user.id)))
        .limit(1);

      if (!chat) {
        const [newChat] = await db
          .insert(chats)
          .values({
            id: chatId,
            user_id: user.id,
            title: content.slice(0, 42),
            mode: "chat",
          })
          .returning();
        chat = newChat;
      }

      await Promise.all([
        db.insert(messages).values({
          chat_id: chatId,
          role: "user",
          content,
        }),
        db
          .update(chats)
          .set({ updated_at: new Date() })
          .where(eq(chats.id, chatId)),
      ]);

      let projectName: string | null = null;
      if (chat.project_id) {
        const [proj] = await db
          .select({ name: projects.name })
          .from(projects)
          .where(eq(projects.id, chat.project_id))
          .limit(1);
        if (proj) projectName = proj.name;
      }

      return { chat, projectName };
    } catch (err) {
      console.warn("Background chat sync warning:", err);
      return null;
    }
  })();

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

        // Instant stream from AI engine
        const textStream = await createChatStream({
          messages: [{ role: "user", content }],
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

        // Await background chat creation and persist final assistant response
        const finalText = generationRecord.text.trim();
        if (finalText && !aborted) {
          await dbSyncPromise;
          try {
            const [assistantMsg] = await db
              .insert(messages)
              .values({
                chat_id: chatId,
                role: "assistant",
                content: finalText,
                tokens_out: Math.ceil(finalText.length / 4),
              })
              .returning();

            try {
              controller.enqueue(
                encoder.encode(`event: done\ndata: ${JSON.stringify({ message_id: assistantMsg.id })}\n\n`)
              );
            } catch {}
          } catch (dbErr) {
            console.warn("Assistant message save error:", dbErr);
          }
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
