export const BACKEND_URL =
  process.env.VITE_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "https://rockgpt.onrender.com";

export async function proxyAuthRequest(endpoint: string, payload: any, timeoutMs = 25000) {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.INTERNAL_SERVICE_KEY) {
      headers["x-service-key"] = process.env.INTERNAL_SERVICE_KEY;
    }
    const res = await fetch(`${BACKEND_URL}/api/auth/${endpoint}`, {
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
  } = {}
) {
  const { method = "GET", body, user, timeoutMs = 25000 } = options;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.INTERNAL_SERVICE_KEY) {
      headers["x-service-key"] = process.env.INTERNAL_SERVICE_KEY;
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
    const url = `${BACKEND_URL}${cleanPath}`;

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
