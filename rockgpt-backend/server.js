import "dotenv/config";
import crypto from "crypto";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import authRoutes, { setGoogleOAuthClientForTesting } from "./routes/auth.js";
import chatsRoutes from "./routes/chats.js";
import chatRoutes from "./routes/chat.js";
import { authMiddleware } from "./middleware/auth.js";
import { globalLimiter } from "./middleware/limit.js";
import { sanitizeInput } from "./middleware/sanitize.js";
import User from "./models/User.js";
import PaymentTransaction from "./models/PaymentTransaction.js";

const app = express();
const PORT = process.env.PORT || 5000;

// ═══ MONGODB CONNECTION ═══
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log("[MongoDB] Connected successfully to Atlas database.");
    })
    .catch((err) => {
      console.error("[MongoDB] Connection error:", err.message);
    });
} else {
  console.warn("[MongoDB] MONGODB_URI is not set. Running in in-memory / guest fallback mode.");
}

// ═══ CORS CONFIGURATION ═══
const allowedOrigins = [
  "https://rockgpt-ten.vercel.app",
  "https://rockgpt.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith(".vercel.app")) {
        callback(null, true);
      } else {
        callback(null, true); // Allow during transition
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// ═══ CYBER ATTACK DEFENSE & SECURITY HEADERS ═══
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  next();
});

// DDoS / Burst Rate Limiting
app.use(globalLimiter);

// SQL / NoSQL Injection Sanitization
app.use(sanitizeInput);

// ═══ API ROUTE MOUNTING ═══
app.use("/api/auth", authRoutes);
app.use("/api/chats", chatsRoutes);
app.use("/api/conversations", chatsRoutes); // Backward-compatibility alias
app.use("/api/chat", chatRoutes);

// ═══ PAYMENT & UPI SYSTEM (PRESERVED) ═══
const PLAN_PRICING = {
  plus: { monthly: 149 * 100, yearly: 119 * 12 * 100, name: "Plus" },
  pro: { monthly: 399 * 100, yearly: 319 * 12 * 100, name: "Pro" },
};

app.get("/api/payment/config", (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.trim() : null;
  res.json({
    configured: Boolean(keyId && process.env.RAZORPAY_KEY_SECRET),
    keyId: keyId,
  });
});

app.post("/api/payment/create-order", authMiddleware, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Please log in to upgrade your subscription." });
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
        error: "Razorpay automated payments are not configured on this instance. Please use UPI transfer.",
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
        receipt: `rcpt_${Date.now().toString(36)}`,
        notes: { userId: req.user._id, plan: planConfig.name, cycle },
      }),
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      return res.status(500).json({ error: orderData.error?.description || "Payment order creation failed." });
    }

    // Persist PaymentTransaction record for verification & replay protection
    await PaymentTransaction.create({
      userId: req.user._id,
      orderId: orderData.id,
      plan: planKey,
      billingCycle: cycle,
      amount: amountInPaise,
      currency: orderData.currency || "INR",
      status: "created",
    }).catch((dbErr) => console.warn("PaymentTransaction log error:", dbErr.message));

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
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/payment/verify-payment", authMiddleware, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required." });
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const keySecret = process.env.RAZORPAY_KEY_SECRET ? process.env.RAZORPAY_KEY_SECRET.trim() : "";
    if (keySecret) {
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({
          error: "Payment verification parameters missing (order_id, payment_id, and signature required).",
        });
      }

      // 1. Look up existing order transaction
      const tx = await PaymentTransaction.findOne({ orderId: razorpay_order_id });
      if (!tx) {
        return res.status(404).json({ error: "Payment order not found or invalid." });
      }

      // 2. Prevent cross-user order usage
      if (tx.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: "Access denied. Order belongs to a different account." });
      }

      // 3. Prevent replay attacks (already consumed)
      if (tx.status === "verified") {
        return res.status(400).json({ error: "This payment has already been verified and processed." });
      }

      // 4. Prevent duplicate payment ID reuse
      const duplicatePayment = await PaymentTransaction.findOne({
        paymentId: razorpay_payment_id,
        status: "verified",
      });
      if (duplicatePayment) {
        return res.status(400).json({ error: "This payment ID has already been claimed." });
      }

      // 5. Verify cryptographic HMAC SHA256 signature
      const generatedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");
      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ error: "Invalid payment signature verification failed." });
      }

      // 6. Server is source of truth for plan and billing cycle
      const planKey = tx.plan;
      const expiryDays = tx.billingCycle === "yearly" ? 365 : 30;
      const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

      tx.status = "verified";
      tx.paymentId = razorpay_payment_id;
      tx.signature = razorpay_signature;
      tx.verifiedAt = new Date();
      await tx.save();

      await User.findByIdAndUpdate(req.user._id, {
        plan: planKey,
        planExpiresAt: expiresAt,
      });

      return res.json({
        success: true,
        message: `Upgraded to ${planKey.toUpperCase()} plan successfully!`,
        plan: planKey,
        expiresAt,
      });
    } else {
      // In development / demo mode when Razorpay keys are not configured
      if (process.env.NODE_ENV === "production") {
        return res.status(503).json({
          error: "Automated payment verification is not configured on this instance. Please use UPI transfer.",
        });
      }

      // Safe dev fallback for offline testing
      const planKey = (req.body.planId || "plus").toLowerCase();
      const expiryDays = req.body.billingCycle === "yearly" ? 365 : 30;
      const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
      await User.findByIdAndUpdate(req.user._id, { plan: planKey, planExpiresAt: expiresAt });
      return res.json({
        success: true,
        message: `Upgraded to ${planKey.toUpperCase()} plan successfully (test mode)!`,
        plan: planKey,
        expiresAt,
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══ HEALTH CHECKS ═══
app.get("/api/version", (req, res) => {
  res.json({
    status: "operational",
    version: "5.0.0",
    engine: "RockGPT Neural Stream v5",
    uptime: process.uptime(),
  });
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.get("/", (req, res) => {
  res.json({
    name: "ROCKGPT API",
    status: "online",
    creator: "Suman Mansuri (Rock)",
    version: "5.0.0",
  });
});

// ═══ SERVER START & WARM-UP KEEP-ALIVE ═══
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`[ROCKGPT] Server listening on port ${PORT}`);
  });

  // Keep-Alive Ping (prevents Render free-tier instance from sleeping)
  const KEEP_ALIVE_URL = process.env.RENDER_EXTERNAL_URL || "https://rockgpt.onrender.com";
  setInterval(async () => {
    try {
      await fetch(`${KEEP_ALIVE_URL}/api/version`);
    } catch {
      /* ignore background ping failure */
    }
  }, 10 * 60 * 1000); // Heartbeat every 10 minutes
}

export { app, setGoogleOAuthClientForTesting };
export default app;