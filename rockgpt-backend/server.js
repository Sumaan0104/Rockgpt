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