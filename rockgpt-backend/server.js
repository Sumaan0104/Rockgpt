import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "./models/User.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set.");
  process.exit(1);
}

app.use(cors());
app.use(express.json({ limit: "10mb" }));

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => { console.error("MongoDB connection error:", err.message); process.exit(1); });

const groq = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" });

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// --- OTP Store ---
const otpStore = new Map();

function generateOtp() { return crypto.randomInt(100000, 999999).toString(); }

function storeOtp(email, otp) {
  otpStore.set(email.toLowerCase(), { otp, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0 });
}

function verifyStoredOtp(email, enteredOtp) {
  const key = email.toLowerCase();
  const record = otpStore.get(key);
  if (!record) return { valid: false, error: "No verification code found. Request a new one." };
  if (Date.now() > record.expiresAt) { otpStore.delete(key); return { valid: false, error: "Code expired. Request a new one." }; }
  if (record.attempts >= 5) { otpStore.delete(key); return { valid: false, error: "Too many incorrect attempts. Request a new code." }; }
  if (record.otp !== enteredOtp) { record.attempts += 1; return { valid: false, error: `Incorrect code. ${5 - record.attempts} attempts left.` }; }
  otpStore.delete(key);
  return { valid: true };
}

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: "Too many requests." } });
const chatLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: "Rate limit reached." } });

function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) { req.user = null; return next(); }
  try { req.user = jwt.verify(h.split(" ")[1], JWT_SECRET); next(); }
  catch { req.user = null; next(); }
}

// ═══ SEND OTP ═══
app.post("/api/auth/send-otp", authLimiter, async (req, res) => {
  try {
    const { email, password, mode } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
    const em = email.trim().toLowerCase();

    if (mode === "signup") {
      if (await User.findOne({ email: em })) return res.status(409).json({ error: "Account already exists. Sign in instead." });
      if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
    }
    if (mode === "login") {
      const u = await User.findOne({ email: em });
      if (!u) return res.status(401).json({ error: "No account found with this email." });
      if (!(await bcrypt.compare(password, u.password))) return res.status(401).json({ error: "Incorrect password." });
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return res.status(500).json({ error: "Email service not configured." });

    const otp = generateOtp();
    storeOtp(em, otp);

    await transporter.sendMail({
      from: `"RockGPT" <${process.env.EMAIL_USER}>`,
      to: em,
      subject: "Your RockGPT Verification Code",
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0d0d0d;border-radius:16px;color:#e5e5e5;"><div style="text-align:center;margin-bottom:24px;"><div style="display:inline-block;background:#fff;color:#000;font-weight:900;font-size:20px;width:48px;height:48px;line-height:48px;border-radius:14px;">R</div></div><h2 style="text-align:center;color:#fff;">Your Verification Code</h2><p style="text-align:center;color:#999;font-size:14px;">Enter this code in RockGPT to verify your identity.</p><div style="text-align:center;background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:20px;margin:16px 0;"><span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#f59e0b;font-family:monospace;">${otp}</span></div><p style="text-align:center;color:#666;font-size:12px;">Expires in 5 minutes. Do not share.</p></div>`,
    });

    res.json({ success: true, message: "Verification code sent." });
  } catch (err) { console.error("send-otp:", err.message); res.status(500).json({ error: "Failed to send email. Try again." }); }
});

// ═══ SIGNUP ═══
app.post("/api/auth/signup", authLimiter, async (req, res) => {
  try {
    const { name, email, password, otp } = req.body;
    if (!name || !email || !password || !otp) return res.status(400).json({ error: "All fields required." });
    const em = email.trim().toLowerCase();
    const otpR = verifyStoredOtp(em, otp);
    if (!otpR.valid) return res.status(400).json({ error: otpR.error });
    if (await User.findOne({ email: em })) return res.status(409).json({ error: "Account already exists." });
    const user = new User({ name: name.trim(), email: em, password: await bcrypt.hash(password, 12), plan: "Free" });
    await user.save();
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, plan: user.plan } });
  } catch (err) { console.error("Signup:", err.message); res.status(500).json({ error: "Signup failed." }); }
});

// ═══ LOGIN ═══
app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password, otp } = req.body;
    if (!email || !password || !otp) return res.status(400).json({ error: "All fields required." });
    const em = email.trim().toLowerCase();
    const otpR = verifyStoredOtp(em, otp);
    if (!otpR.valid) return res.status(400).json({ error: otpR.error });
    const user = await User.findOne({ email: em });
    if (!user) return res.status(401).json({ error: "No account found." });
    if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Incorrect password." });
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, plan: user.plan } });
  } catch (err) { console.error("Login:", err.message); res.status(500).json({ error: "Login failed." }); }
});

// ═══ GET USER ═══
app.get("/api/auth/me", authMiddleware, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated." });
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ user: { id: user._id, name: user.name, email: user.email, plan: user.plan } });
  } catch { res.status(500).json({ error: "Something went wrong." }); }
});

// ═══ CHAT ═══
app.post("/api/chat", chatLimiter, async (req, res) => {
  try {
    const { messages, fast } = req.body;
    if (!messages || !Array.isArray(messages) || !messages.length) return res.status(400).json({ error: "messages required" });
    const hasImg = messages.some((m) => Array.isArray(m.content) && m.content.some((c) => c.type === "image_url"));
    const model = hasImg ? "meta-llama/llama-4-scout-17b-16e-instruct" : "meta-llama/llama-4-maverick-17b-128e-instruct";
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    const stream = await groq.chat.completions.create({
      model, max_tokens: fast ? 300 : 1024,
      messages: [{ role: "system", content: `You are RockGPT, an advanced AI assistant developed by Suman Mansuri ("Rock"). Never mention OpenAI, Groq, or third-party providers. You are powered by custom-configured open-source AI models. If asked about Rock, he is a full-stack developer and founder of Aura Crystal Divine. Be clear, accurate, and direct. Use Markdown formatting.${fast ? " Respond concisely." : ""}` }, ...messages],
      stream: true,
    });
    for await (const chunk of stream) {
      const t = chunk.choices[0]?.delta?.content || "";
      if (t) res.write(`data: ${JSON.stringify({ token: t })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error("Chat error:", err.message);
    try { res.write(`data: ${JSON.stringify({ error: "AI service temporarily unavailable." })}\n\n`); res.end(); } catch {}
  }
});

app.get("/", (req, res) => res.json({ status: "RockGPT backend running." }));
app.listen(PORT, () => console.log(`RockGPT backend on port ${PORT}`));