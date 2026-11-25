import rateLimit from "express-rate-limit";
import Usage from "../models/Usage.js";
import { isServiceKeyValid } from "./auth.js";

/**
 * Extracts verified end-user IP. Only trusts `x-forwarded-client-ip` when request
 * carries a cryptographically verified INTERNAL_SERVICE_KEY from RockGPT frontend proxy.
 */
export function getClientIpFromReq(req) {
  const serviceKey = req.headers["x-service-key"] || req.headers["x-internal-service"];
  if ((req.isService || (serviceKey && isServiceKeyValid(serviceKey))) && req.headers["x-forwarded-client-ip"]) {
    const candidate = String(req.headers["x-forwarded-client-ip"])
      .split(",")[0]
      .trim()
      .replace(/^::ffff:/i, "");
    if (/^[0-9a-fA-F:.]{3,45}$/.test(candidate)) {
      return candidate;
    }
  }
  return String(req.ip || "unknown").replace(/^::ffff:/i, "");
}

// Global DDoS / burst limiter across all API routes (200 requests per 1 minute window)
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  keyGenerator: (req) => getClientIpFromReq(req),
  validate: { keyGeneratorIpFallback: false },
  message: { error: "Too many requests from this IP. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Per-minute IP limiter for auth endpoints (OTP/refresh/Google)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // 60 auth requests per 15 min per IP
  keyGenerator: (req) => getClientIpFromReq(req),
  validate: { keyGeneratorIpFallback: false },
  message: { error: "Too many authentication requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict brute-force limiter on login & signup (10 attempts per 15 min per IP)
export const loginSignupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: (req) => process.env.NODE_ENV === "test" && req.headers["x-test-rate-limit"] !== "true",
  keyGenerator: (req) => getClientIpFromReq(req),
  validate: { keyGeneratorIpFallback: false },
  message: { error: "Too many login or signup attempts. Please wait 15 minutes and try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Chat message rate limiter: prevent automated spam loops
export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 messages per minute
  keyGenerator: (req) => getClientIpFromReq(req),
  validate: { keyGeneratorIpFallback: false },
  message: { error: "You are sending messages too quickly. Please pause for a moment." },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * dailyUsageLimit — Check and increment daily usage count in MongoDB
 * SEC-05: Rate-limit guests strictly by req.ip (never trust client headers)
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

    // SEC-05: Strict IP rate-limiting for guests via Express trusted proxy
    const clientKey = user ? `user_${user._id}` : `ip_${req.ip || "unknown"}`;
    const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

    const maxAllowed = user ? 500 : 100; // Generous 500 messages for registered free users, 100 for guests

    const usageRecord = await Usage.findOneAndUpdate(
      { key: clientKey, date: today },
      { $inc: { count: 1 } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
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
