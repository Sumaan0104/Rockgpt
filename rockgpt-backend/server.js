import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import authRoutes from "./routes/auth.js";
import chatsRoutes from "./routes/chats.js";
import chatRoutes from "./routes/chat.js";
import { authMiddleware } from "./middleware/auth.js";
import User from "./models/User.js";

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
    const { planId, billingCycle } = req.body;
    const planKey = (planId || "plus").toLowerCase();

    const expiryDays = billingCycle === "yearly" ? 365 : 30;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    await User.findByIdAndUpdate(req.user._id, {
      plan: planKey,
      planExpiresAt: expiresAt,
    });

    res.json({
      success: true,
      message: `Upgraded to ${planKey.toUpperCase()} plan successfully!`,
      plan: planKey,
      expiresAt,
    });
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

// ═══ SERVER START ═══
app.listen(PORT, () => {
  console.log(`[ROCKGPT] Server listening on port ${PORT}`);
});

export default app;