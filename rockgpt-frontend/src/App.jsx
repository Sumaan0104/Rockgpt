import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  ArrowUp, Check, ChevronDown, Copy, Download, Edit3, Menu, Mic,
  Plus, Search, Settings, User, X, Zap, Brain, Paperclip,
  Moon, Sun, RefreshCcw, Square, ThumbsDown, ThumbsUp, Trash2,
  Sparkles, Globe, Gauge, Loader2, Crown, ExternalLink, ShieldCheck,
  Smartphone, QrCode, ArrowRight, CheckCircle2, AlertCircle, ChevronRight,
  Lock, Volume2, VolumeX, Pin, Share2, Compass, Code2, BookOpen, PenTool,
  Shield, KeyRound, Mail, ArrowLeft, LogOut, MoreHorizontal, UserCheck
} from "lucide-react";

const BACKEND_URL = "https://rockgpt.onrender.com";
const UPI_ID = "mansurisumaan-2@okhdfcbank";
const PAYEE_NAME = "RockGPT";

const PLANS = [
  {
    id: "free",
    name: "Free",
    badge: "Basic",
    priceMonthly: 0,
    priceYearly: 0,
    period: "/forever",
    description: "Great for everyday questions, brainstorming, and trying RockGPT.",
    features: [
      "Access to RockGPT Flash model",
      "50 messages per day",
      "Standard response speed",
      "Image & document file uploads",
      "Cross-device chat history",
    ],
    highlight: false,
  },
  {
    id: "plus",
    name: "Plus",
    badge: "Most Popular",
    priceMonthly: 149,
    priceYearly: 119, // 20% off
    period: "/month",
    description: "Unlocks RockGPT 4o, priority speeds, and higher limits.",
    features: [
      "Access to RockGPT 4o (Advanced Reasoning)",
      "500 messages per day",
      "2.5x faster priority speed",
      "Fast Mode always available",
      "Early access to new experimental features",
      "Extended 32k context memory",
    ],
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    badge: "Ultimate Power",
    priceMonthly: 399,
    priceYearly: 319, // 20% off
    period: "/month",
    description: "Uncapped performance for professionals, businesses, and heavy workflows.",
    features: [
      "Unlimited access to RockGPT 4o & Flash",
      "Maximum reasoning compute & speed",
      "Highest upload limit (25MB+ files)",
      "Dedicated high-throughput VIP queue",
      "Everything in Plus included",
      "24/7 priority customer support",
    ],
    highlight: false,
  },
];

const CATEGORIES = [
  { id: "all", label: "All", icon: Compass },
  { id: "code", label: "Coding", icon: Code2 },
  { id: "write", label: "Writing", icon: PenTool },
  { id: "learn", label: "Learn", icon: BookOpen },
];

const PROMPT_SUGGESTIONS = {
  all: [
    { title: "React State Management", desc: "Compare Zustand, Redux Toolkit, and Context API", prompt: "Explain the differences between Zustand, Redux Toolkit, and React Context API with code examples and best use-cases." },
    { title: "Quantum Computing", desc: "Explain the fundamentals simply", prompt: "Explain quantum computing and qubits to a high school student with intuitive analogies." },
    { title: "Professional Cold Email", desc: "Write a high-converting outreach email", prompt: "Draft a concise, compelling cold outreach email to a tech recruiter highlighting full-stack engineering skills." },
    { title: "Debug Performance", desc: "Analyze slow website rendering", prompt: "What are the top 5 frontend performance optimization strategies for high Lighthouse scores?" },
  ],
  code: [
    { title: "Write a Custom Hook", desc: "Create a debounce hook in React", prompt: "Write a complete production-grade useDebounce hook in React TypeScript with clean comments." },
    { title: "REST vs GraphQL", desc: "Key architectural differences", prompt: "Create a pros and cons comparison table between REST and GraphQL with example queries." },
  ],
  write: [
    { title: "LinkedIn Thought Leadership", desc: "Post about AI in software engineering", prompt: "Write an engaging LinkedIn post about how AI agents are transforming pair programming in 2026." },
    { title: "Product Launch Announcement", desc: "Engaging copy for product release", prompt: "Write an exciting launch announcement email for a new AI workspace product." },
  ],
  learn: [
    { title: "Explain Docker Containers", desc: "From virtual machines to containers", prompt: "Explain Docker containers, images, and layers step-by-step for a beginner." },
    { title: "Financial Concepts", desc: "Compound interest & portfolio allocation", prompt: "Explain compound interest and the 50/30/20 budget rule clearly." },
  ],
};

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

