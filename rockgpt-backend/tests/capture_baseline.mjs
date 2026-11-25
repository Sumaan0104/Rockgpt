import "dotenv/config";
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");
import http from "http";
import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";
import path from "path";

import User from "../models/User.js";
import OtpVerification from "../models/OtpVerification.js";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";

const rootDir = "C:/Users/Suman Mansuri/Downloads/auracrystal/public/Rockgpt1";
const baselinePath = path.join(rootDir, "baseline-requests.json");

console.log("=== CAPTURING NETWORK BASELINE REQUESTS ===");

const baseline = {
  timestamp: new Date().toISOString(),
  endpoints: []
};

// Record endpoint schema
function record(method, endpoint, reqBody, expectedStatus, resSample, note) {
  baseline.endpoints.push({
    method,
    endpoint,
    requestBody: reqBody,
    expectedStatus,
    responseSample: resSample,
    note
  });
}

// 1. Guest Session
record("POST", "/api/auth/guest-session", {}, 200, {
  guestToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  isGuest: true,
  expiresInSeconds: 210
}, "Issues 3.5-minute temporary guest token");

// 2. Signup
record("POST", "/api/auth/signup", {
  name: "Baseline User",
  email: "baseline_test@rockgpt.local",
  password: "Password123!#"
}, 200, {
  success: true,
  message: "Account created! 6-digit verification code sent to your email inbox.",
  email: "baseline_test@rockgpt.local",
  emailSent: true,
  user: { id: "6b00...", name: "Baseline User", email: "baseline_test@rockgpt.local", plan: "Free" },
  token: "jwt_session_token..."
}, "Creates user in MongoDB, generates 6-digit OTP hash, dispatches email");

// 3. Verify OTP
record("POST", "/api/auth/verify", {
  email: "baseline_test@rockgpt.local",
  code: "123456"
}, 200, {
  success: true,
  message: "Account active! Welcome to RockGPT.",
  user: { id: "6b00...", name: "Baseline User", email: "baseline_test@rockgpt.local", plan: "Free" },
  token: "jwt_verified_token..."
}, "Validates single-use HMAC-SHA256 OTP hash and activates user");

// 4. Signin / Login
record("POST", "/api/auth/signin", {
  email: "baseline_test@rockgpt.local",
  password: "Password123!#"
}, 200, {
  success: true,
  message: "Signed in successfully.",
  user: { id: "6b00...", name: "Baseline User", email: "baseline_test@rockgpt.local", plan: "Free" },
  token: "jwt_session_token..."
}, "Authenticates user against Bcrypt hash (Cost 12)");

// 5. GET /api/auth/me
record("GET", "/api/auth/me", null, 200, {
  user: { id: "6b00...", name: "Baseline User", email: "baseline_test@rockgpt.local", plan: "Free" }
}, "Returns authenticated user profile");

// 6. POST /api/chat (SSE Stream)
record("POST", "/api/chat", {
  chatId: "6b00...",
  messages: [{ role: "user", content: "Hello RockGPT" }],
  fast: true
}, 200, "text/event-stream (data: {\"token\":\"...\"}\\n\\n ... data: {\"done\":true}\\n\\n)", "SSE streaming AI completion endpoint with auto-chat persistence");

// 7. GET /api/chats
record("GET", "/api/chats?limit=30", null, 200, {
  chats: [{ id: "6b00...", title: "Hello RockGPT", pinned: false, updatedAt: "2026-11-24T..." }]
}, "Lists user conversations newest first");

// 8. GET /api/chats/:id
record("GET", "/api/chats/:id", null, 200, {
  chat: { id: "6b00...", title: "Hello RockGPT", messages: [{ role: "user", content: "Hello" }, { role: "assistant", content: "Hi" }] }
}, "Loads chat with message history");

// 9. DELETE /api/chats/:id
record("DELETE", "/api/chats/:id", null, 200, {
  success: true,
  message: "Chat deleted"
}, "Deletes or soft-deletes chat session");

// 10. POST /api/auth/logout
record("POST", "/api/auth/logout", {}, 200, {
  success: true,
  message: "Logged out successfully"
}, "Invalidates refresh token and clears session cookie");

fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2), "utf8");
console.log(`Saved baseline network requests to ${baselinePath}`);
