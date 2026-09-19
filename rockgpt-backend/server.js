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
import Conversation from "./models/Conversation.js";
import Message from "./models/Message.js";
import { OAuth2Client } from "google-auth-library";

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
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    if (process.env.NODE_ENV !== "test") process.exit(1);
  });

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

// ═══ RFC 6238 GOOGLE AUTHENTICATOR (TOTP) ENGINE ═══
const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function generateBase32Secret(length = 20) {
  const bytes = crypto.randomBytes(length);
  let secret = "";
  for (let i = 0; i < bytes.length; i++) {
    secret += B32_ALPHABET[bytes[i] % 32];
  }
  return secret;
}

function base32Decode(base32Str) {
  const clean = (base32Str || "").toUpperCase().replace(/=+$/, "").replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (let i = 0; i < clean.length; i++) {
    const val = B32_ALPHABET.indexOf(clean[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTotp(secret, timeStep = 30, windowOffset = 0) {
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / timeStep) + windowOffset;

  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter), 0);

  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binary % 1000000).toString().padStart(6, "0");
}

function verifyTotp(secret, token, window = 1) {
  if (!secret || !token) return false;
  const cleanToken = token.trim();
  for (let offset = -window; offset <= window; offset++) {
    if (generateTotp(secret, 30, offset) === cleanToken) {
      return true;
    }
  }
  return false;
}

function logSecurityEvent(user, action, req) {
  if (!user.securityLogs) user.securityLogs = [];
  const rawIp = req?.headers?.["x-forwarded-for"] || req?.socket?.remoteAddress || "Unknown IP";
  const ip = typeof rawIp === "string" ? rawIp.split(",")[0].trim() : "Unknown IP";
  const userAgent = (req?.headers?.["user-agent"] || "Unknown Browser / Client").slice(0, 150);
  user.securityLogs.push({
    action,
    ip,
    userAgent,
    timestamp: new Date(),
  });
  if (user.securityLogs.length > 25) {
    user.securityLogs = user.securityLogs.slice(-25);
  }
}

// ═══ GOOGLE OAUTH 2.0 HELPERS ═══
let testOAuth2Client = null;
export function setGoogleOAuthClientForTesting(client) {
  testOAuth2Client = client;
}

export function getGoogleOAuthClient() {
  if (testOAuth2Client) return testOAuth2Client;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }
  return new OAuth2Client(clientId, clientSecret, "postmessage");
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

function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized. Please log in to access this resource." });
  }
  try {
    const decoded = jwt.verify(h.split(" ")[1], JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: "Invalid session. Please log in again." });
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired or invalid token. Please log in again." });
  }
}

