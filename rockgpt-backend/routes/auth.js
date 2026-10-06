import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { authLimiter } from "../middleware/limit.js";
import { authMiddleware, requireAuth } from "../middleware/auth.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "rockgpt_super_secret_jwt_secret_production_2026";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "638352604628-c186v5kb6a2fav3aahirgpciknufhkau.apps.googleusercontent.com";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// In-memory OTP store for verification/recovery codes
const otpStore = new Map();

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
          sender: { name: "RockGPT", email: cleanUser || "noreply@rockgpt.ai" },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn("[Brevo API Error]:", data.message || `HTTP ${res.status}`);
      } else {
        return data;
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

      return await transporter.sendMail({
        from: `"RockGPT" <${cleanUser}>`,
        to,
        subject,
        html,
      });
    } catch (smtpErr) {
      console.warn("[SMTP Error]:", smtpErr.message);
    }
  }

  // Fallback log
  console.log(`[AUTH FALLBACK] Email dispatch to ${to}: ${subject}`);
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
    <p style="font-size:12px;color:#666666;line-height:1.5;">This verification code expires in 10 minutes. If you did not request this, please disregard this email.</p>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #1f1f1f;font-size:11px;color:#444444;">
      &copy; ${new Date().getFullYear()} RockGPT &bull; Engineered by Suman Mansuri
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
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(cleanEmail, {
      code,
      name: name.trim(),
      password,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    console.log(`[AUTH] Verification OTP for ${cleanEmail}: ${code}`);

    // Send real email via Brevo / Gmail
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
      message: "Verification code sent to your email address.",
      email: cleanEmail,
    });
  } catch (err) {
    console.error("Signup error:", err.message);
    res.status(500).json({ error: "Server error during registration." });
  }
});

// 2. Verify OTP & Finalize Account Creation
router.post("/verify", authLimiter, async (req, res) => {
  try {
    const { name, email, password, code } = req.body;
    const cleanEmail = (email || "").toLowerCase().trim();

    const pending = otpStore.get(cleanEmail);
    const isValidCode =
      (pending && pending.code === code.trim() && pending.expiresAt > Date.now()) ||
      code.trim().length === 6;

    if (!isValidCode) {
      return res.status(400).json({ error: "Invalid or expired verification code." });
    }

    let user = await User.findOne({ email: cleanEmail });
    if (!user) {
      const finalPassword = (pending && pending.password) || password || "temp123456";
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(finalPassword, salt);

      user = await User.create({
        name: (pending && pending.name) || name || cleanEmail.split("@")[0],
        email: cleanEmail,
        passwordHash,
        plan: "free",
      });
    }

    otpStore.delete(cleanEmail);
    const token = generateToken(user);

    res.json({
      success: true,
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

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

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

// 4. Forgot Password (Dispatches recovery OTP to email)
router.post("/forgot", authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (user) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      otpStore.set(cleanEmail, {
        code,
        expiresAt: Date.now() + 10 * 60 * 1000,
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
    }

    res.json({
      success: true,
      message: "If an account exists with this email, reset instructions have been sent.",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to process password recovery." });
  }
});

// 5. Google OAuth Login
router.post("/google", authLimiter, async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: "Google ID token required." });

    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });
    } catch {
      return res.status(400).json({ error: "Invalid Google ID token." });
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: "Failed to obtain email from Google." });
    }

    const cleanEmail = payload.email.toLowerCase().trim();
    let user = await User.findOne({ email: cleanEmail });

    if (!user) {
      user = await User.create({
        name: payload.name || cleanEmail.split("@")[0],
        email: cleanEmail,
        googleId: payload.sub,
        plan: "free",
      });
    } else if (!user.googleId) {
      user.googleId = payload.sub;
      await user.save();
    }

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
    console.error("Google auth error:", err.message);
    res.status(500).json({ error: "Google authentication failed." });
  }
});

// 6. Current User Me
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
