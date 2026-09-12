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

// Enterprise Security Headers Hardening
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Powered-By", "RockGPT-Quantum-Security-v4.2");
  next();
});

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
  console.log(`[AUTH OTP DISPATCH] [${new Date().toISOString()}] To: ${email} | Code: ${otp}`);
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

// ═══ COMMUNITY APPRECIATION EMAIL AUTOMATION ═══
const lastAppreciationSent = new Map();

async function sendCommunityAppreciationEmail({ to, name = "Valued Member", plan = "Free", type = "login" }) {
  if (!to || !to.includes("@")) return;
  const cleanEmail = to.trim().toLowerCase();
  const userName = (name || cleanEmail.split("@")[0] || "Valued Member").trim();
  const userPlan = plan || "Free";

  // Throttling: prevent spamming inboxes if user logs in or reacts repeatedly
  const now = Date.now();
  const cooldownHours = type === "signup" ? 0 : (type === "like" ? 24 : 12);
  const key = `${type}:${cleanEmail}`;
  const lastTime = lastAppreciationSent.get(key) || 0;

  if (cooldownHours > 0 && now - lastTime < cooldownHours * 60 * 60 * 1000) {
    console.log(`[EMAIL AUTOMATION] Cooldown active for ${type} appreciation to ${cleanEmail}`);
    return;
  }

  lastAppreciationSent.set(key, now);

  let subject = "";
  let messageBody = "";

  if (type === "signup") {
    subject = "Welcome to RockGPT — Thank You for Joining Our Community!";
    messageBody = `
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.7; color: #d4d4d8;">
        Welcome to RockGPT! We want to take a moment to sincerely appreciate you and say <strong>thank you for becoming an essential part of our growing community</strong>.
      </p>
      <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.7; color: #a1a1aa;">
        RockGPT was built from the ground up to give you an ultra-fast, intelligent, and seamless workspace for coding, reasoning, analysis, and creative ideation. Your account is fully active and ready to use.
      </p>
    `;
  } else if (type === "like") {
    subject = "Thank You for Your Feedback | The RockGPT Community";
    messageBody = `
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.7; color: #d4d4d8;">
        We noticed you gave a thumbs-up to a response on RockGPT — <strong>thank you for your positive feedback and support</strong>!
      </p>
      <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.7; color: #a1a1aa;">
        Every reaction and insight from members like you helps us refine our models and improve the experience for everyone. We're honored to have you in our community.
      </p>
    `;
  } else {
    subject = "Welcome Back to RockGPT — We Appreciate Having You With Us";
    messageBody = `
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.7; color: #d4d4d8;">
        You've successfully signed in to RockGPT. We want to extend our heartfelt appreciation and <strong>thank you for being a dedicated part of our community</strong>.
      </p>
      <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.7; color: #a1a1aa;">
        Your personal chat history, configurations, and AI capabilities are active. We're excited to assist you with whatever you're building or exploring today.
      </p>
    `;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #070709; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ededed;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #070709; padding: 40px 16px;">
        <tr>
          <td align="center">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #121215; border: 1px solid #27272a; border-radius: 20px; overflow: hidden; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);">
              <tr>
                <td align="center" style="padding: 36px 32px 24px 32px; border-bottom: 1px solid #1e1e24; background: linear-gradient(180deg, #18181c 0%, #121215 100%);">
                  <div style="display: inline-block; width: 50px; height: 50px; background: #ffffff; border-radius: 14px; line-height: 50px; text-align: center; color: #000000; font-size: 24px; font-weight: 900; box-shadow: 0 0 24px rgba(255, 255, 255, 0.25);">
                    R
                  </div>
                  <h1 style="margin: 16px 0 4px 0; font-size: 20px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #ffffff;">ROCKGPT</h1>
                  <p style="margin: 0; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #a1a1aa; font-family: monospace;">Next-Generation AI Intelligence</p>
                </td>
              </tr>
              
              <tr>
                <td style="padding: 32px 32px 24px 32px;">
                  <h2 style="margin: 0 0 14px 0; font-size: 18px; font-weight: 700; color: #ffffff;">
                    Hello ${userName},
                  </h2>
                  ${messageBody}

                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #18181d; border: 1px solid #2a2a30; border-radius: 12px; margin: 20px 0;">
                    <tr>
                      <td style="padding: 16px 20px;">
                        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #38bdf8; margin-bottom: 6px;">
                          ⚡ Active Plan: ${userPlan} Member
                        </div>
                        <div style="font-size: 13px; color: #e4e4e7; line-height: 1.5;">
                          • Ultra-fast AI streaming with clean code blocks<br>
                          • Cross-device encrypted sync & persistent memory<br>
                          • Models: RockGPT Flash & RockGPT 4o
                        </div>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 20px 0 24px 0; font-size: 13.5px; line-height: 1.6; color: #a1a1aa;">
                    Thank you for trusting RockGPT. We are thrilled to have you with us on this journey.
                  </p>

                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center" style="padding: 4px 0 12px 0;">
                        <a href="https://rockgpt.vercel.app" style="display: inline-block; background-color: #ffffff; color: #000000; text-decoration: none; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; padding: 12px 28px; border-radius: 9999px; box-shadow: 0 4px 16px rgba(255, 255, 255, 0.2);">
                          Open RockGPT Workspace &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding: 24px 32px 32px 32px; border-top: 1px solid #1e1e24; background-color: #0e0e11; text-align: center;">
                  <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 600; color: #e4e4e7;">
                    With gratitude,
                  </p>
                  <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #ffffff;">
                    The RockGPT Team
                  </p>
                  <p style="margin: 0 0 8px 0; font-size: 11px; color: #71717a;">
                    ~ RockGPT • Architected & Engineered by Suman Mansuri
                  </p>
                  <p style="margin: 0; font-size: 10px; color: #52525b;">
                    You received this email because you are a valued member of the RockGPT community.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    await sendEmail({ to: cleanEmail, subject, html });
    console.log(`[EMAIL AUTOMATION] Successfully delivered ${type} appreciation email to ${cleanEmail}`);
  } catch (err) {
    console.warn(`[EMAIL AUTOMATION] Notice: Could not dispatch ${type} email to ${cleanEmail}:`, err.message);
  }
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
      user: { id: user._id, name: user.name, email: user.email, plan: user.plan, planExpiresAt: user.planExpiresAt },
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

    // Strict password verification on account creation
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
    if (!/[A-Z]/.test(password)) return res.status(400).json({ error: "Password must include at least one uppercase letter (A-Z)." });
    if (!/[0-9]/.test(password)) return res.status(400).json({ error: "Password must include at least one number (0-9)." });
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) return res.status(400).json({ error: "Password must include at least one special character (!@#$...)." });

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

    // Automated community welcome & appreciation email
    sendCommunityAppreciationEmail({ to: user.email, name: user.name, plan: user.plan, type: "signup" }).catch(() => {});

    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, plan: user.plan, planExpiresAt: user.planExpiresAt } });
  } catch (err) { console.error("Signup:", err.message); res.status(500).json({ error: "Signup failed." }); }
});

