export const BACKEND_URL =
  process.env.VITE_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "https://rockgpt.onrender.com";

export async function proxyAuthRequest(endpoint: string, payload: any, timeoutMs = 8000) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
