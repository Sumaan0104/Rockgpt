import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { globalStore } from "@/lib/store";
import { proxyBackendRequest } from "@/lib/backend-auth";
import { generateUUID } from "@/lib/utils";
import { activeGenerations } from "../messages/route";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(false);
  const { id: chatId } = await params;

  const gen = activeGenerations.get(chatId);
  let stopped = false;

  if (gen) {
    const partialText = gen.text.trim();
    gen.abort();
    activeGenerations.delete(chatId);
    stopped = true;

    if (partialText && user) {
      globalStore.saveMessage({
        id: generateUUID(),
        chat_id: chatId,
        role: "assistant",
        content: partialText,
        created_at: new Date(),
      });

      if (!user.email.startsWith("guest-")) {
        proxyBackendRequest(`/api/chats/${chatId}/messages`, {
          method: "POST",
          user,
          body: { role: "assistant", content: partialText, status: "stopped" },
        }).catch(() => {});
      }
    }
  }

  return NextResponse.json({ success: true, stopped });
}
