import express from "express";
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import User from "../models/User.js";
import OtpVerification from "../models/OtpVerification.js";
import OtpRateLimit from "../models/OtpRateLimit.js";
import RefreshToken from "../models/RefreshToken.js";
import { authLimiter, loginSignupLimiter, getClientIpFromReq } from "../middleware/limit.js";
import { authMiddleware, requireAuth } from "../middleware/auth.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

// ═══ ZOD VALIDATION SCHEMAS ═══
const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

const verifySchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  code: z.string().trim().min(4).max(10),
});

const signinSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const forgotSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
});

const resetSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  code: z.string().trim().min(4).max(10),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(128),
});

const resendSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  type: z.enum(["signup", "reset", "login"]).optional().default("signup"),
});

// ═══ OTP CRYPTOGRAPHIC HASHING & RATE-LIMITING ═══
export function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

export function computeOtpHash(email, purpose, code) {
  const canonicalEmail = String(email).toLowerCase().trim();
  return crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${canonicalEmail}:${purpose}:${String(code).trim()}`)
    .digest("hex");
}

export function verifyOtpHash(email, purpose, candidateCode, storedHash) {
  if (!candidateCode || !storedHash) return false;
  const computed = computeOtpHash(email, purpose, candidateCode);
  const bufComputed = Buffer.from(computed, "utf8");
  const bufStored = Buffer.from(storedHash, "utf8");
  if (bufComputed.length !== bufStored.length) return false;
  return crypto.timingSafeEqual(bufComputed, bufStored);
}

// Resend cooldown 60s, max 5 sends/hour per email & per IP
async function checkAndRecordOtpRateLimit(email, ip, req) {
  if (process.env.NODE_ENV === "test" && req?.headers?.["x-test-rate-limit"] !== "true") {
    return { allowed: true };
  }
  const cleanEmail = String(email).toLowerCase().trim();
  const cleanIp = String(ip || "unknown").trim();
  const now = Date.now();

  const keys = [`email:${cleanEmail}`, `ip:${cleanIp}`];

  for (const key of keys) {
    try {
      const record = await OtpRateLimit.findOne({ key });
      if (record) {
        const timeDiff = now - new Date(record.lastSentAt).getTime();
        if (timeDiff < 60 * 1000) {
          const retryAfterSec = Math.ceil((60 * 1000 - timeDiff) / 1000);
          return {
            allowed: false,
            status: 429,
            error: `Please wait ${retryAfterSec} second${retryAfterSec === 1 ? "" : "s"} before requesting a new code.`,
            retryAfter: retryAfterSec,
          };
        }
        if (record.count >= 5) {
          return {
            allowed: false,
            status: 429,
            error: "Too many verification code requests. Please wait an hour before trying again.",
            retryAfter: 3600,
          };
        }
      }
    } catch (e) {
      // In-memory or temporary DB glitch: allow to proceed
    }
  }

  return { allowed: true };
}

async function recordOtpSent(email, ip) {
  const cleanEmail = String(email).toLowerCase().trim();
  const cleanIp = String(ip || "unknown").trim();

  for (const key of [`email:${cleanEmail}`, `ip:${cleanIp}`]) {
    try {
      await OtpRateLimit.findOneAndUpdate(
        { key },
        {
          $inc: { count: 1 },
          $set: { lastSentAt: new Date() },
          $setOnInsert: { expiresAt: new Date(Date.now() + 3600 * 1000) },
        },
        { upsert: true, returnDocument: "after" }
      );
    } catch {}
  }
}

// ═══ REFRESH TOKEN ROTATION & REVOCATION ═══
async function issueRefreshToken(userId, res) {
  const rawRefreshToken = crypto.randomBytes(40).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);

  try {
    await RefreshToken.create({
      userId,
      tokenHash,
      expiresAt,
    });
  } catch {}

  if (res && res.cookie) {
    res.cookie("refreshToken", rawRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth",
      maxAge: 30 * 24 * 3600 * 1000,
    });
  }

  return rawRefreshToken;
}

const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || "").trim();
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID || undefined);

export function timingSafeEqualString(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function setJwtCookie(res, token, req) {
  if (!res || !res.cookie || !token) return;
  const isCrossSiteHttps = Boolean(
    req?.secure ||
      req?.headers?.["x-forwarded-proto"] === "https" ||
      process.env.NODE_ENV === "production"
  );
  res.cookie("token", token, {
    httpOnly: true,
    secure: isCrossSiteHttps,
    sameSite: isCrossSiteHttps ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearJwtCookie(res, req) {
  if (!res || !res.clearCookie) return;
  const isCrossSiteHttps = Boolean(
    req?.secure ||
      req?.headers?.["x-forwarded-proto"] === "https" ||
      process.env.NODE_ENV === "production"
  );
  res.clearCookie("token", {
    httpOnly: true,
    secure: isCrossSiteHttps,
    sameSite: isCrossSiteHttps ? "none" : "lax",
    path: "/",
  });
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
      plan: user.plan || "free",
      scope: "access",
    },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: "7d" }
  );
}

function formatPlanName(plan) {
  if (!plan) return "Free";
  const p = String(plan).toLowerCase();
  if (p === "pro") return "Pro";
  if (p === "plus") return "Plus";
  return "Free";
}

// Check security lockout (15-minute temporary lockout after 5 failed attempts)
function checkLockout(user) {
  if (user && user.lockedUntil) {
    const now = Date.now();
    const lockTime = new Date(user.lockedUntil).getTime();
    if (lockTime > now) {
      const remainingMinutes = Math.ceil((lockTime - now) / (1000 * 60));
      return {
        isLocked: true,
        message: `Account is temporarily locked for security due to multiple failed attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? "s" : ""}.`,
      };
    }
  }
  return { isLocked: false };
}

// ═══ GMAIL NORMALIZATION & DOT-INSENSITIVE EMAIL RESOLUTION ═══
/**
 * Normalizes email lookup for Gmail and Googlemail (where dots in username are ignored by Google)
 * e.g., 'mansuri.suman52@gmail.com' and 'mansurisuman52@gmail.com' map to the exact same mailbox.
 */
export function getEmailSearchFilter(email) {
  if (!email || typeof email !== "string") return { email: "" };
  const cleanEmail = email.toLowerCase().trim();
  const atIndex = cleanEmail.indexOf("@");
  if (atIndex === -1) return { email: cleanEmail };

  const localPart = cleanEmail.slice(0, atIndex);
  const domain = cleanEmail.slice(atIndex + 1);

  if (domain === "gmail.com" || domain === "googlemail.com") {
    // Strip existing dots and any +alias tag to isolate root username
    const baseLocal = localPart.replace(/\./g, "").split("+")[0];
    const pattern =
      "^" +
      baseLocal
        .split("")
        .map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\.?")
        .join("") +
      "(\\+[a-zA-Z0-9._-]+)?@(gmail|googlemail)\\.com$";
    return {
      $or: [
        { email: cleanEmail },
        { email: { $regex: new RegExp(pattern, "i") } },
      ],
    };
  }

  return { email: cleanEmail };
}

export async function findUserByEmail(email) {
  if (!email || typeof email !== "string") return null;
  const cleanEmail = email.toLowerCase().trim();

  // 1. Direct indexed match first (fastest O(1))
  let user = await User.findOne({ email: cleanEmail });
  if (user) return user;

  // 2. Dot-insensitive Gmail pattern lookup
  const filter = getEmailSearchFilter(cleanEmail);
  user = await User.findOne(filter);
  return user;
}

// Pooled, reusable Nodemailer transports for maximum performance & zero connection overhead
let persistentTransporter = null;

function getTransporter(user, pass) {
  if (!persistentTransporter) {
    persistentTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
      pool: true,
      maxConnections: 5,
      maxMessages: 200,
      family: 4, // Force IPv4: completely bypasses 30-40s IPv6 timeouts
      connectionTimeout: 6000,
      greetingTimeout: 6000,
      socketTimeout: 6000,
    });
    // Background warm-up
    persistentTransporter.verify().catch(() => {});
  }
  return persistentTransporter;
}

// Low-latency email dispatcher that prevents button freeze / network hanging
async function dispatchEmailWithTimeout(emailParams, timeoutMs = 4500) {
  let timerId;
  const timeoutPromise = new Promise((resolve) => {
    timerId = setTimeout(() => {
      resolve({ success: false, timedOut: true, reason: "Dispatch continuing in background" });
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([sendEmail(emailParams), timeoutPromise]);
    clearTimeout(timerId);
    return result;
  } catch (err) {
    clearTimeout(timerId);
    return { success: false, reason: err.message };
  }
}

// 100% accurate OTP document lookup matching clean email, registered email, and dot-insensitive variations
async function findOtpDoc(cleanEmail, userEmail, type) {
  const emailsToMatch = Array.from(new Set([cleanEmail, ...(userEmail ? [userEmail] : [])]));
  let otpDoc = await OtpVerification.findOne({ email: { $in: emailsToMatch }, type });
  if (otpDoc) return otpDoc;

  const filter = getEmailSearchFilter(cleanEmail);
  otpDoc = await OtpVerification.findOne({ ...filter, type });
  return otpDoc;
}

// ═══ UNIVERSAL EMAIL DISPATCH ENGINE (BREVO HTTPS + RESEND HTTPS + GMAIL MULTI-PORT SMTP) ═══
export async function sendEmail({ to, subject, html, fromName }) {
  const cleanUser = (process.env.EMAIL_USER || "").trim();
  const senderDisplayName = fromName || "RockGPT Security";

  // 1. Brevo REST API (HTTPS Port 443 — firewall immune, works seamlessly on Render free tier)
  if (process.env.BREVO_API_KEY) {
    try {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": process.env.BREVO_API_KEY.trim(),
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender: { name: senderDisplayName, email: cleanUser || "noreply@rockgpt.ai" },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        console.log(`[Brevo API] Email sent to ${to} (${senderDisplayName})`);
        return { success: true, provider: "brevo", data };
      } else {
        console.warn("[Brevo API Warning]:", data.message || `HTTP ${res.status}`);
      }
    } catch (brevoErr) {
      console.warn("[Brevo Fetch Error]:", brevoErr.message);
    }
  }

  // 2. Resend REST API (HTTPS Port 443 — firewall immune)
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: cleanUser ? `${senderDisplayName} <${cleanUser}>` : `${senderDisplayName} <onboarding@resend.dev>`,
          to: [to],
          subject,
          html,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        console.log(`[Resend API] Email sent to ${to} (${senderDisplayName})`);
        return { success: true, provider: "resend", data };
      } else {
        console.warn("[Resend API Warning]:", data.message || `HTTP ${res.status}`);
      }
    } catch (resendErr) {
      console.warn("[Resend Fetch Error]:", resendErr.message);
    }
  }

  // 3. Gmail SMTP via Nodemailer (Ultra-Fast IPv4 Pooled Transport)
  const cleanPass = (process.env.EMAIL_PASS || "").replace(/\s+/g, "");
  if (cleanUser && cleanPass) {
    try {
      const transporter = getTransporter(cleanUser, cleanPass);
      const info = await transporter.sendMail({
        from: `"${senderDisplayName}" <${cleanUser}>`,
        to,
        subject,
        html,
      });
      console.log(`[Gmail SMTP Fast] Email delivered to ${to} (${senderDisplayName})`);
      return { success: true, provider: "gmail-smtp-fast", info };
    } catch (err) {
      console.warn("[Gmail SMTP Fast Warning]:", err.message);
      try {
        const fallback = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 587,
          secure: false,
          auth: { user: cleanUser, pass: cleanPass },
          family: 4,
          connectionTimeout: 5000,
        });
        const info = await fallback.sendMail({
          from: `"${senderDisplayName}" <${cleanUser}>`,
          to,
          subject,
          html,
        });
        console.log(`[Gmail SMTP Fallback 587] Delivered to ${to}`);
        return { success: true, provider: "gmail-smtp-587", info };
      } catch (err587) {
        console.warn("[Gmail SMTP 587 Error]:", err587.message);
      }
    }
  }

  console.log(`[EMAIL DISPATCH NOTIFICATION] Simulated/Direct delivery fallback for ${to}: ${subject}`);
  return { success: false, reason: "No active email provider reached" };
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getOtpEmailTemplate(code, title, subtitle) {
  return `
  <div style="font-family:'Outfit',system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0d0d0d;border:1px solid #222;border-radius:24px;color:#ffffff;text-align:center;">
    <div style="font-size:24px;font-weight:700;letter-spacing:0.18em;margin-bottom:12px;color:#ffffff;">ROCKGPT</div>
    <h2 style="font-size:20px;font-weight:600;margin:16px 0 8px;color:#ffffff;">${escapeHtml(title)}</h2>
    <p style="font-size:14px;color:#888888;line-height:1.6;margin-bottom:24px;">${escapeHtml(subtitle)}</p>
    <div style="display:inline-block;padding:16px 36px;background:#171717;border:1px solid #2e2e2e;border-radius:16px;font-size:32px;font-weight:700;letter-spacing:0.25em;color:#ffffff;margin-bottom:24px;">
      ${escapeHtml(code)}
    </div>
    <p style="font-size:12px;color:#666666;line-height:1.5;">Notice: This security code is single-use and expires in 10 minutes. You have up to 5 attempts.</p>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #1f1f1f;font-size:11px;color:#444444;">
      &copy; ${new Date().getFullYear()} RockGPT &bull; Architected & Engineered by Suman Mansuri
    </div>
  </div>`;
}

// 1. Sign Up (Immediately creates/stores user data & password in MongoDB + dispatches OTP)
router.post("/signup", loginSignupLimiter, async (req, res) => {
  try {
    const parseResult = signupSchema.safeParse(req.body);
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message || "Invalid registration data.";
      return res.status(400).json({ error: msg });
    }

    const { name, email, password } = parseResult.data;
    const cleanEmail = email.toLowerCase().trim();

    const existing = await findUserByEmail(cleanEmail);
    if (existing) {
      const lockCheck = checkLockout(existing);
      if (lockCheck.isLocked) {
        return res.status(429).json({ error: lockCheck.message, locked: true });
      }
      if (existing.isVerified || (existing.googleId && !existing.passwordHash)) {
        return res.status(409).json({
          error: "An account with this email already exists.",
          ...(existing.googleId && !existing.passwordHash ? { isGoogleAccount: true } : {}),
        });
      }
    }

    const clientIp = getClientIpFromReq(req);

    // Rate limiting: 60s cooldown & max 5 sends/hour
    const rateCheck = await checkAndRecordOtpRateLimit(cleanEmail, clientIp, req);
    if (!rateCheck.allowed) {
      return res.status(rateCheck.status).json({ error: rateCheck.error, retryAfter: rateCheck.retryAfter });
    }

    // Hash password with cost factor 12
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    let user = existing;
    if (!user) {
      user = await User.create({
        name: name.trim(),
        email: cleanEmail,
        passwordHash,
        plan: "free",
        isVerified: false,
        failedOtpAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      });
    } else {
      user.name = name.trim();
      user.passwordHash = passwordHash;
      user.failedOtpAttempts = 0;
      user.lockedUntil = null;
      user.lastLoginAt = new Date();
      await user.save();
    }

    const token = generateToken(user);
    const refreshToken = await issueRefreshToken(user._id, res);
    setJwtCookie(res, token, req);

    // Cryptographic 6-digit OTP stored ONLY as HMAC hash
    const code = generateOtpCode();
    const codeHash = computeOtpHash(cleanEmail, "signup", code);

    const emailsToMatch = Array.from(new Set([cleanEmail, user.email]));
    await OtpVerification.deleteMany({ email: { $in: emailsToMatch }, type: "signup" });
    await OtpVerification.create({
      email: cleanEmail,
      codeHash,
      type: "signup",
      name: name.trim(),
      passwordHash,
      attempts: 0,
      ...(process.env.NODE_ENV === "test" ? { testPlainCode: code } : {}),
    });

    // In production, never log OTP to console
    if (process.env.NODE_ENV === "test") {
      console.log(`[AUTH TEST MODE] Verification OTP for ${cleanEmail}: ${code}`);
    }

    const emailResult = await dispatchEmailWithTimeout({
      to: cleanEmail,
      subject: `Your RockGPT Verification Code: ${code}`,
      html: getOtpEmailTemplate(
        code,
        "Verify Your RockGPT Account",
        `Welcome to RockGPT, ${name.trim()}! Please enter this 6-digit code to complete registration.`
      ),
    });

    const emailSent = Boolean(emailResult?.success);

    // Real error handling: If sending failed in production, return error and clean up
    if (!emailSent && !emailResult?.timedOut && process.env.NODE_ENV === "production") {
      await OtpVerification.deleteMany({ email: { $in: emailsToMatch }, type: "signup" });
      return res.status(502).json({
        error: "Failed to dispatch verification email. Please check your email address and try again.",
      });
    }

    await recordOtpSent(cleanEmail, clientIp);

    res.json({
      success: true,
      message: emailSent
        ? "Account created! 6-digit verification code sent to your email inbox."
        : "Account created successfully! Your credentials have been securely stored.",
      email: cleanEmail,
      emailSent,
      backupCode: process.env.NODE_ENV === "test" ? code : undefined,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        plan: formatPlanName(user.plan),
      },
      token,
      refreshToken,
    });
  } catch (err) {
    console.error("Signup error:", err.message);
    res.status(500).json({ error: "Server error during registration." });
  }
});

// 2. Verify OTP & Activate (5 attempts with 15-minute cooldown)
router.post("/verify", authLimiter, async (req, res) => {
  try {
    const parseResult = verifySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Email and valid verification code are required." });
    }

    const { email, code } = parseResult.data;
    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = String(code).trim();

    const existingUser = await findUserByEmail(cleanEmail);
    if (existingUser) {
      const lockCheck = checkLockout(existingUser);
      if (lockCheck.isLocked) {
        return res.status(429).json({ error: lockCheck.message, locked: true });
      }
    }

    const emailsToMatch = Array.from(new Set([cleanEmail, ...(existingUser ? [existingUser.email] : [])]));
    const otpDoc = await findOtpDoc(cleanEmail, existingUser?.email, "signup");
    
    // SEC-01: /api/auth/verify must NEVER issue a token when no valid OTP exists
    if (!otpDoc) {
      return res.status(400).json({
        error: "Verification code has expired or is invalid. Please request a new code.",
      });
    }

    otpDoc.attempts += 1;

    // SEC-07: Timing-safe HMAC hash verification
    const isCodeMatch =
      (otpDoc.codeHash && verifyOtpHash(cleanEmail, "signup", cleanCode, otpDoc.codeHash)) ||
      (otpDoc.code && timingSafeEqualString(otpDoc.code, cleanCode));

    if (!isCodeMatch) {
      if (otpDoc.attempts >= 5) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        if (existingUser) {
          existingUser.lockedUntil = lockUntil;
          existingUser.failedOtpAttempts = 5;
          await existingUser.save();
        } else {
          await User.findOneAndUpdate(
            { email: { $in: emailsToMatch } },
            { lockedUntil: lockUntil, failedOtpAttempts: 5 },
            { upsert: false }
          );
        }
        await OtpVerification.deleteMany({ email: { $in: emailsToMatch }, type: "signup" });
        return res.status(429).json({
          error: "Maximum attempts exceeded (5/5). Please wait 15 minutes before trying again.",
          locked: true,
        });
      }

      await otpDoc.save();
      const attemptsLeft = 5 - otpDoc.attempts;
      return res.status(400).json({
        error: `Incorrect code. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} remaining.`,
        attemptsLeft,
      });
    }

    // Single-use destruction: delete OTP document immediately
    await OtpVerification.deleteMany({ email: { $in: emailsToMatch }, type: "signup" });

    let user = existingUser || (await findUserByEmail(cleanEmail));
    if (!user) {
      user = await User.create({
        name: otpDoc.name || cleanEmail.split("@")[0],
        email: cleanEmail,
        passwordHash: otpDoc.passwordHash,
        plan: "free",
        isVerified: true,
        failedOtpAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      });
    } else {
      if (otpDoc.passwordHash) user.passwordHash = otpDoc.passwordHash;
      user.isVerified = true;
      user.failedOtpAttempts = 0;
      user.lockedUntil = null;
      user.lastLoginAt = new Date();
      await user.save();
    }

    const token = generateToken(user);
    const refreshToken = await issueRefreshToken(user._id, res);
    setJwtCookie(res, token, req);

    res.json({
      success: true,
      message: "Account active! Welcome to RockGPT.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        plan: formatPlanName(user.plan),
      },
      token,
      refreshToken,
    });
  } catch (err) {
    console.error("Verify OTP error:", err.message);
    res.status(500).json({ error: "Verification server error." });
  }
});

async function handleSignIn(req, res) {
  try {
    const rawEmail = req.body?.email;
    const rawPassword = req.body?.password;
    if (
      typeof rawEmail !== "string" ||
      !rawEmail.trim() ||
      typeof rawPassword !== "string" ||
      !rawPassword
    ) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const parseResult = signinSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const { email, password } = parseResult.data;
    const cleanEmail = email.toLowerCase().trim();

    const user = await findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(401).json({ error: "No account found with this email." });
    }

    if (!user.passwordHash && !user.password) {
      if (user.googleId) {
        return res.status(401).json({
          error: "This account was registered using Google Sign-In. Please sign in with 'Continue with Google', or click 'Forgot password?' below to set a password.",
          isGoogleAccount: true,
        });
      }
      return res.status(401).json({
        error: "No password is set for this account. Please click 'Forgot password?' to set a password.",
        noPassword: true,
      });
    }

    const lockCheck = checkLockout(user);
    if (lockCheck.isLocked) {
      return res.status(429).json({ error: lockCheck.message, locked: true });
    }

    let isMatch = false;
    if (user.passwordHash) {
      isMatch = await bcrypt.compare(password, user.passwordHash);
    } else if (user.password) {
      if (user.password === password) {
        isMatch = true;
      } else {
        isMatch = await bcrypt.compare(password, user.password);
      }
      if (isMatch) {
        user.passwordHash = await bcrypt.hash(password, 12);
        user.password = null;
      }
    }

    if (!isMatch) {
      user.failedOtpAttempts = (user.failedOtpAttempts || 0) + 1;
      if (user.failedOtpAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();
        return res.status(429).json({
          error: "Too many failed login attempts. Please wait 15 minutes before trying again.",
          locked: true,
        });
      }
      await user.save();
      return res.status(401).json({
        error: "Incorrect password. Please try again.",
      });
    }

    user.isVerified = true;
    user.failedOtpAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    await user.save();

    // SEC-02: Enforce 2FA if enabled on account
    if (user.twoFactorEnabled || user.is2faEnabled) {
      const tempToken = jwt.sign(
        { id: user._id, email: user.email, is2faPending: true, scope: "2fa_temp" },
        JWT_SECRET,
        { algorithm: "HS256", expiresIn: "10m" }
      );
      return res.json({
        require2FA: true,
        tempToken,
        email: user.email,
      });
    }

    const token = generateToken(user);
    const refreshToken = await issueRefreshToken(user._id, res);
    setJwtCookie(res, token, req);

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        plan: formatPlanName(user.plan),
      },
      token,
      refreshToken,
    });
  } catch (err) {
    console.error("Sign in error:", err.message);
    res.status(500).json({ error: "Authentication server error." });
  }
}

router.post("/signin", loginSignupLimiter, handleSignIn);
router.post("/login", loginSignupLimiter, handleSignIn);

// 4. Resend OTP Endpoint
router.post("/resend-otp", authLimiter, async (req, res) => {
  try {
    const parseResult = resendSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Email is required." });
    }

    const { email, type } = parseResult.data;
    const cleanEmail = email.toLowerCase().trim();
    const cleanType = type === "reset" ? "reset" : "signup";

    const user = await findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: "Account not found." });
    }

    const lockCheck = checkLockout(user);
    if (lockCheck.isLocked) {
      return res.status(429).json({ error: lockCheck.message, locked: true });
    }

    const clientIp = getClientIpFromReq(req);

    // Rate limiting: 60s cooldown & max 5 sends/hour
    const rateCheck = await checkAndRecordOtpRateLimit(cleanEmail, clientIp, req);
    if (!rateCheck.allowed) {
      return res.status(rateCheck.status).json({ error: rateCheck.error, retryAfter: rateCheck.retryAfter });
    }

    const code = generateOtpCode();
    const codeHash = computeOtpHash(cleanEmail, cleanType, code);
    const emailsToMatch = Array.from(new Set([cleanEmail, user.email]));

    await OtpVerification.deleteMany({ email: { $in: emailsToMatch }, type: cleanType });
    await OtpVerification.create({
      email: cleanEmail,
      codeHash,
      type: cleanType,
      name: user.name,
      passwordHash: user.passwordHash,
      attempts: 0,
      ...(process.env.NODE_ENV === "test" ? { testPlainCode: code } : {}),
    });

    if (process.env.NODE_ENV === "test") {
      console.log(`[AUTH TEST MODE] Resent OTP for ${cleanEmail} (${cleanType}): ${code}`);
    }

    const emailResult = await dispatchEmailWithTimeout({
      to: cleanEmail,
      subject: `Your RockGPT Security Code: ${code}`,
      html: getOtpEmailTemplate(
        code,
        cleanType === "reset" ? "Reset Your Password" : "Verify Your RockGPT Account",
        "Here is your new 6-digit security code. Single-use only."
      ),
    });

    const emailSent = Boolean(emailResult?.success);

    if (!emailSent && !emailResult?.timedOut && process.env.NODE_ENV === "production") {
      await OtpVerification.deleteMany({ email: { $in: emailsToMatch }, type: cleanType });
      return res.status(502).json({ error: "Failed to dispatch verification email. Please try again." });
    }

    await recordOtpSent(cleanEmail, clientIp);

    res.json({
      success: true,
      message: emailSent
        ? "Fresh verification code sent to your email inbox."
        : "New verification code generated successfully.",
      emailSent,
      backupCode: process.env.NODE_ENV === "test" ? code : undefined,
    });
  } catch (err) {
    console.error("Resend OTP error:", err.message);
    res.status(500).json({ error: "Failed to resend verification code." });
  }
});

// 5. Forgot Password (Sends 6-digit recovery OTP)
router.post("/forgot", authLimiter, async (req, res) => {
  try {
    const parseResult = forgotSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Valid email is required." });
    }

    const cleanEmail = parseResult.data.email.toLowerCase().trim();
    const user = await findUserByEmail(cleanEmail);

    if (!user) {
      return res.status(404).json({ error: "No account found with this email address." });
    }

    const lockCheck = checkLockout(user);
    if (lockCheck.isLocked) {
      return res.status(429).json({ error: lockCheck.message, locked: true });
    }

    const clientIp = getClientIpFromReq(req);

    // Rate limiting: 60s cooldown & max 5 sends/hour
    const rateCheck = await checkAndRecordOtpRateLimit(cleanEmail, clientIp, req);
    if (!rateCheck.allowed) {
      return res.status(rateCheck.status).json({ error: rateCheck.error, retryAfter: rateCheck.retryAfter });
    }

    const code = generateOtpCode();
    const codeHash = computeOtpHash(cleanEmail, "reset", code);
    const emailsToMatch = Array.from(new Set([cleanEmail, user.email]));

    await OtpVerification.deleteMany({ email: { $in: emailsToMatch }, type: "reset" });
    await OtpVerification.create({
      email: cleanEmail,
      codeHash,
      type: "reset",
      name: user.name,
      attempts: 0,
      ...(process.env.NODE_ENV === "test" ? { testPlainCode: code } : {}),
    });

    if (process.env.NODE_ENV === "test") {
      console.log(`[AUTH TEST MODE] Password Recovery OTP for ${cleanEmail}: ${code}`);
    }

    const emailResult = await dispatchEmailWithTimeout({
      to: cleanEmail,
      subject: `Your RockGPT Password Reset Code: ${code}`,
      html: getOtpEmailTemplate(
        code,
        "Reset Your RockGPT Password",
        "Use the following 6-digit code to securely recover and reset your password."
      ),
    });

    const emailSent = Boolean(emailResult?.success);

    if (!emailSent && !emailResult?.timedOut && process.env.NODE_ENV === "production") {
      await OtpVerification.deleteMany({ email: { $in: emailsToMatch }, type: "reset" });
      return res.status(502).json({ error: "Failed to dispatch password recovery email. Please try again." });
    }

    await recordOtpSent(cleanEmail, clientIp);

    res.json({
      success: true,
      message: emailSent
        ? "6-digit security code sent to your email inbox."
        : "Recovery code generated. Enter the code below to reset your password.",
      email: cleanEmail,
      emailSent,
      backupCode: process.env.NODE_ENV === "test" ? code : undefined,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to process password recovery." });
  }
});

// 5b. Verify Password Reset OTP (supports standalone verification without consuming code prematurely)
router.post("/verify-reset", authLimiter, async (req, res) => {
  try {
    const parseResult = verifySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Email and valid verification code are required." });
    }

    const { email, code } = parseResult.data;
    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = String(code).trim();

    const user = await findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: "Account not found." });
    }

    const lockCheck = checkLockout(user);
    if (lockCheck.isLocked) {
      return res.status(429).json({ error: lockCheck.message, locked: true });
    }

    const emailsToMatch = Array.from(new Set([cleanEmail, user.email]));
    const otpDoc = await findOtpDoc(cleanEmail, user.email, "reset");
    if (!otpDoc) {
      return res.status(400).json({
        error: "Reset code has expired or is invalid. Please request a new reset code.",
      });
    }

    const isResetMatch =
      (otpDoc.codeHash && verifyOtpHash(cleanEmail, "reset", cleanCode, otpDoc.codeHash)) ||
      (otpDoc.code && timingSafeEqualString(otpDoc.code, cleanCode));

    if (!isResetMatch) {
      otpDoc.attempts += 1;
      if (otpDoc.attempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.failedOtpAttempts = 5;
        await user.save();
        await OtpVerification.deleteMany({ email: { $in: emailsToMatch }, type: "reset" });
        return res.status(429).json({
          error: "Maximum attempts exceeded (5/5). Please wait 15 minutes before trying again.",
          locked: true,
        });
      }
      await otpDoc.save();
      const remaining = 5 - otpDoc.attempts;
      return res.status(400).json({
        error: `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
        remainingAttempts: remaining,
      });
    }

    return res.json({
      success: true,
      verified: true,
      message: "Recovery code verified. Enter your new password.",
    });
  } catch (err) {
    console.error("Verify reset OTP error:", err.message);
    res.status(500).json({ error: "Verification server error." });
  }
});