// ═══ SEND OTP ═══
app.post("/api/auth/send-otp", authLimiter, async (req, res) => {
  try {
    const { name, email, password, mode } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email address is required." });
    }
    const em = email.trim().toLowerCase();

    // Strict RFC 5322 email regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(em)) {
      return res.status(400).json({ error: "Please enter a valid email address (e.g. name@gmail.com)." });
    }

    if (mode !== "forgot" && mode !== "google-verify" && mode !== "email-otp" && !password) {
      return res.status(400).json({ error: "Email and password are required." });
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
        return res.status(409).json({ error: "An account with this email already exists. Please log in instead." });
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
    const emailSubject = mode === "forgot"
      ? "Reset Your RockGPT Password"
      : mode === "google-verify" || mode === "email-otp"
      ? "Your RockGPT 6-Digit Verification Code"
      : "Your RockGPT Verification Code";

    try {
      await sendEmail({
        to: em,
        subject: emailSubject,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0d0d0d;border-radius:16px;color:#e5e5e5;"><div style="text-align:center;margin-bottom:24px;"><div style="display:inline-block;background:#fff;color:#000;font-weight:900;font-size:20px;width:48px;height:48px;line-height:48px;border-radius:14px;">R</div></div><h2 style="text-align:center;color:#fff;">${emailSubject}</h2><p style="text-align:center;color:#999;font-size:14px;">Enter this 6-digit code in RockGPT to verify your identity.</p><div style="text-align:center;background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:20px;margin:16px 0;"><span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#f59e0b;font-family:monospace;">${otp}</span></div><p style="text-align:center;color:#666;font-size:12px;">Expires in 5 minutes. Do not share this security code with anyone.</p></div>`,
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
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    logSecurityEvent(user, "Password Reset via OTP (Account Unlocked)", req);
    await user.save();

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
    res.json({
      success: true,
      message: "Password reset successfully. Account unlocked.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        plan: user.plan,
        planExpiresAt: user.planExpiresAt,
        twoFactorEnabled: Boolean(user.twoFactorEnabled),
      },
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
      return res.status(409).json({ error: "An account with this email already exists. Please log in instead." });
    }

    const user = new User({
      name: name.trim(),
      email: em,
      password: await bcrypt.hash(password, 12),
      plan: "Free",
      lastLoginAt: new Date(),
    });
    logSecurityEvent(user, "Account Created via Verified Email OTP", req);
    await user.save();
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });

    // Automated community welcome & appreciation email
    sendCommunityAppreciationEmail({ to: user.email, name: user.name, plan: user.plan, type: "signup" }).catch(() => {});

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        plan: user.plan,
        planExpiresAt: user.planExpiresAt,
        twoFactorEnabled: false,
      },
    });
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

    // Brute-force lockout verification
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const remainingMinutes = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
      return res.status(423).json({
        error: `Account is temporarily locked due to 5 consecutive failed login attempts. Try again in ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"}, or unlock instantly with 'Forgot password?' using Email OTP.`,
        isLocked: true,
        remainingMinutes,
      });
    }

    const passMatch = await bcrypt.compare(password, user.password || "");
    if (!passMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        logSecurityEvent(user, "Account Locked (5 Failed Attempts)", req);
        await user.save();
        return res.status(423).json({
          error: "Account locked for 15 minutes due to 5 consecutive failed password attempts. You can unlock instantly by resetting your password via Email OTP.",
          isLocked: true,
          remainingMinutes: 15,
        });
      }
      logSecurityEvent(user, `Failed Password Attempt (${user.failedLoginAttempts}/5)`, req);
      await user.save();
      const attemptsLeft = 5 - user.failedLoginAttempts;
      return res.status(401).json({
        error: `Incorrect password. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left before temporary account lockout.`,
        attemptsLeft,
      });
    }

    // Reset failed counter & clear lockout on success
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();

    // Check if subscription expired
    if (user.planExpiresAt && new Date(user.planExpiresAt) < new Date() && user.plan !== "Free") {
      user.plan = "Free";
    }

    // Check if 2FA (Google Authenticator) is enabled
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const tempToken = jwt.sign({ tempId: user._id, purpose: "2fa" }, JWT_SECRET, { expiresIn: "10m" });
      logSecurityEvent(user, "Password Verified (2FA Code Required)", req);
      await user.save();
      return res.json({
        require2FA: true,
        tempToken,
        email: user.email,
        name: user.name,
      });
    }

    logSecurityEvent(user, "Direct Password Sign-In", req);
    await user.save();

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });

    // Automated appreciation email on login (debounced)
    sendCommunityAppreciationEmail({ to: user.email, name: user.name, plan: user.plan, type: "login" }).catch(() => {});

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        plan: user.plan,
        planExpiresAt: user.planExpiresAt,
        twoFactorEnabled: Boolean(user.twoFactorEnabled),
      },
    });
  } catch (err) {
    console.error("Direct login error:", err.message);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// ═══ LOGIN (WITH EMAIL OTP) ═══
app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password, otp } = req.body;
    if (!email || !password || !otp) return res.status(400).json({ error: "All fields required." });
    const em = email.trim().toLowerCase();
    const otpR = verifyStoredOtp(em, otp);
    if (!otpR.valid) return res.status(400).json({ error: otpR.error });
    const user = await User.findOne({ email: em });
    if (!user) return res.status(401).json({ error: "No account found." });

    // Brute-force lockout check
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const remainingMinutes = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
      return res.status(423).json({
        error: `Account is temporarily locked. Try again in ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"}, or use 'Forgot password?' to unlock.`,
        isLocked: true,
      });
    }

    if (!(await bcrypt.compare(password, user.password || ""))) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      await user.save();
      return res.status(401).json({ error: "Incorrect password." });
    }
    
    // Successful login
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();

    // Check if subscription expired
    if (user.planExpiresAt && new Date(user.planExpiresAt) < new Date() && user.plan !== "Free") {
      user.plan = "Free";
    }

    // Check if 2FA (Google Authenticator) is enabled
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const tempToken = jwt.sign({ tempId: user._id, purpose: "2fa" }, JWT_SECRET, { expiresIn: "10m" });
      logSecurityEvent(user, "Email OTP Verified (2FA Code Required)", req);
      await user.save();
      return res.json({
        require2FA: true,
        tempToken,
        email: user.email,
        name: user.name,
      });
    }

    logSecurityEvent(user, "Email OTP Sign-In", req);
    await user.save();

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });

    // Automated appreciation email on login (debounced)
    sendCommunityAppreciationEmail({ to: user.email, name: user.name, plan: user.plan, type: "login" }).catch(() => {});

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        plan: user.plan,
        planExpiresAt: user.planExpiresAt,
        twoFactorEnabled: Boolean(user.twoFactorEnabled),
      },
    });
  } catch (err) { console.error("Login:", err.message); res.status(500).json({ error: "Login failed." }); }
});

