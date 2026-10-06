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
    if (!decoded || !decoded.id) {
      req.user = null;
      return next();
    }

    const user = await User.findById(decoded.id).select("-passwordHash -totpSecret").lean();
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