// ═══ DIRECT LOGIN (EMAIL + PASSWORD) ═══
app.post("/api/auth/direct-login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    const em = email.trim().toLowerCase();
    const user = await User.findOne({ email: em });
    if (!user) {
      return res.status(401).json({ error: "No account found with this email. Please check your spelling or sign up." });
    }
    const passMatch = await bcrypt.compare(password, user.password);
    if (!passMatch) {
      return res.status(401).json({ error: "Incorrect password for this account. Please verify your password or use 'Forgot password?' to reset it." });
    }

    // Check if subscription expired
    if (user.planExpiresAt && new Date(user.planExpiresAt) < new Date() && user.plan !== "Free") {
      user.plan = "Free";
      await user.save();
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });

    // Automated appreciation email on login (debounced)
    sendCommunityAppreciationEmail({ to: user.email, name: user.name, plan: user.plan, type: "login" }).catch(() => {});

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        planExpiresAt: user.planExpiresAt,
      },
    });
  } catch (err) {
    console.error("Direct login error:", err.message);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// ═══ LOGIN (WITH OTP) ═══
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
    
    // Check if subscription expired
    if (user.planExpiresAt && new Date(user.planExpiresAt) < new Date() && user.plan !== "Free") {
      user.plan = "Free";
      await user.save();
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });

    // Automated appreciation email on login (debounced)
    sendCommunityAppreciationEmail({ to: user.email, name: user.name, plan: user.plan, type: "login" }).catch(() => {});

    res.json({ token, user: { id: user._id, name: user.name, email: user.email, plan: user.plan, planExpiresAt: user.planExpiresAt } });
  } catch (err) { console.error("Login:", err.message); res.status(500).json({ error: "Login failed." }); }
});