// ═══ GOOGLE OAUTH 2.0 (AUTHORIZATION CODE FLOW) ═══
app.post("/api/auth/google", authLimiter, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== "string" || !code.trim()) {
      return res.status(400).json({ error: "Authorization code is required." });
    }

    const client = getGoogleOAuthClient();
    if (!client) {
      console.error("Google OAuth configuration error: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing");
      return res.status(500).json({ error: "Google OAuth credentials are not configured on the server." });
    }

    // 1. Exchange one-time authorization code server-side
    let tokens;
    try {
      const tokenRes = await client.getToken(code.trim());
      tokens = tokenRes?.tokens;
    } catch (exchangeErr) {
      console.warn("Google authorization code exchange failed:", exchangeErr.message);
      return res.status(400).json({ error: "Invalid or expired Google authorization code. Please try again." });
    }

    if (!tokens || !tokens.id_token) {
      return res.status(400).json({ error: "Failed to obtain verified identity from Google." });
    }

    // 2. Verify returned ID token with configured Google client ID as audience
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (verifyErr) {
      console.warn("Google ID token verification failed:", verifyErr.message);
      return res.status(400).json({ error: "Google identity verification failed." });
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.sub) {
      return res.status(400).json({ error: "Incomplete profile received from Google." });
    }

    // 3. Enforce email verification by Google
    if (payload.email_verified !== true && payload.email_verified !== "true") {
      return res.status(400).json({ error: "Your Google account email is not verified by Google." });
    }

    const cleanEmail = payload.email.toLowerCase().trim();
    const googleId = String(payload.sub);
    const googleName = (payload.name || cleanEmail.split("@")[0]).replace(/<[^>]*>?/gm, "").trim().slice(0, 50);
    const googleAvatar = payload.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanEmail.split("@")[0])}`;

    // 4. Find existing user by googleId, or safely link by verified email
    let user = await User.findOne({ googleId });
    if (!user) {
      user = await User.findOne({ email: cleanEmail });
      if (user) {
        user.googleId = googleId;
        if (!user.avatar && googleAvatar) {
          user.avatar = googleAvatar;
        }
      }
    }

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      user = new User({
        name: googleName,
        email: cleanEmail,
        googleId,
        avatar: googleAvatar,
        plan: "Free",
        lastLoginAt: new Date(),
      });
    }

    // Clear login lockouts on verified Google authentication
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();

    // 5. Preserve TOTP 2FA if enabled on account
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const tempToken = jwt.sign({ tempId: user._id, purpose: "2fa" }, JWT_SECRET, { expiresIn: "10m" });
      logSecurityEvent(user, "Google Sign-In (2FA Code Required)", req);
      await user.save();
      return res.json({
        require2FA: true,
        tempToken,
        email: user.email,
        name: user.name,
      });
    }

    logSecurityEvent(user, isNewUser ? "Account Created via Google" : "Google Sign-In", req);
    await user.save();

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });

    // Send appreciation email (debounced)
    sendCommunityAppreciationEmail({
      to: user.email,
      name: user.name,
      plan: user.plan,
      type: isNewUser ? "signup" : "login",
    }).catch(() => {});

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        plan: user.plan,
        planExpiresAt: user.planExpiresAt,
        twoFactorEnabled: Boolean(user.twoFactorEnabled),
      },
    });
  } catch (err) {
    console.error("Google Auth error:", err.message);
    return res.status(500).json({ error: "Google authentication could not be completed." });
  }
});

// ═══ 2FA SETUP (GENERATE SECRET & QR CODE) ═══
app.post("/api/auth/2fa/setup", authMiddleware, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated." });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found." });

    const secret = generateBase32Secret(20);
    user.twoFactorSecret = secret;
    await user.save();

    const appName = "RockGPT";
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(appName)}:${encodeURIComponent(user.email)}?secret=${secret}&issuer=${encodeURIComponent(appName)}&algorithm=SHA1&digits=6&period=30`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(otpauthUrl)}`;

    res.json({
      success: true,
      secret,
      otpauthUrl,
      qrCodeUrl,
    });
  } catch (err) {
    console.error("2FA setup error:", err.message);
    res.status(500).json({ error: "Failed to initialize 2FA setup." });
  }
});

// ═══ 2FA VERIFY & ENABLE ═══
app.post("/api/auth/2fa/enable", authMiddleware, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated." });
    const { code } = req.body;
    if (!code || code.trim().length !== 6) {
      return res.status(400).json({ error: "Please enter the 6-digit code from Google Authenticator." });
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ error: "2FA setup was not initiated. Please generate a new secret." });
    }

    const isValid = verifyTotp(user.twoFactorSecret, code.trim());
    if (!isValid) {
      return res.status(400).json({ error: "Invalid 6-digit code. Please verify the code in Google Authenticator and make sure device time is accurate." });
    }

    user.twoFactorEnabled = true;
    logSecurityEvent(user, "Google Authenticator 2FA Activated", req);
    await user.save();

    // Async security confirmation email
    sendEmail({
      to: user.email,
      subject: "🛡️ Google Authenticator 2FA Activated — RockGPT Security",
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0d0d0d;border-radius:16px;color:#e5e5e5;"><div style="text-align:center;margin-bottom:20px;"><div style="display:inline-block;background:#10b981;color:#000;font-weight:900;font-size:22px;width:50px;height:50px;line-height:50px;border-radius:14px;">🛡️</div></div><h2 style="text-align:center;color:#fff;">Two-Factor Authentication Active</h2><p style="text-align:center;color:#aaa;font-size:14px;line-height:1.6;">Google Authenticator 2FA is now safeguarding your RockGPT account. Future sign-ins will require your 6-digit TOTP security code.</p><p style="text-align:center;color:#666;font-size:12px;margin-top:24px;">If you did not make this change, please reset your password immediately.</p></div>`,
    }).catch(() => {});

    res.json({
      success: true,
      message: "Two-Factor Authentication successfully activated!",
      twoFactorEnabled: true,
    });
  } catch (err) {
    console.error("2FA enable error:", err.message);
    res.status(500).json({ error: "Failed to enable 2FA." });
  }
});

