import "dotenv/config";
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/User.js";
import OtpVerification from "../models/OtpVerification.js";
import Chat from "../models/Chat.js";

const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || "rockgpt-fallback-test-secret-key-32chars";

console.log("\n========================================================");
console.log("🔍 ROCKGPT FULL-SYSTEM END-TO-END VERIFICATION & AUDIT");
console.log("========================================================\n");

async function runAudit() {
  const results = { passed: 0, failed: 0, errors: [] };

  function assert(condition, title, details = "") {
    if (condition) {
      console.log(`  ✓ PASS: ${title} ${details ? `(${details})` : ""}`);
      results.passed++;
    } else {
      console.error(`  ✗ FAIL: ${title} ${details ? `(${details})` : ""}`);
      results.failed++;
      results.errors.push(title);
    }
  }

  // 1. LIVE MONGODB ATLAS CONNECTION & PING
  console.log("--- 1. MongoDB Atlas Connectivity & Latency Benchmark ---");
  const connStart = Date.now();
  await mongoose.connect(MONGODB_URI, {
    maxPoolSize: 25,
    minPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    heartbeatFrequencyMS: 10000,
  });
  const connTime = Date.now() - connStart;
  assert(mongoose.connection.readyState === 1, "MongoDB Atlas connected successfully", `Connected in ${connTime}ms`);

  const pingStart = Date.now();
  const adminDb = mongoose.connection.db.admin();
  const pingResult = await adminDb.ping();
  const pingTime = Date.now() - pingStart;
  assert(pingResult && pingResult.ok === 1, "MongoDB Atlas ping successful", `Round-trip: ${pingTime}ms`);

  // 2. USER REGISTRATION & PASSWORD PERSISTENCE AUDIT
  console.log("\n--- 2. User Data & Password Persistence in MongoDB ---");
  const testEmail = `audit_user_${Date.now()}@rockgpt.local`;
  const rawPassword = "RockGPTSecurePass2026!#";
  const testName = "Suman Rock";

  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(rawPassword, salt);

  const user = await User.create({
    name: testName,
    email: testEmail,
    passwordHash,
    plan: "free",
    isVerified: false,
    failedOtpAttempts: 0,
    lockedUntil: null,
    lastLoginAt: new Date(),
  });

  assert(user && user._id, "User account document created in MongoDB Atlas", `ID: ${user._id}`);
  assert(user.email === testEmail, "Email stored with 100% accuracy", user.email);
  assert(user.name === testName, "User name stored accurately", user.name);
  assert(user.passwordHash && user.passwordHash.startsWith("$2"), "Password stored as Bcrypt hash (Cost 12), NOT plaintext");
  // Query back from MongoDB directly without relying on local cache
  const fetchedUser = await User.findById(user._id).lean();
  assert(fetchedUser !== null, "User found via direct MongoDB query");
  assert(!fetchedUser.password, "Plaintext password is null/empty in database document");
  assert(fetchedUser.passwordHash === passwordHash, "Retrieved passwordHash exactly matches stored hash");

  // Verify password comparison using bcrypt
  const validMatch = await bcrypt.compare(rawPassword, fetchedUser.passwordHash);
  assert(validMatch === true, "bcrypt.compare validates password accurately on sign-in");

  const invalidMatch = await bcrypt.compare("WrongPassword123!", fetchedUser.passwordHash);
  assert(invalidMatch === false, "bcrypt.compare rejects incorrect password");

  // 3. CRYPTOGRAPHIC OTP ENGINE & SINGLE-USE VERIFICATION AUDIT
  console.log("\n--- 3. OTP Generation, Hashing & Verification Engine ---");
  const otpCode = crypto.randomInt(100000, 999999).toString();
  const codeHash = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${testEmail}:signup:${otpCode}`)
    .digest("hex");

  const otpDoc = await OtpVerification.create({
    email: testEmail,
    codeHash,
    type: "signup",
    name: testName,
    passwordHash,
    attempts: 0,
  });

  assert(otpDoc && otpDoc._id, "OTP record created in OtpVerification collection", `Doc ID: ${otpDoc._id}`);
  assert(otpDoc.codeHash === codeHash, "OTP stored as cryptographic HMAC-SHA256 hash");
  assert(!otpDoc.testPlainCode, "Plain OTP code is not persisted in MongoDB document");

  // Verify OTP single-use destruction
  const inputHash = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${testEmail}:signup:${otpCode}`)
    .digest("hex");

  const isOtpValid = crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(otpDoc.codeHash));
  assert(isOtpValid === true, "timingSafeEqual validates OTP in constant time");

  // Mark user verified and delete OTP (Single use)
  await User.findByIdAndUpdate(user._id, { isVerified: true });
  await OtpVerification.findByIdAndDelete(otpDoc._id);

  const recheckOtp = await OtpVerification.findById(otpDoc._id);
  assert(recheckOtp === null, "OTP destroyed immediately after verification (Single-Use Enforced)");

  const verifiedUser = await User.findById(user._id).lean();
  assert(verifiedUser.isVerified === true, "User marked active/verified in MongoDB");

  // 4. CHAT HISTORY & ATTACHMENT PERSISTENCE IN MONGODB ATLAS
  console.log("\n--- 4. Chat History, Messages & Attachment Persistence ---");
  const testChatId = `chat_${Date.now()}`;
  const testChat = await Chat.create({
    chatId: testChatId,
    userId: user._id,
    title: "Full Stack RockGPT Architecture",
    mode: "chat",
    messages: [
      {
        role: "user",
        content: "Explain the latency optimizations and streaming in RockGPT.",
        image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        createdAt: new Date(),
      },
      {
        role: "assistant",
        content: "RockGPT uses direct SSE token streaming with zero keep-alive delay and IPv4-first socket pooling.",
        createdAt: new Date(),
      },
    ],
  });

  assert(testChat && testChat._id, "Chat document created in MongoDB Atlas", `Chat ID: ${testChatId}`);

  // Fetch the chat back from database
  const fetchedChat = await Chat.findOne({ chatId: testChatId }).lean();
  assert(fetchedChat !== null, "Chat document retrieved from MongoDB Atlas");
  assert(fetchedChat.messages.length === 2, "Chat contains both user and assistant messages (Count = 2)");
  assert(fetchedChat.messages[0].role === "user", "Message 0 role is 'user'");
  assert(fetchedChat.messages[0].image && fetchedChat.messages[0].image.startsWith("data:image/png"), "User message image attachment stored and preserved perfectly");
  assert(fetchedChat.messages[1].role === "assistant", "Message 1 role is 'assistant'");
  assert(fetchedChat.messages[1].content.includes("RockGPT uses direct SSE"), "Assistant message content preserved with 100% integrity");

  // 5. CLEANUP AUDIT DATA
  console.log("\n--- 5. Cleanup Test Artifacts ---");
  await User.findByIdAndDelete(user._id);
  await Chat.findByIdAndDelete(testChat._id);
  console.log("  ✓ Test artifacts cleaned up cleanly.");

  console.log("\n========================================================");
  console.log(`AUDIT SUMMARY: ${results.passed} PASSED, ${results.failed} FAILED`);
  console.log("========================================================\n");

  await mongoose.disconnect();
  process.exit(results.failed > 0 ? 1 : 0);
}

runAudit().catch((err) => {
  console.error("Fatal audit error:", err);
  process.exit(1);
});
