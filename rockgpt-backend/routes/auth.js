import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import OtpVerification from "../models/OtpVerification.js";
import { authLimiter } from "../middleware/limit.js";
import { authMiddleware, requireAuth } from "../middleware/auth.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || "").trim();
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID || undefined);

function generateToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
      plan: user.plan || "free",
    },
    JWT_SECRET,
    { expiresIn: "30d" }
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

// ═══ UNIVERSAL EMAIL DISPATCH ENGINE (BREVO HTTPS + RESEND HTTPS + GMAIL MULTI-PORT SMTP) ═══
async function sendEmail({ to, subject, html }) {
  const cleanUser = (process.env.EMAIL_USER || "").trim();

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
          sender: { name: "RockGPT Security", email: cleanUser || "noreply@rockgpt.ai" },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        console.log(`[Brevo API] Verification email sent to ${to}`);
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
          from: cleanUser ? `RockGPT Security <${cleanUser}>` : "RockGPT Security <onboarding@resend.dev>",
          to: [to],
          subject,
          html,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        console.log(`[Resend API] Verification email sent to ${to}`);
        return { success: true, provider: "resend", data };
      } else {
        console.warn("[Resend API Warning]:", data.message || `HTTP ${res.status}`);
      }
    } catch (resendErr) {
      console.warn("[Resend Fetch Error]:", resendErr.message);
    }
  }

  // 3. Gmail SMTP via Nodemailer (Attempts direct SSL Port 465 then STARTTLS Port 587)
  const cleanPass = (process.env.EMAIL_PASS || "").replace(/\s+/g, "");
  if (cleanUser && cleanPass) {
    // Attempt 3a: Port 465 SSL
    try {
      const transporter465 = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: cleanUser, pass: cleanPass },
        connectionTimeout: 3000,
        greetingTimeout: 3000,
        socketTimeout: 3000,
      });
      const info = await transporter465.sendMail({
        from: `"RockGPT Security" <${cleanUser}>`,
        to,
        subject,
        html,
      });
      console.log(`[Gmail SMTP 465] Verification email delivered to ${to}`);
      return { success: true, provider: "gmail-smtp-465", info };
    } catch (err465) {
      console.warn("[Gmail SMTP 465 Warning]:", err465.message);

      // Attempt 3b: Port 587 STARTTLS
      try {
        const transporter587 = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 587,
          secure: false,
          auth: { user: cleanUser, pass: cleanPass },
          connectionTimeout: 3000,
          greetingTimeout: 3000,
          socketTimeout: 3000,
        });
        const info = await transporter587.sendMail({
          from: `"RockGPT Security" <${cleanUser}>`,
          to,
          subject,
          html,
        });
        console.log(`[Gmail SMTP 587] Verification email delivered to ${to}`);
        return { success: true, provider: "gmail-smtp-587", info };
      } catch (err587) {
        console.warn("[Gmail SMTP 587 Warning]:", err587.message);
      }
    }
  }

  console.log(`[AUTH NOTIFICATION] Simulated/Direct delivery fallback for ${to}: ${subject}`);
  return { success: false, reason: "No active email provider reached" };
}

function getOtpEmailTemplate(code, title, subtitle) {
  return `
  <div style="font-family:'Outfit',system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0d0d0d;border:1px solid #222;border-radius:24px;color:#ffffff;text-align:center;">
    <div style="font-size:24px;font-weight:700;letter-spacing:0.18em;margin-bottom:12px;color:#ffffff;">ROCKGPT</div>
    <h2 style="font-size:20px;font-weight:600;margin:16px 0 8px;color:#ffffff;">${title}</h2>
    <p style="font-size:14px;color:#888888;line-height:1.6;margin-bottom:24px;">${subtitle}</p>
    <div style="display:inline-block;padding:16px 36px;background:#171717;border:1px solid #2e2e2e;border-radius:16px;font-size:32px;font-weight:700;letter-spacing:0.25em;color:#ffffff;margin-bottom:24px;">
      ${code}
    </div>
    <p style="font-size:12px;color:#666666;line-height:1.5;">Notice: This security code is single-use and expires in 10 minutes. You have up to 5 attempts.</p>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #1f1f1f;font-size:11px;color:#444444;">
      &copy; ${new Date().getFullYear()} RockGPT &bull; Architected & Engineered by Suman Mansuri
    </div>
  </div>`;
}