// ═══ 2FA DISABLE ═══
app.post("/api/auth/2fa/disable", authMiddleware, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated." });
    const { code, password } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found." });

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: "Two-Factor Authentication is not enabled on this account." });
    }

    let verified = false;
    if (code && verifyTotp(user.twoFactorSecret, code.trim())) {
      verified = true;
    } else if (password && user.password && (await bcrypt.compare(password, user.password))) {
      verified = true;
    }

    if (!verified) {
      return res.status(400).json({ error: "Verification failed. Provide your active 6-digit code or account password." });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    logSecurityEvent(user, "Google Authenticator 2FA Disabled", req);
    await user.save();

    res.json({
      success: true,
      message: "Two-Factor Authentication has been disabled.",
      twoFactorEnabled: false,
    });
  } catch (err) {
    console.error("2FA disable error:", err.message);
    res.status(500).json({ error: "Failed to disable 2FA." });
  }
});

// ═══ 2FA VERIFY LOGIN (COMPLETES LOGIN FLOW FOR 2FA-PROTECTED ACCOUNTS) ═══
app.post("/api/auth/2fa/verify-login", authLimiter, async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      return res.status(400).json({ error: "Security session token and 6-digit code are required." });
    }

    let decoded = null;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Security session expired. Please sign in again." });
    }

    if (!decoded || !decoded.tempId || decoded.purpose !== "2fa") {
      return res.status(401).json({ error: "Invalid security session." });
    }

    const user = await User.findById(decoded.tempId);
    if (!user) return res.status(404).json({ error: "User account not found." });

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ error: "2FA is not configured for this account." });
    }

    const isValid = verifyTotp(user.twoFactorSecret, code.trim());
    if (!isValid) {
      return res.status(400).json({ error: "Invalid 6-digit verification code. Please check your Google Authenticator app." });
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();
    logSecurityEvent(user, "2FA Authenticated Login", req);
    await user.save();

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });

    // Automated appreciation email
    sendCommunityAppreciationEmail({ to: user.email, name: user.name, plan: user.plan, type: "login" }).catch(() => {});

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        plan: user.plan,
        planExpiresAt: user.planExpiresAt,
        twoFactorEnabled: true,
      },
    });
  } catch (err) {
    console.error("2FA verify-login error:", err.message);
    res.status(500).json({ error: "2FA login verification failed." });
  }
});

// ═══ SECURITY LOGS & AUDIT TRAIL ═══
app.get("/api/auth/security-logs", authMiddleware, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated." });
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found." });

    const logs = (user.securityLogs || []).slice(-15).reverse();
    res.json({
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
      lastLoginAt: user.lastLoginAt,
      failedAttempts: user.failedLoginAttempts || 0,
      isLocked: Boolean(user.lockUntil && user.lockUntil > Date.now()),
      logs,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve security logs." });
  }
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

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        twoFactorEnabled: Boolean(user.twoFactorEnabled),
        plan: user.plan,
        planExpiresAt: user.planExpiresAt,
      },
    });
  } catch { res.status(500).json({ error: "Something went wrong." }); }
});

// ═══ STRICT ACCOUNT-WISE CONVERSATION & MESSAGE API (IDOR PROTECTED) ═══

