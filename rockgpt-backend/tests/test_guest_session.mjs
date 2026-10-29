import http from "http";
import assert from "assert";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
process.env.NODE_ENV = "test";

const { default: app } = await import("../server.js");
const JWT_SECRET = process.env.JWT_SECRET;

let server;
let serverUrl;

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      serverUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) server.close(resolve);
    else resolve();
  });
}

async function runGuestSessionTests() {
  console.log("==================================================");
  console.log("🧪 ROCKGPT GUEST SESSION & EXPIRATION TEST SUITE");
  console.log("==================================================\n");

  await startServer();

  try {
    // 1. Initialize guest session endpoint
    console.log("--- 1. Guest Session Token Issuance (POST /api/auth/guest-session) ---");
    const guestRes = await fetch(`${serverUrl}/api/auth/guest-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    assert.strictEqual(guestRes.status, 200, "Guest session returns HTTP 200");
    const guestData = await guestRes.json();
    assert.strictEqual(guestData.success, true, "Guest session reports success");
    assert.strictEqual(guestData.expiresInSeconds, 150, "Guest access duration is exactly 150 seconds");
    assert(Boolean(guestData.guestToken), "Guest session returns valid JWT token");
    console.log("  ✓ PASS: Guest session endpoint returns HTTP 200 and 150s expiration");

    const decoded = jwt.verify(guestData.guestToken, JWT_SECRET);
    assert.strictEqual(decoded.isGuest, true, "Guest token contains isGuest: true");
    assert(Boolean(decoded.startedAt), "Guest token contains startedAt timestamp");
    console.log("  ✓ PASS: Guest JWT token is cryptographically signed and valid");

    // 2. Chat access rejected without any token (Unauthenticated & expired guest)
    console.log("\n--- 2. Backend Enforcement: Missing Guest Token Rejected ---");
    const unauthChatRes = await fetch(`${serverUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hello" }],
      }),
    });
    assert.strictEqual(unauthChatRes.status, 403, "Direct chat request without auth/guest token rejected with HTTP 403");
    const unauthChatData = await unauthChatRes.json();
    assert.strictEqual(unauthChatData.guestExpired, true, "Rejection payload includes guestExpired: true");
    assert(
      unauthChatData.error.includes("Your guest access has ended"),
      "Rejection payload contains required expiration message"
    );
    console.log("  ✓ PASS: Direct chat without guest token rejected with HTTP 403 and guestExpired: true");

    // 3. Chat access rejected with expired guest token
    console.log("\n--- 3. Backend Enforcement: Expired Guest Token Rejected ---");
    const expiredGuestToken = jwt.sign(
      { isGuest: true, startedAt: Date.now() - 200000 },
      JWT_SECRET,
      { expiresIn: "0s" } // already expired
    );
    const expiredChatRes = await fetch(`${serverUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-guest-token": expiredGuestToken,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Testing expired guest token" }],
      }),
    });
    assert.strictEqual(expiredChatRes.status, 403, "Expired guest token rejected with HTTP 403");
    const expiredChatData = await expiredChatRes.json();
    assert.strictEqual(expiredChatData.guestExpired, true, "Expired token response includes guestExpired: true");
    console.log("  ✓ PASS: Expired guest token rejected with HTTP 403 before SSE stream starts");

    // 4. Chat access rejected with forged/invalid token
    console.log("\n--- 4. Backend Enforcement: Forged Guest Token Rejected ---");
    const forgedChatRes = await fetch(`${serverUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-guest-token": "forged_malicious_token_12345",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Testing forged token" }],
      }),
    });
    assert.strictEqual(forgedChatRes.status, 403, "Forged token rejected with HTTP 403");
    console.log("  ✓ PASS: Forged or corrupted guest token rejected with HTTP 403");

    // 5. Active valid guest token accepted
    console.log("\n--- 5. Active Valid Guest Token Allows Streaming Chat ---");
    const validGuestChatRes = await fetch(`${serverUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-guest-token": guestData.guestToken,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hello RockGPT" }],
        fast: true,
      }),
    });
    assert.strictEqual(validGuestChatRes.status, 200, "Valid active guest token allowed to stream (HTTP 200)");
    assert.strictEqual(
      validGuestChatRes.headers.get("content-type"),
      "text/event-stream",
      "Valid active guest receives text/event-stream SSE"
    );
    // Cancel stream promptly
    try {
      const reader = validGuestChatRes.body.getReader();
      await reader.cancel();
    } catch (_) {}
    console.log("  ✓ PASS: Valid active guest token initiates SSE stream successfully");

    console.log("\n==================================================");
    console.log("TEST SUMMARY: ALL GUEST ACCESS TESTS PASSED (5/5)");
    console.log("==================================================\n");
  } finally {
    await stopServer();
    process.exit(0);
  }
}

runGuestSessionTests().catch(async (err) => {
  console.error("Test error:", err);
  await stopServer();
  process.exit(1);
});