// 6. Reset Password with OTP
router.post("/reset-password", authLimiter, async (req, res) => {
  try {
    const parseResult = resetSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Email, reset code, and valid new password (8+ chars) are required." });
    }

    const { email, code, newPassword } = parseResult.data;
    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.trim();

    const user = await findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: "Account not found." });
    }

    const lockCheck = checkLockout(user);
    if (lockCheck.isLocked) {
      return res.status(429).json({ error: lockCheck.message, locked: true });
    }

    const emailsToMatch = Array.from(new Set([cleanEmail, user.email]));
    const otpDoc = await findOtpDoc(cleanEmail, user.email, "reset");
    if (!otpDoc) {
      return res.status(400).json({
        error: "Reset code has expired or is invalid. Please request a new reset code.",
      });
    }

    otpDoc.attempts += 1;

    // SEC-07: Timing-safe HMAC hash check
    const isResetMatch =
      (otpDoc.codeHash && verifyOtpHash(cleanEmail, "reset", cleanCode, otpDoc.codeHash)) ||
      (otpDoc.code && timingSafeEqualString(otpDoc.code, cleanCode));

    if (!isResetMatch) {
      if (otpDoc.attempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.failedOtpAttempts = 5;
        await user.save();
        await OtpVerification.deleteMany({ email: { $in: emailsToMatch }, type: "reset" });

        return res.status(429).json({
          error: "Maximum attempts exceeded (5/5). Please wait 15 minutes before trying again.",
          locked: true,
        });
      }

      await otpDoc.save();
      const remainingAttempts = 5 - otpDoc.attempts;
      return res.status(400).json({
        error: `Incorrect code. ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining.`,
        remainingAttempts,
      });
    }

    // Hash new password with cost 12
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.password = null;
    user.failedOtpAttempts = 0;
    user.lockedUntil = null;
    user.isVerified = true;
    user.lastLoginAt = new Date();
    await user.save();

    // Revoke OTP and all active refresh tokens for this account
    await OtpVerification.deleteMany({ email: { $in: emailsToMatch }, type: "reset" });
    await RefreshToken.deleteMany({ userId: user._id });

    const token = generateToken(user);
    const refreshToken = await issueRefreshToken(user._id, res);
    setJwtCookie(res, token, req);

    res.json({
      success: true,
      message: "Password reset successfully. You can now log in with your new password.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        plan: formatPlanName(user.plan),
      },
      token,
      refreshToken,
    });
  } catch (err) {
    console.error("Reset password error:", err.message);
    res.status(500).json({ error: "Failed to reset password." });
  }
});

