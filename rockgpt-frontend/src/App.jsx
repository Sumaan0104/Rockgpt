import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  ArrowUp, Check, ChevronDown, Copy, Download, Edit3, Menu, Mic,
  PanelLeft, Plus, Search, Settings, User, X, Zap, Brain, Paperclip,
  Moon, Sun, RefreshCcw, Square, ThumbsDown, ThumbsUp, Trash2,
  Sparkles, Globe, Gauge, Loader2, Crown,
} from "lucide-react";

const BACKEND_URL = "https://rockgpt.onrender.com";

const PLANS = [
  {
    name: "Free",
    price: "₹0",
    period: "/forever",
    features: ["50 messages / day", "Standard response speed", "Image & file understanding", "Chat history saved"],
    highlight: false,
  },
  {
    name: "Plus",
    price: "₹149",
    period: "/month",
    features: ["500 messages / day", "Priority response speed", "Fast mode always on", "Early access to new features"],
    highlight: true,
  },
  {
    name: "Pro",
    price: "₹399",
    period: "/month",
    features: ["Unlimited messages", "Fastest response speed", "Priority support", "Everything in Plus"],
    highlight: false,
  },
];

function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime(d) {
  try {
    return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function Inline({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return <strong key={i} className="font-semibold text-white">{p.slice(2, -2)}</strong>;
        }
        if (p.startsWith("`") && p.endsWith("`")) {
          return <code key={i} className="rounded-md bg-white/[.08] px-1.5 py-0.5 text-[13px] font-mono">{p.slice(1, -1)}</code>;
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function MessageContent({ content }) {
  const lines = (content || "").split("\n");
  const output = [];
  let inCode = false;
  let lang = "";
  let codeLines = [];

  const flushCode = () => {
    output.push(
      <div key={output.length} className="my-3 overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a]">
        <div className="flex items-center justify-between border-b border-white/10 bg-[#111] px-3 py-1.5">
          <span className="text-[11px] font-medium text-white/45">{lang || "code"}</span>
          <button
            onClick={() => navigator.clipboard.writeText(codeLines.join("\n"))}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-white/45 hover:bg-white/[.06] hover:text-white"
          >
            <Copy size={12} /> Copy
          </button>
        </div>
        <pre className="overflow-x-auto p-3 text-[13px] leading-6 text-white/80"><code>{codeLines.join("\n")}</code></pre>
      </div>
    );
  };

  lines.forEach((line) => {
    if (line.startsWith("```")) {
      if (!inCode) {
        inCode = true;
        lang = line.slice(3).trim();
        codeLines = [];
      } else {
        flushCode();
        inCode = false;
        lang = "";
        codeLines = [];
      }
      return;
    }
    if (inCode) {
      codeLines.push(line);
      return;
    }
    if (!line.trim()) {
      output.push(<div key={output.length} className="h-2" />);
    } else if (line.startsWith("### ")) {
      output.push(<h3 key={output.length} className="mt-2 mb-1 text-base font-semibold">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      output.push(<h2 key={output.length} className="mt-3 mb-1 text-lg font-semibold">{line.slice(3)}</h2>);
    } else if (/^\d+\.\s/.test(line)) {
      const n = line.match(/^(\d+)/)?.[1];
      output.push(
        <div key={output.length} className="flex gap-2 py-0.5">
          <span className="w-5 shrink-0 text-right text-white/45">{n}.</span>
          <span><Inline text={line.replace(/^\d+\.\s+/, "")} /></span>
        </div>
      );
    } else if (line.startsWith("- ")) {
      output.push(
        <div key={output.length} className="flex gap-2 py-0.5">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/50" />
          <span><Inline text={line.slice(2)} /></span>
        </div>
      );
    } else {
      output.push(<p key={output.length} className="leading-7 text-white/80"><Inline text={line} /></p>);
    }
  });
  if (inCode) flushCode();

  return <div className="space-y-0.5 text-[15px]">{output}</div>;
}

function RockMark({ small = false }) {
  return (
    <div className={`grid shrink-0 place-items-center rounded-[10px] border border-white/15 bg-white font-black text-black ${small ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-sm"}`}>
      R
    </div>
  );
}

function IntroScreen({ onDone }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 500);
    const t2 = setTimeout(() => setStage(2), 1300);
    const t3 = setTimeout(onDone, 2300);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#0a0a0a] fade-out" style={{ animationDelay: "1.9s" }}>
      <style>{`html, body, #root { background: #0a0a0a; margin: 0; height: 100%; }`}</style>
      <div className="flex flex-col items-center">
        <div className={`transition-all duration-700 ${stage >= 1 ? "scale-100 opacity-100" : "scale-50 opacity-0"}`} style={{ transitionTimingFunction: "cubic-bezier(.34,1.56,.64,1)" }}>
          <div className="relative">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-2xl font-black text-black shadow-[0_0_50px_rgba(255,255,255,.2)]">R</div>
            {stage >= 1 && <div className="absolute inset-0 -z-10 animate-ping rounded-2xl bg-white/20" style={{ animationDuration: "1.5s", animationIterationCount: "2" }} />}
          </div>
        </div>
        <div className={`mt-5 text-2xl font-semibold tracking-tight text-white transition-all duration-500 ${stage >= 1 ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}>
          RockGPT
        </div>
        {stage >= 2 && (
          <div className="mt-4 flex items-center gap-2 text-xs text-white/40 fade">
            <Loader2 size={14} className="animate-spin" /> Loading your workspace...
          </div>
        )}
      </div>
    </div>
  );
}

export default function RockGPT() {
  const [showIntro, setShowIntro] = useState(true);
  const [conversations, setConversations] = useState(() => {
    try {
      const saved = localStorage.getItem("rockgpt-conversations");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [payingPlan, setPayingPlan] = useState(null);
  const [search, setSearch] = useState("");
  const [typing, setTyping] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [thinkingLabel, setThinkingLabel] = useState("RockGPT is thinking");
  const [copied, setCopied] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState("");
  const [recording, setRecording] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [notice, setNotice] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [webSearchOn, setWebSearchOn] = useState(false);
  const [fastMode, setFastMode] = useState(false);

  // --- Auth state ---
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("rockgpt-token") || null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // --- Guest gate: shows immediately, re-shows locked after a few minutes ---
  const [gateOpen, setGateOpen] = useState(() => !localStorage.getItem("rockgpt-token"));
  const [gateLocked, setGateLocked] = useState(false);
  const gateTimerRef = useRef(null);

  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const abortRef = useRef(null);
  const recognitionRef = useRef(null);
  const dark = theme === "dark";

  useEffect(() => {
    try {
      localStorage.setItem("rockgpt-conversations", JSON.stringify(conversations));
    } catch (err) {
      console.error("Failed to save chats:", err);
    }
  }, [conversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);
    recognitionRef.current = recognition;
  }, []);

  // Guest re-prompt: if not logged in, after 3.5 minutes force the gate back open, locked
  useEffect(() => {
    if (authToken) {
      setGateOpen(false);
      setGateLocked(false);
      if (gateTimerRef.current) clearTimeout(gateTimerRef.current);
      return;
    }
    gateTimerRef.current = setTimeout(() => {
      setGateLocked(true);
      setGateOpen(true);
    }, 3.5 * 60 * 1000);
    return () => { if (gateTimerRef.current) clearTimeout(gateTimerRef.current); };
  }, [authToken]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarOpen((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        newChat();
      }
      if (e.key === "Escape") {
        setSettingsOpen(false);
        setSidebarOpen(false);
        setPricingOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authToken) return;
    fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem("rockgpt-token");
        setAuthToken(null);
        setUser(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notify = (text) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 2200);
  };

  const handleAuthSubmit = async () => {
    setAuthError("");
    if (!authEmail.trim() || !authPassword.trim() || (authMode === "signup" && !authName.trim())) {
      setAuthError("Please fill in all fields.");
      return;
    }
    setAuthLoading(true);
    try {
      const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body =
        authMode === "signup"
          ? { name: authName.trim(), email: authEmail.trim(), password: authPassword }
          : { email: authEmail.trim(), password: authPassword };

      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error || "Something went wrong.");
        setAuthLoading(false);
        return;
      }

      localStorage.setItem("rockgpt-token", data.token);
      setAuthToken(data.token);
      setUser(data.user);
      setAuthModalOpen(false);
      setGateOpen(false);
      setGateLocked(false);
      setAuthName("");
      setAuthEmail("");
      setAuthPassword("");
      notify(`Welcome${authMode === "signup" ? "" : " back"}, ${data.user.name}!`);
    } catch (err) {
      setAuthError("Couldn't reach the server. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("rockgpt-token");
    setAuthToken(null);
    setUser(null);
    notify("Logged out");
  };

  const continueAsGuest = () => {
    setGateOpen(false);
  };

  const newChat = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setInput("");
    setStreaming("");
    setTyping(false);
    setAttachment(null);
    setSidebarOpen(false);
    inputRef.current?.focus();
  }, []);

  const selectConversation = (id) => {
    const c = conversations.find((x) => x.id === id);
    if (!c) return;
    setActiveId(id);
    setMessages(c.messages.map((m) => ({ ...m, createdAt: new Date(m.createdAt) })));
    setSidebarOpen(false);
  };

  const createConversationIfNeeded = (firstMessage) => {
    let id = activeId;
    if (!id) {
      id = uid("chat");
      const c = {
        id,
        title: (typeof firstMessage.content === "string" ? firstMessage.content : "Image message").slice(0, 50) || "New chat",
        messages: [firstMessage],
        updatedAt: new Date(),
      };
      setConversations((prev) => [c, ...prev]);
      setActiveId(id);
    } else {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, messages: [...c.messages, firstMessage], updatedAt: new Date() } : c))
      );
    }
    return id;
  };

  const streamFromBackend = async (history, convId) => {
    setStreaming("");
    setThinkingLabel("RockGPT is thinking");
    const t1 = setTimeout(() => setThinkingLabel("Still working on it..."), 4000);
    const t2 = setTimeout(() => setThinkingLabel("This one's a bit tricky, hang tight..."), 9000);

    let fullText = "";
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ messages: history, fast: fastMode }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        fullText = errData.error || "RockGPT couldn't process that request.";
        setStreaming(fullText);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const parsed = JSON.parse(line.replace("data: ", ""));
          if (parsed.token) {
            fullText += parsed.token;
            setStreaming(fullText);
          }
          if (parsed.error) {
            fullText = parsed.error;
            setStreaming(fullText);
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        fullText = "Failed to reach RockGPT backend. Please try again.";
        setStreaming(fullText);
      }
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      const m = { id: uid("msg"), role: "assistant", content: fullText, createdAt: new Date(), liked: null };
      setStreaming("");
      setTyping(false);
      setMessages((prev) => [...prev, m]);
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, messages: [...c.messages, m], updatedAt: new Date() } : c))
      );
      abortRef.current = null;
    }
  };

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if ((!text && !attachment) || typing) return;

    let backendContent = text;
    let displayAttachment = null;

    if (attachment?.kind === "image") {
      backendContent = [
        { type: "text", text: text || "Please describe and analyze this image." },
        { type: "image_url", image_url: { url: attachment.dataUrl } },
      ];
      displayAttachment = { name: attachment.name, dataUrl: attachment.dataUrl, kind: "image" };
    } else if (attachment?.kind === "doc") {
      backendContent = `${text ? text + "\n\n" : ""}[Attached file: ${attachment.name}]\n${attachment.textContent}`;
      displayAttachment = { name: attachment.name, kind: "doc" };
    }

    const userMsg = {
      id: uid("msg"),
      role: "user",
      content: backendContent,
      displayText: text,
      attachment: displayAttachment,
      createdAt: new Date(),
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setAttachment(null);
    if (inputRef.current) inputRef.current.style.height = "auto";
    setTyping(true);

    const convId = createConversationIfNeeded(userMsg);
    const history = updatedMessages.map((m) => ({ role: m.role, content: m.content }));
    streamFromBackend(history, convId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, typing, activeId, messages, attachment]);

  const stopGeneration = () => {
    abortRef.current?.abort();
    setTyping(false);
    notify("Generation stopped");
  };

  const copyMessage = async (m) => {
    const text = typeof m.content === "string" ? m.content : m.displayText || "";
    await navigator.clipboard.writeText(text);
    setCopied(m.id);
    setTimeout(() => setCopied(null), 1500);
  };

  const regenerate = () => {
    if (typing || !messages.length) return;
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (!last) return;
    const filtered = messages.filter((m) => m.id !== last.id);
    setMessages(filtered);
    setTyping(true);
    if (activeId) {
      const history = filtered.map((m) => ({ role: m.role, content: m.content }));
      streamFromBackend(history, activeId);
    }
  };

  const deleteChat = (id) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) newChat();
  };

  const renameChat = (id, title) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    setEditing(null);
  };

  const exportChat = () => {
    const body = messages
      .map((m) => `${m.role === "user" ? "You" : "RockGPT"}\n${typeof m.content === "string" ? m.content : m.displayText || "(image)"}`)
      .join("\n\n---\n\n");
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rockgpt-chat.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      notify("Voice input isn't supported in this browser — try Chrome");
      return;
    }
    if (recording) {
      recognitionRef.current.stop();
      setRecording(false);
    } else {
      recognitionRef.current.start();
      setRecording(true);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setAttachment({ kind: "image", name: file.name, dataUrl: reader.result });
      reader.readAsDataURL(file);
    } else if (file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
      const reader = new FileReader();
      reader.onload = () => setAttachment({ kind: "doc", name: file.name, textContent: reader.result.slice(0, 8000) });
      reader.readAsText(file);
    } else {
      notify("Supported: images, .txt, and .md files for now");
    }
    e.target.value = "";
  };

  const filtered = useMemo(
    () => conversations.filter((c) => c.title.toLowerCase().includes(search.toLowerCase())),
    [conversations, search]
  );

  const surface = dark ? "#0b0b0b" : "#ffffff";
  const panel = dark ? "#101010" : "#f7f7f7";
  const border = dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.10)";
  const textColor = dark ? "#ffffff" : "#111111";
  const muted = dark ? "rgba(255,255,255,.48)" : "rgba(0,0,0,.52)";

  if (showIntro) {
    return <IntroScreen onDone={() => setShowIntro(false)} />;
  }

  return (
    <div className="relative flex h-[100dvh] min-h-screen w-full overflow-hidden font-sans" style={{ background: surface, color: textColor }}>
      <style>{`
        html, body, #root { height: 100%; margin: 0; padding: 0; background: ${surface}; }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        textarea::-webkit-scrollbar { width: 0; }
        .thin::-webkit-scrollbar { width: 5px; }
        .thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 20px; }
        .fade { animation: fade .25s ease-out both; }
        .fade-out { animation: fadeOut .4s ease-in both; }
        .rise { animation: rise .25s cubic-bezier(.2,.8,.2,1) both; }
        .pop { animation: pop .3s cubic-bezier(.2,.9,.3,1.2) both; }
        @keyframes fade { from {opacity:0} to {opacity:1} }
        @keyframes fadeOut { from {opacity:1} to {opacity:0; visibility:hidden} }
        @keyframes rise { from {opacity:0; transform:translateY(8px)} to {opacity:1; transform:translateY(0)} }
        @keyframes pop { from {opacity:0; transform:scale(.94) translateY(6px)} to {opacity:1; transform:scale(1) translateY(0)} }
        @keyframes blink { 50% { opacity:.35 } }
        .cursor-blink { animation: blink 1s step-end infinite; }
        @keyframes dotBounce { 0%, 60%, 100% { transform: translateY(0); opacity:.4 } 30% { transform: translateY(-5px); opacity:1 } }
        .dot-bounce { animation: dotBounce 1.1s ease-in-out infinite; }
        @media (max-width: 640px) {
          .chat-bubble { max-width: 88% !important; }
        }
      `}</style>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 fade" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 h-full w-[85vw] max-w-[300px] shrink-0 overflow-hidden transition-transform duration-300 sm:w-[280px] ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: panel, borderRight: `1px solid ${border}` }}
      >
        <div className="flex h-full w-full flex-col">
          <div className="flex items-center gap-2 p-3">
            <button onClick={newChat} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/[.05]">
              <RockMark />
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold">RockGPT</div>
                <div className="text-[11px]" style={{ color: muted }}>AI workspace</div>
              </div>
            </button>
            <button onClick={newChat} title="New chat" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-white/[.06]">
              <Plus size={18} />
            </button>
          </div>

          <div className="px-3 pb-2">
            <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: border }}>
              <Search size={14} style={{ color: muted }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          <div className="thin flex-1 overflow-y-auto px-2">
            <div className="mb-2 px-3 pt-2 text-[10px] font-semibold uppercase tracking-[.16em]" style={{ color: muted }}>Chats</div>
            {filtered.length === 0 && <div className="px-3 py-10 text-center text-xs" style={{ color: muted }}>No chats yet</div>}
            {filtered.map((c) => (
              <div
                key={c.id}
                onClick={() => selectConversation(c.id)}
                className={`group relative mb-1 flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 ${activeId === c.id ? "bg-white/[.08]" : "hover:bg-white/[.045]"}`}
              >
                <div className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: activeId === c.id ? "#fff" : "rgba(255,255,255,.25)" }} />
                {editing === c.id ? (
                  <input
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={() => renameChat(c.id, editText)}
                    onKeyDown={(e) => { if (e.key === "Enter") renameChat(c.id, editText); }}
                    className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-[13px]">{c.title}</span>
                )}
                <button onClick={(e) => { e.stopPropagation(); setEditing(c.id); setEditText(c.title); }} className="hidden shrink-0 rounded-md p-1 group-hover:block hover:bg-white/[.08]">
                  <Edit3 size={12} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); deleteChat(c.id); }} className="hidden shrink-0 rounded-md p-1 text-red-400 group-hover:block hover:bg-red-500/10">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t p-2" style={{ borderColor: border }}>
            <button onClick={() => setPricingOpen(true)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-white/[.05]">
              <Crown size={16} className="text-yellow-400" /> <span className="flex-1 text-left">Upgrade plan</span>
            </button>
            <button onClick={() => setSettingsOpen(true)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-white/[.05]" style={{ color: muted }}>
              <Settings size={16} /> Settings
            </button>
            <button
              onClick={() => (user ? logout() : setAuthModalOpen(true))}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-white/[.05]"
            >
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border" style={{ borderColor: border }}><User size={13} /></div>
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-xs font-medium">{user ? user.name : "Sign in"}</div>
                <div className="text-[10px]" style={{ color: muted }}>{user ? `${user.plan} plan · Log out` : "Guest mode"}</div>
              </div>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[56px] shrink-0 items-center justify-between border-b px-3" style={{ borderColor: border, background: dark ? "rgba(11,11,11,.9)" : "rgba(255,255,255,.9)" }}>
          <div className="flex min-w-0 items-center gap-1">
            <button onClick={() => setSidebarOpen(true)} title="Open sidebar (Ctrl+B)" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-white/[.06]">
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-2 px-2">
              <RockMark small />
              <span className="truncate text-sm font-semibold">RockGPT</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {activeId && (
              <button onClick={exportChat} title="Export" className="hidden h-9 w-9 place-items-center rounded-lg hover:bg-white/[.06] sm:grid"><Download size={16} /></button>
            )}
            <button onClick={() => setSettingsOpen(true)} title="Settings" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/[.06]"><Settings size={17} /></button>
          </div>
        </header>

        <section className="thin flex-1 overflow-y-auto">
          {messages.length === 0 && !typing ? (
            <div className="mx-auto flex min-h-full max-w-[900px] flex-col items-center justify-center px-4 py-10">
              <div className="mb-5 fade" style={{ animationDelay: "0.1s" }}><RockMark /></div>
              <h1 className="rise text-center text-2xl font-semibold tracking-tight sm:text-3xl md:text-[38px]" style={{ animationDelay: "0.15s" }}>How can I help you today?</h1>
              <p className="rise mt-3 max-w-xl px-2 text-center text-sm leading-6" style={{ color: muted, animationDelay: "0.25s" }}>
                Ask questions, write code, brainstorm ideas, attach an image or document, or just talk it out.
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-[820px] px-3 py-6 sm:px-6 sm:py-8">
              {messages.map((m, i) => (
                <div key={m.id} className="rise mb-6 sm:mb-8">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium">
                    {m.role === "assistant" ? <RockMark small /> : <div className="grid h-7 w-7 place-items-center rounded-full border" style={{ borderColor: border }}><User size={13} /></div>}
                    <span>{m.role === "assistant" ? "RockGPT" : "You"}</span>
                    <span className="text-[10px]" style={{ color: muted }}>{formatTime(m.createdAt)}</span>
                  </div>

                  {editing === m.id ? (
                    <div className="rounded-2xl border p-3" style={{ borderColor: border }}>
                      <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="min-h-[100px] w-full resize-none bg-transparent text-sm leading-6 outline-none" />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditing(null)} className="rounded-lg px-3 py-1.5 text-xs" style={{ color: muted }}>Cancel</button>
                        <button
                          onClick={() => { setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, content: editText, displayText: editText } : x))); setEditing(null); }}
                          className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black"
                        >Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className={m.role === "user" ? "chat-bubble ml-0 max-w-[92%] rounded-2xl border bg-white/[.04] p-3.5 sm:p-4 sm:ml-9" : "ml-0 sm:ml-9"}>
                      {m.attachment?.kind === "image" && (
                        <img src={m.attachment.dataUrl} alt={m.attachment.name} className="mb-2 max-h-56 rounded-xl border" style={{ borderColor: border }} />
                      )}
                      {m.attachment?.kind === "doc" && (
                        <div className="mb-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: border, color: muted }}>
                          📄 {m.attachment.name}
                        </div>
                      )}
                      {m.role === "assistant" ? (
                        <MessageContent content={m.content} />
                      ) : (
                        <p className="whitespace-pre-wrap text-[15px] leading-7">{m.displayText || (typeof m.content === "string" ? m.content : "")}</p>
                      )}
                    </div>
                  )}

                  <div className="ml-9 mt-2 flex items-center gap-0.5">
                    <button onClick={() => copyMessage(m)} className="rounded-lg p-2 text-xs hover:bg-white/[.06]" style={{ color: muted }} title="Copy">
                      {copied === m.id ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                    {m.role === "user" && (
                      <button onClick={() => { setEditing(m.id); setEditText(m.displayText || ""); }} className="rounded-lg p-2 hover:bg-white/[.06]" style={{ color: muted }} title="Edit">
                        <Edit3 size={13} />
                      </button>
                    )}
                    {m.role === "assistant" && (
                      <>
                        <button onClick={() => setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, liked: x.liked === true ? null : true } : x)))} className="rounded-lg p-2 hover:bg-white/[.06]" style={{ color: m.liked === true ? "white" : muted }}>
                          <ThumbsUp size={13} />
                        </button>
                        <button onClick={() => setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, liked: x.liked === false ? null : false } : x)))} className="rounded-lg p-2 hover:bg-white/[.06]" style={{ color: m.liked === false ? "white" : muted }}>
                          <ThumbsDown size={13} />
                        </button>
                        {i === messages.length - 1 && (
                          <button onClick={regenerate} className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs hover:bg-white/[.06]" style={{ color: muted }}>
                            <RefreshCcw size={13} /> Regenerate
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}

              {typing && (
                <div className="rise mb-8 flex gap-3">
                  <RockMark small />
                  <div className="min-w-0 flex-1 pt-1">
                    {streaming ? (
                      <div className="text-[15px] leading-7 text-white/80">
                        <MessageContent content={streaming} />
                        <span className="cursor-blink ml-1 inline-block h-4 w-0.5 bg-white align-middle" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 pt-1 text-sm" style={{ color: muted }}>
                        <span>{thinkingLabel}</span>
                        <span className="flex items-end gap-1">
                          <i className="dot-bounce h-1.5 w-1.5 rounded-full bg-white" style={{ animationDelay: "0s" }} />
                          <i className="dot-bounce h-1.5 w-1.5 rounded-full bg-white" style={{ animationDelay: "0.15s" }} />
                          <i className="dot-bounce h-1.5 w-1.5 rounded-full bg-white" style={{ animationDelay: "0.3s" }} />
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </section>

        <div className="shrink-0 px-2 pb-3 pt-2 sm:px-4" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto max-w-[820px]">
            {attachment && (
              <div className="mb-2 flex items-center gap-2 rounded-xl border p-2" style={{ borderColor: border }}>
                {attachment.kind === "image" ? (
                  <img src={attachment.dataUrl} alt={attachment.name} className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-lg border text-lg" style={{ borderColor: border }}>📄</div>
                )}
                <span className="flex-1 truncate text-xs" style={{ color: muted }}>{attachment.name}</span>
                <button onClick={() => setAttachment(null)} className="rounded-md p-1 hover:bg-white/[.08]"><X size={14} /></button>
              </div>
            )}
            <div className="relative rounded-[20px] border p-2 shadow-lg sm:rounded-[22px]" style={{ borderColor: border, background: dark ? "#101010" : "#fafafa" }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(160, e.target.scrollHeight) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                rows={1}
                placeholder="Message RockGPT..."
                className="w-full resize-none bg-transparent px-2.5 pb-11 pt-1.5 text-[15px] leading-6 outline-none placeholder:text-white/25 sm:px-3 sm:pt-2"
                style={{ minHeight: 46, maxHeight: 160 }}
              />

              <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between sm:bottom-2 sm:left-2 sm:right-2">
                <div className="flex items-center gap-0.5">
                  <input ref={fileRef} type="file" accept="image/*,.txt,.md" className="hidden" onChange={handleFileSelect} />
                  <div className="relative">
                    <button onClick={() => setAttachMenuOpen((v) => !v)} title="Attach files or photos" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/[.06]" style={{ color: muted }}>
                      <Plus size={18} />
                    </button>
                    {attachMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setAttachMenuOpen(false)} />
                        <div className="absolute bottom-11 left-0 z-40 w-60 rounded-2xl border p-1.5 shadow-2xl pop" style={{ background: dark ? "#151515" : "#fff", borderColor: border }}>
                          <button
                            onClick={() => { fileRef.current?.click(); setAttachMenuOpen(false); }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/[.06]"
                          >
                            <Paperclip size={16} /> <span className="flex-1">Add photo or file</span>
                          </button>
                          <button
                            onClick={() => { setWebSearchOn((v) => !v); notify("Web search is coming soon"); setAttachMenuOpen(false); }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/[.06]"
                          >
                            <Globe size={16} /> <span className="flex-1">Web search</span>
                            <span className="rounded-full px-1.5 py-0.5 text-[9px]" style={{ color: muted, border: `1px solid ${border}` }}>Soon</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => setFastMode((v) => !v)}
                    title={fastMode ? "Fast mode on" : "Turn on fast mode for shorter, quicker replies"}
                    className={`hidden h-9 w-9 place-items-center rounded-xl hover:bg-white/[.06] sm:grid ${fastMode ? "bg-white text-black" : ""}`}
                    style={{ color: fastMode ? "#000" : muted }}
                  >
                    <Gauge size={17} />
                  </button>
                  <button
                    onClick={toggleRecording}
                    title="Voice input"
                    className={`grid h-9 w-9 place-items-center rounded-xl hover:bg-white/[.06] ${recording ? "bg-white text-black" : ""}`}
                    style={{ color: recording ? "#000" : muted }}
                  >
                    <Mic size={17} />
                  </button>
                </div>

                {typing ? (
                  <button onClick={stopGeneration} className="grid h-9 w-9 place-items-center rounded-xl bg-white text-black transition hover:scale-105" title="Stop generating">
                    <Square size={14} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    disabled={!input.trim() && !attachment}
                    onClick={sendMessage}
                    className={`grid h-9 w-9 place-items-center rounded-xl transition ${input.trim() || attachment ? "bg-white text-black hover:scale-105" : "bg-white/[.07] text-white/20"}`}
                    title="Send"
                  >
                    <ArrowUp size={18} />
                  </button>
                )}
              </div>
            </div>
            <div className="hidden items-center justify-center gap-2 py-2 text-[10px] sm:flex" style={{ color: muted }}>
              <span>RockGPT may make mistakes. Consider checking important information.</span>
            </div>
          </div>
        </div>
      </main>

      {/* Guest / auth gate */}
      {gateOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 fade">
          <div className="pop w-full max-w-[380px] rounded-2xl border p-5 shadow-2xl" style={{ background: dark ? "#151515" : "#fff", borderColor: border }}>
            <div className="mb-4 flex flex-col items-center text-center">
              <RockMark />
              <h2 className="mt-3 text-lg font-semibold">
                {gateLocked ? "Let's keep your workspace" : "Welcome to RockGPT"}
              </h2>
              <p className="mt-1.5 text-xs leading-5" style={{ color: muted }}>
                {gateLocked
                  ? "You've been chatting as a guest — sign in or create a free account to keep going."
                  : "Sign in to save your chats across devices, or continue as a guest."}
              </p>
            </div>

            {authMode === "signup" && (
              <input
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                placeholder="Name"
                className="mb-2 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: border, background: "transparent" }}
              />
            )}
            <input
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="Email"
              type="email"
              className="mb-2 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: border, background: "transparent" }}
            />
            <input
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="Password"
              type="password"
              onKeyDown={(e) => { if (e.key === "Enter") handleAuthSubmit(); }}
              className="mb-3 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: border, background: "transparent" }}
            />

            {authError && <p className="mb-3 text-xs text-red-400">{authError}</p>}

            <button
              onClick={handleAuthSubmit}
              disabled={authLoading}
              className="mb-2 w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-black disabled:opacity-50"
            >
              {authLoading ? "Please wait..." : authMode === "signup" ? "Sign up" : "Log in"}
            </button>

            <p className="mb-2 text-center text-xs" style={{ color: muted }}>
              {authMode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                onClick={() => { setAuthMode(authMode === "signup" ? "login" : "signup"); setAuthError(""); }}
                className="font-medium text-white underline"
              >
                {authMode === "signup" ? "Log in" : "Sign up"}
              </button>
            </p>

            {!gateLocked && (
              <button onClick={continueAsGuest} className="w-full rounded-xl px-4 py-2 text-xs" style={{ color: muted }}>
                Continue as guest
              </button>
            )}
          </div>
        </div>
      )}

      {/* Standalone login modal (from sidebar "Sign in") */}
      {authModalOpen && !gateOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 fade" onClick={() => setAuthModalOpen(false)}>
          <div className="pop w-full max-w-[380px] rounded-2xl border p-5 shadow-2xl" style={{ background: dark ? "#151515" : "#fff", borderColor: border }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{authMode === "signup" ? "Create your account" : "Welcome back"}</h2>
              <button onClick={() => setAuthModalOpen(false)}><X size={18} style={{ color: muted }} /></button>
            </div>
            {authMode === "signup" && (
              <input value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="Name" className="mb-2 w-full rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ borderColor: border, background: "transparent" }} />
            )}
            <input value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Email" type="email" className="mb-2 w-full rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ borderColor: border, background: "transparent" }} />
            <input value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="Password" type="password" onKeyDown={(e) => { if (e.key === "Enter") handleAuthSubmit(); }} className="mb-3 w-full rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ borderColor: border, background: "transparent" }} />
            {authError && <p className="mb-3 text-xs text-red-400">{authError}</p>}
            <button onClick={handleAuthSubmit} disabled={authLoading} className="mb-3 w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-black disabled:opacity-50">
              {authLoading ? "Please wait..." : authMode === "signup" ? "Sign up" : "Log in"}
            </button>
            <p className="text-center text-xs" style={{ color: muted }}>
              {authMode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
              <button onClick={() => { setAuthMode(authMode === "signup" ? "login" : "signup"); setAuthError(""); }} className="font-medium text-white underline">
                {authMode === "signup" ? "Log in" : "Sign up"}
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Pricing modal */}
      {pricingOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 fade" onClick={() => setPricingOpen(false)}>
          <div className="pop w-full max-w-[720px] rounded-2xl border p-5 shadow-2xl sm:p-6" style={{ background: dark ? "#151515" : "#fff", borderColor: border }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Upgrade RockGPT</h2>
                <p className="text-xs" style={{ color: muted }}>Pick the plan that fits how you use RockGPT.</p>
              </div>
              <button onClick={() => setPricingOpen(false)}><X size={18} style={{ color: muted }} /></button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className="flex flex-col rounded-2xl border p-4"
                  style={{ borderColor: plan.highlight ? "#fff" : border, background: plan.highlight ? "rgba(255,255,255,.04)" : "transparent" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{plan.name}</span>
                    {plan.highlight && <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-semibold text-black">Popular</span>}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-bold">{plan.price}</span>
                    <span className="text-xs" style={{ color: muted }}>{plan.period}</span>
                  </div>
                  <ul className="mt-3 flex-1 space-y-1.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs" style={{ color: muted }}>
                        <Check size={12} className="mt-0.5 shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => (plan.name === "Free" ? notify("You're already on Free") : setPayingPlan(plan))}
                    className={`mt-4 w-full rounded-xl py-2 text-xs font-semibold ${plan.highlight ? "bg-white text-black" : "border"}`}
                    style={!plan.highlight ? { borderColor: border } : {}}
                  >
                    {plan.name === "Free" ? "Current plan" : "Upgrade"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* UPI payment modal */}
      {payingPlan && (
        <div className="fixed inset-0 z-[75] grid place-items-center bg-black/70 p-4 fade" onClick={() => setPayingPlan(null)}>
          <div className="pop w-full max-w-[360px] rounded-2xl border p-5 shadow-2xl text-center" style={{ background: dark ? "#151515" : "#fff", borderColor: border }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between text-left">
              <div>
                <h2 className="text-lg font-semibold">Upgrade to {payingPlan.name}</h2>
                <p className="text-xs" style={{ color: muted }}>{payingPlan.price}{payingPlan.period}</p>
              </div>
              <button onClick={() => setPayingPlan(null)}><X size={18} style={{ color: muted }} /></button>
            </div>
            <img src="/upi-qr.png" alt="Scan to pay with UPI" className="mx-auto w-full max-w-[220px] rounded-xl border" style={{ borderColor: border }} />
            <p className="mt-3 text-xs" style={{ color: muted }}>Scan with any UPI app, or pay to:</p>
            <div className="mt-1.5 flex items-center justify-center gap-2">
              <code className="rounded-md bg-white/[.06] px-2 py-1 text-xs">mansurisumaan-2@okhdfcbank</code>
              <button
                onClick={() => { navigator.clipboard.writeText("mansurisumaan-2@okhdfcbank"); notify("UPI ID copied"); }}
                className="rounded-md p-1.5 hover:bg-white/[.08]"
              >
                <Copy size={13} />
              </button>
            </div>
            <p className="mt-4 text-[11px] leading-5" style={{ color: muted }}>
              After paying, message Rock with your payment screenshot and account email to activate your {payingPlan.name} plan — it's currently activated manually.
            </p>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 fade" onClick={() => setSettingsOpen(false)}>
          <div className="pop w-full max-w-[420px] rounded-2xl border p-5 shadow-2xl" style={{ background: dark ? "#151515" : "#fff", borderColor: border }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Settings</h2>
                <p className="text-xs" style={{ color: muted }}>Customize your RockGPT workspace.</p>
              </div>
              <button onClick={() => setSettingsOpen(false)}><X size={18} style={{ color: muted }} /></button>
            </div>
            <div className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: border }}>
              {dark ? <Moon size={17} /> : <Sun size={17} />}
              <div className="flex-1">
                <div className="text-sm font-medium">Appearance</div>
                <div className="text-xs" style={{ color: muted }}>Dark / light interface</div>
              </div>
              <button onClick={() => setTheme(dark ? "light" : "dark")} className="rounded-lg border px-3 py-1.5 text-xs" style={{ borderColor: border }}>
                {dark ? "Light" : "Dark"}
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="fixed bottom-20 left-1/2 z-[90] -translate-x-1/2 rounded-full border bg-black px-4 py-2 text-xs text-white shadow-2xl fade" style={{ borderColor: "rgba(255,255,255,.14)" }}>
          {notice}
        </div>
      )}
    </div>
  );
}