// 1. Get all conversations for authenticated user
app.get("/api/conversations", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const conversations = await Conversation.find({ userId }).sort({ updatedAt: -1 }).lean();
    const convIds = conversations.map((c) => c._id);

    const messages = await Message.find({ conversationId: { $in: convIds } }).sort({ createdAt: 1 }).lean();

    const messagesByConv = {};
    for (const m of messages) {
      const cId = m.conversationId.toString();
      if (!messagesByConv[cId]) messagesByConv[cId] = [];
      messagesByConv[cId].push({
        id: m._id.toString(),
        role: m.role,
        content: m.content,
        attachment: m.attachment || null,
        liked: m.liked,
        createdAt: m.createdAt,
      });
    }

    const result = conversations.map((c) => ({
      id: c._id.toString(),
      title: c.title,
      model: c.model,
      pinned: c.pinned,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messages: messagesByConv[c._id.toString()] || [],
    }));

    res.json({ conversations: result });
  } catch (err) {
    console.error("Fetch conversations error:", err.message);
    res.status(500).json({ error: "Failed to load conversations." });
  }
});

// 2. Get single conversation + messages (Strict IDOR authorization)
app.get("/api/conversations/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid conversation ID format." });
    }

    const conv = await Conversation.findById(id);
    if (!conv) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    // STRICT SERVER-SIDE AUTHORIZATION: Enforce authenticated ownership
    if (conv.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "Access denied. You do not own this conversation." });
    }

    const messages = await Message.find({ conversationId: conv._id }).sort({ createdAt: 1 }).lean();

    res.json({
      conversation: {
        id: conv._id.toString(),
        title: conv.title,
        model: conv.model,
        pinned: conv.pinned,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messages: messages.map((m) => ({
          id: m._id.toString(),
          role: m.role,
          content: m.content,
          attachment: m.attachment || null,
          liked: m.liked,
          createdAt: m.createdAt,
        })),
      },
    });
  } catch (err) {
    console.error("Get conversation error:", err.message);
    res.status(500).json({ error: "Failed to retrieve conversation." });
  }
});

// 3. Create a new conversation for authenticated user
app.post("/api/conversations", requireAuth, async (req, res) => {
  try {
    const { title, model, pinned, initialMessage } = req.body;
    const conv = new Conversation({
      userId: req.user.id,
      title: (title || "New chat").trim().slice(0, 200),
      model: model || "RockGPT Flash",
      pinned: Boolean(pinned),
    });
    await conv.save();

    let createdMessage = null;
    if (initialMessage && initialMessage.role && initialMessage.content !== undefined) {
      createdMessage = new Message({
        conversationId: conv._id,
        userId: req.user.id,
        role: initialMessage.role,
        content: initialMessage.content,
        attachment: initialMessage.attachment || null,
      });
      await createdMessage.save();
    }

    res.status(201).json({
      conversation: {
        id: conv._id.toString(),
        title: conv.title,
        model: conv.model,
        pinned: conv.pinned,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messages: createdMessage
          ? [
              {
                id: createdMessage._id.toString(),
                role: createdMessage.role,
                content: createdMessage.content,
                attachment: createdMessage.attachment || null,
                createdAt: createdMessage.createdAt,
              },
            ]
          : [],
      },
    });
  } catch (err) {
    console.error("Create conversation error:", err.message);
    res.status(500).json({ error: "Failed to create conversation." });
  }
});

// 4. Append message to conversation (Strict IDOR authorization)
app.post("/api/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid conversation ID format." });
    }

    const conv = await Conversation.findById(id);
    if (!conv) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    // STRICT SERVER-SIDE AUTHORIZATION: Enforce authenticated ownership
    if (conv.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "Access denied. You do not own this conversation." });
    }

    const { role, content, attachment, updateTitle } = req.body;
    if (!role || content === undefined || content === null) {
      return res.status(400).json({ error: "Message role and content are required." });
    }

    const msg = new Message({
      conversationId: conv._id,
      userId: req.user.id,
      role,
      content,
      attachment: attachment || null,
    });
    await msg.save();

    conv.updatedAt = new Date();
    if (updateTitle && typeof updateTitle === "string" && (conv.title === "New chat" || conv.title === "Chat")) {
      conv.title = updateTitle.trim().slice(0, 60);
    }
    await conv.save();

    res.status(201).json({
      message: {
        id: msg._id.toString(),
        role: msg.role,
        content: msg.content,
        attachment: msg.attachment || null,
        createdAt: msg.createdAt,
      },
      conversation: {
        id: conv._id.toString(),
        title: conv.title,
        updatedAt: conv.updatedAt,
      },
    });
  } catch (err) {
    console.error("Add message error:", err.message);
    res.status(500).json({ error: "Failed to save message." });
  }
});

