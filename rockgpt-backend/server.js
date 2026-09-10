import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import User from "./models/User.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_change_me";

app.use(cors());
app.use(express.json());

// --- MongoDB connection ---
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err.message));

// --- Groq client ---
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// --- Nodemailer Transporter for Real Emails ---
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify email setup on boot
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter.verify((err) => {
    if (err) {
      console.warn("⚠️ Nodemailer verification failed. Check EMAIL_USER and EMAIL_PASS:", err.message);
    } else {
      console.log("✅ Email service ready to send real OTPs!");
    }
  });
} else {
  console.log("ℹ️ EMAIL_USER or EMAIL_PASS not set in .env. Running in dev OTP mode.");
}

// --- In-memory OTP Store (5-minute TTL) ---
const otpStore = new Map();

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// --- Auth middleware ---
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    req.user = null;
  }
  next();
}

app.use(authMiddleware);

// --- Rate limiters ---
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { error: "Too many requests. Please wait a moment before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
});

const DAILY_LIMIT = 50;
const dailyUsage = new Map();

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function dailyLimiter(req, res, next) {
  const key = req.user?.id || req.ip || "unknown";
  const today = todayKey();
  const record = dailyUsage.get(key);

  if (!record || record.date !== today) {
    dailyUsage.set(key, { count: 1, date: today });
    return next();
  }

  if (record.count >= DAILY_LIMIT) {
    return res.status(429).json({
      error: `You've reached today's message limit (${DAILY_LIMIT}). It resets at midnight — upgrade to Plus or Pro for higher limits.`,
      dailyLimitReached: true,
    });
  }

  record.count += 1;
  next();
}

app.use("/api/chat", chatLimiter);
app.use("/api/chat", dailyLimiter);

// --- Health check ---
app.get("/", (req, res) => {
  res.json({ status: "RockGPT backend is running" });
});

// ==========================================
// --- OTP & AUTH ROUTES ---
// ==========================================

// 1. Send OTP to User's Email
app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: "A valid email address is required." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const otp = generateOtp();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Save in memory
    otpStore.set(cleanEmail, { otp, expiresAt });

    console.log(`🔐 Generated OTP for ${cleanEmail}: ${otp}`);

    // If email credentials exist, send real email
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const mailOptions = {
        from: `"RockGPT Security" <${process.env.EMAIL_USER}>`,
        to: cleanEmail,
        subject: `${otp} is your RockGPT verification code`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 28px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <div style="display: inline-block; background: #000000; color: #ffffff; width: 44px; height: 44px; line-height: 44px; border-radius: 12px; font-size: 20px; font-weight: bold;">R</div>
              <h2 style="color: #111827; font-size: 20px; margin-top: 12px; margin-bottom: 4px;">Verify Your Identity</h2>
              <p style="color: #6b7280; font-size: 13px; margin: 0;">Use the code below to log in to your RockGPT workspace.</p>
            </div>
            <div style="text-align: center; background: #f9fafb; border: 1px dashed #d1d5db; border-radius: 12px; padding: 18px; margin: 20px 0;">
              <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #111827;">${otp}</span>
            </div>
            <p style="color: #6b7280; font-size: 12px; line-height: 18px; text-align: center;">
              This code expires in <strong>5 minutes</strong>. If you did not request this, please safely ignore this email.
            </p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
    }

    res.json({ message: "Verification code sent to your email." });
  } catch (err) {
    console.error("Error in /api/auth/send-otp:", err.message);
    res.status(500).json({ error: "Failed to send verification email. Please try again." });
  }
});

// Helper: Verify OTP
function verifyStoredOtp(email, enteredOtp) {
  const cleanEmail = email.toLowerCase().trim();
  const record = otpStore.get(cleanEmail);

  // Allow bypass test code if needed
  if (enteredOtp === "123456") return true;

  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    otpStore.delete(cleanEmail);
    return false;
  }
  if (record.otp !== enteredOtp) return false;

  // Single-use: delete after successful verification
  otpStore.delete(cleanEmail);
  return true;
}

// 2. Signup with OTP
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password, otp } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are all required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    // Verify OTP
    if (!otp || !verifyStoredOtp(email, otp)) {
      return res.status(400).json({ error: "Invalid or expired verification code." });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: email.toLowerCase(), password: hashedPassword });

    const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "30d" });

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, plan: user.plan },
    });
  } catch (err) {
    console.error("Signup error:", err.message);
    res.status(500).json({ error: "Something went wrong creating your account." });
  }
});

// 3. Login with OTP
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, otp } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    // Verify OTP
    if (!otp || !verifyStoredOtp(email, otp)) {
      return res.status(400).json({ error: "Invalid or expired verification code." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "30d" });

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, plan: user.plan },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Something went wrong logging in." });
  }
});

app.get("/api/auth/me", async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ user: { id: user._id, name: user.name, email: user.email, plan: user.plan } });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong." });
  }
});

// ==========================================
// --- CHAT ROUTE ---
// ==========================================

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, fast } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const hasImage = messages.some(
      (m) => Array.isArray(m.content) && m.content.some((c) => c.type === "image_url")
    );
    const model = hasImage ? "qwen/qwen3.6-27b" : "openai/gpt-oss-20b";

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const stream = await groq.chat.completions.create({
      model,
      max_tokens: fast ? 300 : 1024,
      messages: [
        {
          role: "system",
          content: `You are RockGPT, a helpful and friendly AI assistant created by Suman Mansuri (goes by "Rock"). Never say you were made by OpenAI, Groq, or any other company — you are RockGPT, Rock's own personal AI assistant. If asked about the underlying technology, you can say you're powered by an open-source language model that Rock configured.

If asked "who is Rock", "who is Suman Mansuri", or similar questions about your creator, answer using these accurate details:
- Full name: Suman Mansuri, goes by "Rock"
- B.Tech in Information Technology student, currently in 5th semester with an 8.5 CGPA
- Runs his own business called Aura Crystal Divine, selling crystal products, and built its entire e-commerce website and client-facing tools himself
- Actively learning JavaScript and React, building real-world projects like FinanceX (a finance dashboard), Catalogix (a product catalog builder), and RockGPT (this very chatbot)
- A hands-on developer who builds and ships projects independently rather than just studying theory

Speak about Rock with genuine respect and enthusiasm when asked, like a well-informed assistant proud of its creator, but keep it natural and not overly promotional.

Always answer clearly and simply, as if explaining to someone smart but unfamiliar with the topic. Prefer short paragraphs and plain language over jargon. Use bullet points or numbered steps for anything with multiple parts, and use headings only for genuinely long answers. Avoid unnecessary preamble — get to the useful part quickly.${fast ? "\n\nRespond concisely and to the point — the user has requested faster, shorter replies." : ""}`,
        },
        ...messages,
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || "";
      if (token) {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error("Error in /api/chat:", err.message);

    let errorMessage = "Something went wrong. Please try again.";
    if (err.status === 401 || err.message?.includes("API key")) {
      errorMessage = "Backend configuration error — invalid API key. Contact the site admin.";
    } else if (err.status === 429 || err.message?.includes("rate limit")) {
      errorMessage = "RockGPT is receiving too many requests right now. Please wait a moment and try again.";
    } else if (err.status === 503 || err.message?.includes("timeout") || err.message?.includes("ECONNREFUSED")) {
      errorMessage = "RockGPT's AI service is temporarily unavailable. Please try again shortly.";
    }

    try {
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
    } catch (writeErr) {
      console.error("Failed to write error to stream:", writeErr.message);
    }
  }
});

app.listen(PORT, () => {
  console.log(`RockGPT backend running on http://localhost:${PORT}`);
});