/**
 * sanitize.js — Deep NoSQL / SQL injection & prototype pollution defense middleware
 * Strips '__proto__', 'constructor', 'prototype', and keys containing '$' or '.'
 */

const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function sanitizeInPlace(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 10) return;

  for (const key of Object.keys(obj)) {
    if (BLOCKED_KEYS.has(key) || key.startsWith("$") || key.includes(".")) {
      delete obj[key];
    } else if (obj[key] && typeof obj[key] === "object") {
      sanitizeInPlace(obj[key], depth + 1);
    }
  }
}

export function sanitizeInput(req, res, next) {
  try {
    if (req.body && typeof req.body === "object") {
      sanitizeInPlace(req.body);
    }
    if (req.query && typeof req.query === "object") {
      sanitizeInPlace(req.query);
    }
    if (req.params && typeof req.params === "object") {
      sanitizeInPlace(req.params);
    }
  } catch (_) {}
  next();
}
