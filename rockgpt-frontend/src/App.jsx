import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  ArrowUp, Check, ChevronDown, Copy, Download, Edit3, Menu, Mic,
  Plus, Search, Settings, User, X, Zap, Brain, Paperclip,
  Moon, Sun, RefreshCcw, Square, ThumbsDown, ThumbsUp, Trash2,
  Sparkles, Globe, Gauge, Loader2, Crown, ExternalLink, ShieldCheck,
  Smartphone, QrCode, ArrowRight, CheckCircle2, AlertCircle, ChevronRight,
  Lock, Volume2, VolumeX, Pin, Share2, Compass, Code2, BookOpen, PenTool,
  Shield, KeyRound, Mail, ArrowLeft, LogOut, MoreHorizontal, UserCheck, CreditCard,
  SquarePen, PenLine, Eye, EyeOff
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

function CodeBlock({ lang, code, dark }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
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
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-neutral-400 hover:bg-white/[.08] hover:text-white transition"
        >
          {copied ? (
            <>
              <Check size={12} className="text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-6 text-neutral-200 font-mono">
        <code>{code}</code>
      </pre>
    </div>
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
      <CodeBlock
        key={output.length}
        lang={lang}
        code={codeLines.join("\n")}
        dark={dark}
      />
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

/* =========================================================================
   ROCKGPT MASTER LOGO: 6-PETAL CYBER-CRYSTAL ORIGAMI BLOOM & AI STAR
   ========================================================================= */
function RockLogo({ size = 32, dark = true, animated = false, className = "" }) {
  const [imgErr, setImgErr] = useState(false);
  const uid = useMemo(() => `rl-${size}-${Math.random().toString(36).slice(2, 6)}`, [size]);

  if (!imgErr) {
    return (
      <div
        className={`relative inline-flex items-center justify-center shrink-0 select-none overflow-visible ${
          animated ? "transition-transform duration-200 hover:scale-105" : ""
        } ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src="/rockgpt-logo.png"
          alt="RockGPT"
          width={size}
          height={size}
          onError={() => setImgErr(true)}
          className="w-full h-full object-contain rounded-full select-none pointer-events-none drop-shadow-[0_0_14px_rgba(56,189,248,0.4)]"
          loading="eager"
        />
      </div>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${animated ? "transition-transform duration-200 hover:scale-105" : ""} ${className}`}
      style={{ overflow: "visible" }}
    >
      <defs>
        <radialGradient id={`coreGlow-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
          <stop offset="45%" stopColor="#2563eb" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`grad1-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="60%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
        <linearGradient id={`grad2-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="65%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
        <linearGradient id={`grad3-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="70%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <filter id={`bloomGlow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="50" cy="50" r="34" fill={`url(#coreGlow-${uid})`} />
      <g>
        <g transform="rotate(0 50 50)"><path d="M50 10 C68 10 84 22 84 38 C84 46 76 52 64 48 C56 45 52 35 50 10 Z" fill={`url(#grad1-${uid})`} opacity="0.95" /></g>
        <g transform="rotate(60 50 50)"><path d="M50 10 C68 10 84 22 84 38 C84 46 76 52 64 48 C56 45 52 35 50 10 Z" fill={`url(#grad2-${uid})`} opacity="0.95" /></g>
        <g transform="rotate(120 50 50)"><path d="M50 10 C68 10 84 22 84 38 C84 46 76 52 64 48 C56 45 52 35 50 10 Z" fill={`url(#grad2-${uid})`} opacity="0.95" /></g>
        <g transform="rotate(180 50 50)"><path d="M50 10 C68 10 84 22 84 38 C84 46 76 52 64 48 C56 45 52 35 50 10 Z" fill={`url(#grad3-${uid})`} opacity="0.95" /></g>
        <g transform="rotate(240 50 50)"><path d="M50 10 C68 10 84 22 84 38 C84 46 76 52 64 48 C56 45 52 35 50 10 Z" fill={`url(#grad1-${uid})`} opacity="0.95" /></g>
        <g transform="rotate(300 50 50)"><path d="M50 10 C68 10 84 22 84 38 C84 46 76 52 64 48 C56 45 52 35 50 10 Z" fill={`url(#grad3-${uid})`} opacity="0.95" /></g>
      </g>
      <path d="M50 35 Q50 50 65 50 Q50 50 50 65 Q50 50 35 50 Q50 50 50 35 Z" fill="#ffffff" filter={`url(#bloomGlow-${uid})`} />
      <circle cx="50" cy="50" r="2.5" fill="#ffffff" />
    </svg>
  );
}

function RockMark({ small = false, size, dark = true, animated = false }) {
  const s = size || (small ? 26 : 34);
  return <RockLogo size={s} dark={dark} animated={animated} />;
}

/* =========================================================================
   CINEMATIC 2.0-SECOND INTRO EXPERIENCE (PREMIUM MOTION DESIGN)
   ========================================================================= */
function IntroScreen({ onDone }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // 1.60s: Begin transitioning away
    const exitTimer = setTimeout(() => {
      setExiting(true);
    }, 1600);

    // 2.00s: Seamlessly completed, unmount overlay
    const doneTimer = setTimeout(() => {
      onDone();
    }, 2020);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  const handleSkip = () => {
    setExiting(true);
    setTimeout(onDone, 150);
  };

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#070709] text-white select-none overflow-hidden transition-all duration-400 cursor-pointer ${
        exiting ? "opacity-0 scale-102 blur-[4px] pointer-events-none" : "opacity-100 scale-100"
      }`}
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <style>{`
        @keyframes introAmbientPulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.08); }
        }

        @keyframes introLogoSequence {
          0% { opacity: 0; transform: scale(0.85); filter: blur(10px); }
          7.5% { opacity: 0.15; transform: scale(0.88); filter: blur(7px); }
          17.5% { opacity: 1; transform: scale(1); filter: blur(0px) drop-shadow(0 0 18px rgba(56,189,248,0.45)); }
          30% { transform: scale(1.035); filter: blur(0px) drop-shadow(0 0 30px rgba(56,189,248,0.7)); }
          36% { transform: scale(1); filter: blur(0px) drop-shadow(0 0 20px rgba(56,189,248,0.45)); }
          52.5% { filter: drop-shadow(0 0 32px rgba(168,85,247,0.55)) drop-shadow(0 0 16px rgba(56,189,248,0.6)); }
          70% { opacity: 1; transform: scale(1); filter: drop-shadow(0 0 20px rgba(56,189,248,0.4)); }
          80% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.03); filter: blur(6px); }
        }

        @keyframes introWordmarkSequence {
          0%, 37.5% { opacity: 0; transform: translateY(6px); letter-spacing: 0.12em; }
          48% { opacity: 1; transform: translateY(0); letter-spacing: 0.22em; }
          70% { opacity: 1; transform: translateY(0); letter-spacing: 0.22em; }
          80% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-4px); }
        }

        @keyframes introLightSweep {
          0%, 50% { transform: translateX(-150%) skewX(-20deg); opacity: 0; }
          52.5% { opacity: 0.75; }
          64% { transform: translateX(160%) skewX(-20deg); opacity: 0.75; }
          68%, 100% { opacity: 0; transform: translateX(180%) skewX(-20deg); }
        }
      `}</style>

      {/* Subtle Animated Ambient Atmospheric Glow */}
      <div
        className="absolute h-[380px] w-[380px] sm:h-[480px] sm:w-[480px] rounded-full bg-gradient-to-tr from-sky-500/10 via-blue-600/10 to-purple-600/10 blur-[110px] pointer-events-none"
        style={{ animation: "introAmbientPulse 3.2s ease-in-out infinite" }}
      />

      {/* Center 3D Floating Quantum Bloom Emblem */}
      <div className="relative mb-5 sm:mb-7 grid place-items-center">
        {/* Luminous Core Backdrop Halo */}
        <div className="absolute h-28 w-28 sm:h-36 sm:w-36 rounded-full bg-sky-400/[0.12] blur-2xl animate-pulse" />

        {/* Dynamic Logo with Cinematic Timeline Animation */}
        <div
          className="relative z-10"
          style={{ animation: "introLogoSequence 2.0s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
        >
          <RockLogo
            size={96}
            dark={true}
            animated={false}
            className="sm:w-[110px] sm:h-[110px]"
          />
        </div>
      </div>

      {/* Brand Typography with Timeline Wordmark Slide & Light Sweep */}
      <div className="relative text-center px-4 overflow-hidden py-1">
        {/* Soft Light Sweep passing at 1.05s */}
        <div
          className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-r from-transparent via-white/40 to-transparent w-1/2 h-full"
          style={{ animation: "introLightSweep 2.0s ease-in-out forwards" }}
        />

        <h1
          className="text-3xl sm:text-4xl font-extrabold tracking-[0.22em] text-white uppercase drop-shadow-[0_0_18px_rgba(56,189,248,0.35)]"
          style={{ animation: "introWordmarkSequence 2.0s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
        >
          RockGPT
        </h1>

        <div
          className="mt-2 text-[11px] sm:text-xs font-mono tracking-[0.28em] text-sky-400 uppercase"
          style={{
            animation: "introWordmarkSequence 2.0s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            animationDelay: "0.1s"
          }}
        >
          Next-Generation Intelligence
        </div>
      </div>

      {/* Discrete Skip Hint */}
      <div className="absolute bottom-6 sm:bottom-8 text-[11px] text-neutral-500 font-mono tracking-wider hover:text-white transition select-none">
        Tap anywhere to enter ➔
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
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-neutral-700 via-neutral-800 to-neutral-900 border border-white/20 font-bold text-white shadow-sm">
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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Sending...");

  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpTimer, setOtpTimer] = useState(45);
  const [resendActive, setResendActive] = useState(false);
  const [otpShake, setOtpShake] = useState(false);
  const otpInputsRef = useRef([]);

  // Reset credentials and step whenever the modal is opened
  useEffect(() => {
    if (isOpen) {
      setStep("credentials");
      setAuthMode("login");
      setError("");
      setName("");
      setEmail("");
      setPassword("");
      setShowPassword(false);
      setOtpDigits(["", "", "", "", "", ""]);
      setLoading(false);
      setResendActive(false);
      setOtpTimer(45);
    }
  }, [isOpen]);

  const switchAuthMode = (newMode) => {
    setAuthMode(newMode);
    setError("");
    setPassword("");
    setShowPassword(false);
    setOtpDigits(["", "", "", "", "", ""]);
  };

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

  // Direct login with email + password (standard frictionless login)
  const handleDirectLogin = async (e) => {
    if (e) e.preventDefault();
    setError("");

    const form = e?.currentTarget?.tagName === "FORM" ? e.currentTarget : e?.target?.closest ? e.target.closest("form") : null;
    const effectiveEmail = (form?.elements?.email?.value || email || "").trim();
    const effectivePassword = form?.elements?.password?.value || password || "";

    if (effectiveEmail && effectiveEmail !== email) setEmail(effectiveEmail);
    if (effectivePassword && effectivePassword !== password) setPassword(effectivePassword);

    if (!effectiveEmail || !effectivePassword) {
      setError("Please enter both email and password.");
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(effectiveEmail)) {
      setError("Please enter a valid email address (e.g. name@gmail.com).");
      return;
    }

    setLoading(true);
    setLoadingText("Signing in securely...");

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/direct-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: effectiveEmail, password: effectivePassword }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.token) {
        setError(data?.error || "Incorrect password. Please verify or use 'Forgot password?'.");
        setOtpShake(true);
        setTimeout(() => setOtpShake(false), 500);
        return;
      }

      localStorage.setItem("rockgpt-token", data.token);
      localStorage.setItem("rockgpt-user", JSON.stringify(data.user));
      onSuccess(data.user, data.token);
      notify(`Welcome back, ${data.user.name}!`);
      onClose();
    } catch (err) {
      console.error(err);
      setError("Unable to connect to the authentication server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    setError("");

    const form = e?.currentTarget?.tagName === "FORM" ? e.currentTarget : e?.target?.closest ? e.target.closest("form") : null;
    const effectiveName = (form?.elements?.name?.value || name || "").trim();
    const effectiveEmail = (form?.elements?.email?.value || email || "").trim();
    const effectivePassword = form?.elements?.password?.value || password || "";

    if (effectiveName && effectiveName !== name) setName(effectiveName);
    if (effectiveEmail && effectiveEmail !== email) setEmail(effectiveEmail);
    if (effectivePassword && effectivePassword !== password) setPassword(effectivePassword);

    if (!effectiveEmail || (authMode !== "forgot" && !effectivePassword) || (authMode === "signup" && !effectiveName)) {
      setError("Please fill in all required fields.");
      return;
    }

    if (authMode === "signup" && effectiveName.length < 2) {
      setError("Full Name is required (minimum 2 characters).");
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(effectiveEmail)) {
      setError("Please provide a valid email address (e.g. name@gmail.com).");
      return;
    }

    // Enforce strong password on signup
    const effectiveChecks = {
      length: effectivePassword.length >= 8,
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(effectivePassword),
      uppercase: /[A-Z]/.test(effectivePassword),
      number: /[0-9]/.test(effectivePassword),
    };
    const isEffectivePasswordStrong = effectiveChecks.length && effectiveChecks.special && effectiveChecks.uppercase && effectiveChecks.number;

    if (authMode === "signup" && !isEffectivePasswordStrong) {
      setError("Password must be 8+ characters with uppercase, number, and special character.");
      return;
    }

    // Enforce minimum length on login too
    if (authMode === "login" && effectivePassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    setLoadingText("Sending verification code...");
    const t1 = setTimeout(() => setLoadingText("Connecting to server (Render free tier waking up)..."), 3500);
    const t2 = setTimeout(() => setLoadingText("Dispatching email via Brevo..."), 10000);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: effectiveName, email: effectiveEmail, password: effectivePassword, mode: authMode }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      clearTimeout(t1);
      clearTimeout(t2);

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || "Unable to send verification code.");
        return;
      }

      setStep("otp");
      if (authMode === "forgot") {
        setPassword("");
      }
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpTimer(45);
      setResendActive(false);
      notify("🔐 Verification code sent to your email.");

      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 150);
    } catch (err) {
      clearTimeout(timeoutId);
      clearTimeout(t1);
      clearTimeout(t2);
      console.error(err);
      if (err.name === "AbortError") {
        setError("Server response took too long. Please tap Send again.");
      } else {
        setError("Unable to connect to the authentication server. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!resendActive || loading) return;

    setLoading(true);
    setLoadingText("Resending code...");
    setError("");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, mode: authMode }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || "Failed to resend verification code.");
        return;
      }

      setOtpDigits(["", "", "", "", "", ""]);
      setOtpTimer(45);
      setResendActive(false);
      notify("New verification code sent to your email.");

      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
    } catch (err) {
      clearTimeout(timeoutId);
      console.error(err);
      if (err.name === "AbortError") {
        setError("Resend timed out. Please try again.");
      } else {
        setError("Unable to resend verification code.");
      }
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

    const form = e?.currentTarget?.tagName === "FORM" ? e.currentTarget : e?.target?.closest ? e.target.closest("form") : null;
    const effectiveName = (form?.elements?.name?.value || name || "").trim();
    const effectiveEmail = (form?.elements?.email?.value || email || "").trim();
    const effectivePassword = form?.elements?.password?.value || form?.elements?.newPassword?.value || password || "";

    if (authMode === "forgot") {
      const pwdChecks = {
        length: effectivePassword.length >= 8,
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(effectivePassword),
        uppercase: /[A-Z]/.test(effectivePassword),
        number: /[0-9]/.test(effectivePassword),
      };
      const isPwdValid = pwdChecks.length && pwdChecks.special && pwdChecks.uppercase && pwdChecks.number;
      if (!isPwdValid) {
        setError("New password must be 8+ characters with uppercase, number, and special character.");
        return;
      }
    }

    setLoading(true);

    try {
      let endpoint = "/api/auth/login";
      let body = { email: effectiveEmail, password: effectivePassword, otp: enteredOtp };

      if (authMode === "signup") {
        endpoint = "/api/auth/signup";
        body = { name: effectiveName, email: effectiveEmail, password: effectivePassword, otp: enteredOtp };
      } else if (authMode === "forgot") {
        endpoint = "/api/auth/reset-password";
        body = { email: effectiveEmail, otp: enteredOtp, newPassword: effectivePassword };
      }

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
      localStorage.setItem("rockgpt-user", JSON.stringify(data.user));
      onSuccess(data.user, data.token);
      notify(
        authMode === "forgot"
          ? "🎉 Password reset successfully! Welcome back."
          : `Welcome${authMode === "signup" ? "" : " back"}, ${data.user.name}!`
      );
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
      className="fixed inset-0 z-[92] grid place-items-center bg-[#070707]/95 p-4 fade backdrop-blur-2xl select-none"
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
            {/* Clear Mode Switcher Segmented Tabs */}
            {authMode !== "forgot" && (
              <div className="mb-4 grid grid-cols-2 rounded-xl bg-white/[0.05] p-1 border border-white/10">
                <button
                  type="button"
                  onClick={() => switchAuthMode("login")}
                  className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                    authMode === "login"
                      ? "bg-white text-black shadow-sm"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => switchAuthMode("signup")}
                  className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                    authMode === "signup"
                      ? "bg-white text-black shadow-sm"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Create Account
                </button>
              </div>
            )}

            <div className="mb-5 text-center">
              <div className="mx-auto mb-2.5 grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.08] text-white shadow-inner border border-white/10">
                {authMode === "forgot" ? <KeyRound size={22} /> : <Shield size={22} />}
              </div>
              <h2 className="text-lg font-bold tracking-tight">
                {isGateLocked
                  ? "Preserve Your Workspace"
                  : authMode === "signup"
                  ? "Create Your Account"
                  : authMode === "forgot"
                  ? "Reset Your Password"
                  : "Sign In to RockGPT"}
              </h2>
              <p className={`mt-1 text-xs leading-5 ${dark ? "text-neutral-400" : "text-neutral-500"}`}>
                {authMode === "signup"
                  ? "Sign up with email to unlock cloud sync & personal memory."
                  : authMode === "forgot"
                  ? "Enter your registered email to receive a password reset code."
                  : "Sign in with your email and password to access your chats."}
              </p>
            </div>

            <form onSubmit={authMode === "login" ? handleDirectLogin : handleRequestOtp} className="space-y-2.5">
              {authMode === "signup" && (
                <div className="relative">
                  <User size={15} className="absolute left-3 top-3.5 text-neutral-500" />
                  <input
                    name="name"
                    id="auth-name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onInput={(e) => setName(e.target.value)}
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
                  name="email"
                  id="auth-email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onInput={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  type="email"
                  className={`w-full rounded-xl border py-2.5 pl-9 pr-3 text-xs outline-none transition ${
                    dark
                      ? "border-white/15 bg-white/[0.03] text-white focus:border-white/40"
                      : "border-neutral-300 bg-neutral-50 text-neutral-900 focus:border-neutral-500"
                  }`}
                />
              </div>

              {authMode !== "forgot" && (
                <div className="relative">
                  <KeyRound size={15} className="absolute left-3 top-3.5 text-neutral-500" />
                  <input
                    key={authMode}
                    name={authMode === "signup" ? "rockgpt_signup_pwd" : "password"}
                    id="auth-password"
                    autoComplete="off"
                    spellCheck="false"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onInput={(e) => setPassword(e.target.value)}
                    placeholder={authMode === "signup" ? "Create a strong password (min 8 chars)" : "Password"}
                    type={showPassword ? "text" : "password"}
                    className={`w-full rounded-xl border py-2.5 pl-9 pr-10 text-xs outline-none transition ${
                      dark
                        ? "border-white/15 bg-white/[0.03] text-white focus:border-white/40"
                        : "border-neutral-300 bg-neutral-50 text-neutral-900 focus:border-neutral-500"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-3 text-neutral-400 hover:text-white transition"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              )}

              {/* Forgot password link under password input on login */}
              {authMode === "login" && (
                <div className="flex justify-end pr-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() => switchAuthMode("forgot")}
                    className="text-[11px] font-semibold text-neutral-400 hover:text-white hover:underline transition"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

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

              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-400">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-400" />
                    <div className="flex-1">
                      <span>{error}</span>
                      {error.includes("sign in instead") && authMode === "signup" && (
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode("login");
                            setError("");
                          }}
                          className="mt-1.5 block text-xs font-bold text-white underline underline-offset-2 hover:text-neutral-300"
                        >
                          ➔ Switch to Sign In & Continue
                        </button>
                      )}
                      {error.includes("sign up first") && authMode === "login" && (
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode("signup");
                            setError("");
                          }}
                          className="mt-1.5 block text-xs font-bold text-white underline underline-offset-2 hover:text-neutral-300"
                        >
                          ➔ Switch to Sign Up & Create Account
                        </button>
                      )}
                      {(error.includes("Forgot password") || error.includes("Incorrect password")) && authMode === "login" && (
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode("forgot");
                            setError("");
                          }}
                          className="mt-1.5 block text-xs font-bold text-white underline underline-offset-2 hover:text-neutral-300"
                        >
                          ➔ Reset Forgotten Password with OTP
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition active:scale-[0.98] disabled:opacity-50 ${
                  dark ? "bg-white text-black hover:bg-neutral-200" : "bg-neutral-900 text-white hover:bg-neutral-800"
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>{loadingText}</span>
                  </>
                ) : (
                  <>
                    <span>
                      {authMode === "forgot"
                        ? "Send Reset Code"
                        : authMode === "signup"
                        ? "Send Verification Code"
                        : "Sign In"}
                    </span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 text-center">
              {authMode === "forgot" ? (
                <p className={`text-xs ${dark ? "text-neutral-400" : "text-neutral-500"}`}>
                  Remember your password?{" "}
                  <button
                    type="button"
                    onClick={() => switchAuthMode("login")}
                    className="font-bold underline underline-offset-2 hover:text-amber-500"
                  >
                    Sign In
                  </button>
                </p>
              ) : (
                <p className={`text-xs ${dark ? "text-neutral-400" : "text-neutral-500"}`}>
                  {authMode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
                  <button
                    type="button"
                    onClick={() => switchAuthMode(authMode === "signup" ? "login" : "signup")}
                    className="font-bold underline underline-offset-2 hover:text-amber-500"
                  >
                    {authMode === "signup" ? "Sign In" : "Sign Up"}
                  </button>
                </p>
              )}

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
              <h2 className="text-lg font-bold tracking-tight">
                {authMode === "forgot" ? "Reset Your Password" : "Enter Security Code"}
              </h2>
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

              {/* Set New Password field during password reset */}
              {authMode === "forgot" && (
                <div className="space-y-2 pt-1 text-left">
                  <label className={`block text-[11px] font-semibold uppercase tracking-wider ${dark ? "text-neutral-400" : "text-neutral-600"}`}>
                    Enter New Password
                  </label>
                  <div className="relative">
                    <KeyRound size={15} className="absolute left-3 top-3.5 text-neutral-500" />
                    <input
                      name="newPassword"
                      id="auth-new-password"
                      autoComplete="off"
                      spellCheck="false"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onInput={(e) => setPassword(e.target.value)}
                      placeholder="New Password (min 8 chars)"
                      type={showPassword ? "text" : "password"}
                      className={`w-full rounded-xl border py-2.5 pl-9 pr-10 text-xs outline-none transition ${
                        dark
                          ? "border-white/15 bg-white/[0.03] text-white focus:border-white/40"
                          : "border-neutral-300 bg-neutral-50 text-neutral-900 focus:border-neutral-500"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-3 text-neutral-400 hover:text-white transition"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {/* Password strength indicators */}
                  <div className={`rounded-xl border p-2.5 space-y-1 ${dark ? "border-white/10 bg-white/[0.02]" : "border-neutral-200 bg-neutral-50"}`}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.4)" }}>New Password Requirements</div>
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
                </div>
              )}

              {error && <p className="text-center text-xs text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading || otpDigits.join("").length < 6 || (authMode === "forgot" && !isPasswordStrong)}
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50 ${
                  dark ? "bg-white text-black hover:bg-neutral-200" : "bg-neutral-900 text-white hover:bg-neutral-800"
                }`}
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : authMode === "forgot" ? (
                  "Reset Password & Sign In"
                ) : (
                  "Verify Code & Proceed"
                )}
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
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[#070707]/95 p-3 sm:p-4 backdrop-blur-2xl transition-all fade select-none overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`pop relative my-auto flex max-h-[92vh] w-full max-w-[880px] flex-col overflow-hidden rounded-3xl border shadow-[0_0_60px_rgba(0,0,0,0.9)] transition-all duration-300 ${
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
   RAZORPAY SCRIPT DYNAMIC LOADER
   ========================================================================= */
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.getElementById("razorpay-checkout-script");
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.id = "razorpay-checkout-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/* =========================================================================
   COMPREHENSIVE CHECKOUT MODAL (AUTOMATED RAZORPAY + DIRECT UPI)
   ========================================================================= */
function UpiCheckoutModal({
  plan,
  onClose,
  notify,
  user,
  dark = true,
  authToken,
  onPaymentSuccess,
  onOpenAuth,
}) {
  const [activeTab, setActiveTab] = useState("auto"); // "auto" | "manual"
  const [copied, setCopied] = useState(false);
  const [utrNumber, setUtrNumber] = useState("");
  const [submittingManual, setSubmittingManual] = useState(false);
  const [submittedManual, setSubmittedManual] = useState(false);
  const [payingRazorpay, setPayingRazorpay] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

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

  const handleRazorpayCheckout = async () => {
    if (!user || !authToken) {
      notify("Please sign in or create an account first so your subscription is attached to your account.");
      if (onOpenAuth) onOpenAuth();
      return;
    }

    setPayingRazorpay(true);

    try {
      const scriptReady = await loadRazorpayScript();
      if (!scriptReady) {
        notify("Unable to load Razorpay checkout script. Please use direct UPI QR transfer.");
        setActiveTab("manual");
        setPayingRazorpay(false);
        return;
      }

      // Step 1: Request backend to create Razorpay Order
      const orderRes = await fetch(`${BACKEND_URL}/api/payment/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          planId: plan.id,
          billingCycle: plan.billingCycle,
        }),
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok || !orderData.orderId) {
        // If server indicates Razorpay keys are not configured yet, fallback gracefully
        const errorMsg = orderData.error || "Automated payment setup in progress.";
        notify(errorMsg);
        setActiveTab("manual");
        setPayingRazorpay(false);
        return;
      }

      // Step 2: Open Razorpay interactive checkout popup
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "RockGPT AI",
        description: `Upgrade to ${plan.name} (${plan.billingCycle === "yearly" ? "Annual" : "Monthly"})`,
        image: "https://api.dicebear.com/7.x/bottts/svg?seed=RockGPT",
        order_id: orderData.orderId,
        prefill: {
          name: user.name || "",
          email: user.email || "",
        },
        theme: {
          color: "#f59e0b",
        },
        handler: async function (response) {
          // Step 3: Verify cryptographic HMAC-SHA256 signature on backend
          setVerifyingPayment(true);
          try {
            const verifyRes = await fetch(`${BACKEND_URL}/api/payment/verify-payment`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planId: plan.id,
                billingCycle: plan.billingCycle,
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyRes.ok && verifyData.success) {
              if (onPaymentSuccess) {
                onPaymentSuccess(verifyData.user, verifyData.token);
              }
              notify(`🎉 Payment verified! Welcome to RockGPT ${verifyData.user.plan}!`);
              onClose();
            } else {
              notify(verifyData.error || "Verification failed. Please contact support with Ref: " + response.razorpay_payment_id);
            }
          } catch (verifyErr) {
            console.error("Verification error:", verifyErr);
            notify("Network verification failed: " + verifyErr.message);
          } finally {
            setVerifyingPayment(false);
            setPayingRazorpay(false);
          }
        },
        modal: {
          ondismiss: function () {
            setPayingRazorpay(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (failRes) {
        setPayingRazorpay(false);
        notify("Payment failed: " + (failRes.error?.description || "Transaction cancelled"));
      });
      rzp.open();
    } catch (err) {
      console.error("Checkout init error:", err);
      notify("Payment initiation error: " + err.message);
      setPayingRazorpay(false);
    }
  };

  const handleSubmitProof = (e) => {
    e.preventDefault();
    if (!utrNumber.trim()) {
      notify("Please enter your 12-digit UPI reference/UTR number");
      return;
    }
    setSubmittingManual(true);
    setTimeout(() => {
      setSubmittingManual(false);
      setSubmittedManual(true);
      notify("Payment submitted! Verifying your transaction.");
    }, 1200);
  };

  return (
    <div
      className="fixed inset-0 z-[96] flex items-center justify-center bg-[#070707]/95 p-3 sm:p-4 backdrop-blur-2xl transition-all fade select-none overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`pop relative my-auto max-h-[92vh] w-full max-w-[480px] overflow-y-auto thin rounded-3xl border p-5 shadow-[0_0_60px_rgba(0,0,0,0.9)] sm:max-h-[88vh] sm:p-6 ${
          dark ? "border-white/15 bg-[#141414] text-white" : "border-neutral-200 bg-white text-neutral-900"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Verification Loader Overlay */}
        {verifyingPayment && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-3xl bg-black/90 p-6 text-center backdrop-blur-md">
            <Loader2 size={44} className="animate-spin text-amber-400" />
            <h3 className="mt-4 text-base font-bold text-white">Verifying Secure Payment</h3>
            <p className="mt-1 text-xs text-neutral-400">
              Validating cryptographic HMAC-SHA256 signature with Razorpay...
            </p>
            <p className="mt-2 font-mono text-[11px] text-amber-400">
              Unlocking RockGPT 4o model in MongoDB...
            </p>
          </div>
        )}

        {/* Modal Header */}
        <div className={`flex items-center justify-between border-b pb-3 ${dark ? "border-white/10" : "border-neutral-200"}`}>
          <div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                dark ? "border border-amber-500/30 bg-amber-500/10 text-amber-400" : "bg-amber-100 text-amber-800"
              }`}>
                {plan.name} Tier
              </span>
              <span className={`text-[11px] ${dark ? "text-white/50" : "text-neutral-500"}`}>
                {plan.billingCycle === "yearly" ? "Annual Plan (Save 20%)" : "Monthly Plan"}
              </span>
            </div>
            <h3 className="mt-0.5 text-lg font-bold sm:text-xl">Checkout & Upgrade</h3>
          </div>
          <button
            onClick={onClose}
            className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${
              dark ? "text-white/50 hover:bg-white/10 hover:text-white" : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800"
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs: Automated Pay vs Direct UPI QR */}
        <div className="mt-3.5 grid grid-cols-2 gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("auto")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
              activeTab === "auto"
                ? dark
                  ? "bg-amber-500 text-black shadow-md font-bold"
                  : "bg-neutral-900 text-white shadow-md font-bold"
                : dark
                ? "text-white/60 hover:text-white"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            <Zap size={14} className={activeTab === "auto" ? "fill-current" : ""} />
            <span>⚡ Instant Auto-Pay</span>
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
              activeTab === "manual"
                ? dark
                  ? "bg-white text-black shadow-md font-bold"
                  : "bg-neutral-900 text-white shadow-md font-bold"
                : dark
                ? "text-white/60 hover:text-white"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            <QrCode size={14} />
            <span>Direct UPI QR</span>
          </button>
        </div>

        {/* TAB 1: AUTOMATED RAZORPAY CHECKOUT */}
        {activeTab === "auto" && (
          <div className="mt-4 space-y-4">
            {/* Price Summary Banner */}
            <div
              className={`flex items-center justify-between rounded-2xl border p-3.5 ${
                dark ? "border-amber-500/30 bg-amber-500/[0.06]" : "border-amber-200 bg-amber-50/70"
              }`}
            >
              <div>
                <div className="text-xs font-bold">RockGPT {plan.name} Subscription</div>
                <div className={`text-[11px] ${dark ? "text-white/60" : "text-neutral-600"}`}>
                  {plan.billingCycle === "yearly" ? "Billed annually (₹" + plan.activePrice + "/mo)" : "Billed monthly"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-extrabold tracking-tight text-amber-400">₹{totalAmount}</div>
                <div className="text-[10px] font-semibold text-emerald-500">Instant Activation</div>
              </div>
            </div>

            {/* Unauthenticated Guest Warning */}
            {!user ? (
              <div className={`rounded-2xl border p-4 text-center ${dark ? "border-amber-500/20 bg-amber-500/5" : "border-amber-200 bg-amber-50"}`}>
                <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-amber-500/10 text-amber-400">
                  <Lock size={18} />
                </div>
                <h4 className="text-xs font-bold">Sign In Required to Upgrade</h4>
                <p className={`mt-1 text-[11px] leading-relaxed ${dark ? "text-white/60" : "text-neutral-600"}`}>
                  Please sign in or create an account first so your subscription can be saved and activated immediately on your profile.
                </p>
                <button
                  onClick={() => {
                    onClose();
                    if (onOpenAuth) onOpenAuth();
                  }}
                  className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-black shadow-md hover:bg-amber-400"
                >
                  <User size={13} /> Sign In / Sign Up Now
                </button>
              </div>
            ) : (
              <>
                {/* Account info pill */}
                <div className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${
                  dark ? "border-white/10 bg-white/[0.03]" : "border-neutral-200 bg-neutral-50"
                }`}>
                  <span className={dark ? "text-white/50" : "text-neutral-500"}>Upgrading account:</span>
                  <span className="font-semibold text-amber-400 truncate max-w-[220px]">{user.email}</span>
                </div>

                {/* Supported Payment Channels */}
                <div className={`rounded-2xl border p-3.5 text-xs ${
                  dark ? "border-white/10 bg-white/[0.02]" : "border-neutral-200 bg-neutral-50"
                }`}>
                  <div className={`mb-2 text-[10px] font-bold uppercase tracking-wider ${dark ? "text-white/50" : "text-neutral-500"}`}>
                    Supported Instant Payment Methods
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className={`rounded-lg border p-2 ${dark ? "border-white/10 bg-white/5" : "border-neutral-200 bg-white"}`}>
                      <Smartphone size={15} className="mx-auto mb-1 text-emerald-400" />
                      <span className="font-semibold">UPI Apps</span>
                      <div className="text-[9px] text-neutral-400">GPay, PhonePe, Paytm</div>
                    </div>
                    <div className={`rounded-lg border p-2 ${dark ? "border-white/10 bg-white/5" : "border-neutral-200 bg-white"}`}>
                      <CreditCard size={15} className="mx-auto mb-1 text-blue-400" />
                      <span className="font-semibold">Cards</span>
                      <div className="text-[9px] text-neutral-400">Visa, MC, RuPay</div>
                    </div>
                    <div className={`rounded-lg border p-2 ${dark ? "border-white/10 bg-white/5" : "border-neutral-200 bg-white"}`}>
                      <Globe size={15} className="mx-auto mb-1 text-purple-400" />
                      <span className="font-semibold">NetBanking</span>
                      <div className="text-[9px] text-neutral-400">50+ Indian Banks</div>
                    </div>
                  </div>

                  <ul className="mt-3 space-y-1.5 text-[11px]">
                    <li className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 size={13} className="shrink-0" />
                      <span><strong>Instant unlock:</strong> RockGPT 4o is activated immediately after payment</span>
                    </li>
                    <li className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 size={13} className="shrink-0" />
                      <span><strong>Zero waiting:</strong> Database automatically upgraded in ~3 seconds</span>
                    </li>
                    <li className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 size={13} className="shrink-0" />
                      <span><strong>Safe & Encrypted:</strong> 256-bit bank-grade cryptographic security</span>
                    </li>
                  </ul>
                </div>

                {/* Instant Checkout Button */}
                <button
                  onClick={handleRazorpayCheckout}
                  disabled={payingRazorpay || verifyingPayment}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-3.5 text-xs font-extrabold uppercase tracking-wider text-black shadow-[0_0_30px_rgba(245,158,11,0.35)] transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50"
                >
                  {payingRazorpay ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-black" />
                      <span>Launching Secure Gateway...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={16} className="fill-current text-black" />
                      <span>Pay ₹{totalAmount} Instantly with Razorpay</span>
                      <ArrowRight size={15} className="text-black" />
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        )}

        {/* TAB 2: MANUAL DIRECT UPI QR CODE (FALLBACK) */}
        {activeTab === "manual" && (
          <div className="mt-4">
            {submittedManual ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="text-base font-bold">Transaction Reference Saved!</h4>
                <p className={`mt-2 text-xs leading-relaxed ${dark ? "text-white/60" : "text-neutral-600"}`}>
                  Thank you! Reference (<strong className={dark ? "text-white" : "text-neutral-900"}>{utrNumber}</strong>) received for <strong>{user?.email || "guest user"}</strong>. Your account will be verified and upgraded.
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
              <div className="space-y-4">
                <div
                  className={`flex items-center justify-between rounded-xl border p-3 ${
                    dark ? "border-white/10 bg-white/[0.03]" : "border-neutral-200 bg-neutral-50"
                  }`}
                >
                  <div>
                    <div className="text-xs font-medium">{plan.name} Plan ({plan.billingCycle})</div>
                    <div className={`text-[11px] ${dark ? "text-white/50" : "text-neutral-500"}`}>Direct UPI transfer</div>
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
                    disabled={submittingManual}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all active:scale-95 disabled:opacity-50 ${
                      dark ? "bg-white text-black hover:bg-neutral-200" : "bg-neutral-900 text-white hover:bg-neutral-800"
                    }`}
                  >
                    {submittingManual ? <Loader2 size={14} className="animate-spin" /> : "Submit UTR & Request Verification"}
                  </button>
                </form>
              </div>
            )}
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
      const savedUser = JSON.parse(localStorage.getItem("rockgpt-user") || "null");
      const key = savedUser?.id
        ? `rockgpt-conversations_${savedUser.id}`
        : savedUser?.email
        ? `rockgpt-conversations_${savedUser.email.replace(/[^a-zA-Z0-9]/g, "_")}`
        : "rockgpt-conversations_guest";
      const saved = localStorage.getItem(key) || localStorage.getItem("rockgpt-conversations");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeId, setActiveId] = useState(() => {
    return localStorage.getItem("rockgpt-active-id") || null;
  });
  const [messages, setMessages] = useState(() => {
    try {
      const savedActiveId = localStorage.getItem("rockgpt-active-id");
      const savedConvs = localStorage.getItem("rockgpt-conversations");
      if (savedActiveId && savedConvs) {
        const parsed = JSON.parse(savedConvs);
        const activeConv = parsed.find((c) => c.id === savedActiveId);
        if (activeConv && activeConv.messages) {
          return activeConv.messages.map((m) => ({ ...m, createdAt: new Date(m.createdAt) }));
        }
      }
    } catch {
      // ignore
    }
    return [];
  });
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
  const [headerProfileOpen, setHeaderProfileOpen] = useState(false);

  // --- Auth & Subscription State ---
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("rockgpt-user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("rockgpt-token") || null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const isPaidUser = Boolean(
    user &&
    (user.plan === "Plus" ||
     user.plan === "Pro" ||
     user.plan?.toLowerCase() === "plus" ||
     user.plan?.toLowerCase() === "pro")
  );

  const [selectedModel, setSelectedModel] = useState(() => {
    try {
      const savedUser = JSON.parse(localStorage.getItem("rockgpt-user") || "null");
      const isPaid = Boolean(
        savedUser &&
        (savedUser.plan === "Plus" ||
         savedUser.plan === "Pro" ||
         savedUser.plan?.toLowerCase() === "plus" ||
         savedUser.plan?.toLowerCase() === "pro")
      );
      const savedModel = localStorage.getItem("rockgpt-model");
      if (savedModel === "RockGPT 4o" && isPaid) return "RockGPT 4o";
      return "RockGPT Flash";
    } catch {
      return "RockGPT Flash";
    }
  });
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const [gateOpen, setGateOpen] = useState(() => !localStorage.getItem("rockgpt-token"));
  const [gateLocked, setGateLocked] = useState(false);
  const gateTimerRef = useRef(null);

  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const abortRef = useRef(null);
  const recognitionRef = useRef(null);
  const dark = theme === "dark";

  const getStorageKey = (u) => {
    if (u?.id) return `rockgpt-conversations_${u.id}`;
    if (u?.email) return `rockgpt-conversations_${u.email.replace(/[^a-zA-Z0-9]/g, "_")}`;
    return "rockgpt-conversations_guest";
  };

  useEffect(() => {
    try {
      const key = getStorageKey(user);
      localStorage.setItem(key, JSON.stringify(conversations));
    } catch (err) {
      console.error("Failed to save chats:", err);
    }
  }, [conversations, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming, typing]);

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
        setHeaderProfileOpen(false);
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
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401) {
            localStorage.removeItem("rockgpt-token");
            localStorage.removeItem("rockgpt-user");
            setAuthToken(null);
            setUser(null);
          }
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          localStorage.setItem("rockgpt-user", JSON.stringify(data.user));
        }
      })
      .catch(() => {
        // Retain cached session during network delay or cold start
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
      notify("🔒 RockGPT 4o requires a Plus or Pro subscription. Upgrade to unlock!");
      return;
    }
    setSelectedModel(modelName);
    localStorage.setItem("rockgpt-model", modelName);
    setModelDropdownOpen(false);
    notify(`Switched to ${modelName}`);
  };

  const handleAuthSuccess = (loggedUser, token) => {
    setUser(loggedUser);
    setAuthToken(token);
    localStorage.setItem("rockgpt-token", token);
    localStorage.setItem("rockgpt-user", JSON.stringify(loggedUser));
    setGateOpen(false);
    setGateLocked(false);

    // Wipe pre-login/guest chat so a clean, fresh new chat page arrives
    setActiveId(null);
    localStorage.removeItem("rockgpt-active-id");
    setMessages([]);
    setInput("");
    setStreaming("");
    setAttachment(null);
    setSidebarOpen(false);

    // Load logged-in user's private saved conversations
    try {
      const key = getStorageKey(loggedUser);
      const userSaved = localStorage.getItem(key);
      setConversations(userSaved ? JSON.parse(userSaved) : []);
    } catch {
      setConversations([]);
    }
  };

  const handlePaymentSuccess = (updatedUser, token) => {
    setUser(updatedUser);
    if (token) {
      setAuthToken(token);
      localStorage.setItem("rockgpt-token", token);
    }
    localStorage.setItem("rockgpt-user", JSON.stringify(updatedUser));
    setSelectedModel("RockGPT 4o");
    localStorage.setItem("rockgpt-model", "RockGPT 4o");
  };

  // EXPLICIT LOGOUT FUNCTION
  const logout = () => {
    localStorage.removeItem("rockgpt-token");
    localStorage.removeItem("rockgpt-user");
    setAuthToken(null);
    setUser(null);
    setAuthModalOpen(false);
    setGateOpen(false);
    setProfileMenuOpen(false);
    setHeaderProfileOpen(false);

    // Wipe user chats so guest starts fresh on a clean new page
    setActiveId(null);
    localStorage.removeItem("rockgpt-active-id");
    setMessages([]);
    setInput("");
    setStreaming("");
    setAttachment(null);
    setSelectedModel("RockGPT Flash");

    // Load clean guest conversations
    try {
      const guestSaved = localStorage.getItem("rockgpt-conversations_guest");
      setConversations(guestSaved ? JSON.parse(guestSaved) : []);
    } catch {
      setConversations([]);
    }

    notify("Logged out successfully");
  };

  const newChat = useCallback(() => {
    setActiveId(null);
    localStorage.removeItem("rockgpt-active-id");
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
    localStorage.setItem("rockgpt-active-id", id);
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
      localStorage.setItem("rockgpt-active-id", id);
    } else {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, messages: [...c.messages, firstMessage], updatedAt: new Date() } : c))
      );
    }
    return id;
  };

  const streamFromBackend = async (history, convId) => {
    setStreaming("");
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
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const raw = line.slice(6).trim();
            if (!raw || raw === "[DONE]") continue;
            const parsed = JSON.parse(raw);
            if (parsed.token) {
              fullText += parsed.token;
              setStreaming(fullText);
            }
            if (parsed.error) {
              fullText = parsed.error;
              setStreaming(fullText);
            }
          } catch {
            // safely ignore partial or fragmented SSE line
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Stream error:", err);
        fullText = "Failed to reach RockGPT backend. Please try again.";
        setStreaming(fullText);
      }
    } finally {
      setStreaming("");
      setTyping(false);
      abortRef.current = null;
      if (fullText.trim()) {
        const m = { id: uid("msg"), role: "assistant", content: fullText, createdAt: new Date(), liked: null };
        setMessages((prev) => [...prev, m]);
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, messages: [...c.messages, m], updatedAt: new Date() } : c))
        );
      }
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
    if (activeId === id) {
      localStorage.removeItem("rockgpt-active-id");
      newChat();
    }
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

  return (
    <div
      className="relative flex h-[100dvh] min-h-screen w-full overflow-hidden font-sans antialiased"
      style={{ background: surface, color: textColor, overscrollBehaviorY: "none" }}
    >
      {showIntro && (
        <IntroScreen
          onDone={() => {
            setShowIntro(false);
          }}
        />
      )}
      <style>{`
        html, body, #root { 
          height: 100%; 
          margin: 0; 
          padding: 0; 
          background: ${surface}; 
          overscroll-behavior-y: none;
        }
        *, *::before, *::after { 
          box-sizing: border-box; 
          -webkit-tap-highlight-color: transparent; 
        }
        /* Completely eliminate blinking text caret (|) when clicking or tapping non-editable text */
        *:not(input):not(textarea):not([contenteditable="true"]) {
          caret-color: transparent !important;
        }
        input, textarea, [contenteditable="true"] {
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          -ms-user-select: text !important;
          user-select: text !important;
          caret-color: ${dark ? "#ffffff" : "#000000"} !important;
        }
        /* Eliminate browser autofill light blue background */
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px ${dark ? "#141414" : "#ffffff"} inset !important;
          -webkit-text-fill-color: ${dark ? "#ffffff" : "#0f172a"} !important;
          caret-color: ${dark ? "#ffffff" : "#000000"} !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        /* Make all message text, replied content, code blocks, and markdown fully selectable with cursor */
        .selectable-text,
        .selectable-text *,
        .message-content,
        .message-content *,
        .chat-bubble,
        .chat-bubble *,
        .chat-text,
        .chat-text *,
        pre, pre *, code, code *, p, h1, h2, h3, h4, h5, h6, li, blockquote, strong, em {
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          -ms-user-select: text !important;
          user-select: text !important;
        }
        button, a, [role="button"], .select-none {
          -webkit-user-select: none !important;
          user-select: none !important;
        }
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

        /* Coordinated Chat UI Entrance */
        .chat-enter-header {
          animation: enterHeader 450ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .chat-enter-main {
          animation: enterMain 500ms cubic-bezier(0.16, 1, 0.3, 1) 60ms both;
        }
        .chat-enter-composer {
          animation: enterComposer 520ms cubic-bezier(0.16, 1, 0.3, 1) 120ms both;
        }
        @keyframes enterHeader {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes enterMain {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes enterComposer {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Natural Message Entrance */
        .user-msg-enter {
          animation: userMsgEnter 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes userMsgEnter {
          from { opacity: 0; transform: translateY(8px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .assistant-msg-enter {
          animation: assistantMsgEnter 300ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes assistantMsgEnter {
          from { opacity: 0; transform: translateY(6px); filter: blur(2px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }

        /* Staggered Pulsing Thinking Dots */
        @keyframes thinkingDot {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.8) translateY(0); }
          40% { opacity: 1; transform: scale(1.15) translateY(-2px); }
        }
        .thinking-dot-1 { animation: thinkingDot 1.4s ease-in-out infinite; animation-delay: 0s; }
        .thinking-dot-2 { animation: thinkingDot 1.4s ease-in-out infinite; animation-delay: 0.22s; }
        .thinking-dot-3 { animation: thinkingDot 1.4s ease-in-out infinite; animation-delay: 0.44s; }

        /* Subtle Avatar Presence Glow While Thinking */
        @keyframes avatarThinkingPulse {
          0%, 100% { filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.35)); transform: scale(1); }
          50% { filter: drop-shadow(0 0 14px rgba(56, 189, 248, 0.7)) drop-shadow(0 0 8px rgba(168, 85, 247, 0.4)); transform: scale(1.03); }
        }
        .avatar-thinking {
          animation: avatarThinkingPulse 2.4s ease-in-out infinite;
        }

        /* Accessibility: prefers-reduced-motion */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-7px) scale(1.02); }
        }
        @keyframes pulseGlow { 0% { box-shadow: 0 0 10px rgba(245,158,11,0.2); } 50% { box-shadow: 0 0 25px rgba(245,158,11,0.45); } 100% { box-shadow: 0 0 10px rgba(245,158,11,0.2); } }
        .pulse-glow { animation: pulseGlow 3s ease-in-out infinite; }
        @keyframes blink { 50% { opacity:.35 } }
        .cursor-blink { animation: blink 1s step-end infinite; }
        @keyframes dotBounce { 0%, 60%, 100% { transform: translateY(0); opacity:.4 } 30% { transform: translateY(-5px); opacity:1 } }
        .dot-bounce { animation: dotBounce 1.1s ease-in-out infinite; }
        @keyframes auroraShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .aurora-shimmer {
          background: linear-gradient(90deg, rgba(245,158,11,0.1) 0%, rgba(168,85,247,0.45) 50%, rgba(59,130,246,0.3) 100%);
          background-size: 200% 100%;
          animation: auroraShimmer 2.2s ease-in-out infinite;
        }
        @keyframes streamCursorPulse {
          0%, 100% { opacity: 1; transform: scaleY(1); }
          50% { opacity: 0.15; transform: scaleY(0.7); }
        }
        .stream-cursor {
          animation: streamCursorPulse 0.75s ease-in-out infinite;
        }
        @keyframes waveBars {
          0%, 100% { height: 4px; }
          50% { height: 14px; }
        }
        @keyframes workingShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes workingGlow {
          0%, 100% {
            filter: drop-shadow(0 0 5px rgba(56, 189, 248, 0.45)) drop-shadow(0 0 1px rgba(245, 158, 11, 0.25));
          }
          50% {
            filter: drop-shadow(0 0 9px rgba(96, 165, 250, 0.65)) drop-shadow(0 0 3px rgba(245, 158, 11, 0.4));
          }
        }
        .working-shimmer-text {
          display: inline-flex;
          align-items: center;
          font-size: 15px;
          font-weight: 500;
          letter-spacing: -0.01em;
          background: linear-gradient(
            90deg,
            #60a5fa 0%,
            #38bdf8 22%,
            #ffffff 48%,
            #fef08a 70%,
            #f59e0b 86%,
            #60a5fa 100%
          );
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          animation: workingShimmer 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite, workingGlow 3s ease-in-out infinite;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .working-shimmer-text-light {
          display: inline-flex;
          align-items: center;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.01em;
          background: linear-gradient(
            90deg,
            #2563eb 0%,
            #0284c7 25%,
            #0f172a 50%,
            #d97706 75%,
            #2563eb 100%
          );
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          animation: workingShimmer 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
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
              className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-sm font-medium transition-all active:scale-[0.98] ${
                dark
                  ? "border-white/10 bg-white/[0.05] text-white hover:border-white/20 hover:bg-white/[0.08]"
                  : "border-neutral-200 bg-neutral-100 text-neutral-900 hover:border-neutral-300 hover:bg-neutral-200"
              }`}
            >
              <Crown size={17} className="text-amber-400" />
              <div className="flex-1 text-left">
                <div className="leading-tight text-[13px] font-semibold">
                  {isPaidUser ? "Manage Subscription" : "Upgrade plan"}
                </div>
                <div className="text-[11px] text-neutral-400">
                  {isPaidUser ? `Current: ${user.plan}` : "Unlock RockGPT 4o"}
                </div>
              </div>
              <ChevronRight size={14} className="text-neutral-500" />
            </button>

            {/* Theme Switcher in Sidebar */}
            <div
              className={`flex items-center justify-between rounded-xl border p-1.5 transition ${
                dark ? "border-white/10 bg-white/[0.03]" : "border-neutral-200 bg-neutral-100"
              }`}
            >
              <div className="flex items-center gap-2 pl-2">
                {dark ? <Moon size={15} className="text-white/80" /> : <Sun size={15} className="text-neutral-800" />}
                <span className={`text-xs font-semibold ${dark ? "text-white" : "text-neutral-900"}`}>Theme</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    !dark
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <Sun size={12} /> Light
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    dark
                      ? "bg-white text-black shadow-sm font-semibold"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  <Moon size={12} /> Dark
                </button>
              </div>
            </div>

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
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-neutral-700 via-neutral-800 to-neutral-900 border border-white/20 font-bold text-white text-xs shadow-sm">
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
        {/* Top Header — Seamless Frosted Header Flowing Directly into Canvas */}
        <header
          className="chat-enter-header flex h-[58px] shrink-0 items-center justify-between px-3 sm:px-5 relative z-30 select-none"
          style={{
            background: "transparent",
          }}
        >
          {/* Left: Circular Frosted Menu Button */}
          <button
            onClick={() => setSidebarOpen(true)}
            title="Open sidebar"
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-all active:scale-95 shadow-sm ${
              dark
                ? "border-white/10 bg-white/[0.06] text-white/90 hover:border-white/20 hover:bg-white/[0.12] hover:text-white"
                : "border-black/10 bg-black/[0.05] text-neutral-800 hover:border-black/20 hover:bg-black/[0.09]"
            }`}
          >
            <Menu size={19} strokeWidth={2.2} />
          </button>

          {/* Center: Futuristic Frosted Model Selector Pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setModelDropdownOpen((v) => !v)}
              className={`group flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs sm:text-[13px] font-semibold tracking-tight transition-all select-none cursor-pointer active:scale-95 shadow-sm backdrop-blur-md ${
                dark
                  ? "border-white/15 bg-white/[0.07] text-white hover:border-white/30 hover:bg-white/[0.12]"
                  : "border-neutral-200 bg-neutral-100/90 text-neutral-900 hover:border-neutral-300 hover:bg-neutral-200"
              }`}
            >
              {selectedModel === "RockGPT Flash" ? (
                <div className="flex items-center justify-center h-4 w-4 rounded-full bg-sky-500/20 text-sky-400">
                  <Zap size={11} className="fill-current" />
                </div>
              ) : (
                <div className="flex items-center justify-center h-4 w-4 rounded-full bg-amber-500/20 text-amber-400">
                  <Sparkles size={11} className="fill-current" />
                </div>
              )}
              <span className="font-semibold text-sm">{selectedModel}</span>
              <span
                className={`hidden xs:inline-block rounded-full px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider ${
                  selectedModel === "RockGPT Flash"
                    ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                    : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                }`}
              >
                {selectedModel === "RockGPT Flash" ? "Flash" : "4o Omni"}
              </span>
              <ChevronDown
                size={13}
                className={`transition-transform duration-200 ${
                  modelDropdownOpen ? "rotate-180 text-white" : dark ? "text-neutral-400 group-hover:text-white" : "text-neutral-500 group-hover:text-black"
                }`}
              />
            </button>

            {modelDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setModelDropdownOpen(false)} />
                <div
                  className={`absolute left-1/2 -translate-x-1/2 top-11 z-50 w-72 max-w-[90vw] rounded-2xl border p-2 shadow-2xl pop backdrop-blur-xl ${
                    dark ? "border-white/15 bg-[#141416]/95" : "border-neutral-200 bg-white/95"
                  }`}
                >
                  {/* RockGPT 4o option */}
                  <button
                    type="button"
                    onClick={() => handleModelSelect("RockGPT 4o")}
                    className={`flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left transition select-none touch-manipulation cursor-pointer ${
                      selectedModel === "RockGPT 4o"
                        ? dark
                          ? "bg-amber-500/15 border border-amber-500/30"
                          : "bg-amber-50 border border-amber-300"
                        : dark
                        ? "hover:bg-white/5 border border-transparent"
                        : "hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <Sparkles size={16} className={`mt-0.5 shrink-0 ${dark ? "text-yellow-400" : "text-amber-600"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${dark ? "text-white" : "text-neutral-900"}`}>
                          RockGPT 4o
                        </span>
                        {isPaidUser ? (
                          selectedModel === "RockGPT 4o" ? (
                            <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-400">
                              <Check size={10} /> Active
                            </span>
                          ) : (
                            <span className="rounded-full bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-400">
                              Smartest 120B
                            </span>
                          )
                        ) : (
                          <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-500">
                            <Lock size={9} /> Plus/Pro
                          </span>
                        )}
                      </div>
                      <div className={`mt-0.5 text-[10px] leading-tight ${dark ? "text-white/60" : "text-neutral-500"}`}>
                        {isPaidUser
                          ? "Deep reasoning, complex logic, and advanced coding"
                          : "Locked • Requires Plus or Pro subscription"}
                      </div>
                    </div>
                  </button>

                  {/* RockGPT Flash option */}
                  <button
                    type="button"
                    onClick={() => handleModelSelect("RockGPT Flash")}
                    className={`mt-1 flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left transition select-none touch-manipulation cursor-pointer ${
                      selectedModel === "RockGPT Flash"
                        ? dark
                          ? "bg-sky-500/15 border border-sky-500/30"
                          : "bg-sky-50 border border-sky-300"
                        : dark
                        ? "hover:bg-white/5 border border-transparent"
                        : "hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <Zap size={16} className="mt-0.5 shrink-0 text-sky-400 fill-sky-400/20" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${dark ? "text-white" : "text-neutral-900"}`}>
                          RockGPT Flash
                        </span>
                        {selectedModel === "RockGPT Flash" ? (
                          <span className="flex items-center gap-1 rounded-full bg-sky-500/20 px-2 py-0.5 text-[9px] font-bold text-sky-400">
                            <Check size={10} /> Active
                          </span>
                        ) : (
                          <span className="rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-bold text-sky-400">
                            Free 20B
                          </span>
                        )}
                      </div>
                      <div className={`mt-0.5 text-[10px] leading-tight ${dark ? "text-white/60" : "text-neutral-500"}`}>
                        Lightning fast responses for daily questions and brainstorming
                      </div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Right: Circular New Chat Button (Mobile) & Desktop Controls */}
          <div className="flex items-center gap-2">
            {!isPaidUser && (
              <button
                onClick={() => setPricingOpen(true)}
                className={`hidden sm:flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition active:scale-95 shadow-sm ${
                  dark
                    ? "border-white/15 bg-white/[0.08] text-white hover:bg-white/[0.14]"
                    : "border-neutral-200 bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
                }`}
              >
                <Crown size={14} className="text-amber-400" />
                <span className="font-semibold">Upgrade</span>
              </button>
            )}

            {activeId && (
              <button
                onClick={exportChat}
                title="Export chat"
                className={`hidden h-10 w-10 place-items-center rounded-full border transition sm:grid shadow-sm ${
                  dark
                    ? "border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/[0.12] hover:text-white"
                    : "border-black/10 bg-black/[0.05] text-neutral-700 hover:bg-black/[0.09]"
                }`}
              >
                <Download size={16} />
              </button>
            )}

            {/* Circular Frosted New Chat Button */}
            <button
              onClick={newChat}
              title="New chat"
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-all active:scale-95 shadow-sm ${
                dark
                  ? "border-white/10 bg-white/[0.06] text-white/90 hover:border-white/20 hover:bg-white/[0.12] hover:text-white"
                  : "border-black/10 bg-black/[0.05] text-neutral-800 hover:border-black/20 hover:bg-black/[0.09]"
              }`}
            >
              <SquarePen size={18} strokeWidth={2.2} />
            </button>

            {/* Desktop Profile Avatar */}
            <div className="relative hidden sm:block">
              {user ? (
                <button
                  onClick={() => setHeaderProfileOpen((v) => !v)}
                  title="Account menu & logout"
                  className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-neutral-700 via-neutral-800 to-neutral-900 border border-white/20 font-bold text-white text-xs shadow-sm hover:scale-105 transition"
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

              {headerProfileOpen && user && (
                <>
                  <div className="fixed inset-0 z-50" onClick={() => setHeaderProfileOpen(false)} />
                  <div
                    className={`absolute right-0 top-11 z-50 w-64 rounded-2xl border p-2 shadow-2xl pop ${
                      dark ? "border-white/15 bg-[#161616] text-white" : "border-neutral-200 bg-white text-neutral-900 shadow-xl"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 border-b pb-3 px-2 pt-1" style={{ borderColor: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}>
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-neutral-700 via-neutral-800 to-neutral-900 border border-white/20 font-bold text-white shadow-sm">
                        {user.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold">{user.name}</div>
                        <div className="truncate text-[10px] text-neutral-400">{user.email}</div>
                        <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          user.plan === "Plus" || user.plan === "Pro"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-neutral-500/20 text-neutral-400"
                        }`}>{user.plan || "Free"} Plan</span>
                      </div>
                    </div>
                    <div className="pt-2 space-y-0.5">
                      <button onClick={() => { setHeaderProfileOpen(false); setPricingOpen(true); }} className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition ${dark ? "hover:bg-white/[0.08]" : "hover:bg-neutral-100"}`}>
                        <Crown size={15} className="text-amber-500" /> <span className="flex-1">Upgrade / Subscription</span>
                      </button>
                      <button onClick={() => { setHeaderProfileOpen(false); setSettingsOpen(true); }} className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition ${dark ? "hover:bg-white/[0.08]" : "hover:bg-neutral-100"}`}>
                        <Settings size={15} className="text-neutral-400" /> <span className="flex-1">Settings</span>
                      </button>
                      <div className="my-1 border-t" style={{ borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }} />
                      <button onClick={() => { setHeaderProfileOpen(false); logout(); }} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-red-500 hover:bg-red-500/10 transition">
                        <LogOut size={15} /> <span className="flex-1">Log out of RockGPT</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Chat Message Window */}
        <section className="thin flex-1 overflow-y-auto">
          {messages.length === 0 && !typing ? (
            <div className="mx-auto flex h-full max-w-[760px] flex-col justify-end px-4 pb-4 sm:px-6 chat-enter-main">
              {/* Prominent, Welcoming Greeting Header */}
              <div className="mb-7 sm:mb-9 text-left select-none">
                <div className="flex items-center gap-2.5 mb-3">
                  <RockMark size={32} dark={dark} animated />
                  <span className="text-xs font-semibold tracking-wider uppercase text-neutral-400">RockGPT Intelligence</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                  What's on your mind today?
                </h1>
                <p className="text-xs sm:text-sm text-neutral-400 mt-1.5 leading-relaxed">
                  Ask anything, write and debug code, explore concepts, or spark new creative ideas.
                </p>
              </div>

              <div className="flex flex-col gap-2 pb-2">
                <button
                  type="button"
                  onClick={() => {
                    setInput("Help me write, review, or debug code for: ");
                    inputRef.current?.focus();
                  }}
                  className={`flex items-center gap-3.5 rounded-2xl px-3.5 py-3 text-left transition active:scale-[0.99] select-none ${
                    dark
                      ? "text-white/90 hover:bg-white/[0.07] active:bg-white/[0.10]"
                      : "text-neutral-800 hover:bg-black/[0.05] active:bg-black/[0.08]"
                  }`}
                >
                  <Code2 size={20} className={dark ? "text-white/80" : "text-neutral-700"} strokeWidth={2} />
                  <span className="text-[15px] font-medium tracking-normal">Write code or debug</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInput("Help me write, draft, or polish: ");
                    inputRef.current?.focus();
                  }}
                  className={`flex items-center gap-3.5 rounded-2xl px-3.5 py-3 text-left transition active:scale-[0.99] select-none ${
                    dark
                      ? "text-white/90 hover:bg-white/[0.07] active:bg-white/[0.10]"
                      : "text-neutral-800 hover:bg-black/[0.05] active:bg-black/[0.08]"
                  }`}
                >
                  <PenLine size={20} className={dark ? "text-white/80" : "text-neutral-700"} strokeWidth={2} />
                  <span className="text-[15px] font-medium tracking-normal">Write or edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInput("Explain step-by-step and analyze: ");
                    inputRef.current?.focus();
                  }}
                  className={`flex items-center gap-3.5 rounded-2xl px-3.5 py-3 text-left transition active:scale-[0.99] select-none ${
                    dark
                      ? "text-white/90 hover:bg-white/[0.07] active:bg-white/[0.10]"
                      : "text-neutral-800 hover:bg-black/[0.05] active:bg-black/[0.08]"
                  }`}
                >
                  <Sparkles size={20} className={dark ? "text-white/80" : "text-neutral-700"} strokeWidth={2} />
                  <span className="text-[15px] font-medium tracking-normal">Ask anything or analyze</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-[780px] px-3 py-6 sm:px-6 sm:py-8">
              {messages.map((m, i) => (
                <div key={m.id} className={`${m.role === "user" ? "user-msg-enter" : "assistant-msg-enter"} mb-6 sm:mb-7`}>
                  {m.role === "user" ? (
                    <div className="flex flex-col items-end">
                      <div
                        className={`chat-bubble message-content select-text max-w-[86%] sm:max-w-[76%] rounded-[22px] rounded-br-[6px] px-4 py-3 text-[15px] sm:text-[16px] leading-relaxed shadow-sm ${
                          dark
                            ? "bg-[#262626] text-white"
                            : "bg-neutral-200 text-neutral-900"
                        }`}
                      >
                        {m.attachment?.kind === "image" && (
                          <img
                            src={m.attachment.dataUrl}
                            alt={m.attachment.name}
                            className="mb-2 max-h-60 rounded-xl object-cover"
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
                        <p className="whitespace-pre-wrap select-text cursor-text">
                          {m.displayText || (typeof m.content === "string" ? m.content : "")}
                        </p>
                      </div>

                      <div className="mt-1 mr-1 flex items-center gap-1 opacity-60 hover:opacity-100 transition select-none">
                        <button
                          onClick={() => copyMessage(m)}
                          className={`rounded-lg p-1.5 text-xs transition ${
                            dark ? "text-white/50 hover:bg-white/10 hover:text-white" : "text-neutral-500 hover:bg-black/5"
                          }`}
                          title="Copy message"
                        >
                          {copied === m.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                        <button
                          onClick={() => {
                            setEditing(m.id);
                            setEditText(m.displayText || m.content || "");
                          }}
                          className={`rounded-lg p-1.5 text-xs transition ${
                            dark ? "text-white/50 hover:bg-white/10 hover:text-white" : "text-neutral-500 hover:bg-black/5"
                          }`}
                          title="Edit prompt"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-start w-full">
                      {editing === m.id ? (
                        <div className="w-full rounded-2xl border p-3" style={{ borderColor: border }}>
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="min-h-[100px] w-full resize-none bg-transparent text-sm leading-6 outline-none"
                            style={{ caretColor: dark ? "#ffffff" : "#000000" }}
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
                        <div className="w-full text-[15px] sm:text-[16px] leading-relaxed message-content select-text cursor-text">
                          <MessageContent content={m.content} dark={dark} />
                        </div>
                      )}

                      <div className="mt-2.5 flex items-center gap-1 text-neutral-400 select-none">
                        <button
                          onClick={() => copyMessage(m)}
                          className={`rounded-lg p-1.5 transition ${
                            dark ? "text-white/40 hover:bg-white/[.06] hover:text-white" : "text-neutral-400 hover:bg-black/[.06] hover:text-neutral-900"
                          }`}
                          title="Copy message"
                        >
                          {copied === m.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>

                        {typeof m.content === "string" && (
                          <button
                            onClick={() => toggleSpeech(m.id, m.content)}
                            className={`rounded-lg p-1.5 transition ${
                              speakingId === m.id
                                ? "text-blue-500 bg-blue-500/10"
                                : dark
                                ? "text-white/40 hover:bg-white/[.06] hover:text-white"
                                : "text-neutral-400 hover:bg-black/[.06] hover:text-neutral-900"
                            }`}
                            title={speakingId === m.id ? "Stop voice" : "Read aloud"}
                          >
                            {speakingId === m.id ? <VolumeX size={14} /> : <Volume2 size={14} />}
                          </button>
                        )}

                        <button
                          onClick={() =>
                            setMessages((prev) =>
                              prev.map((x) => (x.id === m.id ? { ...x, liked: x.liked === true ? null : true } : x))
                            )
                          }
                          className={`rounded-lg p-1.5 transition ${
                            m.liked === true
                              ? "text-emerald-500"
                              : dark
                              ? "text-white/40 hover:bg-white/[.06]"
                              : "text-neutral-400 hover:bg-black/[.06]"
                          }`}
                          title="Helpful"
                        >
                          <ThumbsUp size={14} />
                        </button>
                        <button
                          onClick={() =>
                            setMessages((prev) =>
                              prev.map((x) => (x.id === m.id ? { ...x, liked: x.liked === false ? null : false } : x))
                            )
                          }
                          className={`rounded-lg p-1.5 transition ${
                            m.liked === false
                              ? "text-red-500"
                              : dark
                              ? "text-white/40 hover:bg-white/[.06]"
                              : "text-neutral-400 hover:bg-black/[.06]"
                          }`}
                          title="Not helpful"
                        >
                          <ThumbsDown size={14} />
                        </button>
                        {i === messages.length - 1 && (
                          <button
                            onClick={regenerate}
                            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition ${
                              dark ? "text-white/50 hover:bg-white/[.06] hover:text-white" : "text-neutral-500 hover:bg-black/[.06] hover:text-neutral-900"
                            }`}
                          >
                            <RefreshCcw size={13} /> Regenerate
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {typing && (
                <div className="assistant-msg-enter mb-8 flex items-start gap-3">
                  {/* Avatar Icon */}
                  <div className="relative shrink-0 mt-0.5 select-none avatar-thinking">
                    <div
                      className={`grid h-8 w-8 place-items-center rounded-xl border shadow-sm overflow-hidden ${
                        dark
                          ? "border-sky-500/20 bg-[#121214] shadow-[0_0_14px_rgba(56,189,248,0.2)]"
                          : "border-sky-300 bg-white shadow-sm"
                      }`}
                    >
                      <RockMark size={22} dark={dark} />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 pt-0.5">
                    {!streaming ? (
                      <div className="flex items-center gap-2 py-1 select-none">
                        <span className={`text-[14.5px] font-medium tracking-tight ${dark ? "text-neutral-300" : "text-neutral-700"}`}>
                          RockGPT is thinking
                        </span>
                        <span className="inline-flex items-center gap-1 ml-0.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-400 thinking-dot-1" />
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 thinking-dot-2" />
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-400 thinking-dot-3" />
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 select-none">
                          <span className={`text-xs font-semibold tracking-tight ${dark ? "text-sky-400" : "text-sky-600"}`}>
                            RockGPT is responding
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="h-1 w-1 rounded-full bg-sky-400 thinking-dot-1" />
                            <span className="h-1 w-1 rounded-full bg-blue-400 thinking-dot-2" />
                            <span className="h-1 w-1 rounded-full bg-purple-400 thinking-dot-3" />
                          </span>
                        </div>
                        <div className={`text-[15px] leading-7 message-content select-text cursor-text ${dark ? "text-white/90" : "text-neutral-800"}`}>
                          <MessageContent content={streaming} dark={dark} />
                          <span className="inline-block w-2 h-4 ml-1 rounded-sm bg-white stream-cursor align-middle shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </section>

        {/* Input Bar — Floating Capsule Pill Matching Reference Image */}
        <div className="chat-enter-composer shrink-0 px-3 pb-3 pt-1 sm:px-4" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto max-w-[760px]">
            {attachment && (
              <div
                className={`mb-2 flex items-center gap-2 rounded-2xl border p-2 ${
                  dark ? "border-white/15 bg-white/[0.05]" : "border-neutral-200 bg-neutral-100"
                }`}
              >
                {attachment.kind === "image" ? (
                  <img src={attachment.dataUrl} alt={attachment.name} className="h-12 w-12 rounded-xl object-cover" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-xl border text-lg" style={{ borderColor: border }}>
                    📄
                  </div>
                )}
                <span className="flex-1 truncate text-xs" style={{ color: muted }}>{attachment.name}</span>
                <button onClick={() => setAttachment(null)} className="rounded-md p-1 hover:bg-black/10">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* The Capsule Pill */}
            <div
              className={`relative flex items-center gap-2 rounded-full border px-2.5 py-1.5 shadow-2xl transition-all duration-200 ${
                dark
                  ? "border-white/10 bg-[#1e1e20] focus-within:border-sky-500/40 focus-within:shadow-[0_0_20px_rgba(56,189,248,0.15)]"
                  : "border-neutral-300 bg-white focus-within:border-sky-500/40 focus-within:shadow-[0_0_20px_rgba(56,189,248,0.12)]"
              }`}
            >
              {/* Attachment '+' button */}
              <input ref={fileRef} type="file" accept="image/*,.txt,.md" className="hidden" onChange={handleFileSelect} />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAttachMenuOpen((v) => !v)}
                  title="Attach photo or file"
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${
                    dark ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-neutral-600 hover:bg-black/5 hover:text-black"
                  }`}
                >
                  <Plus size={20} strokeWidth={2.2} />
                </button>

                {attachMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setAttachMenuOpen(false)} />
                    <div
                      className={`absolute bottom-12 left-0 z-40 w-60 rounded-2xl border p-1.5 shadow-2xl pop ${
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

              {/* Text Input */}
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(140, Math.max(26, e.target.scrollHeight)) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                rows={1}
                placeholder={`Ask ${selectedModel}...`}
                className={`min-w-0 flex-1 resize-none bg-transparent py-1 text-[15px] sm:text-base leading-6 outline-none ${
                  dark ? "text-white placeholder:text-neutral-500" : "text-neutral-900 placeholder:text-neutral-400"
                }`}
                style={{ minHeight: "26px", maxHeight: "140px", caretColor: dark ? "#ffffff" : "#000000" }}
              />

              {/* Right actions inside capsule */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Microphone button */}
                <button
                  type="button"
                  onClick={toggleRecording}
                  title="Voice input"
                  className={`grid h-9 w-9 place-items-center rounded-full transition ${
                    recording
                      ? "bg-red-500 text-white animate-pulse"
                      : dark
                      ? "text-white/70 hover:bg-white/10 hover:text-white"
                      : "text-neutral-600 hover:bg-black/5 hover:text-black"
                  }`}
                >
                  <Mic size={19} />
                </button>

                {/* Morphing Voice Orb / Send Button */}
                {typing ? (
                  <button
                    onClick={stopGeneration}
                    className={`grid h-9 w-9 place-items-center rounded-full transition hover:scale-105 ${
                      dark ? "bg-white text-black" : "bg-neutral-900 text-white"
                    }`}
                    title="Stop generating"
                  >
                    <Square size={13} fill="currentColor" />
                  </button>
                ) : input.trim() || attachment ? (
                  <button
                    onClick={sendMessage}
                    className={`grid h-9 w-9 place-items-center rounded-full transition active:scale-95 shadow-md ${
                      dark
                        ? "bg-white text-black hover:bg-neutral-200"
                        : "bg-neutral-900 text-white hover:bg-black"
                    }`}
                    title="Send message"
                  >
                    <ArrowUp size={18} strokeWidth={2.4} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={toggleRecording}
                    title="Voice mode"
                    className="grid h-9 w-9 place-items-center rounded-full bg-white text-black hover:bg-neutral-200 active:scale-95 transition shadow-sm"
                  >
                    <span className="flex items-center gap-0.5 h-3.5">
                      <span className="w-[2.5px] h-2 bg-black rounded-full animate-pulse" style={{ animationDuration: "0.8s" }} />
                      <span className="w-[2.5px] h-3.5 bg-black rounded-full animate-pulse" style={{ animationDuration: "1.2s" }} />
                      <span className="w-[2.5px] h-2.5 bg-black rounded-full animate-pulse" style={{ animationDuration: "0.9s" }} />
                      <span className="w-[2.5px] h-1.5 bg-black rounded-full animate-pulse" style={{ animationDuration: "1.4s" }} />
                    </span>
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

      {/* Automated Razorpay & Direct UPI Checkout Modal */}
      <UpiCheckoutModal
        plan={payingPlan}
        onClose={() => setPayingPlan(null)}
        notify={notify}
        user={user}
        dark={dark}
        authToken={authToken}
        onPaymentSuccess={handlePaymentSuccess}
        onOpenAuth={() => {
          setPayingPlan(null);
          setGateLocked(false);
          setAuthModalOpen(true);
        }}
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
              {/* Fast Mode */}
              <div className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: border }}>
                <Gauge size={17} className="text-blue-500" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Fast Mode</div>
                  <div className="text-xs" style={{ color: muted }}>Shorter, faster responses for quick tasks</div>
                </div>
                <button
                  onClick={() => { setFastMode((v) => !v); notify(fastMode ? "Fast Mode off" : "Fast Mode on"); }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    fastMode
                      ? dark ? "bg-blue-500 text-white" : "bg-blue-600 text-white"
                      : "border"
                  }`}
                  style={!fastMode ? { borderColor: border } : {}}
                >
                  {fastMode ? "On" : "Off"}
                </button>
              </div>

              {/* Replay Intro Animation */}
              <div className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: border }}>
                <Sparkles size={17} className="text-amber-500" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Intro Animation</div>
                  <div className="text-xs" style={{ color: muted }}>Play the futuristic startup sequence</div>
                </div>
                <button
                  onClick={() => {
                    setSettingsOpen(false);
                    sessionStorage.removeItem("rockgpt-intro-seen");
                    setShowIntro(true);
                  }}
                  className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-amber-500 hover:bg-amber-500/10 transition"
                  style={{ borderColor: border }}
                >
                  Play
                </button>
              </div>

              {/* Clear All Chats */}
              <div className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: border }}>
                <Trash2 size={17} className="text-red-400" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Clear All Chats</div>
                  <div className="text-xs" style={{ color: muted }}>Permanently delete all saved conversations</div>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm("Are you sure? This will delete ALL chat history forever.")) {
                      setConversations([]);
                      newChat();
                      notify("All chats cleared");
                    }
                  }}
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/20 transition"
                >
                  Clear
                </button>
              </div>

              {/* Keyboard Shortcuts */}
              <div className="rounded-xl border p-3" style={{ borderColor: border }}>
                <div className="flex items-center gap-3 mb-2.5">
                  <Code2 size={17} className="text-purple-400" />
                  <div className="text-sm font-medium">Keyboard Shortcuts</div>
                </div>
                <div className="space-y-2">
                  {[
                    { keys: "Ctrl + N", desc: "New chat" },
                    { keys: "Ctrl + B", desc: "Toggle sidebar" },
                    { keys: "Enter", desc: "Send message" },
                    { keys: "Shift + Enter", desc: "New line in message" },
                    { keys: "Esc", desc: "Close modals" },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span style={{ color: muted }}>{s.desc}</span>
                      <kbd className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold ${
                        dark ? "bg-white/10 text-white/70" : "bg-neutral-200 text-neutral-700"
                      }`}>{s.keys}</kbd>
                    </div>
                  ))}
                </div>
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

              {/* About RockGPT */}
              <div className="rounded-xl border p-3" style={{ borderColor: border }}>
                <div className="flex items-center gap-3 mb-2">
                  <RockMark small dark={dark} />
                  <div>
                    <div className="text-sm font-bold">RockGPT</div>
                    <div className="text-[10px]" style={{ color: muted }}>Next-Generation AI Workspace</div>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs" style={{ color: muted }}>
                  <div className="flex justify-between">
                    <span>Version</span>
                    <span className="font-mono font-semibold" style={{ color: textColor }}>2.1.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Developer</span>
                    <span className="font-semibold" style={{ color: textColor }}>Suman Mansuri (Rock)</span>
                  </div>
                  <div className="pt-2 border-t text-[11px] italic leading-relaxed text-center" style={{ borderColor: border, color: muted }}>
                    “Code is not just syntax; it is the art of sculpting intelligence out of pure imagination.”
                  </div>
                </div>
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
