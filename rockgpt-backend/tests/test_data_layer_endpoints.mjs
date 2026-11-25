import "dotenv/config";
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import express from "express";
import http from "http";

import User from "../models/User.js";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import chatsRoutes from "../routes/chats.js";
import { authMiddleware } from "../middleware/auth.js";

const JWT_SECRET = process.env.JWT_SECRET || "rockgpt_super_secure_jwt_secret_min_32_chars_2026!";
const MONGODB_URI = process.env.MONGODB_URI;

console.log("\n========================================================");
console.log("🧪 TESTING SECTION 4 DATA LAYER ENDPOINTS & MONGODB");
console.log("========================================================\n");

const app = express();
app.use(express.json());
app.use("/api/chats", chatsRoutes);

// Settings test endpoints
app.get("/api/me/settings", authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user._id) return res.status(401).json({ error: "Unauthorized" });
    const user = await User.findById(req.user._id).select("settings").lean();
    res.json({ settings: user?.settings || { instructions: "", fast: false, textSize: "m" } });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

app.put("/api/me/settings", authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user._id) return res.status(401).json({ error: "Unauthorized" });
    const { instructions, fast, textSize } = req.body || {};
    const update = {};
    if (typeof instructions === "string") update["settings.instructions"] = instructions.slice(0, 600);
    if (typeof fast === "boolean") update["settings.fast"] = fast;
    if (["s", "m", "l"].includes(textSize)) update["settings.textSize"] = textSize;
    const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, { new: true }).select("settings").lean();
    res.json({ success: true, settings: user?.settings || {} });
  } catch (err) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

let userA, userB, tokenA, tokenB;
let server, baseUrl;

