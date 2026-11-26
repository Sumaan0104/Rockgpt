import "dotenv/config";
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");
import crypto from "crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";

import authRoutes, { setGoogleOAuthClientForTesting } from "./routes/auth.js";
import chatsRoutes from "./routes/chats.js";
import chatRoutes from "./routes/chat.js";
import adminRoutes from "./routes/admin.js";
import { authMiddleware } from "./middleware/auth.js";
import { globalLimiter } from "./middleware/limit.js";
import { sanitizeInput } from "./middleware/sanitize.js";
import User from "./models/User.js";

// ═══ ENVIRONMENT INTEGRITY & KEY STRENGTH VALIDATION ═══
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_SECRET = process.env.ADMIN_SECRET;
const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY;

if (process.env.NODE_ENV === "production") {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    console.error("[FATAL CRITICAL SECURITY] JWT_SECRET is missing or weak (<32 characters). Terminating process.");
    process.exit(1);
  }
  if (!ADMIN_SECRET || ADMIN_SECRET.length < 32) {
    console.warn("[SECURITY WARNING] ADMIN_SECRET is missing or <32 chars; /api/admin endpoints will fail closed until set.");
  }
  if (!INTERNAL_SERVICE_KEY || INTERNAL_SERVICE_KEY.length < 32) {
    console.warn("[SECURITY WARNING] INTERNAL_SERVICE_KEY is missing or <32 chars; service-key auth disabled until set.");
  }
}

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;

// ═══ MONGODB CONNECTION WITH HIGH-PERFORMANCE CONNECTION POOLING ═══
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI, {
      maxPoolSize: 25,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      w: "majority",
    })
    .then(() => {
      console.log("[MongoDB] Connected successfully to Atlas database (Pool: min 5, max 25).");
    })
    .catch((err) => {
      console.error("[MongoDB] Connection error:", err.message);
    });

  mongoose.connection.on("disconnected", () => {
    console.warn("[MongoDB] Atlas connection lost. Auto-reconnecting...");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("[MongoDB] Atlas reconnected successfully.");
  });
  mongoose.connection.on("error", (err) => {
    console.error("[MongoDB] Atlas runtime error:", err.message);
  });
} else {
  console.warn("[MongoDB] MONGODB_URI is not set. Running in in-memory / guest fallback mode.");
}

// ═══ CORS CONFIGURATION ═══
// SEC-04: Strict CORS allowlist (no wildcards, no *.vercel.app, no transition bypass)
const defaultAllowedOrigins = [
  "https://rockgpt-ten.vercel.app",
  "https://rockgpt.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];
const envClientUrl = (process.env.CLIENT_URL || "").trim();
const envAllowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [];
const allowedOrigins = Array.from(
  new Set([...defaultAllowedOrigins, ...(envClientUrl ? [envClientUrl] : []), ...envAllowedOrigins])
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    exposedHeaders: ["X-Chat-Id"],
  })
);

// ═══ COMPRESSION MIDDLEWARE (EXCLUDES SSE / TEXT/EVENT-STREAM) ═══
app.use(
  compression({
    filter: (req, res) => {
      if (req.headers.accept && req.headers.accept.includes("text/event-stream")) {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);

// ═══ SECURITY HEADERS & REQUEST PARSING ═══
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    frameguard: { action: "deny" },
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// DDoS / Burst Rate Limiting
app.use(globalLimiter);

// SQL / NoSQL Injection Sanitization
app.use(sanitizeInput);

// ═══ API ROUTE MOUNTING ═══
app.use("/api/auth", authRoutes);
app.use("/api/chats", chatsRoutes);
app.use("/api/conversations", chatsRoutes); // Backward-compatibility alias
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);

// ═══ SETTINGS ROUTES (/api/me/settings) ═══
app.get("/api/me/settings", authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user._id) return res.status(401).json({ error: "Unauthorized" });
    const user = await User.findById(req.user._id).select("settings").lean();
    res.json({ settings: user?.settings || { instructions: "", fast: false, textSize: "m" } });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

app.put("/api/me/settings", authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user._id) return res.status(401).json({ error: "Unauthorized" });
    const { instructions, fast, mode, textSize } = req.body || {};
    const update = {};
    if (typeof instructions === "string") update["settings.instructions"] = instructions.slice(0, 600);
    if (typeof fast === "boolean") update["settings.fast"] = fast;
    if (["fast", "think", "deep"].includes(mode)) {
      update["settings.mode"] = mode;
      if (typeof fast !== "boolean") update["settings.fast"] = mode === "fast";
    }
    if (["s", "m", "l"].includes(textSize)) update["settings.textSize"] = textSize;
    const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, { returnDocument: "after" }).select("settings").lean();
    res.json({ success: true, settings: user?.settings || {} });
  } catch (err) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// ═══ MESSAGE FEEDBACK (/api/messages/:id/feedback) ═══
app.patch("/api/messages/:id/feedback", authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user._id) return res.status(401).json({ error: "Unauthorized" });
    const { feedback } = req.body;
    if (!["up", "down", null].includes(feedback)) {
      return res.status(400).json({ error: "Invalid feedback value. Must be 'up', 'down', or null." });
    }
    const msgId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(msgId)) {
      return res.status(404).json({ error: "Message not found." });
    }
    const Message = mongoose.models.Message;
    const msg = await Message.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(msgId), userId: req.user._id },
      { $set: { feedback } },
      { returnDocument: "after" }
    );
    if (!msg) return res.status(404).json({ error: "Message not found." });
    res.json({ success: true, feedback: msg.feedback });
  } catch (err) {
    res.status(500).json({ error: "Failed to update feedback." });
  }
});

// ═══ SESSION RESTORE ALIAS (/me) ═══
app.get("/me", authMiddleware, (req, res) => {
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

// ═══ HEALTH CHECKS ═══
app.get("/api/version", (req, res) => {
  res.json({
    status: "operational",
    version: "5.0.0",
    engine: "RockGPT Neural Stream v5",
    uptime: process.uptime(),
  });
});

app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "connecting",
  })
);
app.get("/api/health", (req, res) =>
  res.json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "connecting",
  })
);

app.get("/", (req, res) => {
  res.json({
    name: "ROCKGPT API",
    status: "online",
    creator: "Suman Mansuri (Rock)",
    version: "5.0.0",
  });
});

// ═══ GLOBAL SAFE ERROR HANDLER (NO STACK TRACE LEAKS) ═══
app.use((err, req, res, next) => {
  if (err && err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "Access denied by CORS policy." });
  }
  const status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === "production";
  if (status >= 500) {
    console.error(`[Server Error] ${req.method} ${req.originalUrl}:`, err);
  }
  res.status(status).json({
    error: status === 500 && isProd ? "Internal server error" : (err.message || "An unexpected error occurred"),
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
      await fetch(`${KEEP_ALIVE_URL}/health`);
    } catch {
      /* ignore background ping failure */
    }
  }, 10 * 60 * 1000); // Heartbeat every 10 minutes
}

export { app, setGoogleOAuthClientForTesting };
export default app;
