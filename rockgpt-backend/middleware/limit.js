import rateLimit from "express-rate-limit";
import Usage from "../models/Usage.js";

// Per-minute IP limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 attempts
  message: { error: "Too many authentication requests. Please try again in a few minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Per-minute IP limiter for general chat
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
    const user = req.user;
    const isPaid = user && (user.plan === "plus" || user.plan === "pro");

    // Paid members have unlimited usage
    if (isPaid) return next();

    const clientKey = user ? `user_${user._id}` : `ip_${req.ip || req.headers["x-forwarded-for"] || "guest"}`;
    const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

    const maxAllowed = user ? 50 : 20; // 50 messages for registered free users, 20 for guests

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