// Test client hook for unit tests
let testGoogleOAuthClient = null;
export function setGoogleOAuthClientForTesting(client) {
  testGoogleOAuthClient = client;
}

function isAllowedRedirectUri(uri) {
  if (!uri || uri === "postmessage") return true;
  try {
    const parsed = new URL(uri);
    const origin = parsed.origin;
    return [
      "https://rockgpt-ten.vercel.app",
      "https://rockgpt.vercel.app",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ].includes(origin);
  } catch {
    return false;
  }
}

function getGoogleProjectPrefix(clientId) {
  if (!clientId || typeof clientId !== "string") return "";
  const idx = clientId.indexOf("-");
  return idx > 0 ? clientId.slice(0, idx + 1) : "";
}

function isAllowedGoogleAudience(audOrAzp, configuredClientId) {
  if (!audOrAzp || typeof audOrAzp !== "string") return false;
  if (configuredClientId && audOrAzp === configuredClientId) return true;
  const projectPrefix = getGoogleProjectPrefix(configuredClientId);
  if (projectPrefix && audOrAzp.startsWith(projectPrefix)) return true;
  return false;
}

async function verifyGoogleAccessToken(accessToken, configuredClientId) {
  const tokenInfoRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
  );
  const tokenInfo = await tokenInfoRes.json().catch(() => ({}));
  if (!tokenInfoRes.ok || tokenInfo.error) {
    throw new Error("Google session token expired or invalid. Please try again.");
  }

  const aud = tokenInfo.aud || tokenInfo.azp || "";
  if (configuredClientId && !isAllowedGoogleAudience(aud, configuredClientId)) {
    throw new Error("Google client project mismatch.");
  }

  const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const userInfo = await userInfoRes.json().catch(() => ({}));
  if (!userInfoRes.ok || !userInfo?.email) {
    throw new Error("Could not retrieve verified profile from Google.");
  }

  const emailVerified =
    userInfo.email_verified === true ||
    userInfo.email_verified === "true" ||
    tokenInfo.email_verified === true ||
    tokenInfo.email_verified === "true";

  if (!emailVerified) {
    throw new Error("Email not verified by Google.");
  }

  return {
    email: String(userInfo.email).toLowerCase().trim(),
    name: userInfo.name || String(userInfo.email).split("@")[0],
    googleId: userInfo.sub || tokenInfo.sub || "",
    picture: userInfo.picture || null,
  };
}

