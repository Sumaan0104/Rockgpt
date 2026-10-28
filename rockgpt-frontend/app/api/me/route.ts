import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { globalStore } from "@/lib/store";

const patchMeSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  theme: z.enum(["dark", "light"]).optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      theme: user.theme,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
    },
  });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  try {
    const json = await request.json();
    const parsed = patchMeSchema.parse(json);

    const userInStore = globalStore.getUserById(user.id);
    if (userInStore) {
      if (parsed.name !== undefined) userInStore.name = parsed.name;
      if (parsed.theme !== undefined) userInStore.theme = parsed.theme;
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: userInStore?.name || user.name,
        theme: userInStore?.theme || user.theme,
        avatar_url: userInStore?.avatar_url || user.avatar_url,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid input" } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to update profile" } },
      { status: 500 }
    );
  }
}
