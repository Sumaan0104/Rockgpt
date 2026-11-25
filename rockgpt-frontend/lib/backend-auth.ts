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
  const maxAttempts = 2;
  let lastStatus = 503;
  let lastError = "Backend unreachable";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
        signal: AbortSignal.timeout(attempt === 1 ? Math.min(timeoutMs, 18000) : timeoutMs),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status >= 502 && res.status <= 504 && attempt < maxAttempts) {
        lastStatus = res.status;
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      return { ok: res.ok, status: res.status, data };
    } catch (err: any) {
      lastStatus = 503;
      lastError = err?.message || "Backend unreachable";
      console.warn(`[Backend Auth Proxy Error] ${endpoint} (attempt ${attempt}):`, lastError);
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }
  return { ok: false, status: lastStatus, error: lastError };
}

export async function proxyBackendRequest(
  path: string,
  options: {
    method?: string;
    body?: any;
    user?: {
      id?: string;
      email?: string;
      backend_token?: string | null;
      backend_refresh_token?: string | null;
    } | null;
    timeoutMs?: number;
    clientIp?: string;
  } = {}
) {
  const { method = "GET", body, user, timeoutMs = 25000, clientIp } = options;
  try {
    const backendUrl = await getBackendUrl();
    const buildHeaders = (bearer?: string | null) => {
      const h: Record<string, string> = { "Content-Type": "application/json" };
      if (process.env.INTERNAL_SERVICE_KEY) {
        h["x-service-key"] = process.env.INTERNAL_SERVICE_KEY;
      }
      if (clientIp) {
        h["x-forwarded-client-ip"] = clientIp;
      }
      if (user?.id) {
        h["x-user-id"] = user.id;
      }
      if (user?.email) {
        h["x-user-email"] = user.email;
      }
      if (bearer) {
        h["Authorization"] = `Bearer ${bearer}`;
      }
      return h;
    };

    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${backendUrl}${cleanPath}`;

    const makeFetchOpts = (bearer?: string | null): RequestInit => {
      const opts: RequestInit = {
        method,
        headers: buildHeaders(bearer),
        signal: AbortSignal.timeout(timeoutMs),
      };
      if (body !== undefined && method !== "GET" && method !== "HEAD") {
        opts.body = JSON.stringify(body);
      }
      return opts;
    };

    let res = await fetch(url, makeFetchOpts(user?.backend_token));

    // Auto-refresh short-lived 15m backend JWT using stored refresh token if backend returns 401
    if (res.status === 401 && user?.backend_refresh_token) {
      try {
        const refreshRes = await fetch(`${backendUrl}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: user.backend_refresh_token }),
          signal: AbortSignal.timeout(10_000),
        });
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json().catch(() => ({}));
          if (refreshData?.token) {
            user.backend_token = refreshData.token;
            if (refreshData.refreshToken) user.backend_refresh_token = refreshData.refreshToken;
            res = await fetch(url, makeFetchOpts(refreshData.token));
          }
        }
      } catch {}
    }

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    console.warn(`[Backend Proxy Error] ${path}:`, err?.message || err);
    return { ok: false, status: 503, error: err?.message || "Backend unreachable" };
  }
}