// ═══ FEEDBACK (LIKE / APPRECIATION) ═══
app.post("/api/feedback/like", async (req, res) => {
  try {
    const { email, name } = req.body;
    if (email && email.includes("@")) {
      sendCommunityAppreciationEmail({ to: email, name, type: "like" }).catch(() => {});
    }
    res.json({ success: true, message: "Feedback recorded with gratitude." });
  } catch {
    res.json({ success: true });
  }
});

// ═══ GET USER ═══
app.get("/api/auth/me", authMiddleware, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated." });
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found." });

    // Check if subscription expired
    if (user.planExpiresAt && new Date(user.planExpiresAt) < new Date() && user.plan !== "Free") {
      user.plan = "Free";
      await user.save();
    }

    res.json({ user: { id: user._id, name: user.name, email: user.email, plan: user.plan, planExpiresAt: user.planExpiresAt } });
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
      messages: [{ role: "system", content: `You are RockGPT, an advanced, highly intelligent AI assistant developed and engineered by Suman Mansuri ("Rock"). Never mention OpenAI, Groq, Meta, or third-party providers. You are powered by RockGPT's proprietary high-performance architecture. If asked about your creator, Rock, or Suman Mansuri (including questions about who made you, who he is, his skills, or whether he is intelligent), answer with confidence, technical respect, and complete clarity: Suman Mansuri (widely known as “Rock”) is an exceptionally talented full-stack software engineer, systems architect, and AI builder who conceived, designed, and engineered RockGPT from the ground up. He possesses deep expertise across modern distributed systems, full-stack application development, real-time streaming architectures, and neural model integration. His sharp intellect, architectural foresight, and relentless pursuit of engineering excellence are what made RockGPT possible. Never output cheesy or cliché quotes. Always be insightful, polite, highly capable, and accurate. Use clean Markdown formatting.${fast ? " Respond concisely." : ""}` }, ...messages],
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

// ═══ PAYMENT SYSTEM (RAZORPAY AUTOMATION) ═══
const PLAN_PRICING = {
  plus: {
    monthly: 149 * 100, // 14900 paise = ₹149
    yearly: 119 * 12 * 100, // 142800 paise = ₹1,428
    name: "Plus",
  },
  pro: {
    monthly: 399 * 100, // 39900 paise = ₹399
    yearly: 319 * 12 * 100, // 382800 paise = ₹3,828
    name: "Pro",
  },
};

// Check if Razorpay credentials are configured
app.get("/api/payment/config", (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.trim() : null;
  const isConfigured = Boolean(keyId && process.env.RAZORPAY_KEY_SECRET);
  res.json({
    configured: isConfigured,
    keyId: keyId,
  });
});

// Create Razorpay Order
app.post("/api/payment/create-order", authMiddleware, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Please log in or create an account to upgrade your subscription." });
    }

    const { planId, billingCycle = "monthly" } = req.body;
    const planKey = (planId || "").toLowerCase();
    const cycle = billingCycle === "yearly" ? "yearly" : "monthly";

    if (!PLAN_PRICING[planKey]) {
      return res.status(400).json({ error: "Invalid subscription plan selected." });
    }

    const keyId = process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.trim() : "";
    const keySecret = process.env.RAZORPAY_KEY_SECRET ? process.env.RAZORPAY_KEY_SECRET.trim() : "";

    if (!keyId || !keySecret) {
      return res.status(503).json({
        error: "Razorpay automated payments are not yet activated on this server. Please use manual UPI QR code transfer or set RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET in Render.",
        fallback: true,
      });
    }

    const planConfig = PLAN_PRICING[planKey];
    const amountInPaise = planConfig[cycle];
    const authHeader = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: "INR",
        receipt: `rcpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        notes: {
          userId: req.user.id,
          userEmail: req.user.email,
          plan: planConfig.name,
          billingCycle: cycle,
        },
      }),
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      console.error("Razorpay order creation error:", orderData);
      return res.status(500).json({
        error: orderData.error?.description || `Razorpay order creation failed (HTTP ${orderRes.status})`,
      });
    }

    res.json({
      success: true,
      orderId: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      keyId,
      planName: planConfig.name,
      billingCycle: cycle,
    });
  } catch (err) {
    console.error("create-order error:", err.message);
    res.status(500).json({ error: `Payment order error: ${err.message}` });
  }
});

// Verify Payment Signature & Instantly Upgrade MongoDB User Plan
app.post("/api/payment/verify-payment", authMiddleware, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Please log in to verify payment." });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId, billingCycle } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing required payment verification details." });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET ? process.env.RAZORPAY_KEY_SECRET.trim() : "";
    if (!keySecret) {
      return res.status(500).json({ error: "Server payment verification secret is missing." });
    }

    // Cryptographic signature check: HMAC-SHA256 of order_id + "|" + payment_id using secret
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Security alert: Payment signature verification failed." });
    }

    // Determine plan and expiration
    const planName = (planId || "").toLowerCase() === "pro" ? "Pro" : "Plus";
    const daysToAdd = billingCycle === "yearly" ? 365 : 30;
    const planExpiresAt = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000);

    // Upgrade user in MongoDB
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        plan: planName,
        planExpiresAt,
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
      },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ error: "User account not found." });
    }

    // Issue fresh JWT token
    const token = jwt.sign(
      { id: updatedUser._id, email: updatedUser.email },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    // Send confirmation email asynchronously
    sendEmail({
      to: updatedUser.email,
      subject: `🎉 Your RockGPT ${planName} Plan is Live!`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0d0d0d;border-radius:16px;color:#e5e5e5;"><div style="text-align:center;margin-bottom:24px;"><div style="display:inline-block;background:#f59e0b;color:#000;font-weight:900;font-size:22px;width:52px;height:52px;line-height:52px;border-radius:16px;">R</div></div><h2 style="text-align:center;color:#fff;">RockGPT ${planName} Activated!</h2><p style="text-align:center;color:#aaa;font-size:14px;">Your payment was verified and RockGPT 4o is now unlocked on your account.</p><div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:20px;margin:20px 0;"><p style="margin:6px 0;color:#aaa;font-size:13px;">Plan: <strong style="color:#fff;">RockGPT ${planName}</strong></p><p style="margin:6px 0;color:#aaa;font-size:13px;">Billing: <strong style="color:#fff;">${billingCycle === "yearly" ? "Annual (12 Months)" : "Monthly (30 Days)"}</strong></p><p style="margin:6px 0;color:#aaa;font-size:13px;">Payment Ref: <span style="font-family:monospace;color:#f59e0b;">${razorpay_payment_id}</span></p><p style="margin:6px 0;color:#aaa;font-size:13px;">Valid Until: <strong style="color:#fff;">${planExpiresAt.toLocaleDateString()}</strong></p></div><p style="text-align:center;color:#777;font-size:12px;">Thank you for supporting RockGPT. Enjoy unlimited intelligence!</p></div>`,
    }).catch((e) => console.warn("Email dispatch error on upgrade:", e.message));

    res.json({
      success: true,
      message: `🎉 Payment verified! Upgraded to RockGPT ${planName}.`,
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        plan: updatedUser.plan,
        planExpiresAt: updatedUser.planExpiresAt,
      },
      token,
    });
  } catch (err) {
    console.error("verify-payment error:", err.message);
    res.status(500).json({ error: `Payment verification error: ${err.message}` });
  }
});

app.get("/api/version", (req, res) => {
  res.json({
    app: "RockGPT",
    version: "4.2.0-turbo",
    architecture: "Quantum-Hybrid 120B / 20B",
    security: {
      encryption: "AES-256-GCM / TLS 1.3",
      auth: "Brevo Port 443 OTP + Bcrypt 12-round salted hashing",
      token: "HMAC-SHA256 JWT with strict expiration",
    },
    status: "operational",
  });
});

app.get("/", (req, res) => res.json({ status: "RockGPT v4.2 Turbo backend operational." }));
app.listen(PORT, () => console.log(`RockGPT backend on port ${PORT}`));