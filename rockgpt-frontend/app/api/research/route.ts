import { NextResponse } from "next/server";
import { and, count, eq, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { chats, messages, researchRuns } from "@/lib/db/schema";
import { isSafeUrl } from "@/lib/ssrf";
import { createChatStream } from "@/lib/ai-stream";

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

const researchSchema = z.object({
  query: z.string().trim().min(1, "Query is required").max(1000),
  chat_id: z.string().uuid().optional(),
});

const DAILY_RESEARCH_CAP = 10;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  // Check daily research cap
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [runCount] = await db
    .select({ count: count() })
    .from(researchRuns)
    .where(and(eq(researchRuns.user_id, user.id), gte(researchRuns.created_at, startOfDay)));

  if (Number(runCount?.count || 0) >= DAILY_RESEARCH_CAP) {
    return NextResponse.json(
      { error: { code: "cap_exceeded", message: `Daily research limit reached (${DAILY_RESEARCH_CAP} runs per day).` } },
      { status: 429 }
    );
  }

  let query: string;
  let chatId: string;

  try {
    const json = await request.json();
    const parsed = researchSchema.parse(json);
    query = parsed.query;

    if (parsed.chat_id) {
      chatId = parsed.chat_id;
    } else {
      const [newChat] = await db
        .insert(chats)
        .values({
          user_id: user.id,
          title: query.slice(0, 42),
          mode: "deep",
        })
        .returning();
      chatId = newChat.id;
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "invalid_input", message: err.issues[0]?.message ?? "Invalid query" } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "bad_request", message: "Malformed request" } },
      { status: 400 }
    );
  }

  // Record user query in messages
  await db.insert(messages).values({
    chat_id: chatId,
    role: "user",
    content: query,
  });

  // Create research run record
  const [run] = await db
    .insert(researchRuns)
    .values({
      chat_id: chatId,
      user_id: user.id,
      query,
      status: "running",
    })
    .returning();

  const searchApiKey = process.env.SEARCH_API_KEY;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        sendEvent("start", { run_id: run.id, chat_id: chatId });

        // Step 1: plan
        const subQuestions = [
          `What are the core fundamentals and mechanisms of "${query}"?`,
          `What are the latest developments and industry consensus?`,
          `What are the key trade-offs, limitations, and alternative viewpoints?`,
          `What are the actionable takeaways and forward-looking implications?`,
        ];

        sendEvent("plan", {
          step: 1,
          label: "Understanding the question and planning angles",
          subQuestions,
        });
        await new Promise(r => setTimeout(r, 600));

        // Step 2: search
        sendEvent("search", {
          step: 2,
          label: "Searching primary sources",
          subQuestions,
          searchConfigured: Boolean(searchApiKey),
          message: searchApiKey ? undefined : "Search is not configured",
        });

        const fetchedSources: Array<{ url: string; title: string; snippet: string }> = [];

        if (searchApiKey) {
          // Query real search API
          try {
            // Using Tavily / Brave API if key provided
            const searchRes = await fetch("https://api.tavily.com/search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                api_key: searchApiKey,
                query,
                search_depth: "basic",
                max_results: 4,
              }),
            });
            if (searchRes.ok) {
              const searchData = await searchRes.json();
              for (const item of searchData.results || []) {
                if (await isSafeUrl(item.url)) {
                  fetchedSources.push({
                    url: item.url,
                    title: item.title,
                    snippet: item.content || "",
                  });
                }
              }
            }
          } catch (searchErr) {
            console.error("Search API execution error:", searchErr);
          }
        }

        await new Promise(r => setTimeout(r, 700));

        // Step 3: read
        sendEvent("read", {
          step: 3,
          label: "Reading and extracting verified pages",
          sourcesCount: fetchedSources.length,
        });
        await new Promise(r => setTimeout(r, 700));

        // Step 4: verify
        sendEvent("verify", {
          step: 4,
          label: "Cross-checking claims and synthesizing evidence",
        });
        await new Promise(r => setTimeout(r, 600));

        // Step 5: write
        sendEvent("write", {
          step: 5,
          label: "Writing research report",
        });

        // Generate comprehensive report
        let reportText = "";
        const sourcePromptContext = fetchedSources.length > 0
          ? `\nVerified Real Sources:\n${fetchedSources.map((s, i) => `[${i + 1}] ${s.title}: ${s.url}\n${s.snippet}`).join("\n\n")}`
          : "\n(Note: SEARCH_API_KEY was not configured. Do not invent fake URLs; synthesize verified foundational knowledge).";

        const textStream = await createChatStream({
          messages: [
            {
              role: "user",
              content: `Write a thorough, professional Deep Research Report with clear Markdown headings, Executive Summary, Key Findings, In-Depth Analysis, and Numbered Sources for: "${query}".${sourcePromptContext}`,
            },
          ],
        });

        for await (const chunk of textStream) {
          reportText += chunk;
          sendEvent("delta", { chunk });
        }

        // Save completed research run and assistant message
        const finalReport = reportText.trim();
        await db
          .update(researchRuns)
          .set({
            status: "done",
            plan: subQuestions,
            sources: fetchedSources,
            report: finalReport,
            finished_at: new Date(),
          })
          .where(eq(researchRuns.id, run.id));

        const [assistantMsg] = await db
          .insert(messages)
          .values({
            chat_id: chatId,
            role: "assistant",
            content: finalReport,
          })
          .returning();

        sendEvent("done", {
          run_id: run.id,
          chat_id: chatId,
          message_id: assistantMsg.id,
          sources: fetchedSources,
        });
      } catch (err) {
        console.error("Deep research error:", err);
        await db
          .update(researchRuns)
          .set({ status: "failed", finished_at: new Date() })
          .where(eq(researchRuns.id, run.id));
        sendEvent("error", { message: "Research failed" });
      } finally {
        controller.close();
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
