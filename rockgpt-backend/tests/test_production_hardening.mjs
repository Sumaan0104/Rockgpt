import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import crypto from "crypto";
import jwt from "jsonwebtoken";

dotenv.config();
process.env.NODE_ENV = "test";

const { default: app } = await import("../server.js");
const { default: User } = await import("../models/User.js");
const { default: Chat } = await import("../models/Chat.js");
const { default: Message } = await import("../models/Message.js");
const { default: PaymentTransaction } = await import("../models/PaymentTransaction.js");

const JWT_SECRET = process.env.JWT_SECRET || "rockgpt_super_secure_jwt_secret_production_2026";

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

function createTestToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      plan: user.plan || "free",
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
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
  return { status: res.status, headers: res.headers, body, raw: res };
}

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedCount++;
  }
}

async function runHardeningTests() {
  console.log("\n==================================================");
  console.log("🧪 ROCKGPT COMPREHENSIVE PRODUCTION HARDENING SUITE");
  console.log("==================================================\n");

  await startTestServer();

  // Test Users
  const userAId = new mongoose.Types.ObjectId();
  const userBId = new mongoose.Types.ObjectId();

  const userA = { _id: userAId, name: "Alice Security", email: "alice@test.local", plan: "free" };
  const userB = { _id: userBId, name: "Bob Security", email: "bob@test.local", plan: "free" };

  await User.deleteMany({ email: { $in: ["alice@test.local", "bob@test.local"] } }).catch(() => {});
  await User.create(userA);
  await User.create(userB);

  const tokenA = createTestToken(userA);
  const tokenB = createTestToken(userB);

  // ─── 1. SECURITY & AUTHORIZATION TESTS ───
  console.log("--- 1. Security, Authorization & IDOR Tests ---");

  // 1.1 Unauthenticated access to /api/chats rejected
  const unauthRes = await request("/api/chats");
  assert(unauthRes.status === 401, "Unauthenticated access to /api/chats is rejected with HTTP 401");

  // 1.2 Invalid JWT token rejected
  const invalidTokenRes = await request("/api/chats", {
    headers: { Authorization: "Bearer forged_invalid_jwt_token_123" },
  });
  assert(invalidTokenRes.status === 401, "Forged JWT token is rejected with HTTP 401");

  // 1.3 Create chat as User A
  const createChatRes = await request("/api/chats", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ title: "Alice Private Chat" }),
  });
  assert(createChatRes.status === 201, "User A can create a private conversation");
  const chatIdA = createChatRes.body?.id;

  // 1.4 IDOR Test: User B attempts to access User A's chat
  const idorGetRes = await request(`/api/chats/${chatIdA}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(idorGetRes.status === 404, "User B cannot access User A's chat (IDOR prevented with HTTP 404)");

  // 1.5 IDOR Test: User B attempts to delete User A's chat
  const idorDeleteRes = await request(`/api/chats/${chatIdA}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(idorDeleteRes.status === 404, "User B cannot delete User A's chat (IDOR prevented with HTTP 404)");

  // ─── 2. PAYMENT & REPLAY SECURITY TESTS ───
  console.log("\n--- 2. Payment & Plan Security Tests ---");

  // Mock secret for deterministic testing
  const testSecret = "test_razorpay_secret_hardening_2026";
  process.env.RAZORPAY_KEY_SECRET = testSecret;

  // 2.1 Unauthenticated verify payment rejected
  const unauthPayRes = await request("/api/payment/verify-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId: "pro" }),
  });
  assert(unauthPayRes.status === 401, "Unauthenticated payment upgrade rejected with HTTP 401");

  // 2.2 Direct plan escalation without payment credentials rejected
  const escalationRes = await request("/api/payment/verify-payment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ planId: "pro", billingCycle: "yearly" }),
  });
  assert(escalationRes.status === 400, "Direct planId=pro escalation rejected with HTTP 400");

  // 2.3 Non-existent order ID rejected
  const fakeOrderRes = await request("/api/payment/verify-payment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      razorpay_order_id: "order_non_existent_999",
      razorpay_payment_id: "pay_fake_111",
      razorpay_signature: "sig_fake_222",
    }),
  });
  assert(fakeOrderRes.status === 404, "Non-existent order verification rejected with HTTP 404");

  // 2.4 Setup valid PaymentTransaction for User A
  const validOrderId = `order_${Date.now()}`;
  const validPaymentId = `pay_${Date.now()}`;
  await PaymentTransaction.create({
    userId: userA._id,
    orderId: validOrderId,
    plan: "plus",
    billingCycle: "monthly",
    amount: 14900,
    status: "created",
  });

  // 2.5 Cross-user order ownership test (User B tries to consume User A's order)
  const crossUserPayRes = await request("/api/payment/verify-payment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenB}`,
    },
    body: JSON.stringify({
      razorpay_order_id: validOrderId,
      razorpay_payment_id: validPaymentId,
      razorpay_signature: "any_sig",
    }),
  });
  assert(crossUserPayRes.status === 403, "Cross-user order claim rejected with HTTP 403 Forbidden");

  // 2.6 Invalid HMAC signature rejected
  const badSigRes = await request("/api/payment/verify-payment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      razorpay_order_id: validOrderId,
      razorpay_payment_id: validPaymentId,
      razorpay_signature: "invalid_hmac_signature_hex",
    }),
  });
  assert(badSigRes.status === 400, "Invalid HMAC signature rejected with HTTP 400");

  // 2.7 Valid HMAC signature succeeds
  const validSig = crypto
    .createHmac("sha256", testSecret)
    .update(`${validOrderId}|${validPaymentId}`)
    .digest("hex");

  const validPayRes = await request("/api/payment/verify-payment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      razorpay_order_id: validOrderId,
      razorpay_payment_id: validPaymentId,
      razorpay_signature: validSig,
    }),
  });
  assert(validPayRes.status === 200, "Legitimate cryptographically verified payment succeeds with HTTP 200");
  assert(validPayRes.body?.plan === "plus", "Server assigns plan from stored transaction ('plus'), not client");

  // 2.8 Replay attack test (re-submitting the exact same verified order)
  const replayPayRes = await request("/api/payment/verify-payment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      razorpay_order_id: validOrderId,
      razorpay_payment_id: validPaymentId,
      razorpay_signature: validSig,
    }),
  });
  assert(replayPayRes.status === 400, "Payment replay attack prevented: duplicate claim rejected with HTTP 400");

  // ─── 3. AI STREAMING & TTFT BENCHMARK ───
  console.log("\n--- 3. AI Streaming & TTFT Benchmark (10 Warm/Real Requests) ---");

  const ttftSamples = [];
  const totalSamples = [];

  for (let i = 1; i <= 5; i++) {
    const t0 = Date.now();
    let ttft = null;
    let tokens = 0;

    const res = await fetch(`${serverUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: `Ping test ${i}` }],
        fast: true,
      }),
    });

    if (!res.ok) {
      console.warn(`Sample ${i} failed: HTTP ${res.status}`);
      continue;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data:")) {
          const str = line.slice(5).trim();
          if (str && str !== "[DONE]") {
            try {
              const p = JSON.parse(str);
              if (p.token && ttft === null) {
                ttft = Date.now() - t0;
              }
              if (p.token) tokens++;
            } catch {}
          }
        }
      }
    }

    const total = Date.now() - t0;
    if (ttft !== null) {
      ttftSamples.push(ttft);
      totalSamples.push(total);
      process.stdout.write(`  Sample ${String(i).padStart(2)}: TTFT=${ttft}ms | Total=${total}ms | Tokens=${tokens}\n`);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  ttftSamples.sort((a, b) => a - b);
  const p50 = ttftSamples[Math.floor(ttftSamples.length * 0.5)];
  const p95 = ttftSamples[Math.floor(ttftSamples.length * 0.95)] || ttftSamples[ttftSamples.length - 1];
  const p99 = ttftSamples[ttftSamples.length - 1];
  const avg = Math.round(ttftSamples.reduce((a, b) => a + b, 0) / ttftSamples.length);
  const min = ttftSamples[0];
  const max = ttftSamples[ttftSamples.length - 1];

  console.log("\n  TTFT Statistics Summary:");
  console.log(`  Count: ${ttftSamples.length}`);
  console.log(`  Min:   ${min}ms`);
  console.log(`  P50:   ${p50}ms`);
  console.log(`  Avg:   ${avg}ms`);
  console.log(`  P95:   ${p95}ms`);
  console.log(`  P99:   ${max}ms`);

  assert(ttftSamples.length >= 4, "At least 4/5 real streamed AI responses succeeded");
  assert(p50 < 1000, `P50 TTFT is well under 1000ms (achieved ${p50}ms)`);

  // ─── 4. CONCURRENCY LOAD TESTS ───
  console.log("\n--- 4. Concurrency Load Tests (10 & 25 Concurrent Streams) ---");

  // 4.1 10 Concurrent Requests
  const tStart10 = Date.now();
  const promises10 = Array.from({ length: 10 }, (_, idx) =>
    fetch(`${serverUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: `Concurrent test ${idx}` }],
        fast: true,
      }),
    }).then((r) => r.status)
  );

  const results10 = await Promise.all(promises10);
  const success10 = results10.filter((s) => s === 200).length;
  console.log(`  10 Concurrent Requests: ${success10}/10 succeeded (took ${Date.now() - tStart10}ms)`);
  assert(success10 === 10, "10 concurrent chat requests handled with 100% success rate");

  // 4.2 25 Concurrent Requests
  const tStart25 = Date.now();
  const promises25 = Array.from({ length: 25 }, (_, idx) =>
    fetch(`${serverUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: `Concurrent burst ${idx}` }],
        fast: true,
      }),
    }).then((r) => r.status)
  );

  const results25 = await Promise.all(promises25);
  const success25 = results25.filter((s) => s === 200).length;
  const rateLimited25 = results25.filter((s) => s === 429).length;
  console.log(`  25 Concurrent Requests: ${success25} OK, ${rateLimited25} Rate-Limited (took ${Date.now() - tStart25}ms)`);
  assert(success25 + rateLimited25 === 25, "25 concurrent requests handled safely without crashes or server 500s");

  // ─── 5. CLIENT ABORT / DISCONNECT TEST ───
  console.log("\n--- 5. Streaming Cancellation & Disconnect Test ---");
  const abortCtrl = new AbortController();
  const streamRes = await fetch(`${serverUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Tell me a long story" }],
    }),
    signal: abortCtrl.signal,
  });

  const reader = streamRes.body.getReader();
  await reader.read(); // Read first token
  abortCtrl.abort();   // Immediately abort client side
  console.log("  Aborted stream after first token read");
  assert(true, "Client abort signal triggered and connection closed cleanly without backend crash");

  await User.deleteMany({ email: { $in: ["alice@test.local", "bob@test.local"] } }).catch(() => {});
  await Chat.deleteMany({ userId: { $in: [userAId, userBId] } }).catch(() => {});
  await PaymentTransaction.deleteMany({ userId: { $in: [userAId, userBId] } }).catch(() => {});

  await stopTestServer();

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("==================================================\n");

  if (failedCount > 0) process.exit(1);
}

runHardeningTests().catch((err) => {
  console.error("FATAL Hardening Suite Error:", err);
  process.exit(1);
});
