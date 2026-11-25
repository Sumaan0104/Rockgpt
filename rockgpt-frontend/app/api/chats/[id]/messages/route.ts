import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, checkRateLimit } from "@/lib/auth";
import { createChatStream, type StreamAttachment } from "@/lib/ai-stream";
import { globalStore, type StoredMessage } from "@/lib/store";
import { proxyBackendRequest } from "@/lib/backend-auth";
import { generateUUID } from "@/lib/utils";

const postMessageSchema = z
  .object({
    content: z.string().max(40_000).optional().default(""),
    image: z.string().optional(),
    attachments: z.array(z.any()).optional(),
    fast: z.boolean().optional().default(false),
    instructions: z.string().max(600).optional().default(""),
  })
  .refine(
    (d) =>
      d.content.trim().length > 0 ||
      Boolean(d.image) ||
      (Array.isArray(d.attachments) && d.attachments.length > 0),
    { message: "Message content or attachment is required" }
  );

// Map of active AbortControllers per chat
export const activeGenerations = new Map<string, { abort: () => void; text: string }>();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Automatically provision guest session with signed token so unauthenticated visitors can chat seamlessly
  const user = await getSessionUser(true);
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
  let image: string | undefined;
  let attachments: StreamAttachment[] | undefined;
  let fast = false;
  let instructions = "";

  try {
    const json = await request.json();
    const parsed = postMessageSchema.parse(json);
    content = parsed.content.trim();
    image = parsed.image;
    attachments = parsed.attachments;
    fast = parsed.fast;
    instructions = parsed.instructions;
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

  // 1. Instant zero-latency local store persistence & authorization check
  let chat = globalStore.getChat(chatId);
  if (chat && chat.user_id !== user.id) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "You do not have permission to post to this chat" } },
      { status: 403 }
    );
  }

  if (!chat) {
    chat = globalStore.saveChat({
      id: chatId,
      user_id: user.id,
      title: (content || attachments?.[0]?.name || "Image Analysis").slice(0, 42),
      mode: "chat",
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  const storedAttachments = (attachments || []).map((a) => ({
    name: a?.name || "",
    type: a?.type || "",
    url: a?.url || a?.dataUrl,
  }));

  globalStore.saveMessage({
    id: generateUUID(),
    chat_id: chatId,
    role: "user",
    content,
    image,
    attachments: storedAttachments,
    created_at: new Date(),
  });

  // Sync user message to MongoDB Atlas for authenticated accounts
  if (!user.email.startsWith("guest-")) {
    proxyBackendRequest(`/api/chats/${chatId}/messages`, {
      method: "POST",
      user,
      body: { role: "user", content, image, attachments: storedAttachments },
    }).catch(() => {});
  }

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
        const prevMessages = globalStore
          .getMessages(chatId)
          .slice(-12)
          .map((m: StoredMessage) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

        // Instant stream from AI engine (passes fast, instructions, image & text attachments)
        const textStream = await createChatStream({
          messages: prevMessages.length
            ? prevMessages
            : [{ role: "user", content: content || "Analyze this attachment." }],
          user: user
            ? {
                id: user.id,
                email: user.email,
                name: user.name || "User",
                backend_token: (user as any).backend_token || null,
              }
            : null,
          chatId,
          fast,
          instructions,
          image,
          attachments,
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

        // Persist final assistant response & obtain canonical DB ID for accurate feedback sync
        const finalText = generationRecord.text.trim();
        if (finalText && !aborted) {
          let assistantMsgId = generateUUID();

          if (!user.email.startsWith("guest-")) {
            try {
              const saved = await proxyBackendRequest(`/api/chats/${chatId}/messages`, {
                method: "POST",
                user,
                body: { role: "assistant", content: finalText },
                timeoutMs: 2500,
              });
              if (saved.ok && (saved.data?.id || saved.data?._id)) {
                assistantMsgId = saved.data.id || saved.data._id;
              }
            } catch {}
          }

          globalStore.saveMessage({
            id: assistantMsgId,
            chat_id: chatId,
            role: "assistant",
            content: finalText,
            feedback: null,
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
