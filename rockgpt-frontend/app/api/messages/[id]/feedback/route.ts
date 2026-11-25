import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { proxyBackendRequest } from "@/lib/backend-auth";
import { globalStore } from "@/lib/store";

const feedbackSchema = z.object({
  feedback: z.enum(["up", "down"]).nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(false);
  const { id } = await params;

  try {
    const json = await request.json().catch(() => ({}));
    const { feedback } = feedbackSchema.parse(json);

    // Update local memory store immediately for instant session continuity
    globalStore.updateMessageFeedback(id, feedback);

    // If authenticated, sync feedback to persistent MongoDB
    if (user && !user.email.startsWith("guest-")) {
      await proxyBackendRequest(`/api/messages/${id}/feedback`, {
        method: "PATCH",
        user,
        body: { feedback },
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, feedback });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid feedback value" } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to process feedback" } },
      { status: 500 }
    );
  }
}