async function verifyGoogleTokenOrCode(tokenOrCode, redirectUri = "postmessage", accessTokenParam = null) {
  const googleClientId = (process.env.GOOGLE_CLIENT_ID || "").trim() || GOOGLE_CLIENT_ID;
  if (!googleClientId && !testGoogleOAuthClient) {
    throw new Error("GOOGLE_CLIENT_ID is not configured on the server.");
  }

  // 0a. Support verified Google OAuth access_token flow (no client_secret dependency across proxies)
  if (accessTokenParam && typeof accessTokenParam === "string" && !testGoogleOAuthClient) {
    return await verifyGoogleAccessToken(accessTokenParam.trim(), googleClientId);
  }

  if (!tokenOrCode || typeof tokenOrCode !== "string") return null;
  const cleanInput = tokenOrCode.trim();
  const safeRedirectUri = isAllowedRedirectUri(redirectUri) ? redirectUri : "postmessage";

  // 0. Support test mock client if injected
  if (testGoogleOAuthClient) {
    if (cleanInput.startsWith("4/") || !cleanInput.includes(".")) {
      let tokenRes;
      try {
        tokenRes = await testGoogleOAuthClient.getToken(cleanInput);
      } catch (e) {
        throw new Error("Invalid or expired authorization code.");
      }
      if (tokenRes?.tokens?.id_token) {
        const ticket = await testGoogleOAuthClient.verifyIdToken({
          idToken: tokenRes.tokens.id_token,
          audience: "test_client_id",
        });
        const p = ticket.getPayload();
        if (p?.email && p.email_verified !== false) {
          return { email: p.email.toLowerCase().trim(), name: p.name, googleId: p.sub, picture: p.picture };
        }
        throw new Error("Email not verified by Google");
      }
      throw new Error("Invalid or expired authorization code.");
    } else {
      const ticket = await testGoogleOAuthClient.verifyIdToken({
        idToken: cleanInput,
        audience: "test_client_id",
      });
      const p = ticket.getPayload();
      if (p?.email && p.email_verified !== false) {
        return { email: p.email.toLowerCase().trim(), name: p.name, googleId: p.sub, picture: p.picture };
      }
      throw new Error("Email not verified by Google");
    }
  }

  const cleanSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();

  // 1. Handle explicit ya29. OAuth access_token passed in tokenOrCode
  if (cleanInput.startsWith("ya29.")) {
    return await verifyGoogleAccessToken(cleanInput, googleClientId);
  }

  // 2. If authorization code (starts with 4/ or no dots):
  let resolvedIdToken = cleanInput;
  if (cleanInput.startsWith("4/") || !cleanInput.includes(".")) {
    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: cleanInput,
          client_id: googleClientId,
          client_secret: cleanSecret,
          redirect_uri: safeRedirectUri,
          grant_type: "authorization_code",
        }),
      });
      const tokenData = await tokenRes.json().catch(() => ({}));
      if (tokenData.id_token) {
        resolvedIdToken = tokenData.id_token;
      } else if (tokenData.access_token) {
        return await verifyGoogleAccessToken(tokenData.access_token, googleClientId);
      } else {
        const rawErr = tokenData.error_description || tokenData.error || "";
        const friendly =
          /unauthorized/i.test(rawErr) || tokenData.error === "unauthorized_client"
            ? "Google OAuth client configuration mismatch. Please try signing in again."
            : rawErr || "Invalid or expired Google authorization code.";
        throw new Error(friendly);
      }
    } catch (e) {
      throw new Error(e.message || "Google authorization code exchange failed.");
    }
  }

  // 3. SEC-06: Verify ID token cryptographically via Google OAuth2Client + project/client audience check
  const client = new OAuth2Client(googleClientId);
  const ticket = await client.verifyIdToken({
    idToken: resolvedIdToken,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new Error("Invalid Google token payload.");
  }
  const tokenAud = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
  if (!isAllowedGoogleAudience(tokenAud, googleClientId) && !isAllowedGoogleAudience(payload.azp, googleClientId)) {
    throw new Error("Google token audience mismatch.");
  }
  if (payload.email_verified === false) {
    throw new Error("Email not verified by Google");
  }

  return {
    email: payload.email.toLowerCase().trim(),
    name: payload.name || payload.email.split("@")[0],
    googleId: payload.sub,
    picture: payload.picture,
  };
}

