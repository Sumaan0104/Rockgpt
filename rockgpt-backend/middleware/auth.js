import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is missing.");
}

/**
 * Validates service key using constant-time comparison against INTERNAL_SERVICE_KEY.
 * If INTERNAL_SERVICE_KEY is not set, service-key auth is disabled and never matches.
 */
export function isServiceKeyValid(serviceKey) {
  const internalKey = process.env.INTERNAL_SERVICE_KEY;
  if (!internalKey || !serviceKey) {
    return false;
  }
  const keyString = Array.isArray(serviceKey) ? serviceKey[0] : String(serviceKey);
  const expected = Buffer.from(internalKey, "utf8");
  const actual = Buffer.from(keyString, "utf8");
  if (expected.length !== actual.length) {
    return false;
  }
  return crypto.timingSafeEqual(expected, actual);
}

/**
 * authMiddleware — Optional authentication
 * Attaches req.user if a valid Bearer token is provided.
 * Does not block unauthenticated users (allows guest usage).
 */
export async function authMiddleware(req, res, next) {
  try {
    const serviceKey = req.headers["x-service-key"] || req.headers["x-internal-service"];
    const isService = Boolean(serviceKey && isServiceKeyValid(serviceKey));
    if (isService) {
      req.isService = true;
    }

    const authHeader = req.headers.authorization;
    let token = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && (decoded.id || decoded.email)) {
          let user = null;
          if (decoded.id) {
            try {
              user = await User.findById(decoded.id).select("-passwordHash -totpSecret").lean();
            } catch {}
          }
          if (!user && decoded.email) {
            try {
              user = await User.findOne({ email: decoded.email.toLowerCase().trim() }).select("-passwordHash -totpSecret").lean();
            } catch {}
          }
          if (user) {
            req.user = user;
            return next();
          }
        }
      } catch {}
    }

    // If authenticated via trusted INTERNAL_SERVICE_KEY, look up target user by header
    if (isService) {
      const targetUserId = req.headers["x-user-id"];
      const targetUserEmail = req.headers["x-user-email"];

      let user = null;
      if (targetUserId) {
        try {
          user = await User.findById(targetUserId).select("-passwordHash -totpSecret").lean();
        } catch {}
      }
      if (!user && targetUserEmail) {
        try {
          user = await User.findOne({ email: targetUserEmail.toLowerCase().trim() }).select("-passwordHash -totpSecret").lean();
        } catch {}
      }

      if (user) {
        req.user = user;
        return next();
      }

      if (targetUserId) {
        req.user = {
          _id: targetUserId,
          email: targetUserEmail || "user@rockgpt.ai",
          name: "RockGPT User",
          plan: "pro",
        };
        return next();
      }

      req.user = {
        _id: "service_user",
        email: "service@rockgpt.ai",
        name: "RockGPT Mesh User",
        plan: "pro",
      };
      return next();
    }

    req.user = null;
    return next();
  } catch (err) {
    req.user = null;
    return next();
  }
}

/**
 * requireAuth — Strict authentication guard
 * Returns 401 if user is not authenticated.
 */
export async function requireAuth(req, res, next) {
  await authMiddleware(req, res, () => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized. Please log in or create an account." });
    }
    next();
  });
}
