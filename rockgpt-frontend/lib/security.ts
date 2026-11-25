const ALLOWED_ORIGINS = new Set(
  [
    "https://rockgpt-ten.vercel.app",
    "https://rockgpt.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...(process.env.APP_URL ? [process.env.APP_URL.trim().replace(/\/$/, "")] : []),
  ].filter(Boolean)
);

/**
 * Extracts the verified client IP address from edge/proxy headers safely,
 * stripping ports and IPv6 brackets to resist X-Forwarded-For spoofing.
 */
export function getClientIp(request: Request): string {
  const candidates = [
    request.headers.get("x-vercel-forwarded-for"),
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-forwarded-for"),
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    const first = raw.split(",")[0]?.trim() || "";
    const cleaned = first
      .replace(/^\[|\]$/g, "")
      .replace(/:\d+$/, "")
      .replace(/^::ffff:/i, "");
    if (/^[0-9a-fA-F:.]{3,45}$/.test(cleaned)) {
      return cleaned;
    }
  }
  return "127.0.0.1";
}

/**
 * Validates that a mutating request's Origin or Referer matches our trusted host allowlist.
 */
export function isTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    // Non-browser clients / same-origin navigation without Origin header
    return true;
  }
  try {
    const normalized = new URL(origin).origin;
    if (ALLOWED_ORIGINS.has(normalized)) return true;
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (host) {
      const originHost = new URL(origin).host;
      if (originHost === host) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getCorsOriginHeader(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    const normalized = new URL(origin).origin;
    if (ALLOWED_ORIGINS.has(normalized)) return normalized;
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (host && new URL(origin).host === host) return normalized;
  } catch {}
  return null;
}

/**
 * Deeply strips prototype-pollution keys and MongoDB operator injection keys ('$', '.')
 * from untrusted parsed JSON payloads before passing them to database or backend calls.
 */
export function sanitizePayload<T>(input: T, depth = 0): T {
  if (depth > 8 || input === null || typeof input !== "object") {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => sanitizePayload(item, depth + 1)) as unknown as T;
  }
  const cleanObj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (
      key === "__proto__" ||
      key === "constructor" ||
      key === "prototype" ||
      key.startsWith("$") ||
      key.includes(".")
    ) {
      continue;
    }
    cleanObj[key] = sanitizePayload(value, depth + 1);
  }
  return cleanObj as T;
}

const SECURITY_PERSONAL_REFUSAL =
  "This raises a security and privacy concern, so I cannot reply to that request. RockGPT strictly protects personal privacy, confidential data, and platform security.\n\nIf you'd like help with software engineering, math, architecture, or general topics, feel free to ask!";

/**
 * Detects personal/private PII inquiries, secret/credential extraction,
 * or malicious cyber-attack/bypass prompts while allowing normal creative,
 * technical, educational, and public creator persona questions.
 */
export function detectSecurityOrPersonalConcern(query: string): string | null {
  if (!query || typeof query !== "string") return null;
  const q = query.trim().toLowerCase();
  if (!q) return null;

  // Defensive / educational cybersecurity questions are always safe to explain
  const isDefensiveQuestion =
    /\b(how to prevent|how to protect|defend against|mitigate|what is|explain|fix vulnerability|best practices|security header|how does .* work)\b/i.test(
      q
    ) && !/\b(give me|dump|leak|steal|hack into|crack|bypass .* on rockgpt|suman|personal|phone|address|password of)\b/i.test(q);

  if (isDefensiveQuestion) return null;

  // 1. Personal / Private Information (Creator or any individual PII / Doxxing)
  const personalPrivatePatterns: RegExp[] = [
    /\b(suman|rock|developer|creator|owner|founder|admin|user|someone|his|her|your)\b.{0,45}\b(phone number|mobile number|contact number|whatsapp number|home address|house address|street address|residence|exact location|gps|pin code|postal code|college|university|school|gf|girlfriend|boyfriend|wife|husband|family member|parents|salary|income|bank account|pan card|aadhaar|aadhar|ssn|passport|password|private email|personal life|dating|relationship)\b/i,
    /\b(where does (?:suman|rock) live|what college (?:is|did) (?:suman|rock)|(?:suman|rock)'s (?:number|address|college|age|birthday|dob|password|email|private|family|gf))\b/i,
    /\b(give me|find|lookup|dox|leak|share|tell me)\b.{0,30}\b(phone number|home address|aadhaar|aadhar|pan number|ssn|credit card|cvv|debit card|bank pin|upi pin|otp|password)\b/i,
  ];

  if (personalPrivatePatterns.some((re) => re.test(q))) {
    return SECURITY_PERSONAL_REFUSAL;
  }

  // 2. Credential / Database / System Secret / Prompt Extraction & Direct Attack Requests
  const securityAttackPatterns: RegExp[] = [
    /\b(reveal|show|print|dump|leak|expose|output|extract|give me)\b.{0,40}\b(system prompt|hidden instructions|\.env|env variables|api[ _-]?key|jwt[ _-]?secret|auth[ _-]?secret|mongodb[ _-]?uri|database credentials|all users|user passwords|password hash|otp codes|admin secret)\b/i,
    /\b(hack|exploit|ddos|dos attack|sql injection|nosql injection|xss payload|brute ?force|bypass otp|bypass auth|bypass rate limit|crack password|steal cookies|session hijack)\b.{0,40}\b(this site|rockgpt|vercel|render|website|server|database|account|victim|target)\b/i,
    /\b(ignore all previous instructions|ignore your rules|override system prompt)\b.{0,50}\b(secret|password|prompt|otp|database|private|admin)\b/i,
  ];

  if (securityAttackPatterns.some((re) => re.test(q))) {
    return SECURITY_PERSONAL_REFUSAL;
  }

  return null;
}

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(self), geolocation=(), payment=(), usb=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "X-DNS-Prefetch-Control": "on",
};