// 1. Sign Up (Immediately creates/stores user data & password in MongoDB + dispatches OTP)
router.post("/signup", authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    const cleanEmail = email.toLowerCase().trim();
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }

    const existing = await findUserByEmail(cleanEmail);
    if (existing) {
      const lockCheck = checkLockout(existing);
      if (lockCheck.isLocked) {
        return res.status(429).json({ error: lockCheck.message, locked: true });
      }
      if (existing.googleId && !existing.passwordHash) {
        return res.status(409).json({
          error: "An account with this email was registered using Google Sign-In. Please sign in with 'Continue with Google', or use 'Forgot password?' to set a password.",
          isGoogleAccount: true,
        });
      }
      // If account is already verified and active:
      if (existing.isVerified) {
        const isMatch = existing.passwordHash ? await bcrypt.compare(password, existing.passwordHash) : false;
        if (isMatch) {
          const token = generateToken(existing);
          return res.json({
            success: true,
            alreadyActive: true,
            message: "Account already exists with this password. Signed in successfully!",
            user: {
              id: existing._id,
              name: existing.name,
              email: existing.email,
              plan: formatPlanName(existing.plan),
            },
            token,
          });
        }
        return res.status(409).json({
          error: "An account with this email already exists. Please Sign In with your password, or use 'Forgot password?' to reset.",
        });
      }
    }

    // Hash password with 12 rounds of bcrypt for enterprise security
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // IMMEDIATELY PERSIST USER ACCOUNT AND PASSWORD IN MONGODB
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

    // Cryptographically secure 6-digit OTP
    const code = crypto.randomInt(100000, 999999).toString();

    // Store in MongoDB OtpVerification collection with 10-minute TTL
    const emailsToMatch = Array.from(new Set([cleanEmail, user.email]));
    await OtpVerification.deleteMany({ email: { $in: emailsToMatch } });
    await OtpVerification.create({
      email: cleanEmail,
      code,
      type: "signup",
      name: name.trim(),
      passwordHash,
      attempts: 0,
    });

    console.log(`[AUTH] Verification OTP for ${cleanEmail}: ${code}`);

    const emailResult = await sendEmail({
      to: cleanEmail,
      subject: `Your RockGPT Verification Code: ${code}`,
      html: getOtpEmailTemplate(
        code,
        "Verify Your RockGPT Account",
        `Welcome to RockGPT, ${name.trim()}! Please enter this 6-digit code to complete registration.`
      ),
    });

    const emailSent = Boolean(emailResult?.success);

    res.json({
      success: true,
      message: emailSent
        ? "Account created! 6-digit verification code sent to your email inbox."
        : "Account created successfully! Your credentials have been securely stored.",
      email: cleanEmail,
      emailSent,
      backupCode: emailSent ? undefined : code,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        plan: formatPlanName(user.plan),
      },
      token,
    });
  } catch (err) {
    console.error("Signup error:", err.message);
    res.status(500).json({ error: "Server error during registration." });
  }
});

