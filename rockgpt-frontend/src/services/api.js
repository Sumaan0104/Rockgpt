const isLocal =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

export const BASE_URL = isLocal
  ? "http://localhost:5000"
  : "https://rockgpt.onrender.com";

export const API_BASE = `${BASE_URL}/api`;

const getAuthHeaders = (token) => {
  const headers = { "Content-Type": "application/json" };
  const activeToken =
    token ||
    (typeof localStorage !== "undefined" && localStorage.getItem("rockgpt_token")) ||
    (typeof sessionStorage !== "undefined" && sessionStorage.getItem("rockgpt_token"));

  if (activeToken) {
    headers["Authorization"] = `Bearer ${activeToken}`;
  }
  return headers;
};

// Ping /health on load so Render free-tier awakens without delaying first user query
export async function pingServerHealth() {
  try {
    await fetch(`${BASE_URL}/api/version`, { method: "GET" });
  } catch {}
}

/**
 * askRock — Real streaming SSE client with AbortController
 * @param {Array} messages Conversation history [{role, content, attachments}]
 * @param {Function} onChunk Callback receiving full accumulated string so far
 * @param {Object} options { signal, chatId, fast }
 */
export async function askRock(messages, onChunk, options = {}) {
  const { signal, chatId, fast = false } = options;

  let res;
  try {
    res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        chatId,
        messages,
        fast,
      }),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw err;
    }
    // Attempt one quick retry in case of cold wake
    await new Promise((r) => setTimeout(r, 1200));
    res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ chatId, messages, fast }),
      signal,
    });
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Server responded with status ${res.status}.`
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let accumulated = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const dataStr = trimmed.slice(5).trim();
      if (!dataStr || dataStr === "[DONE]") continue;

      try {
        const parsed = JSON.parse(dataStr);
        if (parsed.chatId && options.onChatIdAssigned) {
          try {
            options.onChatIdAssigned(parsed.chatId);
          } catch {}
        }
        if (parsed.token) {
          accumulated += parsed.token;
          onChunk(accumulated);
        } else if (parsed.error) {
          throw new Error(parsed.error);
        }
      } catch (parseErr) {
        // Fallback for raw text token stream
        if (!dataStr.startsWith("{")) {
          accumulated += dataStr;
          onChunk(accumulated);
        }
      }
    }
  }

  return accumulated;
}

// ═══ AUTH API ═══
export async function apiSignIn(email, password) {
  const res = await fetch(`${API_BASE}/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Sign in failed.");
  return data;
}

export async function apiSignUp(name, email, password) {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Sign up failed.");
  return data;
}

export async function apiVerifyOtp(emailOrName, codeOrEmail, password, code) {
  const email = code !== undefined ? codeOrEmail : emailOrName;
  const finalCode = code !== undefined ? code : codeOrEmail;
  const res = await fetch(`${API_BASE}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code: finalCode }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Verification failed.");
  return data;
}

export async function apiForgotPassword(email) {
  const res = await fetch(`${API_BASE}/auth/forgot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to send reset code.");
  return data;
}

export async function apiResetPassword(email, code, newPassword) {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to reset password.");
  return data;
}

export async function apiGetMe(token) {
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: "GET",
    headers: getAuthHeaders(token),
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function apiGoogleAuth(tokenOrCred) {
  const token =
    typeof tokenOrCred === "object"
      ? tokenOrCred?.credential || tokenOrCred?.code || tokenOrCred?.token || ""
      : tokenOrCred;

  const res = await fetch(`${API_BASE}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token, credential: token, code: token }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `Google authentication failed (${res.status}). Please try again.`);
  }
  return data;
}

// ═══ CHATS CRUD API ═══
export async function apiGetChats() {
  const res = await fetch(`${API_BASE}/chats`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  if (!res.ok) return [];
  return await res.json();
}

export async function apiGetChatById(chatId) {
  const res = await fetch(`${API_BASE}/chats/${chatId}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function apiCreateChat(title) {
  const res = await fetch(`${API_BASE}/chats`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ title }),
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function apiDeleteChat(chatId) {
  const res = await fetch(`${API_BASE}/chats/${chatId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return res.ok;
}
