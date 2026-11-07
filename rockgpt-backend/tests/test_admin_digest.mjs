import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-rockgpt-123456";
process.env.ADMIN_SECRET = process.env.ADMIN_SECRET || "rockgpt-secret-2026";

const { default: app } = await import("../server.js");
const { getPromptOfTheDay, buildDailyDigestHtml, DAILY_PROMPTS } = await import("../routes/admin.js");

let server;
let serverUrl;

function startTestServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      serverUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

function stopTestServer() {
  return new Promise((resolve) => {
    if (server) server.close(resolve);
    else resolve();
  });
}

async function request(path, options = {}) {
  const url = `${serverUrl}${path}`;
  const res = await fetch(url, options);
  let body = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    body = await res.json().catch(() => null);
  } else if (contentType.includes("text/")) {
    body = await res.text().catch(() => null);
  }
  return { status: res.status, headers: res.headers, body };
}

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedCount++;
  }
}

async function runTests() {
  console.log("════════════════════════════════════════════════════════════");
  console.log("  ROCKGPT ADMIN DAILY DIGEST SUITE");
  console.log("════════════════════════════════════════════════════════════\n");

  await startTestServer();

  try {
    // 1. Template & Rotation Unit Checks
    console.log("[1] Unit Tests: Prompt of the Day & HTML Builder");
    const defaultPrompt = getPromptOfTheDay();
    assert(
      typeof defaultPrompt === "string" && defaultPrompt.length > 10,
      `Prompt of the day is valid string: "${defaultPrompt.substring(0, 40)}..."`
    );

    const customPrompt = "Build a scalable real-time neural pipeline with WebSockets.";
    const overridden = getPromptOfTheDay(customPrompt);
    assert(overridden === customPrompt, "Custom prompt override correctly respected");

    const html = buildDailyDigestHtml({
      user: { name: "Alex" },
      promptOfTheDay: customPrompt,
      proTip: "Use connection pooling for Redis.",
      ctaUrl: "https://rockgpt-ten.vercel.app",
    });
    assert(html.includes("Hi Alex,"), "HTML contains personalized greeting");
    assert(html.includes(customPrompt), "HTML contains prompt of the day");
    assert(html.includes("Use connection pooling for Redis."), "HTML contains custom pro tip");
    assert(html.includes("https://rockgpt-ten.vercel.app"), "HTML contains proper CTA link");

    // 2. Security: Unauthorized without key
    console.log("\n[2] Security: Reject requests lacking valid admin credentials");
    const unauthRes = await request("/api/admin/send-daily-digest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ users: [{ email: "test@example.com" }] }),
    });
    assert(unauthRes.status === 403, "Missing admin key returns HTTP 403 Forbidden");
    assert(unauthRes.body?.error === "Unauthorized", "Returns error: 'Unauthorized'");

    // 3. Security: Unauthorized with invalid key
    const invalidKeyRes = await request("/api/admin/send-daily-digest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": "completely-wrong-key-12345",
      },
      body: JSON.stringify({ users: [{ email: "test@example.com" }] }),
    });
    assert(invalidKeyRes.status === 403, "Invalid admin key returns HTTP 403 Forbidden");

    // 4. Authorized via x-admin-key: rockgpt-secret-2026 with users list
    console.log("\n[3] Admin Dispatch: Target recipient batch with x-admin-key header");
    const batchRes = await request("/api/admin/send-daily-digest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": "rockgpt-secret-2026",
      },
      body: JSON.stringify({
        dryRun: true,
        users: [
          { name: "John Doe", email: "john@example.com" },
          { name: "Jane Smith", email: "jane@example.com" },
        ],
        promptOfTheDay: "Design an event-driven architecture.",
      }),
    });
    assert(batchRes.status === 200, "Authorized batch dispatch returns HTTP 200 OK");
    assert(batchRes.body?.success === true, "Response reports success: true");
    assert(batchRes.body?.sentCount === 2, "Dispatched 2 emails accurately");
    assert(batchRes.body?.total === 2, "Total count matches recipients");
    assert(
      batchRes.body?.promptOfTheDay === "Design an event-driven architecture.",
      "Matches custom prompt of the day"
    );

    // 5. Authorized via Authorization: Bearer <key> with single email target
    console.log("\n[4] Admin Dispatch: Single recipient with Bearer authorization");
    const singleRes = await request("/api/admin/send-daily-digest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer rockgpt-secret-2026",
      },
      body: JSON.stringify({
        dryRun: true,
        email: "solo.developer@rockgpt.ai",
        name: "Solo Dev",
      }),
    });
    assert(singleRes.status === 200, "Bearer token dispatch returns HTTP 200 OK");
    assert(singleRes.body?.success === true, "Single dispatch success: true");
    assert(singleRes.body?.sentCount === 1, "Dispatched 1 email accurately");

    // 6. Preview Digest Endpoint
    console.log("\n[5] Admin HTML Preview Endpoint");
    const previewRes = await request("/api/admin/preview-digest", {
      headers: { "x-admin-key": "rockgpt-secret-2026" },
    });
    assert(previewRes.status === 200, "Preview endpoint returns HTTP 200 OK");
    assert(typeof previewRes.body === "string" && previewRes.body.includes("RockGPT"), "Preview returns rendered HTML");

    // 7. Empty list handling
    console.log("\n[6] Edge Case: Empty users list");
    const emptyRes = await request("/api/admin/send-daily-digest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": "rockgpt-secret-2026",
      },
      body: JSON.stringify({ users: [] }),
    });
    assert(emptyRes.status === 200, "Empty list returns HTTP 200");
    assert(emptyRes.body?.sentCount === 0, "Sent count is 0 when empty users list provided");

  } finally {
    await stopTestServer();
    try {
      const mongoose = (await import("mongoose")).default;
      await mongoose.disconnect();
    } catch {}
  }

  console.log("\n════════════════════════════════════════════════════════════");
  console.log(`  RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("════════════════════════════════════════════════════════════");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