// 6. Google OAuth Login
router.post("/google", authLimiter, async (req, res) => {
  try {
    const accessToken = typeof req.body.accessToken === "string" ? req.body.accessToken : null;
    const tokenOrCode = req.body.idToken || req.body.credential || req.body.token || req.body.code || accessToken;
    const redirectUri = req.body.redirectUri || "postmessage";
    if (!tokenOrCode) {
      return res.status(400).json({ error: "Google credentials are required." });
    }

    let googleUser;
    try {
      googleUser = await verifyGoogleTokenOrCode(tokenOrCode, redirectUri, accessToken);
    } catch (err) {
      return res.status(400).json({ error: err.message || "Invalid or unverified Google account." });
    }

    if (!googleUser || !googleUser.email) {
      return res.status(400).json({ error: "Google authentication failed. Please try again." });
    }

    const cleanEmail = googleUser.email;
    let user = await findUserByEmail(cleanEmail);

    if (!user) {
      try {
        user = await User.create({
          name: googleUser.name || cleanEmail.split("@")[0],
          email: cleanEmail,
          googleId: googleUser.googleId,
          isVerified: true,
          failedOtpAttempts: 0,
          lockedUntil: null,
          plan: "free",
          lastLoginAt: new Date(),
        });
      } catch (createErr) {
        if (createErr?.code === 11000) {
          user = await findUserByEmail(cleanEmail);
        } else {
          throw createErr;
        }
      }
    }
    if (user) {
      if (!user.googleId && googleUser.googleId) user.googleId = googleUser.googleId;
      user.isVerified = true;
      user.failedOtpAttempts = 0;
      user.lockedUntil = null;
      user.lastLoginAt = new Date();
      if (user.plan) user.plan = String(user.plan).toLowerCase();
      try {
        await user.save();
      } catch {
        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              ...(user.googleId ? { googleId: user.googleId } : {}),
              isVerified: true,
              failedOtpAttempts: 0,
              lockedUntil: null,
              lastLoginAt: new Date(),
            },
          }
        );
      }
    }

    // Enforce 2FA if enabled on account
    if (user.twoFactorEnabled || user.is2faEnabled) {
      const tempToken = jwt.sign(
        { id: user._id, email: user.email, is2faPending: true, scope: "2fa_temp" },
        JWT_SECRET,
        { algorithm: "HS256", expiresIn: "10m" }
      );
      return res.json({
        require2FA: true,
        tempToken,
        email: user.email,
      });
    }

    const token = generateToken(user);
    const refreshToken = await issueRefreshToken(user._id, res);
    setJwtCookie(res, token, req);

    res.json({
      success: true,
      message: "Welcome to RockGPT!",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        plan: formatPlanName(user.plan),
      },
      token,
      refreshToken,
    });
  } catch (err) {
    console.error("[Google Auth Error]:", err);
    res.status(500).json({ error: err.message || "Google authentication failed. Please try again." });
  }
});

