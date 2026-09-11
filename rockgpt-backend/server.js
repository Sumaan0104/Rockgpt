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

// Universal Email Delivery Service:
// 1. Brevo HTTPS API (Port 443 - works directly on Render free tier without firewall blocks)
// 2. Resend HTTPS API (Port 443 - works directly on Render free tier)
// 3. Gmail SMTP via Nodemailer (Port 465 - works on Vercel, VPS, localhost)
async function sendEmail({ to, subject, html }) {
  const cleanUser = (process.env.EMAIL_USER || "").trim();

  // 1. Brevo REST API (HTTPS over Port 443)
  if (process.env.BREVO_API_KEY) {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY.trim(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "RockGPT", email: cleanUser || "noreply@rockgpt.ai" },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Brevo API HTTP ${res.status}`);
    }
    return data;
  }

  // 2. Resend REST API (HTTPS over Port 443)
  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `RockGPT <${process.env.RESEND_FROM || "onboarding@resend.dev"}>`,
        to: [to],
        subject,
        html,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Resend API HTTP ${res.status}`);
    }
    return data;
  }

  // 3. Gmail SMTP via Nodemailer
  const cleanPass = (process.env.EMAIL_PASS || "").replace(/\s+/g, "");
  if (!cleanUser || !cleanPass) {
    throw new Error("Email service is not configured. Missing EMAIL_USER / EMAIL_PASS or BREVO_API_KEY.");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: cleanUser, pass: cleanPass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
  });

  return await transporter.sendMail({
    from: `"RockGPT" <${cleanUser}>`,
    to,
    subject,
    html,
  });
}

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
    const { name, email, password, mode } = req.body;
    if (!email || (mode !== "forgot" && !password)) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    const em = email.trim().toLowerCase();

    // Strict RFC 5322 email regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(em)) {
      return res.status(400).json({ error: "Please enter a valid email address (e.g. name@gmail.com)." });
    }

    if (mode === "signup") {
      if (!name || name.trim().length < 2) {
        return res.status(400).json({ error: "Full Name is required (minimum 2 characters)." });
      }

      // Check if username/name is already taken by another person
      const existingName = await User.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, "i") } });
      if (existingName) {
        return res.status(409).json({ error: `The name "${name.trim()}" is already taken by another user. Please pick a unique name.` });
      }

      // Check if email already registered
      const existingEmail = await User.findOne({ email: em });
      if (existingEmail) {
        return res.status(409).json({ error: `This email (${em}) is already registered. Please sign in instead.` });
      }

      if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
      if (!/[A-Z]/.test(password)) return res.status(400).json({ error: "Password must include at least one uppercase letter (A-Z)." });
      if (!/[0-9]/.test(password)) return res.status(400).json({ error: "Password must include at least one number (0-9)." });
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) return res.status(400).json({ error: "Password must include at least one special character (!@#$...)." });
    }

    if (mode === "login") {
      const u = await User.findOne({ email: em });
      if (!u) return res.status(401).json({ error: "No account found with this email. Please sign up first." });
      const passMatch = await bcrypt.compare(password, u.password);
      if (!passMatch) return res.status(401).json({ error: "Incorrect password for this account. Click 'Forgot password?' to reset it." });
    }

    if (mode === "forgot") {
      const u = await User.findOne({ email: em });
      if (!u) return res.status(404).json({ error: "No account registered with this email. Please check spelling or create an account." });
    }

    const otp = generateOtp();
    const emailSubject = mode === "forgot" ? "Reset Your RockGPT Password" : "Your RockGPT Verification Code";

    try {
      await sendEmail({
        to: em,
        subject: emailSubject,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0d0d0d;border-radius:16px;color:#e5e5e5;"><div style="text-align:center;margin-bottom:24px;"><div style="display:inline-block;background:#fff;color:#000;font-weight:900;font-size:20px;width:48px;height:48px;line-height:48px;border-radius:14px;">R</div></div><h2 style="text-align:center;color:#fff;">${emailSubject}</h2><p style="text-align:center;color:#999;font-size:14px;">Enter this 6-digit code in RockGPT to verify your identity.</p><div style="text-align:center;background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:20px;margin:16px 0;"><span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#f59e0b;font-family:monospace;">${otp}</span></div><p style="text-align:center;color:#666;font-size:12px;">Expires in 5 minutes. Do not share.</p></div>`,
      });

      // Email was successfully dispatched! Now store OTP for verification.
      storeOtp(em, otp);

      res.json({ success: true, message: "Verification code sent to your email inbox." });
    } catch (emailErr) {
      console.error("send-otp email error:", emailErr.message);
      const isFirewallBlocked =
        emailErr.message.includes("ETIMEDOUT") ||
        emailErr.message.includes("timeout") ||
        emailErr.code === "ETIMEDOUT";

      if (isFirewallBlocked) {
        return res.status(503).json({
          error:
            "Email blocked by host firewall: Render free tier blocks outbound SMTP ports 465/587. Please add BREVO_API_KEY in Render environment variables for instant HTTPS email delivery.",
        });
      }

      return res.status(500).json({
        error: `Failed to deliver verification email: ${emailErr.message}`,
      });
    }
  } catch (err) {
    console.error("send-otp error:", err.message);
    res.status(500).json({ error: `Authentication error: ${err.message}` });
  }
});

// ═══ RESET PASSWORD ═══
app.post("/api/auth/reset-password", authLimiter, async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ error: "All fields are required." });
    const em = email.trim().toLowerCase();

    // Verify OTP
    const otpR = verifyStoredOtp(em, otp);
    if (!otpR.valid) return res.status(400).json({ error: otpR.error });

    // Validate new password strength
    if (newPassword.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
    if (!/[A-Z]/.test(newPassword)) return res.status(400).json({ error: "Password must include at least one uppercase letter (A-Z)." });
    if (!/[0-9]/.test(newPassword)) return res.status(400).json({ error: "Password must include at least one number (0-9)." });
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newPassword)) return res.status(400).json({ error: "Password must include at least one special character (!@#$...)." });

    const user = await User.findOne({ email: em });
    if (!user) return res.status(404).json({ error: "User account not found." });

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
    res.json({
      success: true,
      message: "Password reset successfully.",
      token,
      user: { id: user._id, name: user.name, email: user.email, plan: user.plan },
    });
  } catch (err) {
    console.error("Reset password error:", err.message);
    res.status(500).json({ error: "Failed to reset password. Please try again." });
  }
});

// ═══ SIGNUP ═══
app.post("/api/auth/signup", authLimiter, async (req, res) => {
  try {
    const { name, email, password, otp } = req.body;
    if (!name || !email || !password || !otp) return res.status(400).json({ error: "All fields required." });
    const em = email.trim().toLowerCase();
    const otpR = verifyStoredOtp(em, otp);
    if (!otpR.valid) return res.status(400).json({ error: otpR.error });

    // Double check name and email uniqueness before saving
    if (await User.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, "i") } })) {
      return res.status(409).json({ error: `The name "${name.trim()}" is already taken. Please choose another.` });
    }
    if (await User.findOne({ email: em })) {
      return res.status(409).json({ error: "Account already exists. Please sign in instead." });
    }

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
    const { messages, fast, model: requestedModel } = req.body;
    if (!messages || !Array.isArray(messages) || !messages.length) return res.status(400).json({ error: "messages required" });
    const hasImg = messages.some((m) => Array.isArray(m.content) && m.content.some((c) => c.type === "image_url"));
    const model = hasImg
      ? "qwen/qwen3.8-27b"
      : (requestedModel === "RockGPT 4o" ? "openai/gpt-oss-120b" : "openai/gpt-oss-20b");
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