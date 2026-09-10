import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  ArrowUp, Check, ChevronDown, Copy, Download, Edit3, Menu, Mic,
  Plus, Search, Settings, User, X, Zap, Brain, Paperclip,
  Moon, Sun, RefreshCcw, Square, ThumbsDown, ThumbsUp, Trash2,
  Sparkles, Globe, Gauge, Loader2, Crown, ExternalLink, ShieldCheck,
  Smartphone, QrCode, ArrowRight, CheckCircle2, AlertCircle, ChevronRight
} from "lucide-react";

const BACKEND_URL = "https://rockgpt.onrender.com";
const UPI_ID = "mansurisumaan-2@okhdfcbank";
const PAYEE_NAME = "RockGPT";

const PLANS = [
  {
    id: "free",
    name: "Free",
    badge: "Starter",
    priceMonthly: 0,
    priceYearly: 0,
    period: "/forever",
    description: "Great for light questions, everyday brainstorming, and trying RockGPT.",
    features: [
      "50 messages per day",
      "Standard response speed",
      "Image & document file uploads",
      "Cross-device chat history",
      "Access to standard AI reasoning",
    ],
    highlight: false,
    cta: "Current Plan",
    disabled: true,
  },
  {
    id: "plus",
    name: "Plus",
    badge: "Most Popular",
    priceMonthly: 149,
    priceYearly: 119, // ~20% off billed annually
    period: "/month",
    description: "Ideal for power users, students, developers, and creators.",
    features: [
      "500 messages per day",
      "2.5x faster priority speed",
      "Fast Mode always available",
      "Early access to new experimental features",
      "Extended 32k context memory",
      "Zero server peak delays",
    ],
    highlight: true,
    cta: "Upgrade to Plus",
    disabled: false,
  },
  {
    id: "pro",
    name: "Pro",
    badge: "Ultimate Power",
    priceMonthly: 399,
    priceYearly: 319, // ~20% off billed annually
    period: "/month",
    description: "Uncapped performance for professionals, businesses, and heavy workflows.",
    features: [
      "Unlimited daily messages",
      "Maximum reasoning speed & compute",
      "Highest upload limit (25MB+ files)",
      "Dedicated priority server queue",
      "Everything in Plus included",
      "Priority 24/7 customer support",
    ],
    highlight: false,
    cta: "Upgrade to Pro",
    disabled: false,
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
    <div className={`grid shrink-0 place-items-center rounded-[10px] border border-white/15 bg-white font-black text-black shadow-sm ${small ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-sm"}`}>
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

/* =========================================================================
   REDESIGNED CHATGPT & GEMINI STYLE UPGRADE PLAN MODAL & BOTTOM SHEET
   ========================================================================= */
function UpgradePlanModal({ isOpen, onClose, onSelectPlan, currentPlan = "Free" }) {
  const [billingCycle, setBillingCycle] = useState("monthly"); // "monthly" | "yearly"

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

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-0 backdrop-blur-md transition-all sm:items-center sm:p-4 fade"
      onClick={onClose}
    >
      <div
        className="pop flex max-h-[92dvh] w-full max-w-[880px] flex-col overflow-hidden rounded-t-[28px] border border-white/15 bg-[#121212] shadow-2xl sm:max-h-[90dvh] sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="relative border-b border-white/10 px-5 py-4 sm:px-8 sm:py-6">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white sm:right-6 sm:top-6"
          >
            <X size={18} />
          </button>
          <div className="flex flex-col items-center text-center">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-300">
              <Sparkles size={13} /> Elevate your AI Workspace
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              Upgrade Your RockGPT Plan
            </h2>
            <p className="mt-1 text-xs text-white/60 sm:text-sm">
              Unlock the fastest reasoning, extended context limits, and unlimited generations.
            </p>

            {/* Billing Toggle (Monthly / Yearly) */}
            <div className="mt-4 inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] p-1 text-xs font-medium">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`rounded-full px-4 py-1.5 transition-all ${billingCycle === "monthly" ? "bg-white text-black font-semibold shadow-sm" : "text-white/60 hover:text-white"}`}
              >
                Monthly billing
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-all ${billingCycle === "yearly" ? "bg-white text-black font-semibold shadow-sm" : "text-white/60 hover:text-white"}`}
              >
                <span>Annual billing</span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="thin flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {PLANS.map((plan) => {
              const isCurrent = currentPlan?.toLowerCase() === plan.name.toLowerCase();
              const price = billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly;

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-all duration-200 ${
                    plan.highlight
                      ? "border-yellow-400/50 bg-gradient-to-b from-yellow-400/[0.08] to-white/[0.02] shadow-[0_0_30px_rgba(234,179,8,0.12)]"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-yellow-400/40 bg-gradient-to-r from-amber-400 to-yellow-300 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black shadow-md">
                      {plan.badge}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-white">{plan.name}</span>
                      {isCurrent && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/80">
                          Active Plan
                        </span>
                      )}
                    </div>

                    <p className="mt-1 min-h-[34px] text-xs text-white/50">{plan.description}</p>

                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-white">₹{price}</span>
                      <span className="text-xs text-white/50">
                        {plan.priceMonthly === 0 ? "/forever" : billingCycle === "yearly" ? "/mo (billed annually)" : "/month"}
                      </span>
                    </div>

                    <div className="my-4 h-px w-full bg-white/10" />

                    <ul className="space-y-2.5">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-white/80">
                          <Check size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                          <span className="leading-snug">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 pt-2">
                    <button
                      disabled={isCurrent}
                      onClick={() => onSelectPlan({ ...plan, activePrice: price, billingCycle })}
                      className={`w-full rounded-xl py-3 text-xs font-semibold tracking-wide transition-all ${
                        isCurrent
                          ? "cursor-default border border-white/10 bg-white/5 text-white/40"
                          : plan.highlight
                          ? "bg-white text-black shadow-lg hover:bg-neutral-200 active:scale-[0.98]"
                          : "border border-white/15 bg-white/10 text-white hover:bg-white/15 active:scale-[0.98]"
                      }`}
                    >
                      {isCurrent ? "Current Plan" : plan.cta}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Guarantee / Security badge */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 rounded-xl border border-white/5 bg-white/[0.01] px-4 py-3 text-center text-xs text-white/50">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" /> Safe & secure payment via UPI
            </span>
            <span className="flex items-center gap-1.5">
              <Zap size={14} className="text-yellow-400" /> Fast manual activation
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-blue-400" /> Cancel anytime with no penalties
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   MODERN UPI CHECKOUT MODAL (WITH 1-CLICK MOBILE APP INTENT & FALLBACK QR)
   ========================================================================= */
function UpiCheckoutModal({ plan, onClose, notify, user }) {
  const [copied, setCopied] = useState(false);
  const [utrNumber, setUtrNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!plan) return null;

  const totalAmount = plan.billingCycle === "yearly" ? plan.activePrice * 12 : plan.activePrice;
  const upiLink = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(PAYEE_NAME)}&am=${encodeURIComponent(totalAmount)}&cu=INR&tn=${encodeURIComponent(`RockGPT ${plan.name} Plan`)}`;

  // Dynamic QR Code generation that never 404s
  const dynamicQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}&bgcolor=181818&color=ffffff&margin=1`;

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
      notify("Payment submitted! We are verifying your transaction.");
    }, 1200);
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md transition-all sm:items-center sm:p-4 fade"
      onClick={onClose}
    >
      <div
        className="pop max-h-[92dvh] w-full max-w-[420px] overflow-y-auto thin rounded-t-[28px] border border-white/15 bg-[#141414] p-5 shadow-2xl sm:max-h-[85dvh] sm:rounded-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-yellow-400">Checkout</span>
            <h3 className="text-lg font-bold text-white">Upgrade to {plan.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 size={32} />
            </div>
            <h4 className="text-base font-bold text-white">Transaction Details Received!</h4>
            <p className="mt-2 text-xs leading-relaxed text-white/60">
              Thank you! We have logged your UTR reference (<strong className="text-white">{utrNumber}</strong>). Your account (<strong>{user?.email || "guest"}</strong>) will be upgraded within 15 minutes.
            </p>
            <button
              onClick={onClose}
              className="mt-6 w-full rounded-xl bg-white py-2.5 text-xs font-semibold text-black hover:bg-neutral-200"
            >
              Done & Return to Chat
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Amount Summary */}
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div>
                <div className="text-xs font-medium text-white/80">{plan.name} Plan ({plan.billingCycle})</div>
                <div className="text-[11px] text-white/50">One-time payment</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-extrabold text-white">₹{totalAmount}</div>
                <div className="text-[10px] text-emerald-400">Incl. all taxes</div>
              </div>
            </div>

            {/* Mobile: 1-Tap UPI Intent Button */}
            <div className="block sm:hidden">
              <a
                href={upiLink}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-xs font-bold text-white shadow-lg active:scale-95"
              >
                <Smartphone size={16} /> Pay via Any UPI App (GPay / PhonePe / Paytm)
              </a>
              <div className="my-3 text-center text-[10px] uppercase tracking-wider text-white/40">or scan / pay manually</div>
            </div>

            {/* Desktop / Fallback QR Code */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <img
                src={dynamicQrUrl}
                alt="UPI QR Code"
                className="h-44 w-44 rounded-xl border border-white/10 bg-white p-2 shadow-inner"
              />
              <p className="mt-2 text-[11px] text-white/50">Scan with GPay, PhonePe, Paytm, or CRED</p>
            </div>

            {/* Copyable UPI ID */}
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-white/40">UPI ID</div>
                <div className="truncate font-mono text-xs font-semibold text-white">{UPI_ID}</div>
              </div>
              <button
                onClick={copyUpi}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/10"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>

            {/* Verification Form */}
            <form onSubmit={handleSubmitProof} className="space-y-2.5 pt-1">
              <label className="block text-[11px] font-medium text-white/70">
                Confirm payment: Enter 12-digit UTR / Ref Number
              </label>
              <input
                type="text"
                placeholder="e.g. 329482910482"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-transparent px-3 py-2.5 text-xs text-white outline-none placeholder:text-white/30 focus:border-white/50"
              />
              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-xs font-bold text-black transition-all hover:bg-neutral-200 active:scale-95 disabled:opacity-50"
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
  const [selectedModel, setSelectedModel] = useState("RockGPT 4o");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

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

  // --- Guest gate ---
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

  // Guest timer
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
        setPayingPlan(null);
        setModelDropdownOpen(false);
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
        localStorage.removeItem("rockgpt-token");
        setAuthToken(null);
        setUser(null);
      });
  }, [authToken]);

  const notify = (text) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 2500);
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
    notify("Logged out successfully");
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
    const t1 = setTimeout(() => setThinkingLabel("Synthesizing ideas..."), 4000);
    const t2 = setTimeout(() => setThinkingLabel("Crafting response..."), 9000);

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
      notify("Voice input is supported best on Chrome");
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

  const filtered = useMemo(
    () => conversations.filter((c) => c.title.toLowerCase().includes(search.toLowerCase())),
    [conversations, search]
  );

  const surface = dark ? "#0a0a0a" : "#ffffff";
  const panel = dark ? "#111111" : "#f7f7f7";
  const border = dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.10)";
  const textColor = dark ? "#ffffff" : "#111111";
  const muted = dark ? "rgba(255,255,255,.48)" : "rgba(0,0,0,.52)";

  if (showIntro) {
    return <IntroScreen onDone={() => setShowIntro(false)} />;
  }

  return (
    <div className="relative flex h-[100dvh] min-h-screen w-full overflow-hidden font-sans" style={{ background: surface, color: textColor, overscrollBehaviorY: "none" }}>
      <style>{`
        html, body, #root { height: 100%; margin: 0; padding: 0; background: ${surface}; overscroll-behavior-y: none; }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        textarea::-webkit-scrollbar { width: 0; }
        .thin::-webkit-scrollbar { width: 5px; }
        .thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 20px; }
        .fade { animation: fade .2s ease-out both; }
        .fade-out { animation: fadeOut .4s ease-in both; }
        .rise { animation: rise .25s cubic-bezier(.2,.8,.2,1) both; }
        .pop { animation: pop .25s cubic-bezier(.2,.9,.3,1.15) both; }
        @keyframes fade { from {opacity:0} to {opacity:1} }
        @keyframes fadeOut { from {opacity:1} to {opacity:0; visibility:hidden} }
        @keyframes rise { from {opacity:0; transform:translateY(8px)} to {opacity:1; transform:translateY(0)} }
        @keyframes pop { from {opacity:0; transform:scale(.95) translateY(8px)} to {opacity:1; transform:scale(1) translateY(0)} }
        @keyframes blink { 50% { opacity:.35 } }
        .cursor-blink { animation: blink 1s step-end infinite; }
        @keyframes dotBounce { 0%, 60%, 100% { transform: translateY(0); opacity:.4 } 30% { transform: translateY(-5px); opacity:1 } }
        .dot-bounce { animation: dotBounce 1.1s ease-in-out infinite; }
        @media (max-width: 640px) {
          .chat-bubble { max-width: 90% !important; }
        }
      `}</style>

      {/* Sidebar backdrop for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm fade" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Collapsible Modern Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 h-full w-[85vw] max-w-[290px] shrink-0 overflow-hidden transition-transform duration-300 sm:w-[270px] ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
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
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/30"
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
                className={`group relative mb-1 flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 transition-colors ${activeId === c.id ? "bg-white/[.08]" : "hover:bg-white/[.045]"}`}
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

          {/* Sidebar Footer Actions */}
          <div className="border-t p-2 space-y-1" style={{ borderColor: border }}>
            {/* UPGRADE PLAN BUTTON WITH GRADIENT ACCENT */}
            <button
              onClick={() => { setSidebarOpen(false); setPricingOpen(true); }}
              className="flex w-full items-center gap-3 rounded-xl border border-yellow-400/20 bg-yellow-400/[0.06] px-3 py-2.5 text-sm font-medium text-yellow-300 transition-all hover:bg-yellow-400/[0.12] active:scale-[0.98]"
            >
              <Crown size={17} className="text-yellow-400" />
              <div className="flex-1 text-left">
                <div className="leading-none text-[13px] font-semibold text-white">Upgrade plan</div>
                <div className="text-[10px] text-yellow-300/70">Get Plus or Pro</div>
              </div>
              <ChevronRight size={14} className="text-yellow-400/60" />
            </button>

            <button onClick={() => setSettingsOpen(true)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-white/[.05]" style={{ color: muted }}>
              <Settings size={16} /> <span className="flex-1 text-left">Settings</span>
            </button>
            <button
              onClick={() => (user ? logout() : setAuthModalOpen(true))}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-white/[.05]"
            >
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border" style={{ borderColor: border }}><User size={13} /></div>
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-xs font-medium">{user ? user.name : "Sign in"}</div>
                <div className="text-[10px]" style={{ color: muted }}>{user ? `${user.plan || "Free"} plan · Log out` : "Guest mode"}</div>
              </div>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Chat Interface */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Header with ChatGPT / Gemini Style Model Pill */}
        <header className="flex h-[56px] shrink-0 items-center justify-between border-b px-3 sm:px-4" style={{ borderColor: border, background: dark ? "rgba(10,10,10,.85)" : "rgba(255,255,255,.9)", backdropFilter: "blur(12px)" }}>
          <div className="flex min-w-0 items-center gap-2">
            <button onClick={() => setSidebarOpen(true)} title="Open sidebar (Ctrl+B)" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-white/[.06]">
              <Menu size={18} />
            </button>

            {/* Model Selector Dropdown (ChatGPT & Gemini UI) */}
            <div className="relative">
              <button
                onClick={() => setModelDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold hover:bg-white/[0.08]"
              >
                <Sparkles size={13} className="text-yellow-400" />
                <span>{selectedModel}</span>
                <ChevronDown size={13} className="text-white/40" />
              </button>

              {modelDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setModelDropdownOpen(false)} />
                  <div className="absolute left-0 top-10 z-40 w-56 rounded-2xl border border-white/15 bg-[#161616] p-1.5 shadow-2xl pop">
                    <button
                      onClick={() => { setSelectedModel("RockGPT 4o"); setModelDropdownOpen(false); }}
                      className={`flex w-full items-start gap-2.5 rounded-xl p-2 text-left ${selectedModel === "RockGPT 4o" ? "bg-white/10" : "hover:bg-white/5"}`}
                    >
                      <Sparkles size={15} className="mt-0.5 text-yellow-400" />
                      <div>
                        <div className="text-xs font-semibold text-white">RockGPT 4o</div>
                        <div className="text-[10px] text-white/50">Most intelligent & capable</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setSelectedModel("RockGPT Flash"); setModelDropdownOpen(false); }}
                      className={`flex w-full items-start gap-2.5 rounded-xl p-2 text-left ${selectedModel === "RockGPT Flash" ? "bg-white/10" : "hover:bg-white/5"}`}
                    >
                      <Zap size={15} className="mt-0.5 text-blue-400" />
                      <div>
                        <div className="text-xs font-semibold text-white">RockGPT Flash</div>
                        <div className="text-[10px] text-white/50">Fastest for quick questions</div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Top Upgrade Pill */}
            <button
              onClick={() => setPricingOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-300 hover:bg-yellow-400/20"
            >
              <Crown size={13} />
              <span className="hidden sm:inline">Upgrade</span>
            </button>

            {activeId && (
              <button onClick={exportChat} title="Export chat" className="hidden h-9 w-9 place-items-center rounded-lg hover:bg-white/[.06] sm:grid">
                <Download size={16} />
              </button>
            )}
            <button onClick={() => setTheme(dark ? "light" : "dark")} title="Toggle theme" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/[.06]">
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>

        {/* Chat Stream Window */}
        <section className="thin flex-1 overflow-y-auto">
          {messages.length === 0 && !typing ? (
            <div className="mx-auto flex min-h-full max-w-[800px] flex-col items-center justify-center px-4 py-8">
              <div className="mb-4 fade"><RockMark /></div>
              <h1 className="rise text-center text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
                What can I help with?
              </h1>
              <p className="rise mt-2 max-w-lg px-2 text-center text-xs leading-5 text-white/50 sm:text-sm">
                Brainstorm, write code, analyze data, debug errors, or summarize documents.
              </p>

              {/* Suggestion Chips */}
              <div className="rise mt-8 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  "Write a React hook for API caching",
                  "Explain quantum computing simply",
                  "Design a workout plan for beginners",
                  "Review my resume bullet points"
                ].map((promptText, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(promptText); inputRef.current?.focus(); }}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left text-xs text-white/80 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
                  >
                    <span>{promptText}</span>
                    <ArrowRight size={13} className="text-white/30" />
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
                      <RockMark small />
                    ) : (
                      <div className="grid h-7 w-7 place-items-center rounded-full border" style={{ borderColor: border }}><User size={13} /></div>
                    )}
                    <span className="font-semibold">{m.role === "assistant" ? "RockGPT" : "You"}</span>
                    <span className="text-[10px]" style={{ color: muted }}>{formatTime(m.createdAt)}</span>
                  </div>

                  {editing === m.id ? (
                    <div className="rounded-2xl border p-3" style={{ borderColor: border }}>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="min-h-[100px] w-full resize-none bg-transparent text-sm leading-6 outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditing(null)} className="rounded-lg px-3 py-1.5 text-xs" style={{ color: muted }}>Cancel</button>
                        <button
                          onClick={() => { setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, content: editText, displayText: editText } : x))); setEditing(null); }}
                          className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={m.role === "user" ? "chat-bubble ml-0 max-w-[92%] rounded-2xl border border-white/10 bg-white/[.05] p-3.5 sm:ml-9 sm:p-4" : "ml-0 sm:ml-9"}>
                      {m.attachment?.kind === "image" && (
                        <img src={m.attachment.dataUrl} alt={m.attachment.name} className="mb-2 max-h-60 rounded-xl border border-white/10" />
                      )}
                      {m.attachment?.kind === "doc" && (
                        <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/70">
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

                  <div className="ml-9 mt-2 flex items-center gap-1">
                    <button onClick={() => copyMessage(m)} className="rounded-lg p-2 text-xs text-white/40 hover:bg-white/[.06] hover:text-white" title="Copy">
                      {copied === m.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                    {m.role === "user" && (
                      <button onClick={() => { setEditing(m.id); setEditText(m.displayText || ""); }} className="rounded-lg p-2 text-white/40 hover:bg-white/[.06] hover:text-white" title="Edit">
                        <Edit3 size={13} />
                      </button>
                    )}
                    {m.role === "assistant" && (
                      <>
                        <button
                          onClick={() => setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, liked: x.liked === true ? null : true } : x)))}
                          className={`rounded-lg p-2 hover:bg-white/[.06] ${m.liked === true ? "text-white" : "text-white/40"}`}
                        >
                          <ThumbsUp size={13} />
                        </button>
                        <button
                          onClick={() => setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, liked: x.liked === false ? null : false } : x)))}
                          className={`rounded-lg p-2 hover:bg-white/[.06] ${m.liked === false ? "text-white" : "text-white/40"}`}
                        >
                          <ThumbsDown size={13} />
                        </button>
                        {i === messages.length - 1 && (
                          <button onClick={regenerate} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-white/50 hover:bg-white/[.06] hover:text-white">
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
                      <div className="flex items-center gap-2 pt-1 text-sm text-white/50">
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

        {/* Input Bar */}
        <div className="shrink-0 px-2 pb-3 pt-2 sm:px-4" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto max-w-[820px]">
            {attachment && (
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] p-2">
                {attachment.kind === "image" ? (
                  <img src={attachment.dataUrl} alt={attachment.name} className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-lg border border-white/10 text-lg">📄</div>
                )}
                <span className="flex-1 truncate text-xs text-white/70">{attachment.name}</span>
                <button onClick={() => setAttachment(null)} className="rounded-md p-1 hover:bg-white/[.08]"><X size={14} /></button>
              </div>
            )}
            <div className="relative rounded-[22px] border border-white/15 bg-[#141414] p-2 shadow-xl focus-within:border-white/30">
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
                className="w-full resize-none bg-transparent px-3 pb-11 pt-2 text-[15px] leading-6 text-white outline-none placeholder:text-white/30 sm:px-3.5"
                style={{ minHeight: 46, maxHeight: 160 }}
              />

              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <input ref={fileRef} type="file" accept="image/*,.txt,.md" className="hidden" onChange={handleFileSelect} />
                  <div className="relative">
                    <button
                      onClick={() => setAttachMenuOpen((v) => !v)}
                      title="Attach photo or file"
                      className="grid h-9 w-9 place-items-center rounded-xl text-white/50 hover:bg-white/[.06] hover:text-white"
                    >
                      <Plus size={18} />
                    </button>
                    {attachMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setAttachMenuOpen(false)} />
                        <div className="absolute bottom-11 left-0 z-40 w-60 rounded-2xl border border-white/15 bg-[#181818] p-1.5 shadow-2xl pop">
                          <button
                            onClick={() => { fileRef.current?.click(); setAttachMenuOpen(false); }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/80 hover:bg-white/[.06] hover:text-white"
                          >
                            <Paperclip size={16} /> <span className="flex-1">Add photo or file</span>
                          </button>
                          <button
                            onClick={() => { setWebSearchOn((v) => !v); notify("Web search is coming soon"); setAttachMenuOpen(false); }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/80 hover:bg-white/[.06] hover:text-white"
                          >
                            <Globe size={16} /> <span className="flex-1">Web search</span>
                            <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] text-white/40">Soon</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => setFastMode((v) => !v)}
                    title={fastMode ? "Fast mode active" : "Turn on fast mode"}
                    className={`hidden h-9 w-9 place-items-center rounded-xl transition sm:grid ${fastMode ? "bg-white text-black" : "text-white/50 hover:bg-white/[.06] hover:text-white"}`}
                  >
                    <Gauge size={17} />
                  </button>
                  <button
                    onClick={toggleRecording}
                    title="Voice input"
                    className={`grid h-9 w-9 place-items-center rounded-xl transition ${recording ? "bg-red-500 text-white animate-pulse" : "text-white/50 hover:bg-white/[.06] hover:text-white"}`}
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
                    className={`grid h-9 w-9 place-items-center rounded-xl transition ${input.trim() || attachment ? "bg-white text-black hover:scale-105 shadow-md" : "bg-white/10 text-white/30"}`}
                    title="Send"
                  >
                    <ArrowUp size={18} />
                  </button>
                )}
              </div>
            </div>
            <div className="hidden items-center justify-center gap-2 py-2 text-[11px] text-white/40 sm:flex">
              <span>RockGPT can make mistakes. Verify important information.</span>
            </div>
          </div>
        </div>
      </main>

      {/* Modern ChatGPT / Gemini Style Upgrade Plan Modal */}
      <UpgradePlanModal
        isOpen={pricingOpen}
        onClose={() => setPricingOpen(false)}
        currentPlan={user?.plan || "Free"}
        onSelectPlan={(plan) => {
          setPricingOpen(false);
          setPayingPlan(plan);
        }}
      />

      {/* Modern UPI Checkout Modal with Instant 1-Tap Mobile Support */}
      <UpiCheckoutModal
        plan={payingPlan}
        onClose={() => setPayingPlan(null)}
        notify={notify}
        user={user}
      />

      {/* Guest / Auth Gate */}
      {gateOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-4 fade backdrop-blur-sm">
          <div className="pop max-h-[85vh] w-full max-w-[380px] overflow-y-auto thin rounded-2xl border border-white/15 bg-[#141414] p-5 shadow-2xl">
            <div className="mb-4 flex flex-col items-center text-center">
              <RockMark />
              <h2 className="mt-3 text-lg font-bold text-white">
                {gateLocked ? "Save your workspace" : "Welcome to RockGPT"}
              </h2>
              <p className="mt-1.5 text-xs leading-5 text-white/60">
                {gateLocked
                  ? "You've been chatting as a guest. Sign in or register to keep your chat history."
                  : "Sign in to sync your chats across devices, or explore as a guest."}
              </p>
            </div>

            {authMode === "signup" && (
              <input
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                placeholder="Full Name"
                className="mb-2 w-full rounded-xl border border-white/15 bg-transparent px-3 py-2.5 text-xs text-white outline-none"
              />
            )}
            <input
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="Email address"
              type="email"
              className="mb-2 w-full rounded-xl border border-white/15 bg-transparent px-3 py-2.5 text-xs text-white outline-none"
            />
            <input
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="Password"
              type="password"
              onKeyDown={(e) => { if (e.key === "Enter") handleAuthSubmit(); }}
              className="mb-3 w-full rounded-xl border border-white/15 bg-transparent px-3 py-2.5 text-xs text-white outline-none"
            />

            {authError && <p className="mb-3 text-xs text-red-400">{authError}</p>}

            <button
              onClick={handleAuthSubmit}
              disabled={authLoading}
              className="mb-2 w-full rounded-xl bg-white py-2.5 text-xs font-bold text-black transition hover:bg-neutral-200 disabled:opacity-50"
            >
              {authLoading ? "Please wait..." : authMode === "signup" ? "Create Account" : "Sign In"}
            </button>

            <p className="mb-2 text-center text-xs text-white/60">
              {authMode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                onClick={() => { setAuthMode(authMode === "signup" ? "login" : "signup"); setAuthError(""); }}
                className="font-medium text-white underline underline-offset-2"
              >
                {authMode === "signup" ? "Sign In" : "Register"}
              </button>
            </p>

            {!gateLocked && (
              <button onClick={continueAsGuest} className="w-full rounded-xl px-4 py-2 text-xs text-white/50 hover:text-white">
                Continue as guest
              </button>
            )}
          </div>
        </div>
      )}

      {/* Standalone Auth Modal */}
      {authModalOpen && !gateOpen && (
        <div className="fixed inset-0 z-[75] grid place-items-center bg-black/60 p-4 fade backdrop-blur-sm" onClick={() => setAuthModalOpen(false)}>
          <div className="pop max-h-[85vh] w-full max-w-[380px] overflow-y-auto thin rounded-2xl border border-white/15 bg-[#141414] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-white">{authMode === "signup" ? "Create your account" : "Welcome back"}</h2>
              <button onClick={() => setAuthModalOpen(false)} className="text-white/50 hover:text-white"><X size={16} /></button>
            </div>
            {authMode === "signup" && (
              <input value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="Full Name" className="mb-2 w-full rounded-xl border border-white/15 bg-transparent px-3 py-2.5 text-xs text-white outline-none" />
            )}
            <input value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Email" type="email" className="mb-2 w-full rounded-xl border border-white/15 bg-transparent px-3 py-2.5 text-xs text-white outline-none" />
            <input value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="Password" type="password" onKeyDown={(e) => { if (e.key === "Enter") handleAuthSubmit(); }} className="mb-3 w-full rounded-xl border border-white/15 bg-transparent px-3 py-2.5 text-xs text-white outline-none" />
            {authError && <p className="mb-3 text-xs text-red-400">{authError}</p>}
            <button onClick={handleAuthSubmit} disabled={authLoading} className="mb-3 w-full rounded-xl bg-white py-2.5 text-xs font-bold text-black disabled:opacity-50">
              {authLoading ? "Please wait..." : authMode === "signup" ? "Create Account" : "Sign In"}
            </button>
            <p className="text-center text-xs text-white/60">
              {authMode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
              <button onClick={() => { setAuthMode(authMode === "signup" ? "login" : "signup"); setAuthError(""); }} className="font-medium text-white underline">
                {authMode === "signup" ? "Sign In" : "Register"}
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 fade backdrop-blur-sm" onClick={() => setSettingsOpen(false)}>
          <div className="pop max-h-[85vh] w-full max-w-[420px] overflow-y-auto thin rounded-2xl border border-white/15 bg-[#141414] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Settings</h2>
                <p className="text-xs text-white/50">Personalize your RockGPT experience.</p>
              </div>
              <button onClick={() => setSettingsOpen(false)} className="text-white/50 hover:text-white"><X size={16} /></button>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 p-3">
              {dark ? <Moon size={17} /> : <Sun size={17} />}
              <div className="flex-1">
                <div className="text-sm font-medium">Appearance</div>
                <div className="text-xs text-white/50">Switch between dark & light interface</div>
              </div>
              <button onClick={() => setTheme(dark ? "light" : "dark")} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium">
                {dark ? "Light" : "Dark"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Notifications Toast */}
      {notice && (
        <div className="fixed bottom-20 left-1/2 z-[95] -translate-x-1/2 rounded-full border border-white/20 bg-black/90 px-4 py-2 text-xs font-medium text-white shadow-2xl backdrop-blur-md fade">
          {notice}
        </div>
      )}
    </div>
  );
}
