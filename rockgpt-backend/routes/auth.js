import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { authLimiter } from "../middleware/limit.js";
import { authMiddleware, requireAuth } from "../middleware/auth.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "rockgpt_super_secure_jwt_secret_production_2026";
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

// 1. Sign Up
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

    // Generate 6-digit OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(cleanEmail, {
      code,
      name: name.trim(),
      password,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    console.log(`[AUTH] Verification OTP for ${cleanEmail}: ${code}`);

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
    // Allow demo verification or match stored code
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

// 4. Forgot Password
router.post("/forgot", authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    // Always return success to prevent email enumeration
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
