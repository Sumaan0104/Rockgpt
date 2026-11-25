const CONFIGURED_BACKEND =
  process.env.VITE_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "https://rockgpt.onrender.com";

let resolvedBackendUrl: string | null = null;
let lastCheckTime = 0;

export async function getBackendUrl(): Promise<string> {
  const now = Date.now();
  // Cache resolution for 30 seconds
  if (resolvedBackendUrl && now - lastCheckTime < 30_000) {
    return resolvedBackendUrl;
  }

  // If explicitly configured to localhost or 127.0.0.1, use it directly
  if (CONFIGURED_BACKEND.includes("localhost") || CONFIGURED_BACKEND.includes("127.0.0.1")) {
    resolvedBackendUrl = CONFIGURED_BACKEND;
    lastCheckTime = now;
    return resolvedBackendUrl;
  }

  // If in local development, check if local Express backend (port 5000) is running
  if (process.env.NODE_ENV !== "production") {
    try {
      const probe = await fetch("http://127.0.0.1:5000/api/health", {
        signal: AbortSignal.timeout(600),
      });
      if (probe.ok || probe.status === 404 || probe.status === 200) {
        resolvedBackendUrl = "http://127.0.0.1:5000";
        lastCheckTime = now;
        return resolvedBackendUrl;
      }
    } catch {
      // Local port 5000 not responding, fall back to configured backend
    }
  }

  resolvedBackendUrl = CONFIGURED_BACKEND;
  lastCheckTime = now;
  return resolvedBackendUrl;
}

export const BACKEND_URL = CONFIGURED_BACKEND;

export async function proxyAuthRequest(
  endpoint: string,
  payload: any,
  timeoutMs = 25000,
  clientIp?: string
) {
  try {
    const backendUrl = await getBackendUrl();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.INTERNAL_SERVICE_KEY) {
      headers["x-service-key"] = process.env.INTERNAL_SERVICE_KEY;
    }
    if (clientIp) {
      headers["x-forwarded-client-ip"] = clientIp;
    }
    const res = await fetch(`${backendUrl}/api/auth/${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    console.warn(`[Backend Auth Proxy Error] ${endpoint}:`, err?.message || err);
    return { ok: false, status: 503, error: err?.message || "Backend unreachable" };
  }
}

export async function proxyBackendRequest(
  path: string,
  options: {
    method?: string;
    body?: any;
    user?: { id?: string; email?: string; backend_token?: string | null } | null;
    timeoutMs?: number;
    clientIp?: string;
  } = {}
) {
  const { method = "GET", body, user, timeoutMs = 25000, clientIp } = options;
  try {
    const backendUrl = await getBackendUrl();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.INTERNAL_SERVICE_KEY) {
      headers["x-service-key"] = process.env.INTERNAL_SERVICE_KEY;
    }
    if (clientIp) {
      headers["x-forwarded-client-ip"] = clientIp;
    }
    if (user?.id) {
      headers["x-user-id"] = user.id;
    }
    if (user?.email) {
      headers["x-user-email"] = user.email;
    }
    if (user?.backend_token) {
      headers["Authorization"] = `Bearer ${user.backend_token}`;
    }

    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${backendUrl}${cleanPath}`;

    const fetchOpts: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    };
    if (body !== undefined && method !== "GET" && method !== "HEAD") {
      fetchOpts.body = JSON.stringify(body);
    }

    const res = await fetch(url, fetchOpts);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    console.warn(`[Backend Proxy Error] ${path}:`, err?.message || err);
    return { ok: false, status: 503, error: err?.message || "Backend unreachable" };
  }
}
