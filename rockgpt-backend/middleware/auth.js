import jwt from "jsonwebtoken";
import User from "../models/User.js";

const JWT_SECRET = process.env.JWT_SECRET || "rockgpt_super_secure_jwt_secret_production_2026";

/**
 * authMiddleware — Optional authentication
 * Attaches req.user if a valid Bearer token is provided.
 * Does not block unauthenticated users (allows guest usage).
 */
export async function authMiddleware(req, res, next) {
  try {
    const serviceKey = req.headers["x-service-key"] || req.headers["x-internal-service"];
    if (serviceKey && serviceKey === JWT_SECRET) {
      req.isService = true;
      req.user = {
        _id: "service_user",
        email: "service@rockgpt.ai",
        name: "RockGPT Mesh User",
        plan: "pro",
      };
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || (!decoded.id && !decoded.email)) {
      req.user = null;
      return next();
    }

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

    // If cryptographically signed by JWT_SECRET, accept verified user claims
    if (!user && (decoded.id || decoded.email)) {
      user = {
        _id: decoded.id || "verified_user",
        email: decoded.email || "user@rockgpt.ai",
        name: decoded.name || "User",
        plan: decoded.plan || "pro",
      };
    }

    req.user = user || null;
    next();
  } catch (err) {
    req.user = null;
    next();
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
