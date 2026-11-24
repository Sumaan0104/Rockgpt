import "dotenv/config";
import http from "http";
import mongoose from "mongoose";
import User from "../models/User.js";
import Chat from "../models/Chat.js";

async function runBenchmark() {
  console.log("=== ROCKGPT LATENCY BENCHMARK ===");

  // 1. Database Connection & Query Measurement
  const dbStart = performance.now();
  if (process.env.MONGODB_URI) {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
  }
  const dbConnectTime = (performance.now() - dbStart).toFixed(2);
  console.log(`[DB Connect Time]: ${dbConnectTime}ms`);

  // DB Query (Indexed Lookup by Email)
  const qStart = performance.now();
  const testUser = await User.findOne({ email: "test.admin@rockgpt.ai" }).lean();
  const qDuration = (performance.now() - qStart).toFixed(2);
  console.log(`[DB User Lookup (findOne indexed)]: ${qDuration}ms (Found: ${!!testUser})`);

  // DB Chat Query
  const chatQStart = performance.now();
  const testChat = await Chat.findOne().lean();
  const chatQDuration = (performance.now() - chatQStart).toFixed(2);
  console.log(`[DB Chat Query]: ${chatQDuration}ms`);

  // 2. Health Endpoint Latency via Express App
  process.env.NODE_ENV = "test";
  const { default: app } = await import("../server.js");
  const server = http.createServer(app);
  await new Promise((res) => server.listen(0, res));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  // Cold /health request
  const healthStart = performance.now();
  const healthRes = await fetch(`${baseUrl}/health`);
  const healthData = await healthRes.json();
  const healthDuration = (performance.now() - healthStart).toFixed(2);
  console.log(`[Express /health Cold Latency]: ${healthDuration}ms (Status: ${healthRes.status}, data: ${JSON.stringify(healthData)})`);

  // Warm /health request (keep-alive)
  const warmStart = performance.now();
  const warmRes = await fetch(`${baseUrl}/health`);
  await warmRes.json();
  const warmDuration = (performance.now() - warmStart).toFixed(2);
  console.log(`[Express /health Warm Latency]: ${warmDuration}ms (Status: ${warmRes.status})`);

  // 3. /api/version Latency
  const verStart = performance.now();
  const verRes = await fetch(`${baseUrl}/api/version`);
  const verData = await verRes.json();
  const verDuration = (performance.now() - verStart).toFixed(2);
  console.log(`[Express /api/version Latency]: ${verDuration}ms (Engine: ${verData.engine})`);

  // 4. TTFT on /api/chat
  if (process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY) {
    console.log("Measuring TTFT (Time-to-First-Token) on /api/chat...");
    const chatStart = performance.now();
    let ttft = null;
    let totalTime = null;

    try {
      const resp = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-service-key": process.env.INTERNAL_SERVICE_KEY || "dummy-service-key",
        },
        body: JSON.stringify({
          fast: true,
          messages: [{ role: "user", content: "Reply with the single word: READY" }],
        }),
      });

      if (resp.ok && resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          if (text.includes("token") && ttft === null) {
            ttft = (performance.now() - chatStart).toFixed(2);
            console.log(`[Chat TTFT (Time to First Token)]: ${ttft}ms`);
          }
        }
        totalTime = (performance.now() - chatStart).toFixed(2);
        console.log(`[Chat Total Stream Time]: ${totalTime}ms`);
      } else {
        console.log(`[Chat Endpoint Status]: ${resp.status}`);
      }
    } catch (e) {
      console.log(`[Chat TTFT Error]: ${e.message}`);
    }
  }

  console.log("=== BENCHMARK COMPLETE ===");
  server.close();
  await mongoose.disconnect();
  process.exit(0);
}

runBenchmark().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