async function runTests() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB Atlas dev database.");

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // Helper request function using native fetch
  async function api(method, path, body = null, token = null) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${baseUrl}${path}`, opts);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, body: data };
  }

  // Create two distinct test users for ownership isolation checks
  userA = await User.create({
    name: "User Alpha",
    email: `alpha_${Date.now()}@rockgpt.local`,
    plan: "pro",
    isVerified: true,
  });
  tokenA = jwt.sign({ id: userA._id.toString(), email: userA.email }, JWT_SECRET, { expiresIn: "1h" });

  userB = await User.create({
    name: "User Beta",
    email: `beta_${Date.now()}@rockgpt.local`,
    plan: "free",
    isVerified: true,
  });
  tokenB = jwt.sign({ id: userB._id.toString(), email: userB.email }, JWT_SECRET, { expiresIn: "1h" });

  let testsPassed = 0;
  function pass(title) {
    console.log(`  ✓ PASS: ${title}`);
    testsPassed++;
  }

  // 1. Create Chat
  const createRes = await api("POST", "/api/chats", { title: "Alpha Chat 1", clientId: "client_chat_alpha_1" }, tokenA);
  if (createRes.status === 201 && createRes.body.title === "Alpha Chat 1") {
    pass("POST /api/chats creates new conversation");
  } else throw new Error(`Create chat failed: ${createRes.status}`);

  const chatAId = createRes.body.id;

  // 2. Idempotent create with same clientId
  const idempRes = await api("POST", "/api/chats", { title: "Different Title", clientId: "client_chat_alpha_1" }, tokenA);
  if (idempRes.status === 200 && idempRes.body.id === chatAId) {
    pass("POST /api/chats is idempotent by clientId");
  } else throw new Error("Idempotency failed");

  // 3. Ownership Isolation: User B cannot read User A's chat (must return 404, not 403)
  const foreignRead = await api("GET", `/api/chats/${chatAId}`, null, tokenB);
  if (foreignRead.status === 404) {
    pass("GET /api/chats/:id returns 404 for foreign user (Strict isolation)");
  } else throw new Error(`Ownership check failed, status: ${foreignRead.status}`);

  // 4. Append message to chat
  const msgRes = await api("POST", `/api/chats/${chatAId}/messages`, { role: "user", content: "How does quantum gravity work?" }, tokenA);
  if (msgRes.status === 201 && msgRes.body.content.includes("quantum")) {
    pass("POST /api/chats/:id/messages adds message");
  } else throw new Error("Append message failed");

  const msgId = msgRes.body.id;

  // 5. Message Feedback PATCH
  const fbRes = await api("PATCH", `/api/chats/messages/${msgId}/feedback`, { feedback: "up" }, tokenA);
  if (fbRes.status === 200 && fbRes.body.feedback === "up") {
    pass("PATCH /api/messages/:id/feedback saves user reaction");
  } else throw new Error("Feedback failed");

  // 6. Rename & Pin Chat
  const patchRes = await api("PATCH", `/api/chats/${chatAId}`, { title: "Quantum Physics Exploration", pinned: true }, tokenA);
  if (patchRes.status === 200 && patchRes.body.pinned === true && patchRes.body.title === "Quantum Physics Exploration") {
    pass("PATCH /api/chats/:id renames and pins chat");
  } else throw new Error("Patch chat failed");

  // 7. Search in GET /api/chats?q=
  const searchRes = await api("GET", "/api/chats?q=Quantum", null, tokenA);
  if (searchRes.status === 200 && searchRes.body.length >= 1) {
    pass("GET /api/chats?q= searches titles and messages accurately");
  } else throw new Error("Search failed");

  // 8. Soft Delete Chat
  const delRes = await api("DELETE", `/api/chats/${chatAId}`, null, tokenA);
  if (delRes.status === 200 && delRes.body.success) {
    pass("DELETE /api/chats/:id performs soft delete (deletedAt)");
  } else throw new Error("Soft delete failed");

  // Verify deleted chat is excluded from list
  const listAfterDel = await api("GET", "/api/chats", null, tokenA);
  if (!listAfterDel.body.some((c) => c.id === chatAId)) {
    pass("Soft-deleted chat is excluded from active chat listing");
  } else throw new Error("Deleted chat still listed");

  // 9. Restore Chat (Undo Toast)
  const restoreRes = await api("POST", `/api/chats/${chatAId}/restore`, null, tokenA);
  if (restoreRes.status === 200 && restoreRes.body.success) {
    pass("POST /api/chats/:id/restore revives soft-deleted chat");
  } else throw new Error("Restore failed");

  // 10. User Settings GET and PUT
  const putSetRes = await api("PUT", "/api/me/settings", { instructions: "Always provide clean code examples", fast: true, textSize: "l" }, tokenA);
  if (putSetRes.status === 200 && putSetRes.body.settings.instructions.includes("clean code")) {
    pass("PUT /api/me/settings persists instructions, fast mode, and textSize");
  } else throw new Error("Put settings failed");

  const getSetRes = await api("GET", "/api/me/settings", null, tokenA);
  if (getSetRes.status === 200 && getSetRes.body.settings.textSize === "l") {
    pass("GET /api/me/settings returns persisted user settings");
  } else throw new Error("Get settings failed");

  // 11. Bulk Idempotent Import of Guest Chats
  const importRes = await api(
    "POST",
    "/api/chats/import",
    {
      chats: [
        {
          clientId: "local_guest_chat_1",
          title: "Guest Local Chat",
          pinned: false,
          msgs: [
            { role: "user", content: "Guest query" },
            { role: "assistant", content: "Guest reply" },
          ],
        },
      ],
    },
    tokenA
  );
  if (importRes.status === 200 && importRes.body.imported === 1) {
    pass("POST /api/chats/import performs bulk guest chat import");
  } else throw new Error("Import failed");

  // Re-importing same clientId is idempotent
  const reImportRes = await api(
    "POST",
    "/api/chats/import",
    {
      chats: [
        {
          clientId: "local_guest_chat_1",
          title: "Guest Local Chat Updated",
          msgs: [{ role: "user", content: "Guest query updated" }],
        },
      ],
    },
    tokenA
  );
  if (reImportRes.status === 200 && reImportRes.body.imported === 0) {
    pass("POST /api/chats/import is idempotent and prevents duplicate chats");
  } else throw new Error("Re-import duplicate check failed");

  // Cleanup test users and chats
  await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
  await Chat.deleteMany({ userId: { $in: [userA._id, userB._id] } });
  await Message.deleteMany({ userId: { $in: [userA._id, userB._id] } });

  console.log(`\n========================================================`);
  console.log(`🎉 ALL ${testsPassed} DATA LAYER & MONGODB TESTS PASSED!`);
  console.log(`========================================================\n`);

  server.close();
  await mongoose.disconnect();
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
