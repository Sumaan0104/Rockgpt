"use server";

import { generateText, type UIMessage } from "ai";
import { cookies } from "next/headers";
import { auth } from "@/app/(auth)/auth";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { titleModel } from "@/lib/ai/models";
import { titlePrompt } from "@/lib/ai/prompts";
import { getTitleModel } from "@/lib/ai/providers";
import {
  deleteMessagesByChatIdAfterTimestamp,
  getChatById,
  getMessageById,
  updateChatVisibilityById,
} from "@/lib/db/queries";
import { getTextFromMessage } from "@/lib/utils";

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const { text } = await generateText({
    instructions: titlePrompt,
    model: getTitleModel(),
    prompt: getTextFromMessage(message),
    providerOptions: {
      gateway: { order: titleModel.gatewayOrder },
    },
  });
  return text
    .replace(/^[#*"\s]+/, "")
    .replace(/["]+$/, "")
    .trim();
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const [message] = await getMessageById({ id });
  if (!message) {
    throw new Error("Message not found");
  }

  const msgAny = message as any;
  const chat = await getChatById({ id: msgAny.chat_id ?? msgAny.chatId });
  const chatAny = chat as any;
  if (!chatAny || (chatAny.user_id ?? chatAny.userId) !== session.user.id) {
    throw new Error("Unauthorized");
  }

  if (typeof (deleteMessagesByChatIdAfterTimestamp as any) === "function") {
    await deleteMessagesByChatIdAfterTimestamp({
      chatId: msgAny.chat_id ?? msgAny.chatId,
      timestamp: msgAny.created_at ?? msgAny.createdAt,
    });
  }
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const chat = await getChatById({ id: chatId });
  const chatAny = chat as any;
  if (!chatAny || (chatAny.user_id ?? chatAny.userId) !== session.user.id) {
    throw new Error("Unauthorized");
  }

  await updateChatVisibilityById({ chatId, visibility });
}
