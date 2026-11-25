import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, getSessionState, SESSION_COOKIE_NAME } from "@/lib/auth";
import { createChatStream, type StreamAttachment } from "@/lib/ai-stream";
import { globalStore, type StoredMessage } from "@/lib/store";
import { proxyBackendRequest } from "@/lib/backend-auth";
import { generateUUID } from "@/lib/utils";
import { detectSecurityOrPersonalConcern, getClientIp, sanitizePayload } from "@/lib/security";

const postMessageSchema = z
  .object({
    content: z.string().max(40_000).optional().default(""),
    image: z.string().optional(),
    attachments: z.array(z.any()).max(8).optional(),
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

export const activeGenerations = new Map<string, { abort: () => void; text: string }>();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIp = getClientIp(request);

  // Per-IP burst flood protection (DDoS mitigation)
  const ipRateLimit = checkRateLimit(`msg:ip:${clientIp}`, 90, 60_000);
  if (!ipRateLimit.allowed) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Slow down a moment" } },
      { status: 429, headers: { "Retry-After": String(ipRateLimit.retryAfter ?? 60) } }
    );
  }

  // Enforce server-side 3-minute free guest session expiry & user session resolution
  const sessionState = await getSessionState(true);
  const user = sessionState.user;

  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  if (sessionState.isGuest && sessionState.guestExpired) {
    return NextResponse.json(
      {
        error: {
          code: "guest_expired",
          message: "Your free session has ended. Please sign in or create an account to continue chatting.",
        },
        guestExpired: true,
      },
      { status: 403 }
    );
  }

  const { id: chatId } = await params;

  const userRateLimit = checkRateLimit(`msg:${user.id}`, 60, 60_000);
  if (!userRateLimit.allowed) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Slow down a moment" } },
      { status: 429, headers: { "Retry-After": String(userRateLimit.retryAfter ?? 60) } }
    );
  }

  let content: string;
  let image: string | undefined;
  let attachments: StreamAttachment[] | undefined;
  let fast = false;
  let instructions = "";

  try {
    const rawJson = await request.json();
    const json = sanitizePayload(rawJson);
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

  if (!user.email.startsWith("guest-")) {
    proxyBackendRequest(`/api/chats/${chatId}/messages`, {
      method: "POST",
      user,
      body: { role: "user", content, image, attachments: storedAttachments },
      clientIp,
    }).catch(() => {});
  }

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

        // Security & Personal Privacy Guardrail check before LLM invocation
        const securityRefusal = detectSecurityOrPersonalConcern(content);
        if (securityRefusal) {
          generationRecord.text = securityRefusal;
          const parts = securityRefusal.split(/(\s+)/);
          for (const chunk of parts) {
            if (aborted) break;
            if (!chunk) continue;
            controller.enqueue(encoder.encode(`event: delta\ndata: ${JSON.stringify({ chunk })}\n\n`));
          }
        } else {
          const prevMessages = globalStore
            .getMessages(chatId)
            .slice(-12)
            .map((m: StoredMessage) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            }));

          const textStream = await createChatStream({
            messages: prevMessages.length
              ? prevMessages
              : [{ role: "user", content: content || "Analyze this attachment." }],
            user: {
              id: user.id,
              email: user.email,
              name: user.name || "User",
              backend_token: (user as any).backend_token || null,
            },
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
              break;
            }
          }
        }

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
                clientIp,
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

  const headers = new Headers({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  if (sessionState.newCookieToken) {
    const expDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
    const secFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
    headers.set(
      "Set-Cookie",
      `${SESSION_COOKIE_NAME}=${sessionState.newCookieToken}; Path=/; HttpOnly; SameSite=Lax; Expires=${expDate}${secFlag}`
    );
  }

  return new Response(stream, { headers });
}
