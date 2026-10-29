import rateLimit from "express-rate-limit";
import Usage from "../models/Usage.js";
import { isServiceKeyValid } from "./auth.js";

// Global DDoS / burst limiter across all API routes (200 requests per 1 minute window)
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: "Too many requests from this IP. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Per-minute IP limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 auth requests per 15 min per IP
  message: { error: "Too many authentication requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Chat message rate limiter: prevent automated spam loops
export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 messages per minute
  message: { error: "You are sending messages too quickly. Please pause for a moment." },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * dailyUsageLimit — Check and increment daily usage count in MongoDB
 */
export async function dailyUsageLimit(req, res, next) {
  try {
    const serviceKey = req.headers["x-service-key"] || req.headers["x-internal-service"];

    // Authorized internal frontend service mesh calls or service users bypass daily throttling
    if (req.isService || (serviceKey && isServiceKeyValid(serviceKey))) {
      return next();
    }

    const user = req.user;
    const isPaid = user && (user.plan === "plus" || user.plan === "pro");

    // Paid members have unlimited usage
    if (isPaid) return next();

    // Isolate client key by explicit device/client session identifier or IP
    const clientSession = req.headers["x-client-session"] || req.headers["x-device-id"];
    const clientIp = req.headers["x-forwarded-for"]
      ? req.headers["x-forwarded-for"].split(",")[0].trim()
      : req.ip || "guest";

    const clientKey = user ? `user_${user._id}` : (clientSession ? `sess_${clientSession}` : `ip_${clientIp}`);
    const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

    const maxAllowed = user ? 500 : 100; // Generous 500 messages for registered free users, 100 for guests

    const usageRecord = await Usage.findOneAndUpdate(
      { key: clientKey, date: today },
      { $inc: { count: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (usageRecord.count > maxAllowed) {
      return res.status(429).json({
        error: `Daily limit of ${maxAllowed} messages reached. Upgrade your plan to Plus or Pro for unlimited access.`,
        limitReached: true,
        limit: maxAllowed,
        count: usageRecord.count,
      });
    }

    next();
  } catch (err) {
    // If usage check fails, do not block user
    next();
  }
}