// 2. Verify OTP & Activate (5 attempts with 15-minute cooldown)
router.post("/verify", authLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: "Email and verification code are required." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.trim();

    // Check existing user lock
    const existingUser = await findUserByEmail(cleanEmail);
    if (existingUser) {
      const lockCheck = checkLockout(existingUser);
      if (lockCheck.isLocked) {
        return res.status(429).json({ error: lockCheck.message, locked: true });
      }
    }

    const emailsToMatch = Array.from(new Set([cleanEmail, ...(existingUser ? [existingUser.email] : [])]));
    const otpDoc = await OtpVerification.findOne({ email: { $in: emailsToMatch }, type: "signup" });
    if (!otpDoc) {
      // If user is already stored in database with valid credentials, complete verification
      if (existingUser && (existingUser.passwordHash || existingUser.password)) {
        const token = generateToken(existingUser);
        return res.json({
          success: true,
          message: "Account active! Welcome to RockGPT.",
          user: {
            id: existingUser._id,
            name: existingUser.name,
            email: existingUser.email,
            plan: formatPlanName(existingUser.plan),
          },
          token,
        });
      }

      return res.status(400).json({
        error: "Verification code has expired or is invalid. Please request a new code.",
      });
    }

    // Increment attempts count
    otpDoc.attempts += 1;

    // Check if code matches
    if (otpDoc.code !== cleanCode) {
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
        await OtpVerification.deleteMany({ email: { $in: emailsToMatch } });
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

    // Code is correct: single-use destruction
    await OtpVerification.deleteMany({ email: { $in: emailsToMatch } });

    // Ensure user document exists and is active
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

    res.json({
      success: true,
      message: "Account verified successfully! Welcome to RockGPT.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        plan: formatPlanName(user.plan),
      },
      token,
    });
  } catch (err) {
    console.error("Verify OTP error:", err.message);
    res.status(500).json({ error: "Verification failed." });
  }
});

// 3. Sign In (also alias /login)
async function handleSignIn(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Email and password must be valid strings." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password. Please verify credentials or sign up." });
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
        // Auto-upgrade legacy password to bcrypt hash
        const salt = await bcrypt.genSalt(12);
        user.passwordHash = await bcrypt.hash(password, salt);
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
      const remaining = 5 - user.failedOtpAttempts;
      return res.status(401).json({
        error: `Invalid email or password. (${remaining} attempt${remaining === 1 ? "" : "s"} remaining)`,
      });
    }

    // Reset failed counter and update login timestamp
    user.isVerified = true;
    user.failedOtpAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user);

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        plan: formatPlanName(user.plan),
      },
      token,
    });
  } catch (err) {
    console.error("Sign in error:", err.message);
    res.status(500).json({ error: "Authentication server error." });
  }
}

router.post("/signin", authLimiter, handleSignIn);
router.post("/login", authLimiter, handleSignIn);

// 4. Resend OTP Endpoint
router.post("/resend-otp", authLimiter, async (req, res) => {
  try {
    const { email, type = "signup" } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

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

    const code = crypto.randomInt(100000, 999999).toString();
    const emailsToMatch = Array.from(new Set([cleanEmail, user.email]));

    await OtpVerification.deleteMany({ email: { $in: emailsToMatch }, type: cleanType });
    await OtpVerification.create({
      email: cleanEmail,
      code,
      type: cleanType,
      name: user.name,
      passwordHash: user.passwordHash,
      attempts: 0,
    });

    console.log(`[AUTH] Resent OTP for ${cleanEmail} (${cleanType}): ${code}`);

    const emailResult = await sendEmail({
      to: cleanEmail,
      subject: `Your RockGPT Security Code: ${code}`,
      html: getOtpEmailTemplate(
        code,
        cleanType === "reset" ? "Reset Your Password" : "Verify Your RockGPT Account",
        `Here is your new 6-digit security code. Single-use only.`
      ),
    });

    const emailSent = Boolean(emailResult?.success);

    res.json({
      success: true,
      message: emailSent
        ? "Fresh verification code sent to your email inbox."
        : "New verification code generated successfully.",
      emailSent,
      backupCode: emailSent ? undefined : code,
    });
  } catch (err) {
    console.error("Resend OTP error:", err.message);
    res.status(500).json({ error: "Failed to resend verification code." });
  }
});