function Inline({ text, dark }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return (
            <strong key={i} className={`font-semibold ${dark ? "text-white" : "text-neutral-900"}`}>
              {p.slice(2, -2)}
            </strong>
          );
        }
        if (p.startsWith("`") && p.endsWith("`")) {
          return (
            <code
              key={i}
              className={`rounded-md px-1.5 py-0.5 text-[13px] font-mono ${
                dark ? "bg-white/[.08] text-white/90" : "bg-neutral-200/60 text-neutral-800"
              }`}
            >
              {p.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function MessageContent({ content, dark }) {
  const lines = (content || "").split("\n");
  const output = [];
  let inCode = false;
  let lang = "";
  let codeLines = [];

  const flushCode = () => {
    output.push(
      <div
        key={output.length}
        className={`my-3 overflow-hidden rounded-xl border ${
          dark ? "border-white/10 bg-[#0a0a0a]" : "border-neutral-300/80 bg-neutral-900 text-white shadow-sm"
        }`}
      >
        <div
          className={`flex items-center justify-between border-b px-3 py-1.5 ${
            dark ? "border-white/10 bg-[#121212]" : "border-neutral-800 bg-neutral-950"
          }`}
        >
          <span className="text-[11px] font-mono font-medium text-neutral-400">{lang || "code"}</span>
          <button
            onClick={() => navigator.clipboard.writeText(codeLines.join("\n"))}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-neutral-400 hover:bg-white/[.08] hover:text-white"
          >
            <Copy size={12} /> Copy code
          </button>
        </div>
        <pre className="overflow-x-auto p-3 text-[13px] leading-6 text-neutral-200 font-mono">
          <code>{codeLines.join("\n")}</code>
        </pre>
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
      output.push(
        <h3 key={output.length} className={`mt-3 mb-1 text-base font-bold ${dark ? "text-white" : "text-neutral-900"}`}>
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith("## ")) {
      output.push(
        <h2 key={output.length} className={`mt-4 mb-1 text-lg font-bold ${dark ? "text-white" : "text-neutral-900"}`}>
          {line.slice(3)}
        </h2>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const n = line.match(/^(\d+)/)?.[1];
      output.push(
        <div key={output.length} className="flex gap-2 py-0.5">
          <span className={`w-5 shrink-0 text-right font-medium ${dark ? "text-white/45" : "text-neutral-400"}`}>{n}.</span>
          <span><Inline text={line.replace(/^\d+\.\s+/, "")} dark={dark} /></span>
        </div>
      );
    } else if (line.startsWith("- ")) {
      output.push(
        <div key={output.length} className="flex gap-2 py-0.5">
          <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dark ? "bg-white/50" : "bg-neutral-500"}`} />
          <span><Inline text={line.slice(2)} dark={dark} /></span>
        </div>
      );
    } else {
      output.push(
        <p key={output.length} className={`leading-7 ${dark ? "text-neutral-200" : "text-neutral-800"}`}>
          <Inline text={line} dark={dark} />
        </p>
      );
    }
  });
  if (inCode) flushCode();

  return <div className="space-y-1 text-[15px]">{output}</div>;
}

function RockMark({ small = false, dark = true }) {
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-[10px] font-black shadow-sm transition-all duration-300 ${
        small ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-sm"
      } ${
        dark
          ? "border border-white/15 bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.15)]"
          : "border border-neutral-300 bg-neutral-900 text-white shadow-sm"
      }`}
    >
      R
    </div>
  );
}

/* =========================================================================
   CINEMATIC INTRO ANIMATION
   ========================================================================= */
function IntroScreen({ onDone }) {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPercent((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(onDone, 300);
          return 100;
        }
        return prev + 5;
      });
    }, 40);
    return () => clearInterval(interval);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#070707] text-white select-none">
      <button
        onClick={onDone}
        className="absolute top-6 right-6 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/50 hover:bg-white/10 hover:text-white"
      >
        Skip ➜
      </button>

      <div className="absolute h-80 w-80 rounded-full bg-gradient-to-tr from-amber-500/15 to-purple-600/15 blur-3xl" />

      <div className="relative mb-6">
        <div className="relative z-10 grid h-20 w-20 place-items-center rounded-3xl bg-white text-3xl font-black text-black shadow-[0_0_60px_rgba(255,255,255,0.25)] transition-all hover:scale-105">
          R
        </div>
        <div className="absolute -inset-2 -z-10 animate-spin rounded-3xl border border-white/20" style={{ animationDuration: "8s" }} />
        <div className="absolute -inset-4 -z-20 animate-pulse rounded-3xl bg-white/5 blur-md" />
      </div>

      <div className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        RockGPT
      </div>
      <p className="mt-2 text-xs font-medium tracking-wider text-white/50 uppercase">
        Next-Generation AI Workspace
      </p>

      <div className="mt-8 w-56">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-white to-purple-400 transition-all duration-100 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-white/40 font-mono">
          <span>Booting system...</span>
          <span>{percent}%</span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   USER PROFILE & LOGOUT POPOVER MENU (CHATGPT & GEMINI STYLE)
   ========================================================================= */
function UserProfileMenu({
  user,
  dark,
  isOpen,
  onClose,
  onLogout,
  onOpenSettings,
  onOpenUpgrade,
  onOpenAuth,
}) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} />
      <div
        className={`absolute bottom-16 left-3 z-50 w-64 rounded-2xl border p-2 shadow-2xl pop ${
          dark ? "border-white/15 bg-[#161616] text-white" : "border-neutral-200 bg-white text-neutral-900 shadow-xl"
        }`}
      >
        {user ? (
          <div>
            <div className="flex items-center gap-2.5 border-b pb-3 px-2 pt-1" style={{ borderColor: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-amber-500 to-purple-600 font-bold text-white shadow-sm">
                {user.name ? user.name.slice(0, 1).toUpperCase() : "U"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold">{user.name}</div>
                <div className="truncate text-[10px] text-neutral-400">{user.email}</div>
                <div className="mt-1 flex items-center gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                    user.plan === "Plus" || user.plan === "Pro"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-neutral-500/20 text-neutral-400"
                  }`}>
                    {user.plan || "Free"} Plan
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 space-y-0.5">
              <button
                onClick={() => {
                  onClose();
                  onOpenUpgrade();
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition ${
                  dark ? "hover:bg-white/[0.08]" : "hover:bg-neutral-100"
                }`}
              >
                <Crown size={15} className="text-amber-500" />
                <span className="flex-1">Upgrade / Subscription</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition ${
                  dark ? "hover:bg-white/[0.08]" : "hover:bg-neutral-100"
                }`}
              >
                <Settings size={15} className="text-neutral-400" />
                <span className="flex-1">Settings</span>
              </button>

              <div className="my-1 border-t" style={{ borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }} />

              {/* DIRECT LOGOUT BUTTON */}
              <button
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-red-500 hover:bg-red-500/10 transition"
              >
                <LogOut size={15} />
                <span className="flex-1">Log out of RockGPT</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-2 text-center">
            <div className="mb-2 text-xs font-semibold">Guest Mode</div>
            <p className="mb-3 text-[11px] text-neutral-400">Sign in to save chat history and unlock models.</p>
            <button
              onClick={() => {
                onClose();
                onOpenAuth();
              }}
              className="w-full rounded-xl bg-white py-2 text-xs font-bold text-black hover:bg-neutral-200 transition"
            >
              Sign in / Register
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/* =========================================================================
   AUTHENTICATION & SECURE 6-DIGIT OTP VERIFICATION MODAL
   ========================================================================= */
function AuthModal({
  isOpen,
  onClose,
  dark,
  notify,
  onSuccess,
  isGateLocked = false,
  allowGuest = true,
}) {
  const [authMode, setAuthMode] = useState("login");
  const [step, setStep] = useState("credentials");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpTimer, setOtpTimer] = useState(45);
  const [resendActive, setResendActive] = useState(false);
  const [otpShake, setOtpShake] = useState(false);
  const otpInputsRef = useRef([]);

  useEffect(() => {
    let interval = null;
    if (step === "otp" && otpTimer > 0) {
      interval = setInterval(() => setOtpTimer((t) => t - 1), 1000);
    } else if (otpTimer === 0) {
      setResendActive(true);
    }
    return () => clearInterval(interval);
  }, [step, otpTimer]);

  if (!isOpen) return null;

  const handleOtpChange = (index, val) => {
    if (!/^\d*$/.test(val)) return;
    const newDigits = [...otpDigits];

    if (val.length > 1) {
      const pasted = val.slice(0, 6).split("");
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || "";
      }
      setOtpDigits(newDigits);
      const nextFocus = Math.min(pasted.length, 5);
      otpInputsRef.current[nextFocus]?.focus();
      return;
    }

    newDigits[index] = val.slice(-1);
    setOtpDigits(newDigits);

    if (val && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  // Password strength validation
  const passwordChecks = {
    length: password.length >= 8,
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  };
  const isPasswordStrong = passwordChecks.length && passwordChecks.special && passwordChecks.uppercase && passwordChecks.number;

  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim() || (authMode === "signup" && !name.trim())) {
      setError("Please fill in all required fields.");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      setError("Please provide a valid email address.");
      return;
    }

    // Enforce strong password on signup
    if (authMode === "signup" && !isPasswordStrong) {
      setError("Password must be 8+ characters with uppercase, number, and special character.");
      return;
    }

    // Enforce minimum length on login too
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, mode: authMode }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || "Unable to send verification code.");
        return;
      }

      // SECURITY: The OTP is generated, stored, and sent by the backend.
      // Never generate, store, display, or validate the OTP in the frontend.
      setStep("otp");
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpTimer(45);
      setResendActive(false);

      notify("🔐 Verification code sent to your email.");
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 150);
    } catch (err) {
      console.error(err);
      setError("Unable to connect to the authentication server.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!resendActive || loading) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, mode: authMode }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || "Failed to resend verification code.");
        return;
      }

      setOtpDigits(["", "", "", "", "", ""]);
      setOtpTimer(45);
      setResendActive(false);
      notify("New verification code sent.");

      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
    } catch (err) {
      console.error(err);
      setError("Unable to resend verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setError("");
    const enteredOtp = otpDigits.join("");

    if (!/^\d{6}$/.test(enteredOtp)) {
      setError("Please enter the complete 6-digit verification code.");
      setOtpShake(true);
      setTimeout(() => setOtpShake(false), 500);
      return;
    }

    setLoading(true);

    try {
      const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body =
        authMode === "signup"
          ? { name: name.trim(), email: email.trim(), password, otp: enteredOtp }
          : { email: email.trim(), password, otp: enteredOtp };

      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      // SECURITY: Authentication succeeds only when the backend verifies
      // the OTP and returns a real authentication token.
      if (!res.ok || !data?.token) {
        setError(data?.error || "Invalid or expired verification code.");
        setOtpShake(true);
        setTimeout(() => setOtpShake(false), 500);
        return;
      }

      localStorage.setItem("rockgpt-token", data.token);
      onSuccess(data.user, data.token);
      notify(`Welcome${authMode === "signup" ? "" : " back"}, ${data.user.name}!`);
      onClose();
    } catch (err) {
      console.error(err);
      setError("Server connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-4 fade backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className={`pop max-h-[88vh] w-full max-w-[400px] overflow-y-auto thin rounded-3xl border p-6 shadow-2xl transition-all duration-300 ${
          dark
            ? "border-white/15 bg-[#141414] text-white"
            : "border-neutral-200 bg-white text-neutral-900"
        } ${otpShake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-6px); }
            40%, 80% { transform: translateX(6px); }
          }
        `}</style>

        <div className="mb-4 flex items-center justify-between">
          {step === "otp" ? (
            <button
              onClick={() => {
                setStep("credentials");
                setError("");
              }}
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white"
            >
              <ArrowLeft size={15} /> Back
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <RockMark small dark={dark} />
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-500">Security Gate</span>
            </div>
          )}

          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {step === "credentials" ? (
          <div>
            <div className="mb-5 text-center">
              <div className="mx-auto mb-2.5 grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-500 shadow-inner">
                <Shield size={24} />
              </div>
              <h2 className="text-lg font-bold tracking-tight">
                {isGateLocked
                  ? "Preserve Your Workspace"
                  : authMode === "signup"
                  ? "Create Your Account"
                  : "Welcome to RockGPT"}
              </h2>
              <p className={`mt-1 text-xs leading-5 ${dark ? "text-neutral-400" : "text-neutral-500"}`}>
                {authMode === "signup"
                  ? "Sign up with email to unlock cloud sync & personal memory."
                  : "Sign in to access your chat history and unlocked models."}
              </p>
            </div>

            <form onSubmit={handleRequestOtp} className="space-y-2.5">
              {authMode === "signup" && (
                <div className="relative">
                  <User size={15} className="absolute left-3 top-3.5 text-neutral-500" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full Name"
                    className={`w-full rounded-xl border py-2.5 pl-9 pr-3 text-xs outline-none transition ${
                      dark
                        ? "border-white/15 bg-white/[0.03] text-white focus:border-white/40"
                        : "border-neutral-300 bg-neutral-50 text-neutral-900 focus:border-neutral-500"
                    }`}
                  />
                </div>
              )}

              <div className="relative">
                <Mail size={15} className="absolute left-3 top-3.5 text-neutral-500" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  type="email"
                  className={`w-full rounded-xl border py-2.5 pl-9 pr-3 text-xs outline-none transition ${
                    dark
                      ? "border-white/15 bg-white/[0.03] text-white focus:border-white/40"
                      : "border-neutral-300 bg-neutral-50 text-neutral-900 focus:border-neutral-500"
                  }`}
                />
              </div>

              <div className="relative">
                <KeyRound size={15} className="absolute left-3 top-3.5 text-neutral-500" />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (min 8 chars)"
                  type="password"
                  className={`w-full rounded-xl border py-2.5 pl-9 pr-3 text-xs outline-none transition ${
                    dark
                      ? "border-white/15 bg-white/[0.03] text-white focus:border-white/40"
                      : "border-neutral-300 bg-neutral-50 text-neutral-900 focus:border-neutral-500"
                  }`}
                />
              </div>

              {/* Password strength indicator — only show during signup when user starts typing */}
              {authMode === "signup" && password.length > 0 && (
                <div className={`rounded-xl border p-2.5 space-y-1 ${dark ? "border-white/10 bg-white/[0.02]" : "border-neutral-200 bg-neutral-50"}`}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.4)" }}>Password Requirements</div>
                  {[
                    { ok: passwordChecks.length, label: "At least 8 characters" },
                    { ok: passwordChecks.uppercase, label: "One uppercase letter (A-Z)" },
                    { ok: passwordChecks.number, label: "One number (0-9)" },
                    { ok: passwordChecks.special, label: "One special character (!@#$...)" },
                  ].map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      {r.ok ? (
                        <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                      ) : (
                        <div className={`h-3 w-3 rounded-full border shrink-0 ${dark ? "border-white/20" : "border-neutral-300"}`} />
                      )}
                      <span className={`text-[11px] ${r.ok ? (dark ? "text-emerald-400" : "text-emerald-600") : (dark ? "text-neutral-500" : "text-neutral-400")}`}>{r.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {error && <p className="text-xs text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition active:scale-[0.98] disabled:opacity-50 ${
                  dark ? "bg-white text-black hover:bg-neutral-200" : "bg-neutral-900 text-white hover:bg-neutral-800"
                }`}
              >
                {loading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 text-center">
              <p className={`text-xs ${dark ? "text-neutral-400" : "text-neutral-500"}`}>
                {authMode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === "signup" ? "login" : "signup");
                    setError("");
                  }}
                  className="font-bold underline underline-offset-2 hover:text-amber-500"
                >
                  {authMode === "signup" ? "Sign In" : "Sign Up"}
                </button>
              </p>

              {allowGuest && !isGateLocked && (
                <button
                  type="button"
                  onClick={onClose}
                  className={`mt-3 w-full rounded-xl py-1.5 text-xs ${
                    dark ? "text-neutral-400 hover:text-white" : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  Continue as guest
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="rise">
            <div className="mb-5 text-center">
              <div className="relative mx-auto mb-2.5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-tr from-amber-500/20 to-yellow-400/20 text-amber-500">
                <ShieldCheck size={28} />
                <div className="absolute -inset-1 -z-10 animate-ping rounded-2xl bg-amber-500/10" style={{ animationDuration: "2s" }} />
              </div>
              <h2 className="text-lg font-bold tracking-tight">Enter Security Code</h2>
              <p className={`mt-1 text-xs leading-5 ${dark ? "text-neutral-400" : "text-neutral-500"}`}>
                Check your inbox! We've sent a 6-digit code to <br />
                <strong className={dark ? "text-white" : "text-neutral-900"}>{email}</strong>
              </p>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {/* 6-DIGIT INPUT BOXES */}
              <div className="flex items-center justify-between gap-1.5">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputsRef.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    autoComplete={idx === 0 ? "one-time-code" : "off"}
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className={`h-12 w-11 rounded-xl border text-center font-mono text-lg font-bold outline-none transition-all ${
                      digit
                        ? dark
                          ? "border-amber-400 bg-amber-400/[0.08] text-white shadow-[0_0_15px_rgba(251,191,36,0.15)]"
                          : "border-amber-500 bg-amber-50 text-neutral-900 shadow-sm"
                        : dark
                        ? "border-white/15 bg-white/[0.03] text-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                        : "border-neutral-300 bg-neutral-50 text-neutral-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    }`}
                  />
                ))}
              </div>

              {error && <p className="text-center text-xs text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading || otpDigits.join("").length < 6}
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50 ${
                  dark ? "bg-white text-black hover:bg-neutral-200" : "bg-neutral-900 text-white hover:bg-neutral-800"
                }`}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : "Verify Code & Proceed"}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between text-xs">
              <span className={dark ? "text-neutral-400" : "text-neutral-500"}>
                Didn't receive email?
              </span>
              {resendActive ? (
                <button
                  onClick={handleResendOtp}
                  className="font-bold text-amber-500 hover:underline"
                >
                  Resend OTP
                </button>
              ) : (
                <span className={`font-mono ${dark ? "text-neutral-500" : "text-neutral-400"}`}>
                  Resend in 00:{otpTimer < 10 ? `0${otpTimer}` : otpTimer}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   REDESIGNED UPGRADE PLAN MODAL
   ========================================================================= */
function UpgradePlanModal({ isOpen, onClose, onSelectPlan, currentPlan = "Free", dark = true }) {
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState("plus");

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKey);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentSelectedPlan = PLANS.find((p) => p.id === selectedPlanId) || PLANS[1];
  const activePrice = billingCycle === "yearly" ? currentSelectedPlan.priceYearly : currentSelectedPlan.priceMonthly;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-0 backdrop-blur-md transition-all sm:items-center sm:p-4 fade"
      onClick={onClose}
    >
      <div
        className={`pop flex max-h-[92dvh] w-full max-w-[880px] flex-col overflow-hidden rounded-t-[26px] border shadow-2xl transition-all duration-300 sm:max-h-[88dvh] sm:rounded-[24px] ${
          dark
            ? "border-white/15 bg-[#121212] text-white"
            : "border-neutral-200 bg-white text-neutral-900"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className={`h-1.5 w-12 rounded-full ${dark ? "bg-white/20" : "bg-neutral-300"}`} />
        </div>

        <div className={`relative border-b px-4 py-3.5 sm:px-8 sm:py-5 ${dark ? "border-white/10" : "border-neutral-200"}`}>
          <button
            onClick={onClose}
            className={`absolute right-3.5 top-3.5 grid h-8 w-8 place-items-center rounded-full transition-colors sm:right-6 sm:top-5 ${
              dark ? "text-white/60 hover:bg-white/10 hover:text-white" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            }`}
          >
            <X size={18} />
          </button>

          <div className="flex flex-col items-center text-center">
            <div
              className={`mb-1.5 inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold ${
                dark
                  ? "border border-yellow-400/30 bg-yellow-400/10 text-yellow-300"
                  : "border border-amber-500/30 bg-amber-50 text-amber-800"
              }`}
            >
              <Sparkles size={13} />
              <span>Unlock Advanced AI</span>
            </div>

            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              Upgrade Your RockGPT Plan
            </h2>
            <p className={`mt-0.5 text-xs sm:text-sm ${dark ? "text-white/60" : "text-neutral-500"}`}>
              Unlock RockGPT 4o, maximum speeds, and extended context limits.
            </p>

            <div
              className={`mt-3 inline-flex items-center rounded-full p-1 text-xs font-medium ${
                dark ? "border border-white/10 bg-white/[0.05]" : "border-neutral-200 bg-neutral-100"
              }`}
            >
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`rounded-full px-3.5 py-1 transition-all ${
                  billingCycle === "monthly"
                    ? dark
                      ? "bg-white text-black font-semibold shadow-sm"
                      : "bg-white text-neutral-900 font-semibold shadow-sm"
                    : dark
                    ? "text-white/60 hover:text-white"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                Monthly billing
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 transition-all ${
                  billingCycle === "yearly"
                    ? dark
                      ? "bg-white text-black font-semibold shadow-sm"
                      : "bg-white text-neutral-900 font-semibold shadow-sm"
                    : dark
                    ? "text-white/60 hover:text-white"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                <span>Annual billing</span>
                <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-500">
                  Save 20%
                </span>
              </button>
            </div>

            <div className="mt-3 flex w-full max-w-[340px] items-center rounded-xl p-1 sm:hidden border border-neutral-200/20 bg-neutral-500/10">
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`flex-1 rounded-lg py-1.5 text-center text-xs font-semibold transition-all ${
                    selectedPlanId === plan.id
                      ? dark
                        ? "bg-white text-black shadow-md"
                        : "bg-white text-neutral-900 shadow-md"
                      : dark
                      ? "text-white/60 hover:text-white"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  {plan.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="thin flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {PLANS.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              const isCurrent = currentPlan?.toLowerCase() === plan.name.toLowerCase();
              const price = billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly;
              const mobileVisibleClass = isSelected ? "flex" : "hidden sm:flex";

              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`${mobileVisibleClass} relative cursor-pointer flex-col justify-between rounded-2xl border p-5 transition-all duration-200 ${
                    isSelected
                      ? dark
                        ? "border-yellow-400 bg-yellow-400/[0.07] ring-2 ring-yellow-400/50 shadow-[0_0_30px_rgba(250,204,21,0.15)]"
                        : "border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/40 shadow-lg"
                      : dark
                      ? "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                      : "border-neutral-200 bg-neutral-50/50 hover:border-neutral-300 hover:bg-neutral-100/50"
                  }`}
                >
                  {plan.highlight && (
                    <div
                      className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-md ${
                        dark
                          ? "border border-yellow-400/50 bg-gradient-to-r from-amber-400 to-yellow-300 text-black"
                          : "border border-amber-600 bg-amber-500 text-white"
                      }`}
                    >
                      {plan.badge}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`grid h-5 w-5 place-items-center rounded-full border transition-all ${
                            isSelected
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : dark
                              ? "border-white/20"
                              : "border-neutral-300"
                          }`}
                        >
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </div>
                        <span className="text-base font-bold">{plan.name}</span>
                      </div>
                      {isCurrent && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            dark ? "bg-white/10 text-white/80" : "bg-neutral-200 text-neutral-700"
                          }`}
                        >
                          Current
                        </span>
                      )}
                    </div>

                    <p className={`mt-1.5 min-h-[36px] text-xs leading-5 ${dark ? "text-white/60" : "text-neutral-500"}`}>
                      {plan.description}
                    </p>

                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold">₹{price}</span>
                      <span className={`text-xs ${dark ? "text-white/50" : "text-neutral-500"}`}>
                        {plan.priceMonthly === 0
                          ? "/forever"
                          : billingCycle === "yearly"
                          ? "/mo (billed annually)"
                          : "/month"}
                      </span>
                    </div>

                    <div className={`my-4 h-px w-full ${dark ? "bg-white/10" : "bg-neutral-200"}`} />

                    <ul className="space-y-2.5">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs">
                          <Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                          <span className={`leading-snug ${dark ? "text-white/80" : "text-neutral-700"}`}>
                            {feat}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPlanId(plan.id);
                        if (plan.id === "free") {
                          onClose();
                        } else {
                          onSelectPlan({ ...plan, activePrice: price, billingCycle });
                        }
                      }}
                      className={`w-full rounded-xl py-2.5 text-xs font-semibold tracking-wide transition-all ${
                        isCurrent
                          ? dark
                            ? "cursor-default border border-white/10 bg-white/5 text-white/40"
                            : "cursor-default border border-neutral-200 bg-neutral-100 text-neutral-400"
                          : isSelected
                          ? dark
                            ? "bg-white text-black shadow-lg hover:bg-neutral-200 active:scale-[0.98]"
                            : "bg-neutral-900 text-white shadow-lg hover:bg-neutral-800 active:scale-[0.98]"
                          : dark
                          ? "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                          : "border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50"
                      }`}
                    >
                      {isCurrent
                        ? "Current Plan"
                        : plan.id === "free"
                        ? "Continue with Free"
                        : `Upgrade to ${plan.name}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className={`mt-5 flex flex-wrap items-center justify-center gap-5 rounded-xl px-4 py-3 text-center text-xs ${
              dark
                ? "border border-white/5 bg-white/[0.02] text-white/50"
                : "border border-neutral-200 bg-neutral-50 text-neutral-500"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-500" /> 100% Secure UPI Payment
            </span>
            <span className="flex items-center gap-1.5">
              <Zap size={14} className="text-amber-500" /> Fast activation
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-blue-500" /> Cancel anytime
            </span>
          </div>
        </div>

        <div
          className={`border-t p-3 sm:hidden ${
            dark ? "border-white/10 bg-[#161616]" : "border-neutral-200 bg-neutral-50"
          }`}
        >
          <button
            onClick={() => {
              if (currentSelectedPlan.id === "free") {
                onClose();
              } else {
                onSelectPlan({ ...currentSelectedPlan, activePrice, billingCycle });
              }
            }}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold shadow-lg transition-all active:scale-[0.98] ${
              currentSelectedPlan.id === "free"
                ? dark
                  ? "bg-white/10 text-white"
                  : "bg-neutral-200 text-neutral-800"
                : dark
                ? "bg-white text-black"
                : "bg-neutral-900 text-white"
            }`}
          >
            <span>
              {currentSelectedPlan.id === "free"
                ? "Keep Free Plan"
                : `Select ${currentSelectedPlan.name} • ₹${activePrice}`}
            </span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   UPI CHECKOUT MODAL
   ========================================================================= */
function UpiCheckoutModal({ plan, onClose, notify, user, dark = true }) {
  const [copied, setCopied] = useState(false);
  const [utrNumber, setUtrNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!plan) return null;

  const totalAmount = plan.billingCycle === "yearly" ? plan.activePrice * 12 : plan.activePrice;
  const upiLink = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(PAYEE_NAME)}&am=${encodeURIComponent(totalAmount)}&cu=INR&tn=${encodeURIComponent(`RockGPT ${plan.name} Plan`)}`;
  const dynamicQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}&bgcolor=${dark ? "181818" : "ffffff"}&color=${dark ? "ffffff" : "000000"}&margin=1`;

  const copyUpi = () => {
    navigator.clipboard.writeText(UPI_ID);
    setCopied(true);
    notify("UPI ID copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmitProof = (e) => {
    e.preventDefault();
    if (!utrNumber.trim()) {
      notify("Please enter your 12-digit UPI reference/UTR number");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      notify("Payment submitted! Verifying your transaction.");
    }, 1200);
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md transition-all sm:items-center sm:p-4 fade"
      onClick={onClose}
    >
      <div
        className={`pop max-h-[92dvh] w-full max-w-[420px] overflow-y-auto thin rounded-t-[26px] border p-5 shadow-2xl sm:max-h-[85dvh] sm:rounded-2xl sm:p-6 ${
          dark ? "border-white/15 bg-[#141414] text-white" : "border-neutral-200 bg-white text-neutral-900"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between border-b pb-3 ${dark ? "border-white/10" : "border-neutral-200"}`}>
          <div>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${dark ? "text-yellow-400" : "text-amber-600"}`}>
              UPI Checkout
            </span>
            <h3 className="text-lg font-bold">Upgrade to {plan.name}</h3>
          </div>
          <button
            onClick={onClose}
            className={`grid h-8 w-8 place-items-center rounded-full ${
              dark ? "text-white/50 hover:bg-white/10 hover:text-white" : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800"
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 size={32} />
            </div>
            <h4 className="text-base font-bold">Transaction Reference Saved!</h4>
            <p className={`mt-2 text-xs leading-relaxed ${dark ? "text-white/60" : "text-neutral-600"}`}>
              Thank you! Reference (<strong className={dark ? "text-white" : "text-neutral-900"}>{utrNumber}</strong>) received for <strong>{user?.email || "guest user"}</strong>. Your account will be upgraded within 15 minutes.
            </p>
            <button
              onClick={onClose}
              className={`mt-6 w-full rounded-xl py-2.5 text-xs font-semibold ${
                dark ? "bg-white text-black hover:bg-neutral-200" : "bg-neutral-900 text-white hover:bg-neutral-800"
              }`}
            >
              Done & Return to Chat
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div
              className={`flex items-center justify-between rounded-xl border p-3 ${
                dark ? "border-white/10 bg-white/[0.03]" : "border-neutral-200 bg-neutral-50"
              }`}
            >
              <div>
                <div className="text-xs font-medium">{plan.name} Plan ({plan.billingCycle})</div>
                <div className={`text-[11px] ${dark ? "text-white/50" : "text-neutral-500"}`}>One-time payment</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-extrabold">₹{totalAmount}</div>
                <div className="text-[10px] text-emerald-500 font-semibold">Incl. all taxes</div>
              </div>
            </div>

            <div className="block sm:hidden">
              <a
                href={upiLink}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-xs font-bold text-white shadow-lg active:scale-95"
              >
                <Smartphone size={16} /> Pay via Any UPI App (GPay / PhonePe / Paytm)
              </a>
              <div className={`my-2 text-center text-[10px] uppercase tracking-wider ${dark ? "text-white/40" : "text-neutral-400"}`}>
                or scan QR code below
              </div>
            </div>

            <div
              className={`flex flex-col items-center justify-center rounded-xl border p-3 ${
                dark ? "border-white/10 bg-white/[0.02]" : "border-neutral-200 bg-neutral-50"
              }`}
            >
              <img
                src={dynamicQrUrl}
                alt="UPI QR Code"
                className="h-40 w-40 rounded-xl border border-neutral-300/30 bg-white p-2 shadow-inner"
              />
              <p className={`mt-2 text-[11px] ${dark ? "text-white/50" : "text-neutral-500"}`}>
                Scan with Google Pay, PhonePe, Paytm, or CRED
              </p>
            </div>

            <div
              className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                dark ? "border-white/10 bg-white/[0.04]" : "border-neutral-200 bg-neutral-50"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className={`text-[10px] ${dark ? "text-white/40" : "text-neutral-500"}`}>UPI ID</div>
                <div className="truncate font-mono text-xs font-semibold">{UPI_ID}</div>
              </div>
              <button
                onClick={copyUpi}
                className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs ${
                  dark
                    ? "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                    : "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100"
                }`}
              >
                {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>

            <form onSubmit={handleSubmitProof} className="space-y-2 pt-1">
              <label className={`block text-[11px] font-medium ${dark ? "text-white/70" : "text-neutral-700"}`}>
                Confirm payment: Enter 12-digit UTR / Ref Number
              </label>
              <input
                type="text"
                placeholder="e.g. 329482910482"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2.5 text-xs outline-none transition ${
                  dark
                    ? "border-white/15 bg-transparent text-white placeholder:text-white/30 focus:border-white/50"
                    : "border-neutral-300 bg-white text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-600"
                }`}
              />
              <button
                type="submit"
                disabled={submitting}
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all active:scale-95 disabled:opacity-50 ${
                  dark ? "bg-white text-black hover:bg-neutral-200" : "bg-neutral-900 text-white hover:bg-neutral-800"
                }`}
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : "Verify & Activate Plan"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   MAIN ROCKGPT APP
   ========================================================================= */
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
  const [speakingId, setSpeakingId] = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");

  // Profile Popover State
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // --- Auth & Subscription State ---
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("rockgpt-token") || null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const isPaidUser = Boolean(user && (user.plan === "Plus" || user.plan === "Pro"));

  const [selectedModel, setSelectedModel] = useState("RockGPT Flash");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  useEffect(() => {
    if (isPaidUser) {
      setSelectedModel("RockGPT 4o");
    } else {
      setSelectedModel("RockGPT Flash");
    }
  }, [isPaidUser]);

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
    return () => {
      if (gateTimerRef.current) clearTimeout(gateTimerRef.current);
    };
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
        setPayingPlan(null);
        setModelDropdownOpen(false);
        setAuthModalOpen(false);
        setProfileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!authToken) return;
    fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setUser(data.user))
      .catch(() => {
        if (!authToken.startsWith("rockgpt_")) {
          localStorage.removeItem("rockgpt-token");
          setAuthToken(null);
          setUser(null);
        }
      });
  }, [authToken]);

  const notify = (text) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 2800);
  };

  const toggleSpeech = (msgId, text) => {
    if (!("speechSynthesis" in window)) {
      notify("Text-to-speech not supported in this browser");
      return;
    }
    if (speakingId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleModelSelect = (modelName) => {
    if (modelName === "RockGPT 4o" && !isPaidUser) {
      setModelDropdownOpen(false);
      setPricingOpen(true);
      notify("🔒 RockGPT 4o is locked. Upgrade to Plus or Pro to unlock!");
      return;
    }
    setSelectedModel(modelName);
    setModelDropdownOpen(false);
    notify(`Switched to ${modelName}`);
  };

  const handleAuthSuccess = (loggedUser, token) => {
    setUser(loggedUser);
    setAuthToken(token);
    setGateOpen(false);
    setGateLocked(false);
  };

  // EXPLICIT LOGOUT FUNCTION
  const logout = () => {
    localStorage.removeItem("rockgpt-token");
    setAuthToken(null);
    setUser(null);
    setSelectedModel("RockGPT Flash");
    notify("Logged out successfully");
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
        pinned: false,
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
    const t1 = setTimeout(() => setThinkingLabel("Synthesizing reasoning..."), 3500);
    const t2 = setTimeout(() => setThinkingLabel("Formatting response..."), 7500);

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
        body: JSON.stringify({
          messages: history,
          fast: fastMode || selectedModel === "RockGPT Flash",
          model: selectedModel,
        }),
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
  }, [input, typing, activeId, messages, attachment, selectedModel, fastMode]);

  const stopGeneration = () => {
    abortRef.current?.abort();
    setTyping(false);
    notify("Generation stopped");
  };

  const copyMessage = async (m) => {
    const text = typeof m.content === "string" ? m.content : m.displayText || "";
    await navigator.clipboard.writeText(text);
    setCopied(m.id);
    notify("Message copied to clipboard");
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

  const togglePinChat = (id) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
    );
  };

  const exportChat = () => {
    const body = messages
      .map(
        (m) =>
          `${m.role === "user" ? "You" : "RockGPT"}\n${
            typeof m.content === "string" ? m.content : m.displayText || "(image)"
          }`
      )
      .join("\n\n---\n\n");
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rockgpt-chat-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    notify("Chat exported as text file");
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      notify("Voice input supported best on Google Chrome");
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
      notify("Supported: images, .txt, and .md files");
    }
    e.target.value = "";
  };

  const filtered = useMemo(() => {
    return conversations
      .filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  }, [conversations, search]);

  const surface = dark ? "#0a0a0a" : "#ffffff";
  const panel = dark ? "#111111" : "#f7f7f8";
  const border = dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.08)";
  const textColor = dark ? "#ffffff" : "#0f172a";
  const muted = dark ? "rgba(255,255,255,.50)" : "rgba(0,0,0,.55)";

  if (showIntro) {
    return <IntroScreen onDone={() => setShowIntro(false)} />;
  }

  return (
    <div
      className="relative flex h-[100dvh] min-h-screen w-full overflow-hidden font-sans antialiased"
      style={{ background: surface, color: textColor, overscrollBehaviorY: "none" }}
    >
      <style>{`
        html, body, #root { height: 100%; margin: 0; padding: 0; background: ${surface}; overscroll-behavior-y: none; }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        textarea::-webkit-scrollbar { width: 0; }
        .thin::-webkit-scrollbar { width: 5px; }
        .thin::-webkit-scrollbar-thumb { background: ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.15)"}; border-radius: 20px; }
        .fade { animation: fade .22s ease-out both; }
        .fade-out { animation: fadeOut .35s ease-in both; }
        .rise { animation: rise .28s cubic-bezier(.16,1,.3,1) both; }
        .pop { animation: pop .25s cubic-bezier(.16,1,.3,1) both; }
        @keyframes fade { from {opacity:0} to {opacity:1} }
        @keyframes fadeOut { from {opacity:1} to {opacity:0; visibility:hidden} }
        @keyframes rise { from {opacity:0; transform:translateY(8px)} to {opacity:1; transform:translateY(0)} }
        @keyframes pop { from {opacity:0; transform:scale(.96) translateY(6px)} to {opacity:1; transform:scale(1) translateY(0)} }
        @keyframes blink { 50% { opacity:.35 } }
        .cursor-blink { animation: blink 1s step-end infinite; }
        @keyframes dotBounce { 0%, 60%, 100% { transform: translateY(0); opacity:.4 } 30% { transform: translateY(-5px); opacity:1 } }
        .dot-bounce { animation: dotBounce 1.1s ease-in-out infinite; }
        @media (max-width: 640px) {
          .chat-bubble { max-width: 90% !important; }
        }
      `}</style>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm fade" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 h-full w-[85vw] max-w-[290px] shrink-0 overflow-hidden transition-transform duration-300 sm:w-[270px] ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: panel, borderRight: `1px solid ${border}` }}
      >
        <div className="flex h-full w-full flex-col">
          <div className="flex items-center gap-2 p-3">
            <button
              onClick={newChat}
              className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition ${
                dark ? "hover:bg-white/[.05]" : "hover:bg-black/[.05]"
              }`}
            >
              <RockMark dark={dark} />
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold">RockGPT</div>
                <div className="text-[11px]" style={{ color: muted }}>
                  {isPaidUser ? `${user.plan} Member` : "Free Tier"}
                </div>
              </div>
            </button>
            <button
              onClick={newChat}
              title="New chat"
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition ${
                dark ? "hover:bg-white/[.06]" : "hover:bg-black/[.06]"
              }`}
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="px-3 pb-2">
            <div
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                dark ? "border-white/10 bg-white/[0.02]" : "border-neutral-300/70 bg-white"
              }`}
            >
              <Search size={14} style={{ color: muted }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats..."
                className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${
                  dark ? "placeholder:text-white/30" : "placeholder:text-neutral-400"
                }`}
              />
            </div>
          </div>

          <div className="thin flex-1 overflow-y-auto px-2">
            <div className="mb-2 px-3 pt-2 text-[10px] font-semibold uppercase tracking-[.16em]" style={{ color: muted }}>
              Recent Chats
            </div>
            {filtered.length === 0 && (
              <div className="px-3 py-10 text-center text-xs" style={{ color: muted }}>
                No chats yet
              </div>
            )}
            {filtered.map((c) => (
              <div
                key={c.id}
                onClick={() => selectConversation(c.id)}
                className={`group relative mb-1 flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 transition-colors ${
                  activeId === c.id
                    ? dark
                      ? "bg-white/[.08]"
                      : "bg-neutral-200/70"
                    : dark
                    ? "hover:bg-white/[.045]"
                    : "hover:bg-neutral-200/40"
                }`}
              >
                {c.pinned ? (
                  <Pin size={11} className="shrink-0 text-amber-500 fill-amber-500" />
                ) : (
                  <div
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      background: activeId === c.id ? (dark ? "#fff" : "#111") : dark ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.25)",
                    }}
                  />
                )}
                {editing === c.id ? (
                  <input
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={() => renameChat(c.id, editText)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") renameChat(c.id, editText);
                    }}
                    className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-[13px]">{c.title}</span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePinChat(c.id);
                  }}
                  title={c.pinned ? "Unpin chat" : "Pin chat"}
                  className={`hidden shrink-0 rounded-md p-1 group-hover:block ${
                    dark ? "hover:bg-white/[.08]" : "hover:bg-black/[.08]"
                  }`}
                >
                  <Pin size={12} className={c.pinned ? "text-amber-500" : ""} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(c.id);
                    setEditText(c.title);
                  }}
                  className={`hidden shrink-0 rounded-md p-1 group-hover:block ${
                    dark ? "hover:bg-white/[.08]" : "hover:bg-black/[.08]"
                  }`}
                >
                  <Edit3 size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(c.id);
                  }}
                  className="hidden shrink-0 rounded-md p-1 text-red-500 group-hover:block hover:bg-red-500/10"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Sidebar Footer with Profile & Menu */}
          <div className="relative border-t p-2 space-y-1" style={{ borderColor: border }}>
            <button
              onClick={() => {
                setSidebarOpen(false);
                setPricingOpen(true);
              }}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all active:scale-[0.98] ${
                dark
                  ? "border-yellow-400/30 bg-yellow-400/[0.08] text-yellow-300 hover:bg-yellow-400/[0.14]"
                  : "border-amber-500/40 bg-amber-500/[0.10] text-amber-800 hover:bg-amber-500/[0.16]"
              }`}
            >
              <Crown size={17} className={dark ? "text-yellow-400" : "text-amber-600"} />
              <div className="flex-1 text-left">
                <div className={`leading-none text-[13px] font-semibold ${dark ? "text-white" : "text-neutral-900"}`}>
                  {isPaidUser ? "Manage Subscription" : "Upgrade plan"}
                </div>
                <div className={`text-[10px] ${dark ? "text-yellow-300/80" : "text-amber-700"}`}>
                  {isPaidUser ? `Current: ${user.plan}` : "Unlock RockGPT 4o"}
                </div>
              </div>
              <ChevronRight size={14} className={dark ? "text-yellow-400/60" : "text-amber-600/60"} />
            </button>

            {/* Profile trigger with floating menu */}
            <button
              onClick={() => {
                if (!user) {
                  setAuthModalOpen(true);
                } else {
                  setProfileMenuOpen((v) => !v);
                }
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                dark ? "hover:bg-white/[0.06]" : "hover:bg-black/[0.05]"
              }`}
            >
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-amber-500 to-purple-600 font-bold text-white text-xs shadow-sm">
                {user?.name ? user.name.slice(0, 1).toUpperCase() : <User size={13} />}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-xs font-semibold">{user ? user.name : "Sign in / Register"}</div>
                <div className="text-[10px]" style={{ color: muted }}>
                  {user ? `${user.plan || "Free"} Plan • Account` : "Tap to sign in"}
                </div>
              </div>
              {user && <MoreHorizontal size={14} className="text-neutral-400" />}
            </button>

            {/* User Profile Popover */}
            <UserProfileMenu
              user={user}
              dark={dark}
              isOpen={profileMenuOpen}
              onClose={() => setProfileMenuOpen(false)}
              onLogout={logout}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenUpgrade={() => setPricingOpen(true)}
              onOpenAuth={() => setAuthModalOpen(true)}
            />
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header
          className="flex h-[56px] shrink-0 items-center justify-between border-b px-3 sm:px-4"
          style={{
            borderColor: border,
            background: dark ? "rgba(10,10,10,.85)" : "rgba(255,255,255,.94)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              title="Open sidebar (Ctrl+B)"
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition ${
                dark ? "text-white/80 hover:bg-white/[.08]" : "text-neutral-700 hover:bg-black/[.06]"
              }`}
            >
              <Menu size={18} />
            </button>

            {/* Model Selector */}
            <div className="relative">
              <button
                onClick={() => setModelDropdownOpen((v) => !v)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition shadow-sm ${
                  dark
                    ? "border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                    : "border-neutral-200 bg-neutral-100 text-neutral-800 hover:bg-neutral-200"
                }`}
              >
                {selectedModel === "RockGPT 4o" ? (
                  <Sparkles size={13} className={dark ? "text-yellow-400" : "text-amber-600"} />
                ) : (
                  <Zap size={13} className="text-blue-500" />
                )}
                <span>{selectedModel}</span>
                <ChevronDown size={13} className={dark ? "text-white/40" : "text-neutral-500"} />
              </button>

              {modelDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setModelDropdownOpen(false)} />
                  <div
                    className={`absolute left-0 top-10 z-40 w-64 rounded-2xl border p-1.5 shadow-2xl pop ${
                      dark ? "border-white/15 bg-[#161616]" : "border-neutral-200 bg-white"
                    }`}
                  >
                    <button
                      onClick={() => handleModelSelect("RockGPT Flash")}
                      className={`flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left transition ${
                        selectedModel === "RockGPT Flash"
                          ? dark
                            ? "bg-white/10"
                            : "bg-neutral-100"
                          : dark
                          ? "hover:bg-white/5"
                          : "hover:bg-neutral-50"
                      }`}
                    >
                      <Zap size={15} className="mt-0.5 text-blue-500" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold ${dark ? "text-white" : "text-neutral-900"}`}>
                            RockGPT Flash
                          </span>
                          <span className="rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold text-blue-400">
                            Free
                          </span>
                        </div>
                        <div className={`text-[10px] ${dark ? "text-white/50" : "text-neutral-500"}`}>
                          Fastest for general questions
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleModelSelect("RockGPT 4o")}
                      className={`flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left transition ${
                        selectedModel === "RockGPT 4o"
                          ? dark
                            ? "bg-white/10"
                            : "bg-neutral-100"
                          : dark
                          ? "hover:bg-white/5"
                          : "hover:bg-neutral-50"
                      }`}
                    >
                      <Sparkles size={15} className={`mt-0.5 ${dark ? "text-yellow-400" : "text-amber-600"}`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold ${dark ? "text-white" : "text-neutral-900"}`}>
                            RockGPT 4o
                          </span>
                          {isPaidUser ? (
                            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                              Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-500">
                              <Lock size={9} /> Plus/Pro
                            </span>
                          )}
                        </div>
                        <div className={`text-[10px] ${dark ? "text-white/50" : "text-neutral-500"}`}>
                          {isPaidUser ? "Deep reasoning & highest compute" : "Requires Plus or Pro subscription"}
                        </div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {!isPaidUser && (
              <button
                onClick={() => setPricingOpen(true)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition active:scale-95 ${
                  dark
                    ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-300 hover:bg-yellow-400/20"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20"
                }`}
              >
                <Crown size={14} className={dark ? "text-yellow-400" : "text-amber-600"} />
                <span className="font-semibold">Upgrade</span>
              </button>
            )}

            {activeId && (
              <button
                onClick={exportChat}
                title="Export chat"
                className={`hidden h-9 w-9 place-items-center rounded-lg transition sm:grid ${
                  dark ? "text-white/80 hover:bg-white/[.08]" : "text-neutral-700 hover:bg-black/[.06]"
                }`}
              >
                <Download size={16} />
              </button>
            )}

            <button
              onClick={() => setTheme(dark ? "light" : "dark")}
              title="Toggle theme"
              className={`grid h-9 w-9 place-items-center rounded-lg transition ${
                dark ? "text-white/80 hover:bg-white/[.08]" : "text-neutral-700 hover:bg-black/[.06]"
              }`}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* TOP RIGHT PROFILE AVATAR & LOGOUT SHORTCUT */}
            {user ? (
              <button
                onClick={() => setProfileMenuOpen((v) => !v)}
                title="Account menu & logout"
                className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-tr from-amber-500 to-purple-600 font-bold text-white text-xs shadow-sm hover:scale-105 transition"
              >
                {user.name.slice(0, 1).toUpperCase()}
              </button>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className={`rounded-xl border px-2.5 py-1 text-xs font-semibold transition ${
                  dark
                    ? "border-white/15 text-white hover:bg-white/10"
                    : "border-neutral-300 text-neutral-800 hover:bg-neutral-100"
                }`}
              >
                Sign in
              </button>
            )}
          </div>
        </header>

        {/* Chat Message Window */}
        <section className="thin flex-1 overflow-y-auto">
          {messages.length === 0 && !typing ? (
            <div className="mx-auto flex min-h-full max-w-[800px] flex-col items-center justify-center px-4 py-8">
              <div className="mb-4 fade"><RockMark dark={dark} /></div>
              <h1 className="rise text-center text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
                What can I help with today?
              </h1>
              <p
                className="rise mt-2 max-w-lg px-2 text-center text-xs leading-5 sm:text-sm"
                style={{ color: muted }}
              >
                Brainstorm, write clean code, analyze documents, or solve complex problems.
              </p>

              <div className="rise mt-6 flex flex-wrap items-center justify-center gap-1.5">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        activeCategory === cat.id
                          ? dark
                            ? "bg-white text-black"
                            : "bg-neutral-900 text-white"
                          : dark
                          ? "bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white"
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                      }`}
                    >
                      <Icon size={12} />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="rise mt-4 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {(PROMPT_SUGGESTIONS[activeCategory] || PROMPT_SUGGESTIONS.all).map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(item.prompt);
                      inputRef.current?.focus();
                    }}
                    className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all hover:scale-[1.01] ${
                      dark
                        ? "border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.05]"
                        : "border-neutral-200 bg-neutral-50 hover:border-neutral-300 hover:bg-neutral-100/80 shadow-sm"
                    }`}
                  >
                    <div>
                      <div className={`text-xs font-semibold ${dark ? "text-white" : "text-neutral-900"}`}>
                        {item.title}
                      </div>
                      <div className={`mt-0.5 text-[11px] leading-snug ${dark ? "text-white/50" : "text-neutral-500"}`}>
                        {item.desc}
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <ArrowRight size={13} className={dark ? "text-white/30" : "text-neutral-400"} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-[820px] px-3 py-6 sm:px-6 sm:py-8">
              {messages.map((m, i) => (
                <div key={m.id} className="rise mb-6 sm:mb-8">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium">
                    {m.role === "assistant" ? (
                      <RockMark small dark={dark} />
                    ) : (
                      <div className="grid h-7 w-7 place-items-center rounded-full border" style={{ borderColor: border }}>
                        <User size={13} />
                      </div>
                    )}
                    <span className="font-semibold">{m.role === "assistant" ? "RockGPT" : "You"}</span>
                    <span className="text-[10px]" style={{ color: muted }}>
                      {formatTime(m.createdAt)}
                    </span>
                  </div>

                  {editing === m.id ? (
                    <div className="rounded-2xl border p-3" style={{ borderColor: border }}>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="min-h-[100px] w-full resize-none bg-transparent text-sm leading-6 outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditing(null)} className="rounded-lg px-3 py-1.5 text-xs" style={{ color: muted }}>
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            setMessages((prev) =>
                              prev.map((x) => (x.id === m.id ? { ...x, content: editText, displayText: editText } : x))
                            );
                            setEditing(null);
                          }}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                            dark ? "bg-white text-black" : "bg-neutral-900 text-white"
                          }`}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={
                        m.role === "user"
                          ? `chat-bubble ml-0 max-w-[92%] rounded-2xl border p-3.5 sm:ml-9 sm:p-4 ${
                              dark
                                ? "border-white/10 bg-white/[.05] text-white"
                                : "border-neutral-200 bg-neutral-100 text-neutral-900"
                            }`
                          : "ml-0 sm:ml-9"
                      }
                    >
                      {m.attachment?.kind === "image" && (
                        <img
                          src={m.attachment.dataUrl}
                          alt={m.attachment.name}
                          className="mb-2 max-h-60 rounded-xl border"
                          style={{ borderColor: border }}
                        />
                      )}
                      {m.attachment?.kind === "doc" && (
                        <div
                          className="mb-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs"
                          style={{ borderColor: border, color: muted }}
                        >
                          📄 {m.attachment.name}
                        </div>
                      )}
                      {m.role === "assistant" ? (
                        <MessageContent content={m.content} dark={dark} />
                      ) : (
                        <p className="whitespace-pre-wrap text-[15px] leading-7">
                          {m.displayText || (typeof m.content === "string" ? m.content : "")}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="ml-9 mt-2 flex items-center gap-1">
                    <button
                      onClick={() => copyMessage(m)}
                      className={`rounded-lg p-2 text-xs transition ${
                        dark ? "text-white/40 hover:bg-white/[.06] hover:text-white" : "text-neutral-400 hover:bg-black/[.06] hover:text-neutral-900"
                      }`}
                      title="Copy message"
                    >
                      {copied === m.id ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    </button>

                    {m.role === "assistant" && typeof m.content === "string" && (
                      <button
                        onClick={() => toggleSpeech(m.id, m.content)}
                        className={`rounded-lg p-2 text-xs transition ${
                          speakingId === m.id
                            ? "text-blue-500 bg-blue-500/10"
                            : dark
                            ? "text-white/40 hover:bg-white/[.06] hover:text-white"
                            : "text-neutral-400 hover:bg-black/[.06] hover:text-neutral-900"
                        }`}
                        title={speakingId === m.id ? "Stop voice" : "Read aloud"}
                      >
                        {speakingId === m.id ? <VolumeX size={13} /> : <Volume2 size={13} />}
                      </button>
                    )}

                    {m.role === "user" && (
                      <button
                        onClick={() => {
                          setEditing(m.id);
                          setEditText(m.displayText || "");
                        }}
                        className={`rounded-lg p-2 transition ${
                          dark ? "text-white/40 hover:bg-white/[.06] hover:text-white" : "text-neutral-400 hover:bg-black/[.06] hover:text-neutral-900"
                        }`}
                        title="Edit prompt"
                      >
                        <Edit3 size={13} />
                      </button>
                    )}

                    {m.role === "assistant" && (
                      <>
                        <button
                          onClick={() =>
                            setMessages((prev) =>
                              prev.map((x) => (x.id === m.id ? { ...x, liked: x.liked === true ? null : true } : x))
                            )
                          }
                          className={`rounded-lg p-2 transition ${
                            m.liked === true
                              ? "text-emerald-500"
                              : dark
                              ? "text-white/40 hover:bg-white/[.06]"
                              : "text-neutral-400 hover:bg-black/[.06]"
                          }`}
                          title="Helpful"
                        >
                          <ThumbsUp size={13} />
                        </button>
                        <button
                          onClick={() =>
                            setMessages((prev) =>
                              prev.map((x) => (x.id === m.id ? { ...x, liked: x.liked === false ? null : false } : x))
                            )
                          }
                          className={`rounded-lg p-2 transition ${
                            m.liked === false
                              ? "text-red-500"
                              : dark
                              ? "text-white/40 hover:bg-white/[.06]"
                              : "text-neutral-400 hover:bg-black/[.06]"
                          }`}
                          title="Not helpful"
                        >
                          <ThumbsDown size={13} />
                        </button>
                        {i === messages.length - 1 && (
                          <button
                            onClick={regenerate}
                            className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition ${
                              dark ? "text-white/50 hover:bg-white/[.06] hover:text-white" : "text-neutral-500 hover:bg-black/[.06] hover:text-neutral-900"
                            }`}
                          >
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
                  <RockMark small dark={dark} />
                  <div className="min-w-0 flex-1 pt-1">
                    {streaming ? (
                      <div className={`text-[15px] leading-7 ${dark ? "text-white/85" : "text-neutral-800"}`}>
                        <MessageContent content={streaming} dark={dark} />
                        <span className={`cursor-blink ml-1 inline-block h-4 w-0.5 align-middle ${dark ? "bg-white" : "bg-black"}`} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 pt-1 text-sm" style={{ color: muted }}>
                        <span>{thinkingLabel}</span>
                        <span className="flex items-end gap-1">
                          <i className={`dot-bounce h-1.5 w-1.5 rounded-full ${dark ? "bg-white" : "bg-neutral-800"}`} style={{ animationDelay: "0s" }} />
                          <i className={`dot-bounce h-1.5 w-1.5 rounded-full ${dark ? "bg-white" : "bg-neutral-800"}`} style={{ animationDelay: "0.15s" }} />
                          <i className={`dot-bounce h-1.5 w-1.5 rounded-full ${dark ? "bg-white" : "bg-neutral-800"}`} style={{ animationDelay: "0.3s" }} />
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

        {/* Input Bar */}
        <div className="shrink-0 px-2 pb-3 pt-2 sm:px-4" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto max-w-[820px]">
            {attachment && (
              <div
                className={`mb-2 flex items-center gap-2 rounded-xl border p-2 ${
                  dark ? "border-white/15 bg-white/[0.05]" : "border-neutral-200 bg-neutral-100"
                }`}
              >
                {attachment.kind === "image" ? (
                  <img src={attachment.dataUrl} alt={attachment.name} className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-lg border text-lg" style={{ borderColor: border }}>
                    📄
                  </div>
                )}
                <span className="flex-1 truncate text-xs" style={{ color: muted }}>{attachment.name}</span>
                <button onClick={() => setAttachment(null)} className="rounded-md p-1 hover:bg-black/10">
                  <X size={14} />
                </button>
              </div>
            )}
            <div
              className={`relative rounded-[22px] border p-2 shadow-xl focus-within:ring-1 ${
                dark
                  ? "border-white/15 bg-[#141414] focus-within:border-white/30 focus-within:ring-white/20"
                  : "border-neutral-300 bg-white focus-within:border-neutral-400 focus-within:ring-neutral-200"
              }`}
            >
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
                placeholder={`Message ${selectedModel}...`}
                className={`w-full resize-none bg-transparent px-3 pb-11 pt-2 text-[15px] leading-6 outline-none sm:px-3.5 ${
                  dark ? "text-white placeholder:text-white/30" : "text-neutral-900 placeholder:text-neutral-400"
                }`}
                style={{ minHeight: 46, maxHeight: 160 }}
              />

              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <input ref={fileRef} type="file" accept="image/*,.txt,.md" className="hidden" onChange={handleFileSelect} />
                  <div className="relative">
                    <button
                      onClick={() => setAttachMenuOpen((v) => !v)}
                      title="Attach photo or file"
                      className={`grid h-9 w-9 place-items-center rounded-xl transition ${
                        dark ? "text-white/50 hover:bg-white/[.06] hover:text-white" : "text-neutral-500 hover:bg-black/[.06] hover:text-neutral-900"
                      }`}
                    >
                      <Plus size={18} />
                    </button>
                    {attachMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setAttachMenuOpen(false)} />
                        <div
                          className={`absolute bottom-11 left-0 z-40 w-60 rounded-2xl border p-1.5 shadow-2xl pop ${
                            dark ? "border-white/15 bg-[#181818]" : "border-neutral-200 bg-white"
                          }`}
                        >
                          <button
                            onClick={() => {
                              fileRef.current?.click();
                              setAttachMenuOpen(false);
                            }}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                              dark ? "text-white/80 hover:bg-white/[.06] hover:text-white" : "text-neutral-700 hover:bg-neutral-100"
                            }`}
                          >
                            <Paperclip size={16} /> <span className="flex-1">Add photo or file</span>
                          </button>
                          <button
                            onClick={() => {
                              setWebSearchOn((v) => !v);
                              notify("Web search is coming soon");
                              setAttachMenuOpen(false);
                            }}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                              dark ? "text-white/80 hover:bg-white/[.06] hover:text-white" : "text-neutral-700 hover:bg-neutral-100"
                            }`}
                          >
                            <Globe size={16} /> <span className="flex-1">Web search</span>
                            <span
                              className={`rounded-full border px-1.5 py-0.5 text-[9px] ${
                                dark ? "border-white/10 text-white/40" : "border-neutral-200 text-neutral-500"
                              }`}
                            >
                              Soon
                            </span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => setFastMode((v) => !v)}
                    title={fastMode ? "Fast mode active" : "Turn on fast mode"}
                    className={`hidden h-9 w-9 place-items-center rounded-xl transition sm:grid ${
                      fastMode
                        ? dark
                          ? "bg-white text-black"
                          : "bg-neutral-900 text-white"
                        : dark
                        ? "text-white/50 hover:bg-white/[.06] hover:text-white"
                        : "text-neutral-500 hover:bg-black/[.06] hover:text-neutral-900"
                    }`}
                  >
                    <Gauge size={17} />
                  </button>
                  <button
                    onClick={toggleRecording}
                    title="Voice input"
                    className={`grid h-9 w-9 place-items-center rounded-xl transition ${
                      recording
                        ? "bg-red-500 text-white animate-pulse"
                        : dark
                        ? "text-white/50 hover:bg-white/[.06] hover:text-white"
                        : "text-neutral-500 hover:bg-black/[.06] hover:text-neutral-900"
                    }`}
                  >
                    <Mic size={17} />
                  </button>
                </div>

                {typing ? (
                  <button
                    onClick={stopGeneration}
                    className={`grid h-9 w-9 place-items-center rounded-xl transition hover:scale-105 ${
                      dark ? "bg-white text-black" : "bg-neutral-900 text-white"
                    }`}
                    title="Stop generating"
                  >
                    <Square size={14} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    disabled={!input.trim() && !attachment}
                    onClick={sendMessage}
                    className={`grid h-9 w-9 place-items-center rounded-xl transition ${
                      input.trim() || attachment
                        ? dark
                          ? "bg-white text-black hover:scale-105 shadow-md"
                          : "bg-neutral-900 text-white hover:scale-105 shadow-md"
                        : dark
                        ? "bg-white/10 text-white/30"
                        : "bg-neutral-200 text-neutral-400"
                    }`}
                    title="Send"
                  >
                    <ArrowUp size={18} />
                  </button>
                )}
              </div>
            </div>
            <div className="hidden items-center justify-center gap-2 py-2 text-[11px] sm:flex" style={{ color: muted }}>
              <span>RockGPT can make mistakes. Verify important information.</span>
            </div>
          </div>
        </div>
      </main>

      {/* Upgrade Plan Modal */}
      <UpgradePlanModal
        isOpen={pricingOpen}
        onClose={() => setPricingOpen(false)}
        currentPlan={user?.plan || "Free"}
        dark={dark}
        onSelectPlan={(plan) => {
          setPricingOpen(false);
          setPayingPlan(plan);
        }}
      />

      {/* UPI Checkout Modal */}
      <UpiCheckoutModal
        plan={payingPlan}
        onClose={() => setPayingPlan(null)}
        notify={notify}
        user={user}
        dark={dark}
      />

      {/* Auth Modal with OTP */}
      <AuthModal
        isOpen={gateOpen || authModalOpen}
        onClose={() => {
          setGateOpen(false);
          setAuthModalOpen(false);
        }}
        dark={dark}
        notify={notify}
        onSuccess={handleAuthSuccess}
        isGateLocked={gateLocked}
        allowGuest={!gateLocked}
      />

      {/* Settings Modal (WITH CLEAR LOGOUT BUTTON) */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 fade backdrop-blur-sm"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className={`pop max-h-[85vh] w-full max-w-[420px] overflow-y-auto thin rounded-2xl border p-5 shadow-2xl ${
              dark ? "border-white/15 bg-[#141414] text-white" : "border-neutral-200 bg-white text-neutral-900"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Settings</h2>
                <p className="text-xs" style={{ color: muted }}>Personalize your RockGPT experience.</p>
              </div>
              <button onClick={() => setSettingsOpen(false)} style={{ color: muted }}>
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: border }}>
                {dark ? <Moon size={17} /> : <Sun size={17} />}
                <div className="flex-1">
                  <div className="text-sm font-medium">Appearance</div>
                  <div className="text-xs" style={{ color: muted }}>Switch between dark & light interface</div>
                </div>
                <button
                  onClick={() => setTheme(dark ? "light" : "dark")}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                  style={{ borderColor: border }}
                >
                  {dark ? "Light" : "Dark"}
                </button>
              </div>

              {/* ACCOUNT & EXPLICIT LOGOUT SECTION */}
              <div className="rounded-xl border p-3" style={{ borderColor: border }}>
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-400">Account</div>
                {user ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: muted }}>Logged in as:</span>
                      <span className="font-semibold">{user.email}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: muted }}>Subscription:</span>
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                        {user.plan || "Free"} Plan
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setSettingsOpen(false);
                        logout();
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/10 py-2.5 text-xs font-bold text-red-500 hover:bg-red-500/20 transition"
                    >
                      <LogOut size={14} /> Log out of RockGPT
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-xs mb-2" style={{ color: muted }}>You are currently using guest mode.</p>
                    <button
                      onClick={() => {
                        setSettingsOpen(false);
                        setAuthModalOpen(true);
                      }}
                      className="w-full rounded-xl bg-white text-black font-bold py-2 text-xs"
                    >
                      Sign in or Register
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notice */}
      {notice && (
        <div
          className={`fixed bottom-20 left-1/2 z-[95] -translate-x-1/2 rounded-full border px-4 py-2 text-xs font-medium shadow-2xl backdrop-blur-md fade ${
            dark
              ? "border-white/20 bg-black/90 text-white"
              : "border-neutral-300 bg-neutral-900/90 text-white"
          }`}
        >
          {notice}
        </div>
      )}
    </div>
  );
}
