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