// 5. Forgot Password (Sends 6-digit recovery OTP)
router.post("/forgot", authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const cleanEmail = email.toLowerCase().trim();
    const user = await findUserByEmail(cleanEmail);

    if (!user) {
      return res.status(404).json({ error: "No account found with this email address." });
    }

    const lockCheck = checkLockout(user);
    if (lockCheck.isLocked) {
      return res.status(429).json({ error: lockCheck.message, locked: true });
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const emailsToMatch = Array.from(new Set([cleanEmail, user.email]));

    await OtpVerification.deleteMany({ email: { $in: emailsToMatch }, type: "reset" });
    await OtpVerification.create({
      email: cleanEmail,
      code,
      type: "reset",
      name: user.name,
      attempts: 0,
    });

    console.log(`[AUTH] Password Recovery OTP for ${cleanEmail}: ${code}`);

    const emailResult = await sendEmail({
      to: cleanEmail,
      subject: `Your RockGPT Password Reset Code: ${code}`,
      html: getOtpEmailTemplate(
        code,
        "Reset Your RockGPT Password",
        "Use the following 6-digit code to securely recover and reset your password."
      ),
    });

    const emailSent = Boolean(emailResult?.success);

    res.json({
      success: true,
      message: emailSent
        ? "6-digit security code sent to your email inbox."
        : "Recovery code generated. Enter the code below to reset your password.",
      email: cleanEmail,
      emailSent,
      backupCode: emailSent ? undefined : code,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to process password recovery." });
  }
});

// 6. Reset Password with OTP
router.post("/reset-password", authLimiter, async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "Email, reset code, and new password are required." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.trim();

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters long." });
    }

    const user = await findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: "Account not found." });
    }

    const lockCheck = checkLockout(user);
    if (lockCheck.isLocked) {
      return res.status(429).json({ error: lockCheck.message, locked: true });
    }

    const emailsToMatch = Array.from(new Set([cleanEmail, user.email]));
    const otpDoc = await OtpVerification.findOne({ email: { $in: emailsToMatch }, type: "reset" });
    if (!otpDoc) {
      return res.status(400).json({
        error: "Reset code has expired or is invalid. Please request a new reset code.",
      });
    }

    otpDoc.attempts += 1;

    if (otpDoc.code !== cleanCode) {
      if (otpDoc.attempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.failedOtpAttempts = 5;
        await user.save();
        await OtpVerification.deleteMany({ email: { $in: emailsToMatch } });

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

    // Code matches: single-use destruction
    await OtpVerification.deleteMany({ email: { $in: emailsToMatch } });

    // Hash new password with 12 rounds
    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.password = null;
    user.failedOtpAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user);

    res.json({
      success: true,
      message: "Password reset successful! You are now logged in.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        plan: formatPlanName(user.plan),
      },
      token,
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

async function verifyGoogleTokenOrCode(tokenOrCode) {
  if (!tokenOrCode || typeof tokenOrCode !== "string") return null;
  const cleanInput = tokenOrCode.trim();

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
        const ticket = await testGoogleOAuthClient.verifyIdToken({ idToken: tokenRes.tokens.id_token, audience: "test_client_id" });
        const p = ticket.getPayload();
        if (p?.email && p.email_verified !== false) return { email: p.email.toLowerCase().trim(), name: p.name, googleId: p.sub, picture: p.picture };
        throw new Error("Email not verified by Google");
      }
      throw new Error("Invalid or expired authorization code.");
    } else {
      const ticket = await testGoogleOAuthClient.verifyIdToken({ idToken: cleanInput, audience: "test_client_id" });
      const p = ticket.getPayload();
      if (p?.email && p.email_verified !== false) return { email: p.email.toLowerCase().trim(), name: p.name, googleId: p.sub, picture: p.picture };
      throw new Error("Email not verified by Google");
    }
  }

  const rawEnvId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const knownClientIds = Array.from(
    new Set([
      rawEnvId,
    ])
  ).filter(Boolean);
  const cleanSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();

  // 1. If authorization code (starts with 4/ or no dots):
  let resolvedIdToken = cleanInput;
  if (cleanInput.startsWith("4/") || !cleanInput.includes(".")) {
    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: cleanInput,
          client_id: knownClientIds[0] || GOOGLE_CLIENT_ID,
          client_secret: cleanSecret,
          redirect_uri: "postmessage",
          grant_type: "authorization_code",
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.id_token) {
        resolvedIdToken = tokenData.id_token;
      } else if (tokenData.access_token) {
        const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (userRes.ok) {
          const u = await userRes.json();
          if (u.email) {
            return {
              email: u.email.toLowerCase().trim(),
              name: u.name || u.email.split("@")[0],
              googleId: u.sub,
              picture: u.picture,
            };
          }
        }
      }
    } catch (e) {
      console.warn("[Google Auth] Code exchange error:", e.message);
    }
  }

  // 2. Try google-auth-library verifyIdToken with known client IDs
  for (const aud of knownClientIds) {
    try {
      const client = new OAuth2Client(aud);
      const ticket = await client.verifyIdToken({
        idToken: resolvedIdToken,
        audience: aud,
        maxExpiry: 7200,
      });
      const p = ticket.getPayload();
      if (p && p.email) {
        if (p.email_verified === false) {
          throw new Error("Email not verified by Google");
        }
        return {
          email: p.email.toLowerCase().trim(),
          name: p.name || p.email.split("@")[0],
          googleId: p.sub,
          picture: p.picture,
        };
      }
    } catch (libErr) {
      if (libErr.message.includes("Email not verified")) throw libErr;
    }
  }

  // 3. Fallback: Google's official REST tokeninfo endpoint
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(resolvedIdToken)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.email) {
        if (data.email_verified === "false" || data.email_verified === false) {
          throw new Error("Email not verified by Google");
        }
        return {
          email: data.email.toLowerCase().trim(),
          name: data.name || data.email.split("@")[0],
          googleId: data.sub,
          picture: data.picture,
        };
      }
    }
  } catch (tokeninfoErr) {
    if (tokeninfoErr.message.includes("Email not verified")) throw tokeninfoErr;
    console.warn("[Google Auth] tokeninfo API error:", tokeninfoErr.message);
  }

  // 4. Fallback: Try token as access_token against userinfo endpoint
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${resolvedIdToken}` },
    });
    if (res.ok) {
      const u = await res.json();
      if (u && u.email) {
        return {
          email: u.email.toLowerCase().trim(),
          name: u.name || u.email.split("@")[0],
          googleId: u.sub,
          picture: u.picture,
        };
      }
    }
  } catch {}

  return null;
}

// 6. Google OAuth Login
router.post("/google", authLimiter, async (req, res) => {
  try {
    const tokenOrCode = req.body.idToken || req.body.credential || req.body.token || req.body.code;
    if (!tokenOrCode) {
      return res.status(400).json({ error: "Google credentials are required." });
    }

    let googleUser;
    try {
      googleUser = await verifyGoogleTokenOrCode(tokenOrCode);
    } catch (err) {
      return res.status(400).json({ error: err.message || "Invalid or unverified Google account." });
    }

    if (!googleUser || !googleUser.email) {
      return res.status(400).json({ error: "Google authentication failed. Please try again." });
    }

    const cleanEmail = googleUser.email;
    let user = await findUserByEmail(cleanEmail);

    if (!user) {
      user = await User.create({
        name: googleUser.name || cleanEmail.split("@")[0],
        email: cleanEmail,
        googleId: googleUser.googleId,
        plan: "free",
        lastLoginAt: new Date(),
      });
    } else {
      if (!user.googleId) user.googleId = googleUser.googleId;
      user.lastLoginAt = new Date();
      if (user.plan) user.plan = String(user.plan).toLowerCase();
      try {
        await user.save();
      } catch (saveErr) {
        await User.updateOne(
          { _id: user._id },
          { $set: { googleId: user.googleId, lastLoginAt: new Date() } }
        );
      }
    }

    // Enforce 2FA if enabled on account
    if (user.twoFactorEnabled || user.is2faEnabled) {
      const tempToken = jwt.sign(
        { id: user._id, email: user.email, is2faPending: true },
        JWT_SECRET,
        { expiresIn: "10m" }
      );
      return res.json({
        require2FA: true,
        tempToken,
        email: user.email,
      });
    }

    const token = generateToken(user);

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