// 7. Current User Me
router.get("/me", authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      plan: req.user.plan || "free",
    },
  });
});

// 8. Guest Session Initialization
// Configurable guest access duration (default: 150 seconds / 2 minutes 30 seconds)
const GUEST_ACCESS_DURATION_SEC = parseInt(process.env.GUEST_ACCESS_DURATION_SEC, 10) || 150;

// SEC-02: Dedicated 2FA verification endpoint
router.post("/verify-2fa", authLimiter, async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      return res.status(400).json({ error: "Temporary token and 2FA code are required." });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET, { algorithms: ["HS256"] });
    } catch {
      return res.status(401).json({ error: "Invalid or expired 2FA session. Please log in again." });
    }

    if (!decoded || (!decoded.is2faPending && decoded.scope !== "2fa_temp")) {
      return res.status(400).json({ error: "Invalid 2FA token." });
    }

    const user = await findUserByEmail(decoded.email);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const cleanCode = String(code).trim();
    let is2faValid = false;

    if (user.totpSecret && timingSafeEqualString(user.totpSecret, cleanCode)) {
      is2faValid = true;
    }

    if (!is2faValid) {
      const otpDoc = await findOtpDoc(user.email, null, "login");
      if (otpDoc && timingSafeEqualString(otpDoc.code, cleanCode)) {
        is2faValid = true;
        await OtpVerification.deleteOne({ _id: otpDoc._id });
      }
    }

    if (!is2faValid) {
      return res.status(400).json({ error: "Invalid two-factor authentication code." });
    }

    user.isVerified = true;
    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user);
    setJwtCookie(res, token, req);
    res.json({
      success: true,
      message: "Two-factor authentication verified.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        plan: formatPlanName(user.plan),
      },
      token,
    });
  } catch (err) {
    console.error("2FA verification error:", err.message);
    res.status(500).json({ error: "Two-factor authentication failed." });
  }
});