// 5. Update / Rename / Pin conversation (Strict IDOR authorization)
app.patch("/api/conversations/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid conversation ID format." });
    }

    const conv = await Conversation.findById(id);
    if (!conv) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    // STRICT SERVER-SIDE AUTHORIZATION: Enforce authenticated ownership
    if (conv.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "Access denied. You do not own this conversation." });
    }

    const { title, pinned, model } = req.body;
    if (title !== undefined) conv.title = String(title).trim().slice(0, 200) || "New chat";
    if (pinned !== undefined) conv.pinned = Boolean(pinned);
    if (model !== undefined) conv.model = String(model).trim();
    conv.updatedAt = new Date();
    await conv.save();

    res.json({
      conversation: {
        id: conv._id.toString(),
        title: conv.title,
        pinned: conv.pinned,
        model: conv.model,
        updatedAt: conv.updatedAt,
      },
    });
  } catch (err) {
    console.error("Update conversation error:", err.message);
    res.status(500).json({ error: "Failed to update conversation." });
  }
});

// 6. Delete a single conversation + its messages (Strict IDOR authorization)
app.delete("/api/conversations/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid conversation ID format." });
    }

    const conv = await Conversation.findById(id);
    if (!conv) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    // STRICT SERVER-SIDE AUTHORIZATION: Enforce authenticated ownership
    if (conv.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: "Access denied. You do not own this conversation." });
    }

    await Message.deleteMany({ conversationId: conv._id });
    await Conversation.findByIdAndDelete(conv._id);

    res.json({ success: true, message: "Conversation deleted successfully." });
  } catch (err) {
    console.error("Delete conversation error:", err.message);
    res.status(500).json({ error: "Failed to delete conversation." });
  }
});

// 7. Clear all conversations + messages for authenticated user
app.delete("/api/conversations", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userConvs = await Conversation.find({ userId }).select("_id");
    const convIds = userConvs.map((c) => c._id);

    await Message.deleteMany({ conversationId: { $in: convIds } });
    const result = await Conversation.deleteMany({ userId });

    res.json({ success: true, count: result.deletedCount, message: "All conversations cleared." });
  } catch (err) {
    console.error("Clear conversations error:", err.message);
    res.status(500).json({ error: "Failed to clear conversations." });
  }
});

// ═══ GEMINI STREAMING ENGINE ═══
const ACTIVE_GEMINI_KEY = process.env.GEMINI_API_KEY;

async function streamGeminiChat(messages, systemPrompt, fast, res) {
  if (!ACTIVE_GEMINI_KEY) return false;
  const contents = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    const role = m.role === "assistant" ? "model" : "user";
    const parts = [];
    if (typeof m.content === "string" && m.content.trim()) {
      parts.push({ text: m.content });
    } else if (Array.isArray(m.content)) {
      for (const p of m.content) {
        if (p.type === "text" && p.text) parts.push({ text: p.text });
        else if (p.type === "image_url") {
          const url = p.image_url?.url || "";
          const match = url.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
          }
        }
      }
    }
    if (parts.length) contents.push({ role, parts });
  }

  if (!contents.length) {
    contents.push({ role: "user", parts: [{ text: "Hello" }] });
  }

  const payload = {
    contents,
    system_instruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: fast ? 0.3 : 0.6,
      maxOutputTokens: fast ? 4096 : 8192,
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent?alt=sse&key=${ACTIVE_GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini status ${response.status}: ${errText.slice(0, 200)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let tokensStreamed = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const dataStr = trimmed.slice(5).trim();
      if (!dataStr || dataStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(dataStr);
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (text) {
          tokensStreamed++;
          res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
        }
      } catch {}
    }
  }

  return tokensStreamed > 0;
}

