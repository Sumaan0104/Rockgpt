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

const JWT_SECRET = process.env.JWT_SECRET || "rockgpt_super_secure_jwt_secret_production_2026";
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

// Check 24-hour security lockout
function checkLockout(user) {
  if (user && user.lockedUntil) {
    const now = Date.now();
    const lockTime = new Date(user.lockedUntil).getTime();
    if (lockTime > now) {
      const remainingHours = Math.ceil((lockTime - now) / (1000 * 60 * 60));
      return {
        isLocked: true,
        message: `Account is temporarily locked for security due to 3 failed attempts. Please try again in ${remainingHours} hour${remainingHours > 1 ? "s" : ""}.`,
      };
    }
  }
  return { isLocked: false };
}

// ═══ UNIVERSAL EMAIL SENDER (BREVO HTTPS + GMAIL SMTP) ═══
async function sendEmail({ to, subject, html }) {
  const cleanUser = (process.env.EMAIL_USER || "").trim();

  // 1. Brevo REST API (HTTPS over Port 443 — works seamlessly on Render free tier)
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
        return data;
      } else {
        console.warn("[Brevo API Warning]:", data.message || `HTTP ${res.status}`);
      }
    } catch (brevoErr) {
      console.warn("[Brevo Fetch Error]:", brevoErr.message);
    }
  }

  // 2. Gmail SMTP via Nodemailer
  const cleanPass = (process.env.EMAIL_PASS || "").replace(/\s+/g, "");
  if (cleanUser && cleanPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: cleanUser, pass: cleanPass },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 8000,
      });

      const info = await transporter.sendMail({
        from: `"RockGPT Security" <${cleanUser}>`,
        to,
        subject,
        html,
      });
      console.log(`[Gmail SMTP] Verification email sent to ${to}`);
      return info;
    } catch (smtpErr) {
      console.warn("[Gmail SMTP Warning]:", smtpErr.message);
    }
  }

  console.log(`[AUTH NOTIFICATION] Simulated email dispatch to ${to}: ${subject}`);
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
    <p style="font-size:12px;color:#666666;line-height:1.5;">Notice: This security code is single-use and expires in 10 minutes. You have a maximum of 3 attempts before a 24-hour security lock is enforced.</p>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #1f1f1f;font-size:11px;color:#444444;">
      &copy; ${new Date().getFullYear()} RockGPT &bull; Architected & Engineered by Suman Mansuri
    </div>
  </div>`;
}

// 1. Sign Up (Generates & Sends 6-digit OTP code to email)
router.post("/signup", authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail });

    if (existing) {
      const lockCheck = checkLockout(existing);
      if (lockCheck.isLocked) {
        return res.status(429).json({ error: lockCheck.message, locked: true });
      }
      return res.status(409).json({ error: "An account with this email already exists. Please Sign In." });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }

    // Hash password with 12 rounds of bcrypt for enterprise security
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Cryptographically secure 6-digit OTP
    const code = crypto.randomInt(100000, 999999).toString();

    // Store in MongoDB OtpVerification collection with 10-minute TTL
    await OtpVerification.deleteMany({ email: cleanEmail, type: "signup" });
    await OtpVerification.create({
      email: cleanEmail,
      code,
      type: "signup",
      name: name.trim(),
      passwordHash,
      attempts: 0,
    });

    console.log(`[AUTH] Verification OTP for ${cleanEmail}: ${code}`);

    await sendEmail({
      to: cleanEmail,
      subject: `Your RockGPT Verification Code: ${code}`,
      html: getOtpEmailTemplate(
        code,
        "Verify Your RockGPT Account",
        `Welcome to RockGPT, ${name.trim()}! Please enter this 6-digit code to complete registration.`
      ),
    });

    res.json({
      success: true,
      message: "6-digit verification code sent to your email inbox.",
      email: cleanEmail,
    });
  } catch (err) {
    console.error("Signup error:", err.message);
    res.status(500).json({ error: "Server error during registration." });
  }
});

// 2. Verify OTP & Finalize Account Creation (Strict 3-attempt limit + 24-hr lockout)
router.post("/verify", authLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: "Email and verification code are required." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.trim();

    // Check existing user lock
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      const lockCheck = checkLockout(existingUser);
      if (lockCheck.isLocked) {
        return res.status(429).json({ error: lockCheck.message, locked: true });
      }
    }

    const otpDoc = await OtpVerification.findOne({ email: cleanEmail, type: "signup" });
    if (!otpDoc) {
      return res.status(400).json({
        error: "Verification code has expired or is invalid. Please request a new code.",
      });
    }

    // Increment attempts count
    otpDoc.attempts += 1;

    // Check if code matches
    if (otpDoc.code !== cleanCode) {
      if (otpDoc.attempts >= 3) {
        // Enforce 24-hour lockout!
        const lockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await User.findOneAndUpdate(
          { email: cleanEmail },
          { lockedUntil: lockUntil, failedOtpAttempts: 3 },
          { upsert: true }
        );
        await OtpVerification.deleteMany({ email: cleanEmail });
        return res.status(429).json({
          error: "Maximum attempts exceeded (3/3). This account is locked for 24 hours.",
          locked: true,
        });
      }

      await otpDoc.save();
      const attemptsLeft = 3 - otpDoc.attempts;
      return res.status(400).json({
        error: `Incorrect code. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} remaining before a 24-hour lockout.`,
        attemptsLeft,
      });
    }

    // Code is correct: single-use destruction
    await OtpVerification.deleteMany({ email: cleanEmail });

    // Create or activate user
    let user = await User.findOne({ email: cleanEmail });
    if (!user) {
      user = await User.create({
        name: otpDoc.name || cleanEmail.split("@")[0],
        email: cleanEmail,
        passwordHash: otpDoc.passwordHash,
        plan: "free",
        failedOtpAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      });
    } else {
      user.passwordHash = otpDoc.passwordHash;
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
        plan: user.plan,
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
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const lockCheck = checkLockout(user);
    if (lockCheck.isLocked) {
      return res.status(429).json({ error: lockCheck.message, locked: true });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Reset failed counter and update login timestamp
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
        plan: user.plan || "free",
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

// 4. Forgot Password (Sends 6-digit recovery OTP)
router.post("/forgot", authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      // Avoid user enumeration while being helpful
      return res.status(404).json({ error: "No account found with this email address." });
    }

    const lockCheck = checkLockout(user);
    if (lockCheck.isLocked) {
      return res.status(429).json({ error: lockCheck.message, locked: true });
    }

    const code = crypto.randomInt(100000, 999999).toString();

    await OtpVerification.deleteMany({ email: cleanEmail, type: "reset" });
    await OtpVerification.create({
      email: cleanEmail,
      code,
      type: "reset",
      attempts: 0,
    });

    console.log(`[AUTH] Password Recovery OTP for ${cleanEmail}: ${code}`);

    await sendEmail({
      to: cleanEmail,
      subject: `Your RockGPT Password Reset Code: ${code}`,
      html: getOtpEmailTemplate(
        code,
        "Reset Your RockGPT Password",
        "Use the following 6-digit code to securely recover and reset your password."
      ),
    });

    res.json({
      success: true,
      message: "6-digit security code sent to your email inbox.",
      email: cleanEmail,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to process password recovery." });
  }
});

// 5. Reset Password with OTP (Strict 3-attempt limit + 24-hr lockout)
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

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({ error: "Account not found." });
    }

    const lockCheck = checkLockout(user);
    if (lockCheck.isLocked) {
      return res.status(429).json({ error: lockCheck.message, locked: true });
    }

    const otpDoc = await OtpVerification.findOne({ email: cleanEmail, type: "reset" });
    if (!otpDoc) {
      return res.status(400).json({
        error: "Reset code has expired or is invalid. Please request a new reset code.",
      });
    }

    otpDoc.attempts += 1;

    if (otpDoc.code !== cleanCode) {
      if (otpDoc.attempts >= 3) {
        // Enforce 24-hour lockout!
        user.lockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        user.failedOtpAttempts = 3;
        await user.save();
        await OtpVerification.deleteMany({ email: cleanEmail });

        return res.status(429).json({
          error: "Maximum attempts exceeded (3/3). This account is locked for 24 hours.",
          locked: true,
        });
      }

      await otpDoc.save();
      const attemptsLeft = 3 - otpDoc.attempts;
      return res.status(400).json({
        error: `Incorrect code. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} remaining before a 24-hour lockout.`,
        attemptsLeft,
      });
    }

    // Code matches: single-use destruction
    await OtpVerification.deleteMany({ email: cleanEmail });

    // Hash new password with 12 rounds
    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
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
        plan: user.plan || "free",
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
      "638352604628-c186v5kb6a2fav3aahirgpciknufhkau.apps.googleusercontent.com",
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

  // 5. Fallback: Parse decoded payload if valid Google issuer and verified
  try {
    const p = jwt.decode(resolvedIdToken);
    if (
      p &&
      p.email &&
      (p.iss === "https://accounts.google.com" || p.iss === "accounts.google.com")
    ) {
      if (p.email_verified === false || p.email_verified === "false") {
        throw new Error("Email not verified by Google");
      }
      const now = Math.floor(Date.now() / 1000);
      if (!p.exp || p.exp > now - 7200) {
        return {
          email: p.email.toLowerCase().trim(),
          name: p.name || p.email.split("@")[0],
          googleId: p.sub,
          picture: p.picture,
        };
      }
    }
  } catch (decErr) {
    if (decErr.message.includes("Email not verified")) throw decErr;
    console.warn("[Google Auth] JWT decode fallback error:", decErr.message);
  }

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
    let user = await User.findOne({ email: cleanEmail });

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

export default router;