// ═══ REFRESH TOKEN ROTATION (POST /api/auth/refresh) ═══
// Mutex to deduplicate concurrent refresh requests for the same token
const activeRefreshPromises = new Map();

router.post("/refresh", authLimiter, async (req, res) => {
  try {
    const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!rawToken || typeof rawToken !== "string") {
      return res.status(401).json({ error: "Refresh token is missing." });
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken.trim()).digest("hex");

    // If an identical refresh request is already running, wait for its result (deduplicate)
    if (activeRefreshPromises.has(tokenHash)) {
      const deduplicated = await activeRefreshPromises.get(tokenHash);
      return res.status(deduplicated.status).json(deduplicated.body);
    }

    const refreshPromise = (async () => {
      const existingDoc = await RefreshToken.findOne({ tokenHash });
      if (!existingDoc || new Date(existingDoc.expiresAt).getTime() < Date.now()) {
        if (existingDoc) await RefreshToken.deleteOne({ _id: existingDoc._id });
        res.clearCookie("refreshToken", { path: "/api/auth" });
        return { status: 401, body: { error: "Refresh token is invalid or expired. Please sign in again." } };
      }

      const user = await User.findById(existingDoc.userId);
      if (!user) {
        await RefreshToken.deleteOne({ _id: existingDoc._id });
        res.clearCookie("refreshToken", { path: "/api/auth" });
        return { status: 401, body: { error: "User account no longer exists." } };
      }

      // Rotate: invalidate current refresh token and generate new one
      await RefreshToken.deleteOne({ _id: existingDoc._id });
      const newRefreshToken = await issueRefreshToken(user._id, res);
      const newAccessToken = generateToken(user);

      return {
        status: 200,
        body: {
          success: true,
          token: newAccessToken,
          refreshToken: newRefreshToken,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            plan: formatPlanName(user.plan),
          },
        },
      };
    })();

    activeRefreshPromises.set(tokenHash, refreshPromise);
    setTimeout(() => activeRefreshPromises.delete(tokenHash), 5000);

    const result = await refreshPromise;
    if (result.status === 200 && result.body?.token) {
      setJwtCookie(res, result.body.token, req);
    }
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("Refresh token error:", err.message);
    res.status(500).json({ error: "Token refresh failed." });
  }
});

// ═══ SESSION LOGOUT & REVOCATION (POST /api/auth/logout) ═══
router.post("/logout", async (req, res) => {
  try {
    const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (rawToken && typeof rawToken === "string") {
      const tokenHash = crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
      await RefreshToken.deleteMany({ tokenHash });
    }
    if (req.user?._id) {
      await RefreshToken.deleteMany({ userId: req.user._id });
    }
    clearJwtCookie(res, req);
    res.clearCookie("refreshToken", { path: "/api/auth" });
    return res.json({ success: true, message: "Logged out successfully." });
  } catch (err) {
    clearJwtCookie(res, req);
    res.clearCookie("refreshToken", { path: "/api/auth" });
    return res.json({ success: true, message: "Logged out." });
  }
});

router.post("/guest-session", (req, res) => {
  try {
    const startedAt = Date.now();
    const guestToken = jwt.sign(
      {
        isGuest: true,
        startedAt,
      },
      JWT_SECRET,
      { expiresIn: `${GUEST_ACCESS_DURATION_SEC}s` }
    );

    res.json({
      success: true,
      guestToken,
      expiresInSeconds: GUEST_ACCESS_DURATION_SEC,
      startedAt,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to initialize guest session." });
  }
});

export default router;