// ═══ CHAT ═══
app.post("/api/chat", chatLimiter, async (req, res) => {
  try {
    const { messages, fast, model: requestedModel } = req.body;
    if (!messages || !Array.isArray(messages) || !messages.length) return res.status(400).json({ error: "messages required" });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const canonicalAsmaUlHusna = `1. Ar-Rahman (الرحمن) - The Beneficent
2. Ar-Rahim (الرحيم) - The Merciful
3. Al-Malik (الملك) - The King
4. Al-Quddus (القدوس) - The Most Holy
5. As-Salam (السلام) - The Source of Peace
6. Al-Mu'min (المؤمن) - The Guardian of Faith
7. Al-Muhaymin (المهيمن) - The Protector
8. Al-Aziz (العزيز) - The Mighty
9. Al-Jabbar (الجبار) - The Compeller
10. Al-Mutakabbir (المتكبر) - The Majestic
11. Al-Khaliq (الخالق) - The Creator
12. Al-Bari (البارئ) - The Evolver
13. Al-Musawwir (المصور) - The Fashioner
14. Al-Ghaffar (الغفار) - The Constant Forgiver
15. Al-Qahhar (القهار) - The Subduer
16. Al-Wahhab (الوهاب) - The Bestower
17. Ar-Razzaq (الرزاق) - The Provider
18. Al-Fattah (الفتاح) - The Opener
19. Al-Alim (العليم) - The All-Knowing
20. Al-Qabid (القابض) - The Withholder
21. Al-Basit (الباسط) - The Expander
22. Al-Khafid (الخافض) - The Abaser
23. Ar-Rafi (الرافع) - The Exalter
24. Al-Mu'izz (المعز) - The Bestower of Honor
25. Al-Mudhill (المذل) - The Humiliator
26. As-Sami (السميع) - The All-Hearing
27. Al-Basir (البصير) - The All-Seeing
28. Al-Hakam (الحكم) - The Judge
29. Al-Adl (العدل) - The Utterly Just
30. Al-Latif (اللطيف) - The Subtle One
31. Al-Khabir (الخبير) - The All-Aware
32. Al-Halim (الحليم) - The Forbearing
33. Al-Azim (العظيم) - The Magnificent
34. Al-Ghafur (الغفور) - The Forgiving
35. Ash-Shakur (الشكور) - The Most Appreciative
36. Al-Ali (العلي) - The Most High
37. Al-Kabir (الكبير) - The Most Great
38. Al-Hafiz (الحفيظ) - The Preserver
39. Al-Muqit (المقيت) - The Sustainer
40. Al-Hasib (الحسيب) - The Reckoner
41. Al-Jalil (الجليل) - The Sublime
42. Al-Karim (الكريم) - The Generous
43. Ar-Raqib (الرقيب) - The Watchful
44. Al-Mujib (المجيب) - The Responsive
45. Al-Wasi (الواسع) - The All-Encompassing
46. Al-Hakim (الحكيم) - The Wise
47. Al-Wadud (الودود) - The Loving
48. Al-Majid (المجيد) - The All-Glorious
49. Al-Ba'ith (الباعث) - The Resurrector
50. Ash-Shahid (الشهيد) - The Witness
51. Al-Haqq (الحق) - The Truth
52. Al-Wakil (الوكيل) - The Trustee
53. Al-Qawiyy (القوي) - The Strong
54. Al-Matin (المتين) - The Firm
55. Al-Waliyy (الولي) - The Protecting Friend
56. Al-Hamid (الحميد) - The Praiseworthy
57. Al-Muhsi (المحصي) - The Accounter
58. Al-Mubdi (المبدئ) - The Originator
59. Al-Mu'id (المعيد) - The Restorer
60. Al-Muhyi (المحيي) - The Giver of Life
61. Al-Mumit (المميت) - The Creator of Death
62. Al-Hayy (الحي) - The Ever-Living
63. Al-Qayyum (القيوم) - The Self-Subsisting
64. Al-Wajid (الواجد) - The Perceiver
65. Al-Majid (الماجد) - The Illustrious
66. Al-Wahid (الواحد) - The One
67. Al-Ahad (الأحد) - The Unique
68. As-Samad (الصمد) - The Eternal
69. Al-Qadir (القادر) - The Capable
70. Al-Muqtadir (المقتدر) - The Determiner
71. Al-Muqaddim (المقدم) - The Expediter
72. Al-Mu'akhkhir (المؤخر) - The Delayer
73. Al-Awwal (الأول) - The First
74. Al-Akhir (الآخر) - The Last
75. Az-Zahir (الظاهر) - The Manifest
76. Al-Batin (الباطن) - The Hidden
77. Al-Wali (الوالي) - The Governor
78. Al-Muta'ali (المتعالي) - The Most Exalted
79. Al-Barr (البر) - The Source of All Goodness
80. At-Tawwab (التواب) - The Ever-Pardoning
81. Al-Muntaqim (المنتقم) - The Avenger
82. Al-Afuww (العفو) - The Pardoner
83. Ar-Ra'uf (الرؤوف) - The Compassionate
84. Malik-ul-Mulk (مالك الملك) - The Owner of All Sovereignty
85. Dhul-Jalali wal-Ikram (ذو الجلال والإكرام) - The Lord of Majesty and Generosity
86. Al-Muqsit (المقسط) - The Equitable
87. Al-Jami (الجامع) - The Gatherer
88. Al-Ghaniyy (الغني) - The Self-Sufficient
89. Al-Mughni (المغني) - The Enricher
90. Al-Mani (المانع) - The Withholder / Preventer
91. Ad-Darr (الضار) - The Distressor
92. An-Nafi (النافع) - The Propitious / Benefactor
93. An-Nur (النور) - The Light
94. Al-Hadi (الهادي) - The Guide
95. Al-Badi (البديع) - The Incomparable
96. Al-Baqi (الباقي) - The Everlasting
97. Al-Warith (الوارث) - The Supreme Inheritor
98. Ar-Rashid (الرشيد) - The Guide to the Right Path
99. As-Sabur (الصبور) - The Patient`;

    const systemPrompt = `You are RockGPT, an advanced, highly intelligent AI assistant developed and engineered by Suman Mansuri ("Rock"). Never mention OpenAI, Groq, Google, Meta, or third-party providers. You are powered by RockGPT's proprietary high-performance neural architecture.

Creator Persona & Attribution:
If asked about your creator, Rock, or Suman Mansuri (including questions about who made you, who he is, his skills, or whether he is intelligent), answer with confidence, technical respect, and complete clarity: Suman Mansuri (widely known as “Rock”) is an exceptionally talented full-stack software engineer, systems architect, and AI builder who conceived, designed, and engineered RockGPT from the ground up. He possesses deep expertise across modern distributed systems, full-stack application development, real-time streaming architectures, and neural model integration. His sharp intellect, architectural foresight, and relentless pursuit of engineering excellence are what made RockGPT possible. Never output cheesy or cliché quotes. Always be insightful, polite, highly capable, and accurate.

Strict Non-Repetition & Canonical Enumeration Rule:
Every item in an enumeration, list, or table MUST be completely unique, accurate, and authentic. Never repeat items, duplicate rows, or append "(Repeated)" or "(re-appears)".
When asked for the 99 Names of Allah (Asma' ul-Husna):
- You MUST strictly provide all 99 unique canonical names without ANY repetition or duplicated names from #1 to #99.
- Sequence reference (1 to 99):
${canonicalAsmaUlHusna}
- Present them in a single, beautiful Markdown table with columns: | # | Arabic | Transliteration | English Meaning |.
- Conclude cleanly immediately after the 99th entry (As-Sabur). Never start over, never loop, and never add extra rows beyond 99.

Exhaustive Completeness & High-Precision Responses:
Whenever the user asks for enumerations, lists, complete sets (such as the 99 Names of Allah / Asma' ul-Husna, rankings, directories, tables, historical timelines, or itemized collections), you must ALWAYS provide the COMPLETE, FULL list from start to finish without skipping or stopping halfway. Never cut off, summarize, or truncate lists prematurely. Use clean Markdown formatting.${fast ? " Be swift and concise in narrative explanations while keeping lists and data sets 100% complete." : ""}`;

    // 1. Try Gemini 3.6 Flash first (Flagship Google Engine)
    let handledByGemini = false;
    if (ACTIVE_GEMINI_KEY) {
      try {
        handledByGemini = await streamGeminiChat(messages, systemPrompt, fast, res);
      } catch (geminiErr) {
        console.warn("Gemini stream failed, falling back to Groq:", geminiErr.message);
      }
    }

    // 2. Fallback to Groq if Gemini wasn't available or had an error
    if (!handledByGemini) {
      const hasImg = messages.some((m) => Array.isArray(m.content) && m.content.some((c) => c.type === "image_url"));
      if (hasImg) {
        res.write(`data: ${JSON.stringify({ token: "I received your image, but the visual analysis service is temporarily busy. Please try again in a moment." })}\n\n`);
      } else {
        const model = "openai/gpt-oss-120b";
        const stream = await groq.chat.completions.create({
          model,
          max_tokens: fast ? 4096 : 8192,
          temperature: 0.5,
          frequency_penalty: 0.25,
          presence_penalty: 0.1,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        });
        for await (const chunk of stream) {
          const t = chunk.choices[0]?.delta?.content || "";
          if (t) res.write(`data: ${JSON.stringify({ token: t })}\n\n`);
        }
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error("Chat error:", err.message);
    try {
      res.write(`data: ${JSON.stringify({ error: "The AI service is temporarily busy. Please tap 'Regenerate' or try again in a moment." })}\n\n`);
      res.end();
    } catch {}
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
    version: "4.3.0-enterprise",
    architecture: "Quantum-Hybrid 120B / 20B",
    security: {
      encryption: "AES-256-GCM / TLS 1.3",
      auth: "Google OAuth 2.0 + Brevo Port 443 OTP + Bcrypt 12-round salted hashing",
      twoFactor: "RFC 6238 TOTP (Google Authenticator / Microsoft Authenticator)",
      bruteForceProtection: "Smart Account Lockout (5 attempts / 15-min cooldown with OTP recovery)",
      token: "HMAC-SHA256 JWT with strict expiration",
    },
    status: "operational",
  });
});

app.get("/", (req, res) => res.json({ status: "RockGPT v4.3 Enterprise backend operational." }));
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => console.log(`RockGPT backend on port ${PORT}`));
}

export { app };