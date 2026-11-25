"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { renderMarkdown } from "@/lib/markdown";

type UserData = {
  id?: string;
  name?: string;
  email?: string;
  theme?: "dark" | "light";
  settings?: {
    instructions?: string;
    fast?: boolean;
    textSize?: "s" | "m" | "l";
  };
};

type ChatItem = {
  id: string;
  _id?: string;
  title: string;
  pinned?: boolean;
  clientId?: string;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
  msgs?: MessageItem[];
  messages?: MessageItem[];
  t?: number;
};

type MessageItem = {
  id?: string;
  _id?: string;
  role: "user" | "assistant";
  content: string;
  image?: string;
  attachments?: { name?: string; type?: string; url?: string; dataUrl?: string; text?: string }[];
  files?: { name: string; type: string; url?: string; dataUrl?: string; text?: string }[];
  feedback?: "up" | "down" | null;
  fb?: "up" | "dn" | null;
  createdAt?: string;
};

// ═══ SVG SPRITE ICONS ═══
const PIN_SVG = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 4h6l-1 6 3 3v1H7v-1l3-3zM12 14v6" />
  </svg>
);

const REN_SVG = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h8M16.5 3.5a2.1 2.1 0 013 3L8 18l-4 1 1-4z" />
  </svg>
);

const BIN_SVG = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
  </svg>
);

const EDIT_SVG = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h8M16.5 3.5a2.1 2.1 0 013 3L8 18l-4 1 1-4z" />
  </svg>
);

const GOOGLE_SVG = (
  <svg width="20" height="20" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
  </svg>
);

const FUP_OPTIONS = [
  "Explain more",
  "Give an example",
  "Make it shorter",
  "Translate to Hindi",
];

// Helper to check if element is visible in viewport
const isSeen = (el: HTMLElement | null) => {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return el.getClientRects().length > 0 && r.width > 0 && r.right > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
};

// ═══ 6-BOX AUTO-ADVANCING OTP COMPONENT ═══
function OtpBoxes({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const firstEmpty = value.length < 6 ? value.length : 0;
    inputRefs.current[firstEmpty]?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const char = e.target.value.replace(/\D/g, "");
    if (!char) {
      const arr = value.split("");
      arr[idx] = "";
      onChange(arr.join("").trimEnd());
      return;
    }
    const lastChar = char.slice(-1);
    const arr = value.padEnd(6, " ").split("");
    arr[idx] = lastChar;
    const newVal = arr.join("").trimEnd();
    onChange(newVal);
    if (idx < 5 && lastChar) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === "Backspace") {
      if (!value[idx] && idx > 0) {
        inputRefs.current[idx - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      e.preventDefault();
      inputRefs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < 5) {
      e.preventDefault();
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (paste) {
      onChange(paste);
      const nextFocus = Math.min(paste.length, 5);
      inputRefs.current[nextFocus]?.focus();
    }
  };

  return (
    <div className="otp-digit-grid" onPaste={handlePaste} role="group" aria-label="6-digit verification code">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete="one-time-code"
          data-lpignore="true"
          disabled={disabled}
          value={value[i] || ""}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          className="otp-digit-box"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

// ═══ SECURITY SHIELD LOGO (MATCHING USER IMAGE 2) ═══
function ShieldLogo({ size = 28 }: { size?: number }) {
  return (
    <div className="shield" role="img" aria-label="RockGPT Security Shield">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2.5L4.5 5.5v5.5c0 5.25 3.5 10 7.5 11 4-1 7.5-5.75 7.5-11V5.5L12 2.5z" />
      </svg>
    </div>
  );
}

// ═══ PROGRESSIVE "THINKING..." / "WORKING..." ANIMATED INDICATOR ═══
function ThinkingIndicator({
  hasImage,
  isImageGen,
  fastMode,
}: {
  hasImage?: boolean;
  isImageGen?: boolean;
  fastMode?: boolean;
}) {
  const [stageIdx, setStageIdx] = useState(0);

  const stages = hasImage
    ? ["Thinking...", "Inspecting image...", "Working...", "Analyzing details..."]
    : isImageGen
    ? ["Thinking...", "Imagining visual...", "Working...", "Rendering artwork..."]
    : fastMode
    ? ["Thinking...", "Working..."]
    : ["Thinking...", "Analyzing request...", "Working...", "Synthesizing answer..."];

  useEffect(() => {
    setStageIdx(0);
    const id = setInterval(() => {
      setStageIdx((prev) => (prev + 1) % stages.length);
    }, 1050);
    return () => clearInterval(id);
  }, [hasImage, isImageGen, fastMode, stages.length]);

  const label = stages[stageIdx % stages.length];

  return (
    <div className="thinking" role="status" aria-live="polite" aria-label={label}>
      <span className="dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span key={label} className="tlabel">
        {label}
      </span>
    </div>
  );
}

// ═══ RESPONSE ACTION BUTTONS BAR (PROPER LIKE/DISLIKE + CREATIVE ANIMATIONS) ═══
function ResponseActionsBar({
  messageId,
  content,
  feedback,
  onFeedbackChange,
  isLast,
  isStreaming,
  onRegenerate,
  onToast,
}: {
  messageId?: string;
  content: string;
  feedback?: "up" | "down" | null;
  onFeedbackChange?: (val: "up" | "down" | null) => void;
  isLast: boolean;
  isStreaming: boolean;
  onRegenerate?: () => void;
  onToast: (msg: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [animating, setAnimating] = useState<"up" | "dn" | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const triggerClickAnim = (kind: "up" | "dn") => {
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    setAnimating(null);
    requestAnimationFrame(() => {
      setAnimating(kind);
      animTimerRef.current = setTimeout(() => setAnimating(null), 650);
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      onToast("Copied to clipboard!");
      setTimeout(() => setCopied(false), 1400);
    } catch {
      onToast("Couldn't copy");
    }
  };

  const handleShare = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "RockGPT Response", text: content });
        return;
      }
      await navigator.clipboard.writeText(content);
      onToast("Copied response for sharing");
    } catch {}
  };

  const handleSpeech = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onToast("Text-to-speech not supported");
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const plain = content
      .replace(/```[\s\S]*?```/g, " code block ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[`*#>_$]/g, "")
      .trim();

    if (!plain) return;
    const utter = new SpeechSynthesisUtterance(plain);
    utter.lang = navigator.language || "en-US";
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  };

  const handleLike = () => {
    const next = feedback === "up" ? null : "up";
    onFeedbackChange?.(next);
    if (next === "up") triggerClickAnim("up");
    if (messageId) {
      fetch(`/api/messages/${messageId}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: next }),
      }).catch(() => {});
    }
    onToast(next ? "Appreciate your response" : "Feedback removed");
  };

  const handleDislike = () => {
    const next = feedback === "down" ? null : "down";
    onFeedbackChange?.(next);
    if (next === "down") triggerClickAnim("dn");
    if (messageId) {
      fetch(`/api/messages/${messageId}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: next }),
      }).catch(() => {});
    }
    onToast(next ? "We will try to improve" : "Feedback removed");
  };

  return (
    <div className="acts" role="toolbar" aria-label="Response toolbar">
      {/* 1. Copy */}
      <button
        type="button"
        className={`ab ${copied ? "ok" : ""}`}
        onClick={handleCopy}
        title="Copy"
        aria-label="Copy"
      >
        <svg className="cp" viewBox="0 0 24 24">
          <rect x="9" y="9" width="11" height="11" rx="2.5" />
          <path d="M5 15V6.5A2.5 2.5 0 017.5 4H15" />
        </svg>
        <svg className="ck" viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>

      {/* 2. Speaker / Read aloud */}
      <button
        type="button"
        className={`ab ${speaking ? "sel" : ""}`}
        data-k="sp"
        onClick={handleSpeech}
        title={speaking ? "Stop" : "Read aloud"}
        aria-label="Read aloud"
      >
        <svg viewBox="0 0 24 24">
          <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM15.5 9a4 4 0 010 6M18 6.5a8 8 0 010 11" />
        </svg>
      </button>

      {/* 3. Proper Thumbs Up Button + Spark Burst */}
      <button
        type="button"
        className={`ab ${feedback === "up" ? "sel" : ""} ${animating === "up" ? "anim-up" : ""}`}
        data-k="up"
        onClick={handleLike}
        title="Good response"
        aria-label="Good response"
        aria-pressed={feedback === "up"}
      >
        {animating === "up" && (
          <>
            <span className="fb-ring" aria-hidden="true" />
            <span className="fb-sparks" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
          </>
        )}
        <svg viewBox="0 0 24 24">
          <path d="M7 10v12" />
          <path
            className="thumb-body"
            d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"
          />
        </svg>
      </button>

      {/* 4. Proper Thumbs Down Button + Smooth Tilt Animation */}
      <button
        type="button"
        className={`ab ${feedback === "down" ? "sel" : ""} ${animating === "dn" ? "anim-dn" : ""}`}
        data-k="dn"
        onClick={handleDislike}
        title="Bad response"
        aria-label="Bad response"
        aria-pressed={feedback === "down"}
      >
        {animating === "dn" && <span className="fb-ring" aria-hidden="true" />}
        <svg viewBox="0 0 24 24">
          <path d="M17 14V2" />
          <path
            className="thumb-body"
            d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"
          />
        </svg>
      </button>

      {/* 5. Share */}
      <button
        type="button"
        className="ab"
        data-k="sh"
        onClick={handleShare}
        title="Share response"
        aria-label="Share response"
      >
        <svg viewBox="0 0 24 24">
          <path d="M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 002 2h10a2 2 0 002-2v-5" />
        </svg>
      </button>

      {/* 6. Regenerate (on last assistant message) */}
      {isLast && onRegenerate && (
        <button
          type="button"
          className="ab"
          data-k="rg"
          onClick={onRegenerate}
          disabled={isStreaming}
          title="Regenerate"
          aria-label="Regenerate"
        >
          <svg viewBox="0 0 24 24">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
          </svg>
        </button>
      )}

      {/* Animated Inline Feedback Status Pill */}
      {feedback === "up" && (
        <span className="fb-note" key="fb-up">
          <svg viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Appreciate your response
        </span>
      )}
      {feedback === "down" && (
        <span className="fb-note" key="fb-dn">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          We will try to improve
        </span>
      )}
    </div>
  );
}

// ═══ MAIN ROCKGPT APPLICATION COMPONENT ═══
export function RockGPTApp() {
  // Splash & Intro State
  const [showIntro, setShowIntro] = useState(true);
  const [flown, setFlown] = useState(false);

  // User & Theme State
  const [user, setUser] = useState<UserData | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [settings, setSettings] = useState<{
    enter: boolean;
    intro: boolean;
    size: "s" | "m" | "l";
    scroll: boolean;
    instr: string;
    fast?: boolean;
  }>({
    enter: true,
    intro: true,
    size: "m",
    scroll: true,
    instr: "",
    fast: false,
  });
  const [fastMode, setFastMode] = useState(false);

  // Layout & Sidebar
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");

  // Chats & Active Conversation
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [activeChat, setActiveChat] = useState<ChatItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingContext, setThinkingContext] = useState<{ hasImage?: boolean; isImageGen?: boolean }>({});
  const [showScrollDown, setShowScrollDown] = useState(false);

  // Composer State
  const [inputValue, setInputValue] = useState("");
  const [attachments, setAttachments] = useState<
    { name: string; type: string; size?: number; url?: string; dataUrl?: string; text?: string; file?: File }[]
  >([]);

  // Modals & Overlays
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"in" | "up" | "code" | "forgot" | "reset">("in");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPassword2, setAuthPassword2] = useState("");
  const [authOtpCode, setAuthOtpCode] = useState("");
  const [authShowPw, setAuthShowPw] = useState(false);
  const [authRememberSession, setAuthRememberSession] = useState(true);
  const [authAgreeTos, setAuthAgreeTos] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);
  const [authResendSeconds, setAuthResendSeconds] = useState(0);
  const [sessionEndedNotice, setSessionEndedNotice] = useState(false);

  // Guest Session Countdown Timer (3 Minutes = 180s Free Session)
  const GUEST_SESSION_SECONDS = 180;
  const [guestTimeLeft, setGuestTimeLeft] = useState<number | null>(null);

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<{ url: string; alt: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<{ id: string; msg: string; act?: { label: string; fn: () => void } }[]>([]);

  // DOM & Streaming Refs
  const scRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const introIconRef = useRef<HTMLImageElement | null>(null);
  const sMarkRef = useRef<HTMLDivElement | null>(null);
  const hMarkRef = useRef<HTMLDivElement | null>(null);
  const abortCtrlRef = useRef<AbortController | null>(null);
  const lastAiMarkRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const micRecRef = useRef<any>(null);
  const introRanRef = useRef(false);
  const flyInRanRef = useRef(false);
  const guestExpiryPopupFiredRef = useRef(false);
  const streamTargetRef = useRef("");
  const streamShownLenRef = useRef(0);
  const streamDoneRef = useRef(false);
  const streamRafRef = useRef<number | null>(null);

  // Toast Dispatcher
  const showToast = useCallback((msg: string, act?: { label: string; fn: () => void }) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev.slice(-3), { id, msg, act }]);
    const duration = act ? 6000 : 2600;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  // Auth Modal Opener (Guarantees fresh state, zero prefill, and optional session-ended notice)
  const openAuthModal = useCallback(
    (mode: "in" | "up" = "in", errorMsg?: string, endedNotice = false) => {
      setAuthMode(mode);
      setAuthEmail("");
      setAuthPassword("");
      setAuthPassword2("");
      setAuthName("");
      setAuthOtpCode("");
      setAuthError(errorMsg || null);
      setAuthSuccessMsg(null);
      setSessionEndedNotice(endedNotice);
      setShowAuthModal(true);
    },
    []
  );

  // Theme Synchronizer (including mobile theme-color meta tag)
  const applyTheme = useCallback((t: "dark" | "light") => {
    setTheme(t);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = t;
      const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (meta) meta.content = t === "light" ? "#ffffff" : "#0d0d0d";
      try {
        localStorage.setItem("rockgpt_theme", t);
      } catch {}
    }
  }, []);

  // Settings Synchronizer
  const updateSettings = useCallback((newSet: Partial<typeof settings>) => {
    setSettings((prev) => {
      const merged = { ...prev, ...newSet };
      if (typeof document !== "undefined") {
        document.documentElement.dataset.size = merged.size;
        try {
          localStorage.setItem("rockgpt_set", JSON.stringify(merged));
        } catch {}
      }
      return merged;
    });
  }, []);

  // 1. INTRO FLIP ANIMATION (SECTION 6 & FLIP SHARED-ELEMENT)
  const flyIn = useCallback(() => {
    if (flyInRanRef.current) return;
    flyInRanRef.current = true;
    setFlown(true);

    const root = document.documentElement;
    root.classList.add("reveal");

    const icon = introIconRef.current;
    if (icon) {
      try {
        icon.getAnimations().forEach((x) => x.cancel());
        icon.style.opacity = "1";
      } catch {}
    }

    const targetSlot = [hMarkRef.current, sMarkRef.current].find((el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });

    const done = () => {
      if (targetSlot) {
        targetSlot.style.opacity = "1";
        targetSlot.style.transition = "none";
      }
      root.classList.add("reveal", "landed");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setShowIntro(false);
        });
      });
    };

    // Watchdog fallback: never allow intro to stay stuck
    const watchdog = setTimeout(done, 1100);

    if (!targetSlot || !icon || !icon.animate) {
      clearTimeout(watchdog);
      done();
      return;
    }

    try {
      const a = icon.getBoundingClientRect();
      const b = targetSlot.getBoundingClientRect();
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const k = b.width / (a.width || 1);

      const anim = icon.animate(
        [
          { transform: "translate(0,0) scale(1)" },
          { transform: `translate(${dx}px, ${dy}px) scale(${k})` },
        ],
        {
          duration: 750,
          easing: "cubic-bezier(.65,0,.35,1)",
          fill: "forwards",
        }
      );
      anim.onfinish = () => {
        clearTimeout(watchdog);
        done();
      };
    } catch {
      clearTimeout(watchdog);
      done();
    }
  }, []);

  // Initial Load & Mount Setup
  useEffect(() => {
    // 1. Theme & Settings
    const savedTheme = (localStorage.getItem("rockgpt_theme") as "dark" | "light") || "dark";
    applyTheme(savedTheme);

    try {
      const savedSet = JSON.parse(localStorage.getItem("rockgpt_set") || "{}");
      if (savedSet) updateSettings(savedSet);
    } catch {}

    const savedFast = localStorage.getItem("rockgpt_fast") === "1";
    setFastMode(savedFast);

    // 2. Viewport Resize & App Mode
    const updateVh = () => {
      const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty("--vh", `${h}px`);
    };
    updateVh();
    window.addEventListener("resize", updateVh);
    window.visualViewport?.addEventListener("resize", updateVh);

    // 3. Intro Flow (Guaranteed to execute and never freeze)
    if (!introRanRef.current) {
      introRanRef.current = true;

      const fallbackTimer = setTimeout(() => {
        document.documentElement.classList.add("reveal", "landed");
        setShowIntro(false);
      }, 4500);

      const isAppMode =
        document.documentElement.classList.contains("app-mode") ||
        window.matchMedia("(display-mode: standalone)").matches;

      const forceIntro = !!sessionStorage.getItem("rg_force");
      if (forceIntro) {
        sessionStorage.removeItem("rg_force");
      }

      let prefIntro = true;
      try {
        const saved = localStorage.getItem("rockgpt_set");
        if (saved) prefIntro = JSON.parse(saved).intro !== false;
      } catch {}

      if (prefIntro || forceIntro) {
        if (introIconRef.current) {
          introIconRef.current.style.opacity = "1";
        }
        // Logo unfolds (0s-0.52s), "ROCKGPT" arranges next to it (0.45s-1.00s), holds centered briefly, then smooth FLIP glides to header
        const dur = isAppMode ? 1350 : 1550;
        const timer = setTimeout(flyIn, dur);
        return () => {
          clearTimeout(timer);
          clearTimeout(fallbackTimer);
          window.removeEventListener("resize", updateVh);
          window.visualViewport?.removeEventListener("resize", updateVh);
        };
      } else {
        clearTimeout(fallbackTimer);
        document.documentElement.classList.add("reveal", "landed");
        setShowIntro(false);
      }
    }

    return () => {
      window.removeEventListener("resize", updateVh);
      window.visualViewport?.removeEventListener("resize", updateVh);
    };
  }, [applyTheme, flyIn, updateSettings]);

  // Keydown / Click to Dismiss Intro Early
  useEffect(() => {
    if (!showIntro) return;
    const onKey = () => flyIn();
    window.addEventListener("keydown", onKey, { once: true });
    return () => window.removeEventListener("keydown", onKey);
  }, [showIntro, flyIn]);

  // Feed click delegation: code copy, image zoom lightbox, and image download
  useEffect(() => {
    const onListClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      const copyBtn = target.closest<HTMLButtonElement>(".cc, .code-copy-btn");
      if (copyBtn) {
        const raw = copyBtn.dataset.copy
          ? decodeURIComponent(copyBtn.dataset.copy)
          : copyBtn.closest("pre")?.querySelector("code")?.textContent || "";
        if (raw) {
          navigator.clipboard.writeText(raw).then(() => {
            const oldText = copyBtn.textContent;
            copyBtn.textContent = "Copied";
            setTimeout(() => {
              copyBtn.textContent = oldText || "Copy";
            }, 1400);
          });
        }
        return;
      }

      const dlBtn = target.closest<HTMLButtonElement>(".msg-image-dl");
      if (dlBtn) {
        const url = dlBtn.dataset.dlImg;
        const name = (dlBtn.dataset.dlName || "rockgpt-image").replace(/[^\w-]+/g, "-").slice(0, 40);
        if (url) {
          try {
            const resp = await fetch(url);
            const blob = await resp.blob();
            const objUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = objUrl;
            a.download = `${name}.jpg`;
            a.click();
            URL.revokeObjectURL(objUrl);
            showToast("Image downloaded");
          } catch {
            window.open(url, "_blank", "noopener,noreferrer");
          }
        }
        return;
      }

      const previewImg = target.closest<HTMLImageElement>("img[data-preview='img'], .att img");
      if (previewImg && previewImg.src) {
        setLightboxImg({
          url: previewImg.src,
          alt: previewImg.alt || "Image Preview",
        });
      }
    };
    const sc = scRef.current;
    sc?.addEventListener("click", onListClick);
    return () => sc?.removeEventListener("click", onListClick);
  }, [showToast]);

  // Helper to download image from Lightbox
  const downloadImageUrl = useCallback(
    async (url: string, name = "rockgpt-image") => {
      const cleanName = name.replace(/[^\w-]+/g, "-").slice(0, 40) || "rockgpt-image";
      try {
        const resp = await fetch(url);
        const blob = await resp.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        a.download = `${cleanName}.jpg`;
        a.click();
        URL.revokeObjectURL(objUrl);
        showToast("Image downloaded");
      } catch {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    },
    [showToast]
  );

  // Initialize / compute persistent 3-minute guest countdown synced with server
  const initGuestTimer = useCallback(
    (serverGuest?: { remainingSeconds?: number; expired?: boolean }) => {
      try {
        if (serverGuest?.expired) {
          localStorage.setItem("rockgpt_guest_started_at", String(Date.now() - GUEST_SESSION_SECONDS * 1000));
          setGuestTimeLeft(0);
          if (!guestExpiryPopupFiredRef.current) {
            guestExpiryPopupFiredRef.current = true;
            openAuthModal("up", undefined, true);
          }
          return;
        }
        const raw = localStorage.getItem("rockgpt_guest_started_at");
        let startedAt = raw ? Number(raw) : NaN;
        if (!Number.isFinite(startedAt) || startedAt <= 0) {
          startedAt = Date.now();
          localStorage.setItem("rockgpt_guest_started_at", String(startedAt));
        }
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        let rem = Math.max(0, GUEST_SESSION_SECONDS - elapsed);
        if (typeof serverGuest?.remainingSeconds === "number") {
          rem = Math.min(rem, Math.max(0, serverGuest.remainingSeconds));
        }
        setGuestTimeLeft(rem);
        if (rem <= 0 && !guestExpiryPopupFiredRef.current) {
          guestExpiryPopupFiredRef.current = true;
          openAuthModal("up", undefined, true);
        }
      } catch {
        setGuestTimeLeft((prev) => (prev === null ? GUEST_SESSION_SECONDS : prev));
      }
    },
    [openAuthModal]
  );

  // Fetch Session & Persistent Chats
  const fetchSession = useCallback(async () => {
    let serverGuest: { remainingSeconds?: number; expired?: boolean } | undefined;
    try {
      const res = await fetch("/api/me");
      if (res.ok) {
        const data = await res.json();
        if (data.guest) serverGuest = data.guest;
        if (data.user) {
          setUser(data.user);
          setGuestTimeLeft(null);
          setSessionEndedNotice(false);
          try {
            localStorage.removeItem("rockgpt_guest_started_at");
          } catch {}
          if (data.user.settings) {
            updateSettings({
              instr: data.user.settings.instructions || "",
              fast: !!data.user.settings.fast,
              size: data.user.settings.textSize || "m",
            });
            if (data.user.settings.fast !== undefined) {
              setFastMode(!!data.user.settings.fast);
            }
          }
          return;
        }
      }
    } catch {}
    initGuestTimer(serverGuest);
  }, [updateSettings, initGuestTimer]);

  const fetchChats = useCallback(async (q = "") => {
    try {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const res = await fetch(`/api/chats${qs}`);
      if (res.ok) {
        const data = await res.json();
        const list: ChatItem[] = Array.isArray(data.chats) ? data.chats : Array.isArray(data) ? data : [];
        setChats(list);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchSession();
    fetchChats();
  }, [fetchSession, fetchChats]);

  // Debounced server + local search query sync when signed in
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => {
      fetchChats(searchQuery);
    }, 220);
    return () => clearTimeout(t);
  }, [searchQuery, user, fetchChats]);

  // Auto-scroll when assistant reply finishes to reveal response toolbar & follow-up chips
  useEffect(() => {
    if (!isBusy && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role === "assistant") {
        const timer = setTimeout(() => {
          if (scRef.current) {
            scRef.current.scrollTo({
              top: scRef.current.scrollHeight + 300,
              behavior: "smooth",
            });
          }
        }, 80);
        return () => clearTimeout(timer);
      }
    }
  }, [isBusy, messages.length]);

  // Guest 3-minute free session live countdown
  useEffect(() => {
    if (guestTimeLeft === null || user) return;
    if (guestTimeLeft <= 0) {
      if (!guestExpiryPopupFiredRef.current) {
        guestExpiryPopupFiredRef.current = true;
        openAuthModal("up", undefined, true);
      }
      return;
    }
    const t = setInterval(() => {
      setGuestTimeLeft((p) => {
        if (p === null) return null;
        if (p <= 1) return 0;
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [guestTimeLeft, user, openAuthModal]);

  // Unload guard: warn unauthenticated users that refreshing will clear their in-memory conversation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!user && messages.length > 0) {
        e.preventDefault();
        e.returnValue = "Are you sure you want to refresh? Your conversation will be lost unless you sign up.";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [user, messages.length]);

  // OTP resend countdown
  useEffect(() => {
    if (authResendSeconds <= 0) return;
    const t = setInterval(() => setAuthResendSeconds((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [authResendSeconds]);

  // Auto-scroll Feed
  const scrollToBottom = useCallback((smooth = true) => {
    if (scRef.current) {
      scRef.current.scrollTo({
        top: scRef.current.scrollHeight + 1000,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

  const handleScroll = () => {
    if (!scRef.current) return;
    const dist = scRef.current.scrollHeight - scRef.current.scrollTop - scRef.current.clientHeight;
    setShowScrollDown(dist > 260);
  };

  // 2. CONVERSATION MANAGEMENT
  const startNewChat = useCallback(() => {
    if (isBusy) {
      showToast("Stop the current reply first");
      return;
    }
    setActiveChat(null);
    setMessages([]);
    setAttachments([]);
    setInputValue("");
    setMobileOpen(false);
  }, [isBusy, showToast]);

  const loadChat = async (chat: ChatItem) => {
    if (isBusy) {
      showToast("Stop the current reply first");
      return;
    }
    try {
      const res = await fetch(`/api/chats/${chat.id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveChat(chat);
        const rawMsgs = data.messages || (data.chat && data.chat.messages) || [];
        setMessages(
          rawMsgs.map((m: any) => ({
            id: m.id || m._id,
            role: m.role,
            content: m.content || "",
            image: m.image,
            attachments: m.attachments,
            feedback: m.feedback,
            fb: m.feedback === "up" ? "up" : m.feedback === "down" ? "dn" : null,
          }))
        );
        setMobileOpen(false);
        setTimeout(() => scrollToBottom(false), 50);
      }
    } catch {
      showToast("Failed to load chat");
    }
  };

  const handlePinChat = async (c: ChatItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextPinned = !c.pinned;
    setChats((prev) =>
      prev.map((item) => (item.id === c.id ? { ...item, pinned: nextPinned } : item))
    );
    showToast(nextPinned ? "Chat pinned" : "Chat unpinned");
    await fetch(`/api/chats/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: nextPinned }),
    }).catch(() => {});
  };

  const handleStartRename = (c: ChatItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(c.id);
    setRenameText(c.title);
  };

  const handleSaveRename = async (c: ChatItem, newTitle: string) => {
    const trimmed = newTitle.trim();
    setRenamingId(null);
    if (!trimmed || trimmed === c.title) return;
    setChats((prev) =>
      prev.map((item) => (item.id === c.id ? { ...item, title: trimmed } : item))
    );
    if (activeChat?.id === c.id) {
      setActiveChat((prev) => (prev ? { ...prev, title: trimmed } : null));
    }
    await fetch(`/api/chats/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    }).catch(() => {});
  };

  const handleDeleteChat = async (c: ChatItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBusy && activeChat?.id === c.id) {
      showToast("Wait for the reply to finish");
      return;
    }
    const wasActive = activeChat?.id === c.id;
    const removedIdx = chats.findIndex((item) => item.id === c.id);
    setChats((prev) => prev.filter((item) => item.id !== c.id));
    if (wasActive) startNewChat();

    // 6-Second Undo Toast
    showToast("Chat deleted", {
      label: "Undo",
      fn: async () => {
        setChats((prev) => {
          const next = [...prev];
          next.splice(Math.min(removedIdx, next.length), 0, c);
          return next;
        });
        if (wasActive) loadChat(c);
        await fetch(`/api/chats/${c.id}/restore`, { method: "POST" }).catch(() => {});
      },
    });

    // Soft delete on backend
    await fetch(`/api/chats/${c.id}`, { method: "DELETE" }).catch(() => {});
  };

  // 3. SEND & ULTRA-SMOOTH STREAMING FLOW
  const cancelStreamAnimation = useCallback(() => {
    if (streamRafRef.current !== null) {
      cancelAnimationFrame(streamRafRef.current);
      streamRafRef.current = null;
    }
  }, []);

  const stopGeneration = useCallback(() => {
    cancelStreamAnimation();
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
      abortCtrlRef.current = null;
    }
    if (activeChat?.id) {
      fetch(`/api/chats/${activeChat.id}/stop`, { method: "POST" }).catch(() => {});
    }
    setIsBusy(false);
    setIsThinking(false);
  }, [activeChat?.id, cancelStreamAnimation]);

  const spinDownMark = (markEl: HTMLElement | null) => {
    if (!markEl) return;
    const logoImg = markEl.querySelector<HTMLElement>(".logo");
    if (!logoImg) return;
    try {
      const mx = new DOMMatrix(getComputedStyle(logoImg).transform);
      const angle = (Math.atan2(mx.b, mx.a) * (180 / Math.PI) + 360) % 360;
      markEl.classList.remove("live");
      logoImg.style.animation = "none";
      let to = 360;
      if (360 - angle < 110) to = 720;
      logoImg.style.transform = `rotate(${to}deg)`;
      if (logoImg.animate) {
        logoImg.animate(
          [{ transform: `rotate(${angle}deg)` }, { transform: `rotate(${to}deg)` }],
          { duration: 1200, easing: "cubic-bezier(.16,1,.3,1)" }
        );
      }
    } catch {}
  };

  const handleSend = async (overrideText?: string, baseHistory?: MessageItem[]) => {
    // 0. Check guest session expiration
    if (!user && guestTimeLeft !== null && guestTimeLeft <= 0) {
      openAuthModal("up", undefined, true);
      return;
    }

    // 0b. Ensure 3-minute countdown is started if uninitialized
    if (!user && guestTimeLeft === null) {
      try {
        if (!localStorage.getItem("rockgpt_guest_started_at")) {
          localStorage.setItem("rockgpt_guest_started_at", String(Date.now()));
        }
      } catch {}
      setGuestTimeLeft(GUEST_SESSION_SECONDS);
    }

    const textToSend = (overrideText ?? inputValue).trim();
    const filesToSend = attachments;
    if ((!textToSend && !filesToSend.length) || isBusy) return;

    if (micRecRef.current) {
      try {
        micRecRef.current.stop();
      } catch {}
    }

    setInputValue("");
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // 1. Assign or reuse Chat
    let chatId = activeChat?.id;
    if (!chatId) {
      const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0");
      const randomHex = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      chatId = (timestamp + randomHex).toLowerCase();
      const newChatObj: ChatItem = {
        id: chatId,
        title: textToSend.slice(0, 42) || filesToSend[0]?.name || "New chat",
      };
      setActiveChat(newChatObj);
      setChats((prev) => [newChatObj, ...prev]);
    }

    // 2. Add user message & initialize smooth streaming buffers
    const currentBase = baseHistory ?? messages;
    const firstImgDataUrl = filesToSend.find((f) => f.type.startsWith("image/"))?.dataUrl;
    const userMsg: MessageItem = {
      role: "user",
      content: textToSend,
      files: filesToSend.map((f) => ({ name: f.name, type: f.type, url: f.url, text: f.text })),
      image: firstImgDataUrl,
    };

    const isImgGenPrompt = /^(?:generate|create|draw|make|show|render|produce|paint)\s+(?:an?\s+)?(?:image|picture|photo|illustration|art|wallpaper)/i.test(
      textToSend
    );
    setThinkingContext({
      hasImage: Boolean(firstImgDataUrl),
      isImageGen: isImgGenPrompt,
    });

    setMessages([...currentBase, userMsg, { role: "assistant", content: "" }]);
    setIsBusy(true);
    setIsThinking(true);
    setTimeout(() => scrollToBottom(false), 30);

    streamTargetRef.current = "";
    streamShownLenRef.current = 0;
    streamDoneRef.current = false;
    cancelStreamAnimation();

    const abortCtrl = new AbortController();
    abortCtrlRef.current = abortCtrl;
    const minThinkUntil = Date.now() + 650;
    let finalMessageId: string | undefined;

    const removeEmptyPlaceholder = () => {
      setMessages((prev) => {
        if (prev.length > 0 && prev[prev.length - 1].role === "assistant" && !prev[prev.length - 1].content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    };

    const startSmoothRevealLoop = () => {
      if (streamRafRef.current !== null) return;
      const tick = () => {
        if (Date.now() < minThinkUntil) {
          streamRafRef.current = requestAnimationFrame(tick);
          return;
        }

        const target = streamTargetRef.current;
        const shown = streamShownLenRef.current;

        if (shown < target.length) {
          if (shown === 0) {
            setIsThinking(false);
          }
          const backlog = target.length - shown;
          const step = Math.max(2, Math.min(20, Math.ceil(backlog / 8)));
          const nextLen = Math.min(target.length, shown + step);
          streamShownLenRef.current = nextLen;
          const visibleText = target.slice(0, nextLen);

          setMessages((prev) => {
            const next = [...prev];
            const lastIdx = next.length - 1;
            if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
              next[lastIdx] = { ...next[lastIdx], content: visibleText };
            } else {
              next.push({ role: "assistant", content: visibleText });
            }
            return next;
          });

          if (settings.scroll && scRef.current) {
            const el = scRef.current;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 220) {
              el.scrollTop = el.scrollHeight;
            }
          }
        }

        if (streamDoneRef.current && streamShownLenRef.current >= streamTargetRef.current.length) {
          streamRafRef.current = null;
          if (finalMessageId) {
            setMessages((prev) => {
              const next = [...prev];
              const lastIdx = next.length - 1;
              if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
                next[lastIdx] = { ...next[lastIdx], id: finalMessageId };
              }
              return next;
            });
          }
          setIsBusy(false);
          setIsThinking(false);
          abortCtrlRef.current = null;
          spinDownMark(lastAiMarkRef.current);
          fetchChats().catch(() => {});
          return;
        }

        streamRafRef.current = requestAnimationFrame(tick);
      };
      streamRafRef.current = requestAnimationFrame(tick);
    };

    try {
      const streamRes = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: textToSend,
          image: userMsg.image,
          attachments: filesToSend.map((f) => ({
            name: f.name,
            type: f.type,
            text: f.text,
            dataUrl: f.type.startsWith("image/") ? f.dataUrl : undefined,
          })),
          fast: fastMode,
          instructions: settings.instr,
        }),
        signal: abortCtrl.signal,
      });

      if (!streamRes.ok) {
        removeEmptyPlaceholder();
        if (streamRes.status === 401) {
          openAuthModal("in");
          setIsBusy(false);
          setIsThinking(false);
          return;
        }
        if (streamRes.status === 403) {
          const errPayload = await streamRes.json().catch(() => ({}));
          if (errPayload?.guestExpired) {
            try {
              localStorage.setItem("rockgpt_guest_started_at", String(Date.now() - GUEST_SESSION_SECONDS * 1000));
            } catch {}
            guestExpiryPopupFiredRef.current = true;
            setGuestTimeLeft(0);
            openAuthModal("up", undefined, true);
            setIsBusy(false);
            setIsThinking(false);
            return;
          }
        }
        if (streamRes.status === 429) {
          showToast("Slow down a moment");
          setIsBusy(false);
          setIsThinking(false);
          return;
        }
        throw new Error(`HTTP ${streamRes.status}`);
      }

      const reader = streamRes.body?.getReader();
      if (!reader) throw new Error("No readable stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let streamFinished = false;
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;

          if (line.startsWith("event:")) {
            const ev = line.replace(/^event:\s*/, "");
            if (ev === "done") {
              streamFinished = true;
            }
          } else if (line.startsWith("data:")) {
            const dataStr = line.replace(/^data:\s*/, "");
            try {
              const data = JSON.parse(dataStr);
              if (data.message_id) {
                finalMessageId = data.message_id;
                streamFinished = true;
                break;
              }
              if (data.done) {
                streamFinished = true;
                break;
              }
              const chunk = data.chunk ?? data.text ?? data.token ?? "";
              if (chunk) {
                streamTargetRef.current += chunk;
                startSmoothRevealLoop();
              }
            } catch {}
          }
        }
        if (streamFinished) {
          try {
            await reader.cancel();
          } catch {}
          break;
        }
      }

      streamDoneRef.current = true;
      if (streamTargetRef.current.length === 0) {
        removeEmptyPlaceholder();
        setIsBusy(false);
        setIsThinking(false);
        spinDownMark(lastAiMarkRef.current);
      } else {
        startSmoothRevealLoop();
      }
    } catch (err: any) {
      cancelStreamAnimation();
      streamDoneRef.current = true;
      if (err.name === "AbortError") {
        removeEmptyPlaceholder();
      } else {
        setMessages((prev) => {
          const next = [...prev];
          const lastIdx = next.length - 1;
          if (lastIdx >= 0 && next[lastIdx].role === "assistant" && !next[lastIdx].content) {
            next[lastIdx] = {
              role: "assistant",
              content: "Couldn't reach ROCKGPT. Check your connection and try again.",
            };
          } else {
            next.push({
              role: "assistant",
              content: "Couldn't reach ROCKGPT. Check your connection and try again.",
            });
          }
          return next;
        });
      }
      setIsBusy(false);
      setIsThinking(false);
      abortCtrlRef.current = null;
      spinDownMark(lastAiMarkRef.current);
      fetchChats().catch(() => {});
    }
  };

  // Global Keyboard Shortcuts (matching Settings modal shortcuts table)
  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const targetTag = (e.target as HTMLElement)?.tagName || "";
      const isEditingInput = targetTag === "INPUT" || targetTag === "TEXTAREA";

      if (mod && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        startNewChat();
        return;
      }
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowSearchInput((p) => {
          const next = !p;
          if (next) setTimeout(() => searchInputRef.current?.focus(), 40);
          return next;
        });
        return;
      }
      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        if (window.innerWidth <= 820) setMobileOpen((p) => !p);
        else setCollapsed((p) => !p);
        return;
      }
      if (mod && e.key === ",") {
        e.preventDefault();
        setShowSettingsModal((p) => !p);
        return;
      }
      if (e.key === "/" && !isEditingInput && !showAuthModal && !showSettingsModal && !showPricingModal) {
        e.preventDefault();
        textareaRef.current?.focus();
        return;
      }
      if (e.key === "Escape") {
        if (lightboxImg) {
          setLightboxImg(null);
          return;
        }
        if (showPricingModal) {
          setShowPricingModal(false);
          return;
        }
        if (showSettingsModal) {
          setShowSettingsModal(false);
          return;
        }
        if (showAuthModal) {
          setShowAuthModal(false);
          return;
        }
        if (isBusy) {
          stopGeneration();
        }
      }
    };
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  }, [isBusy, lightboxImg, showAuthModal, showPricingModal, showSettingsModal, startNewChat, stopGeneration]);

  const handleRegenerate = () => {
    if (isBusy || messages.length === 0) return;
    let lastUserIdx = messages.length - 1;
    while (lastUserIdx >= 0 && messages[lastUserIdx].role !== "user") {
      lastUserIdx--;
    }
    if (lastUserIdx < 0) return;
    const userQuery = messages[lastUserIdx].content;
    const baseList = messages.slice(0, lastUserIdx);
    handleSend(userQuery, baseList);
  };

  const handleEditLast = () => {
    if (isBusy || messages.length === 0) return;
    let lastUserIdx = messages.length - 1;
    while (lastUserIdx >= 0 && messages[lastUserIdx].role !== "user") {
      lastUserIdx--;
    }
    if (lastUserIdx < 0) return;
    const userQuery = messages[lastUserIdx].content;
    setInputValue(userQuery);
    setMessages(messages.slice(0, lastUserIdx));
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  };

  // Voice Input (SpeechRecognition)
  const handleVoiceInput = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      showToast("Voice input not supported in this browser");
      return;
    }
    if (micRecRef.current) {
      micRecRef.current.stop();
      micRecRef.current = null;
      return;
    }
    try {
      const rec = new SpeechRec();
      rec.interimResults = true;
      rec.lang = navigator.language || "en-US";
      const base = inputValue;
      rec.onresult = (e: any) => {
        const transcript = [...e.results].map((r: any) => r[0].transcript).join("");
        setInputValue((base ? `${base} ` : "") + transcript);
      };
      rec.onend = () => { micRecRef.current = null; };
      rec.onerror = () => { micRecRef.current = null; };
      rec.start();
      micRecRef.current = rec;
      showToast("Listening…");
    } catch {
      showToast("Microphone permission needed");
    }
  };

  // File Upload Handling (Images + .txt/.md/code extraction)
  const handleAddFiles = (fileList: FileList | File[]) => {
    const arr = [...fileList];
    const isTextReadable = (f: File) =>
      f.type.startsWith("text/") ||
      /json|javascript|xml|csv/i.test(f.type) ||
      /\.(txt|md|markdown|json|csv|js|jsx|ts|tsx|py|html|htm|css|scss|sql|log|yml|yaml|xml|env|sh)$/i.test(f.name);

    arr.forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        showToast("File must be smaller than 10MB");
        return;
      }
      const isImg = file.type.startsWith("image/");
      const reader = new FileReader();

      if (isImg) {
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setAttachments((prev) => [
            ...prev,
            {
              name: file.name,
              type: file.type,
              size: file.size,
              file,
              url: URL.createObjectURL(file),
              dataUrl,
            },
          ]);
        };
        reader.readAsDataURL(file);
      } else if (isTextReadable(file)) {
        reader.onload = () => {
          const textContent = String(reader.result || "").slice(0, 40_000);
          setAttachments((prev) => [
            ...prev,
            {
              name: file.name,
              type: file.type || "text/plain",
              size: file.size,
              file,
              text: textContent,
            },
          ]);
        };
        reader.readAsText(file);
      } else {
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
            file,
          },
        ]);
      }
    });
  };

  // Export Current Chat
  const handleExportChat = () => {
    if (!activeChat || messages.length === 0) return;
    const md = `# ${activeChat.title}\n\n` +
      messages.map((m) => `${m.role === "user" ? "**You**" : "**ROCKGPT**"}\n\n${m.content}`).join("\n\n---\n\n") +
      "\n";
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(activeChat.title.replace(/[^\w]+/g, "-").slice(0, 40) || "chat")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Chat exported");
  };

  const finishAuthSuccess = (loggedUser: UserData, toastMessage: string) => {
    setUser(loggedUser);
    setGuestTimeLeft(null);
    setSessionEndedNotice(false);
    guestExpiryPopupFiredRef.current = false;
    try {
      localStorage.removeItem("rockgpt_guest_started_at");
    } catch {}
    setShowAuthModal(false);
    setAuthPassword("");
    setAuthPassword2("");
    setAuthOtpCode("");

    if (messages.length > 0) {
      fetch("/api/chats/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chats: [
            {
              id: activeChat?.id || Date.now().toString(),
              title: activeChat?.title || "Conversation",
              msgs: messages,
              messages,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      })
        .then(() => fetchChats())
        .catch(() => {});
    } else {
      fetchChats();
    }
    showToast(toastMessage);
  };

  // 4. AUTHENTICATION HANDLERS
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (authMode === "in") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: authEmail, password: authPassword, remember: authRememberSession }),
        });
        const data = await res.json();
        if (res.ok && data.user) {
          finishAuthSuccess(data.user, `Welcome back, ${(data.user.name || "User").split(" ")[0]}!`);
        } else {
          setAuthError(data.error?.message || "Invalid email or password");
        }
      } else if (authMode === "up") {
        if (authPassword !== authPassword2) {
          setAuthError("Passwords do not match");
          setAuthLoading(false);
          return;
        }
        if (!authAgreeTos) {
          setAuthError("Accept the Terms of Service to continue");
          setAuthLoading(false);
          return;
        }
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: authName, email: authEmail, password: authPassword }),
        });
        const data = await res.json();
        if (res.ok) {
          if (data.alreadyActive && data.user) {
            finishAuthSuccess(data.user, `Welcome back, ${(data.user.name || "User").split(" ")[0]}!`);
          } else {
            setAuthMode("code");
            setAuthResendSeconds(60);
            showToast(data.message || "Verification code sent to your email!");
          }
        } else {
          setAuthError(data.error?.message || "Failed to create account");
        }
      } else if (authMode === "code") {
        const res = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: authEmail, code: authOtpCode, type: "signup" }),
        });
        const data = await res.json();
        if (res.ok && data.user) {
          finishAuthSuccess(data.user, `Welcome, ${(data.user.name || "User").split(" ")[0]}!`);
        } else {
          setAuthError(data.error?.message || "Invalid verification code");
        }
      } else if (authMode === "forgot") {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: authEmail }),
        });
        const data = await res.json();
        if (res.ok) {
          setAuthMode("reset");
          setAuthResendSeconds(60);
          showToast(data.message || "Recovery code sent to your inbox!");
        } else {
          setAuthError(data.error?.message || "Failed to send recovery code");
        }
      } else if (authMode === "reset") {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: authEmail, code: authOtpCode, newPassword: authPassword }),
        });
        const data = await res.json();
        if (res.ok && data.user) {
          finishAuthSuccess(data.user, "Password updated successfully! You are signed in.");
        } else {
          setAuthError(data.error?.message || "Failed to reset password");
        }
      }
    } catch {
      setAuthError("Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setChats([]);
      startNewChat();
      guestExpiryPopupFiredRef.current = false;
      try {
        localStorage.setItem("rockgpt_guest_started_at", String(Date.now()));
      } catch {}
      setGuestTimeLeft(GUEST_SESSION_SECONDS);
      showToast("Logged out");
    } catch {
      showToast("Failed to log out");
    }
  };

  // Grouping Chats into Temporal Buckets
  const s0 = new Date().setHours(0, 0, 0, 0);
  const D = 864e5;
  const qLower = searchQuery.trim().toLowerCase();
  const filteredChats = chats.filter((c) => {
    if (!qLower || user) return true;
    if (c.title.toLowerCase().includes(qLower)) return true;
    if (activeChat?.id === c.id) {
      return messages.some((m) => (m.content || "").toLowerCase().includes(qLower));
    }
    return false;
  });

  const pinnedChats = filteredChats.filter((c) => c.pinned);
  const unpinnedChats = filteredChats.filter((c) => !c.pinned);

  const getBucket = (c: ChatItem) => {
    const t = c.t || (c.updatedAt ? new Date(c.updatedAt).getTime() : Date.now());
    if (t >= s0) return "Today";
    if (t >= s0 - D) return "Yesterday";
    if (t >= s0 - 7 * D) return "Previous 7 days";
    return "Older";
  };

  const buckets = ["Today", "Yesterday", "Previous 7 days", "Older"] as const;

  const isFeedEmpty = messages.length === 0;

  return (
    <>
      {/* ═══ 1. INTRO SPLASH OVERLAY (MATCHING IMAGE 1 BRAND LOCKUP) ═══ */}
      {showIntro && (
        <div id="intro" className={flown ? "fly" : "go"} onClick={flyIn}>
          <div id="iBg" />
          <div id="introLockup">
            <div id="stage">
              <img
                id="iIcon"
                ref={introIconRef}
                className="logo"
                src="/assets/logo-lg.webp"
                alt="RockGPT"
                draggable="false"
              />
            </div>
            <div id="word" aria-label="RockGPT">
              {"ROCKGPT".split("").map((c, i) => (
                <span key={i}>
                  <i style={{ animationDelay: `${0.45 + i * 0.038}s` }}>{c}</i>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ 2. MAIN APPLICATION CONTAINER ═══ */}
      <div
        id="app"
        className={`${isFeedEmpty ? "is-empty" : ""} ${isBusy ? "busy" : ""} ${
          collapsed ? "collapsed" : ""
        } ${mobileOpen ? "m-open" : ""}`}
      >
        {/* Mobile Scrim / Backdrop */}
        <div id="back" onClick={() => setMobileOpen(false)} />

        {/* ═══ SIDEBAR ═══ */}
        <aside id="side" className={showSearchInput ? "sq" : ""} aria-label="Sidebar navigation">
          <div className="sin">
            <div className="stop">
              <div className="brand">
                <div className="bm fly-target" id="sMark" ref={sMarkRef}>
                  <img className="logo" src="/assets/logo-sm.webp" alt="RockGPT" draggable="false" />
                </div>
                <span>ROCKGPT</span>
              </div>
              <button
                type="button"
                className="sbtn"
                id="sqb"
                title="Search chats (Ctrl+K)"
                aria-label="Search chats"
                onClick={() =>
                  setShowSearchInput((prev) => {
                    const next = !prev;
                    if (!next) setSearchQuery("");
                    else setTimeout(() => searchInputRef.current?.focus(), 40);
                    return next;
                  })
                }
              >
                <svg viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </button>
            </div>

            <button type="button" className="nrow" id="new" onClick={startNewChat}>
              <svg viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>New chat</span>
            </button>

            {showSearchInput && (
              <input
                ref={searchInputRef}
                id="sq"
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            )}

            {/* Chat List Grouping */}
            <div id="hist">
              {pinnedChats.length > 0 && (
                <>
                  <div className="hl">Pinned</div>
                  {pinnedChats.map((c) => (
                    <div
                      key={c.id}
                      className={`it pinned ${activeChat?.id === c.id ? "on" : ""}`}
                      onClick={() => loadChat(c)}
                    >
                      {renamingId === c.id ? (
                        <input
                          className="rn"
                          value={renameText}
                          onChange={(e) => setRenameText(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") handleSaveRename(c, renameText);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          onBlur={() => handleSaveRename(c, renameText)}
                          autoFocus
                        />
                      ) : (
                        <span>{c.title}</span>
                      )}
                      <button
                        type="button"
                        className="ia"
                        data-a="pin"
                        title="Unpin"
                        aria-label="Unpin"
                        onClick={(e) => handlePinChat(c, e)}
                      >
                        {PIN_SVG}
                      </button>
                      <button
                        type="button"
                        className="ia"
                        data-a="ren"
                        title="Rename"
                        aria-label="Rename"
                        onClick={(e) => handleStartRename(c, e)}
                      >
                        {REN_SVG}
                      </button>
                      <button
                        type="button"
                        className="ia"
                        data-a="del"
                        title="Delete"
                        aria-label="Delete"
                        onClick={(e) => handleDeleteChat(c, e)}
                      >
                        {BIN_SVG}
                      </button>
                    </div>
                  ))}
                </>
              )}

              {buckets.map((b) => {
                const bucketChats = unpinnedChats.filter((c) => getBucket(c) === b);
                if (bucketChats.length === 0) return null;
                return (
                  <React.Fragment key={b}>
                    <div className="hl">{b}</div>
                    {bucketChats.map((c) => (
                      <div
                        key={c.id}
                        className={`it ${activeChat?.id === c.id ? "on" : ""}`}
                        onClick={() => loadChat(c)}
                      >
                        {renamingId === c.id ? (
                          <input
                            className="rn"
                            value={renameText}
                            onChange={(e) => setRenameText(e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter") handleSaveRename(c, renameText);
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            onBlur={() => handleSaveRename(c, renameText)}
                            autoFocus
                          />
                        ) : (
                          <span>{c.title}</span>
                        )}
                        <button
                          type="button"
                          className="ia"
                          data-a="pin"
                          title="Pin"
                          aria-label="Pin"
                          onClick={(e) => handlePinChat(c, e)}
                        >
                          {PIN_SVG}
                        </button>
                        <button
                          type="button"
                          className="ia"
                          data-a="ren"
                          title="Rename"
                          aria-label="Rename"
                          onClick={(e) => handleStartRename(c, e)}
                        >
                          {REN_SVG}
                        </button>
                        <button
                          type="button"
                          className="ia"
                          data-a="del"
                          title="Delete"
                          aria-label="Delete"
                          onClick={(e) => handleDeleteChat(c, e)}
                        >
                          {BIN_SVG}
                        </button>
                      </div>
                    ))}
                  </React.Fragment>
                );
              })}

              {filteredChats.length === 0 && (
                <div className="nores">
                  {searchQuery ? "No matching chats" : "Your chats will appear here"}
                </div>
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="sfoot">
              <div className="theme">
                <div className="tl">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
                  </svg>
                  <span>Theme</span>
                </div>
                <div className="seg">
                  <button
                    type="button"
                    className={theme === "light" ? "on" : ""}
                    onClick={() => applyTheme("light")}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    className={theme === "dark" ? "on" : ""}
                    onClick={() => applyTheme("dark")}
                  >
                    Dark
                  </button>
                </div>
              </div>

              {user ? (
                <div className="me">
                  <div className="av">{(user.name || "U")[0].toUpperCase()}</div>
                  <div>
                    <span>{user.name}</span>
                    <small>{user.email}</small>
                  </div>
                  <button type="button" onClick={() => setShowSettingsModal(true)} title="Settings">
                    ⚙
                  </button>
                  <button type="button" onClick={handleLogout} title="Log out">
                    Log out
                  </button>
                </div>
              ) : (
                <div className="auth">
                  <button
                    type="button"
                    onClick={() => openAuthModal("in")}
                  >
                    Log in
                  </button>
                  <button
                    type="button"
                    className="fill"
                    onClick={() => openAuthModal("up")}
                  >
                    Sign up
                  </button>
                </div>
              )}
            </div>
          </div>
          {/* Resize Handle */}
          <div
            id="rs"
            onPointerDown={(e) => {
              const target = e.currentTarget;
              target.setPointerCapture(e.pointerId);
              const onMove = (ev: PointerEvent) => {
                const w = Math.min(420, Math.max(240, ev.clientX));
                document.documentElement.style.setProperty("--sw", `${w}px`);
              };
              const onUp = () => {
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
              };
              window.addEventListener("pointermove", onMove);
              window.addEventListener("pointerup", onUp);
            }}
          />
        </aside>

        {/* ═══ MAIN CHAT COLUMN ═══ */}
        <main id="main">
          {/* Header */}
          <header>
            <button
              type="button"
              className="ib"
              id="menu"
              aria-label="Toggle menu"
              onClick={() => {
                if (window.innerWidth <= 820) {
                  setMobileOpen((p) => !p);
                } else {
                  setCollapsed((p) => !p);
                }
              }}
            >
              <svg viewBox="0 0 24 24">
                <path d="M4 9h16M4 15h10" />
              </svg>
            </button>

            <div className="hbrand fly-target" id="hMark" ref={hMarkRef}>
              <div className="hm">
                <img className="logo" src="/assets/logo-sm.webp" alt="RockGPT" draggable="false" />
              </div>
              <span>ROCKGPT</span>
            </div>

            <div id="ctitle">{activeChat?.title || ""}</div>

            {activeChat && messages.length > 0 && (
              <button
                type="button"
                className="ib"
                id="exp"
                title="Export chat as Markdown"
                aria-label="Export chat"
                onClick={handleExportChat}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 002 2h10a2 2 0 002-2v-5" />
                </svg>
              </button>
            )}

            {guestTimeLeft !== null && !user && (
              <button
                type="button"
                className={`guest-pill ${guestTimeLeft <= 0 ? "expired" : guestTimeLeft <= 30 ? "urgent" : ""}`}
                title="3-minute free preview. Sign up to save your chats permanently."
                onClick={() => openAuthModal("up", undefined, guestTimeLeft <= 0)}
              >
                <span>{guestTimeLeft <= 0 ? "Session ended" : "Free session"}</span>
                {guestTimeLeft > 0 && (
                  <span className="gtimer">
                    {Math.floor(guestTimeLeft / 60)}:{String(guestTimeLeft % 60).padStart(2, "0")}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              className="newbtn"
              id="new2"
              title="New chat"
              onClick={(e) => {
                const btn = e.currentTarget;
                btn.classList.add("pop");
                setTimeout(() => btn.classList.remove("pop"), 550);
                startNewChat();
              }}
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>New chat</span>
            </button>
          </header>

          {/* Empty State: Centred Knot Logo + Heading + Dock */}
          {isFeedEmpty && (
            <>
              <div id="empty">
                <div className="em" id="eMark">
                  <img className="logo" src="/assets/logo-lg.webp" alt="RockGPT" draggable="false" />
                </div>
                <h2>
                  {user
                    ? `What should we work on, ${user.name?.split(" ")[0]}?`
                    : "What should we work on?"}
                </h2>
              </div>

              <div id="dock">
                <button
                  type="button"
                  className="chip"
                  onClick={() => handleSend("Plan my day")}
                >
                  <svg viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>Plan my day</span>
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => handleSend("Help me learn coding")}
                >
                  <svg viewBox="0 0 24 24">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                  <span>Help me learn coding</span>
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => handleSend("Give me a study tip")}
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                  <span>Give me a study tip</span>
                </button>
              </div>
            </>
          )}

          {/* Message Feed */}
          <div id="sc" ref={scRef} onScroll={handleScroll}>
            <div id="list">
              {messages.map((m, i) => {
                const isUser = m.role === "user";
                const isLastMsg = i === messages.length - 1;
                const isLastUser = isUser && !messages.slice(i + 1).some((x) => x.role === "user");

                if (isUser) {
                  return (
                    <div
                      key={i}
                      className={`msg user ${isLastUser && !isBusy ? "canedit" : ""}`}
                    >
                      {m.image && (
                        <div className="att">
                          <img src={m.image} alt="Upload preview" />
                        </div>
                      )}
                      {m.files && m.files.length > 0 && !m.image && (
                        <div className="att">
                          {m.files.map((f, fi) => (
                            <div key={fi} className="fc">
                              <span>{f.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {m.content && <div className="bub">{m.content}</div>}
                      {isLastUser && !isBusy && (
                        <button
                          type="button"
                          className="ued"
                          aria-label="Edit message"
                          title="Edit message"
                          onClick={handleEditLast}
                        >
                          {EDIT_SVG}
                        </button>
                      )}
                    </div>
                  );
                }

                // Assistant Message View
                return (
                  <div key={i} className="msg ai-msg">
                    <div
                      className={`ai-mark ${isBusy && isLastMsg ? "live" : ""}`}
                      ref={isLastMsg ? lastAiMarkRef : undefined}
                      aria-hidden="true"
                    >
                      <img className="logo" src="/assets/logo-sm.webp" alt="" draggable="false" />
                    </div>
                    <div className="ai-content">
                      <div className="body">
                        {m.content ? (
                          <div
                            dangerouslySetInnerHTML={{
                              __html: renderMarkdown(
                                m.content,
                                isBusy && isLastMsg
                              ),
                            }}
                          />
                        ) : isBusy && isLastMsg ? (
                          <ThinkingIndicator
                            hasImage={thinkingContext.hasImage}
                            isImageGen={thinkingContext.isImageGen}
                            fastMode={fastMode}
                          />
                        ) : null}
                      </div>

                      {/* Response Action Buttons Toolbar */}
                      {m.content && !(isBusy && isLastMsg) && (
                        <>
                          <ResponseActionsBar
                            messageId={m.id}
                            content={m.content}
                            feedback={m.feedback}
                            onFeedbackChange={(val) => {
                              setMessages((prev) => {
                                const next = [...prev];
                                next[i] = { ...next[i], feedback: val, fb: val === "up" ? "up" : val === "down" ? "dn" : null };
                                return next;
                              });
                            }}
                            isLast={isLastMsg}
                            isStreaming={isBusy && isLastMsg}
                            onRegenerate={handleRegenerate}
                            onToast={showToast}
                          />

                          {/* 4 Follow-up Chips on the Last Assistant Message */}
                          {isLastMsg && !isBusy && (
                            <div className="fups">
                              {FUP_OPTIONS.map((fupText) => (
                                <button
                                  key={fupText}
                                  type="button"
                                  className="fup"
                                  onClick={() => handleSend(fupText)}
                                >
                                  <svg viewBox="0 0 24 24">
                                    <path d="M5 5v6a3 3 0 003 3h11M15 9l4 5-4 5" />
                                  </svg>
                                  <span>{fupText}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Floating Scroll-to-Bottom Button */}
          <button
            type="button"
            id="tobot"
            className={showScrollDown ? "show" : ""}
            onClick={() => scrollToBottom(true)}
            aria-label="Scroll to bottom"
          >
            <svg viewBox="0 0 24 24">
              <path d="M12 5v14M6 13l6 6 6-6" />
            </svg>
          </button>

          {/* Composer Footer */}
          <footer>
            <div
              className={`composer ${isDragOver ? "over" : ""}`}
              id="comp"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files?.length) {
                  handleAddFiles(e.dataTransfer.files);
                }
              }}
            >
              {/* Attachments Tray */}
              {attachments.length > 0 && (
                <div id="tray">
                  {attachments.map((att, attIdx) => (
                    <div key={attIdx} className="pv">
                      {att.dataUrl ? (
                        <img src={att.dataUrl} alt={att.name} />
                      ) : (
                        <div className="fc">
                          <span>{att.name}</span>
                        </div>
                      )}
                      <i
                        onClick={() =>
                          setAttachments((prev) => prev.filter((_, idx) => idx !== attIdx))
                        }
                      >
                        ×
                      </i>
                    </div>
                  ))}
                </div>
              )}

              {/* Textarea */}
              <textarea
                id="in"
                ref={textareaRef}
                rows={1}
                placeholder="Reply to RockGPT"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    if (settings.enter) {
                      e.preventDefault();
                      handleSend();
                    } else if (e.ctrlKey || e.metaKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }
                }}
                onPaste={(e) => {
                  if (e.clipboardData.files?.length) {
                    e.preventDefault();
                    handleAddFiles(e.clipboardData.files);
                  }
                }}
              />

              {/* Bottom Controls Row */}
              <div className="crow">
                <div className="cl">
                  <button
                    type="button"
                    className="sbtn"
                    id="clip"
                    title="Attach file"
                    aria-label="Attach file"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    className={`pill ${fastMode ? "on" : ""}`}
                    id="fast"
                    onClick={() => {
                      const next = !fastMode;
                      setFastMode(next);
                      localStorage.setItem("rockgpt_fast", next ? "1" : "0");
                      if (user) {
                        fetch("/api/me/settings", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ fast: next }),
                        }).catch(() => {});
                      }
                      showToast(next ? "Fast mode enabled" : "Fast mode disabled");
                    }}
                  >
                    <svg viewBox="0 0 24 24">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <span>Fast</span>
                  </button>
                </div>

                <div className="cr">
                  {inputValue.length > 0 && (
                    <span className="cstats" aria-hidden="true">
                      {inputValue.trim().split(/\s+/).filter(Boolean).length}w · {inputValue.length}c
                    </span>
                  )}
                  {!inputValue.trim() && attachments.length === 0 && (
                    <button
                      type="button"
                      className="sbtn"
                      id="mic"
                      title="Voice dictation"
                      aria-label="Voice dictation"
                      onClick={handleVoiceInput}
                    >
                      <svg viewBox="0 0 24 24">
                        <rect x="9" y="3" width="6" height="11" rx="3" />
                        <path d="M5 11a7 7 0 0014 0M12 18v3" />
                      </svg>
                    </button>
                  )}

                  <button
                    type="button"
                    id="send"
                    className={`${(inputValue.trim() || attachments.length) && !isBusy ? "on" : ""} ${
                      isBusy ? "stop" : ""
                    }`}
                    aria-label={isBusy ? "Stop generating" : "Send message"}
                    onClick={isBusy ? stopGeneration : () => handleSend()}
                  >
                    {isBusy ? (
                      <svg className="sq" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="7" y="7" width="10" height="10" rx="2" />
                      </svg>
                    ) : (inputValue.trim() || attachments.length) ? (
                      <svg className="up" viewBox="0 0 24 24">
                        <path d="M12 19V5M6 11l6-6 6 6" />
                      </svg>
                    ) : (
                      <svg className="wav" viewBox="0 0 24 24">
                        <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10v4" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="note">
              <span>RockGPT can make mistakes. Verify important info.</span>
              <span className="note-links">
                <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy</a>
                {" · "}
                <a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a>
                {" · "}
                <a href="/security" target="_blank" rel="noopener noreferrer">Security</a>
              </span>
            </div>
          </footer>
          <nav className="sr-only" aria-label="RockGPT Site Directory">
            <h1>RockGPT – Next-Gen AI Assistant Engineered by Suman Mansuri</h1>
            <a href="/rock-gpt">What is RockGPT</a>
            <a href="/features">RockGPT Features</a>
            <a href="/how-it-works">How RockGPT Works</a>
            <a href="/faq">RockGPT FAQ</a>
            <a href="/about">About RockGPT</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
            <a href="/security">Security Policy</a>
          </nav>

          <input
            type="file"
            ref={fileInputRef}
            hidden
            multiple
            onChange={(e) => {
              if (e.target.files?.length) {
                handleAddFiles(e.target.files);
                e.target.value = "";
              }
            }}
          />
        </main>
      </div>

      {/* ═══ 3. AUTHENTICATION MODAL (SIGN IN / CREATE ACCOUNT / 6-BOX OTP) ═══ */}
      <div
        id="modal"
        className={showAuthModal ? "on" : ""}
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowAuthModal(false);
            setAuthEmail("");
            setAuthPassword("");
            setAuthPassword2("");
            setAuthName("");
            setAuthOtpCode("");
            setAuthError(null);
          }
        }}
      >
        <div className="card">
          <div className="mh">
            <span className="lg">
              <img className="logo" src="/assets/logo-sm.webp" alt="" draggable="false" />
            </span>
            <span>ROCKGPT AUTH</span>
            <button
              type="button"
              className="ib"
              id="mx"
              onClick={() => {
                setShowAuthModal(false);
                setAuthEmail("");
                setAuthPassword("");
                setAuthPassword2("");
                setAuthName("");
                setAuthOtpCode("");
                setAuthError(null);
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {(authMode === "in" || authMode === "up") && sessionEndedNotice && (
            <div className="session-banner" role="alert">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              <div>
                <strong>Your free session has ended</strong>
                <span>
                  Your 3-minute free preview has ended. Sign in or create a free account to continue chatting and save your history.
                </span>
              </div>
            </div>
          )}

          {(authMode === "in" || authMode === "up") && (
            <div className="tabs" data-m={authMode}>
              <button
                type="button"
                className={authMode === "in" ? "on" : ""}
                onClick={() => {
                  setAuthMode("in");
                  setAuthError(null);
                  setAuthEmail("");
                  setAuthPassword("");
                  setAuthPassword2("");
                  setAuthName("");
                  setAuthOtpCode("");
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                className={authMode === "up" ? "on" : ""}
                onClick={() => {
                  setAuthMode("up");
                  setAuthError(null);
                  setAuthEmail("");
                  setAuthPassword("");
                  setAuthPassword2("");
                  setAuthName("");
                  setAuthOtpCode("");
                }}
              >
                Sign up
              </button>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} autoComplete="off">
            {/* Decoy hidden inputs to prevent browser password managers from auto-filling */}
            <input type="text" name="decoy_user" style={{ display: "none" }} tabIndex={-1} aria-hidden="true" autoComplete="off" />
            <input type="password" name="decoy_pw" style={{ display: "none" }} tabIndex={-1} aria-hidden="true" autoComplete="new-password" />

            {authError && <div className="err">{authError}</div>}
            {authSuccessMsg && <div className="err ok">{authSuccessMsg}</div>}

            {/* SIGN IN VIEW */}
            {authMode === "in" && (
              <>
                <div className="hero">
                  <ShieldLogo />
                  <h3>Welcome Back</h3>
                  <p>Sign in with your email and password to access your chats.</p>
                </div>

                <label className="fld">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 7l9 6 9-6" />
                  </svg>
                  <input
                    type="email"
                    name="rockgpt_login_email"
                    id="rockgpt_login_email"
                    placeholder="Email Address"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck="false"
                    data-lpignore="true"
                    data-form-type="other"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                  />
                </label>

                <label className="fld">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="8" cy="15" r="4" />
                    <path d="M11 12l9-9M16 7l3 3" />
                  </svg>
                  <input
                    type={authShowPw ? "text" : "password"}
                    name="rockgpt_login_password"
                    id="rockgpt_login_password"
                    placeholder="Password"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-form-type="other"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="eye"
                    onClick={() => setAuthShowPw((p) => !p)}
                    aria-label="Toggle password visibility"
                  >
                    👁
                  </button>
                </label>

                <div className="chk">
                  <label>
                    <input
                      type="checkbox"
                      checked={authRememberSession}
                      onChange={(e) => setAuthRememberSession(e.target.checked)}
                    />
                    <span>Remember session</span>
                  </label>
                  <button
                    type="button"
                    className="lk"
                    onClick={() => {
                      setAuthMode("forgot");
                      setAuthError(null);
                      setAuthEmail("");
                    }}
                  >
                    Forgot password?
                  </button>
                </div>

                <button type="submit" className="pbtn" disabled={authLoading}>
                  {authLoading ? "Signing In…" : "Sign In →"}
                </button>

                <div className="or">OR CONTINUE WITH</div>
                <button
                  type="button"
                  className="pbtn g"
                  onClick={() => {
                    window.location.href = "/api/auth/google";
                  }}
                >
                  {GOOGLE_SVG}
                  <span>Continue with Google</span>
                </button>

                <div className="sw">
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    className="lk"
                    onClick={() => {
                      setAuthMode("up");
                      setAuthError(null);
                      setAuthEmail("");
                      setAuthPassword("");
                      setAuthPassword2("");
                      setAuthName("");
                    }}
                  >
                    Sign Up
                  </button>
                </div>
                <div className="sw">
                  <button
                    type="button"
                    className="lk quiet"
                    onClick={() => {
                      setShowAuthModal(false);
                      setAuthError(null);
                    }}
                  >
                    {guestTimeLeft !== null && guestTimeLeft <= 0 ? "Close window" : "Stay logged out (Continue as guest)"}
                  </button>
                </div>
              </>
            )}

            {/* SIGN UP VIEW */}
            {authMode === "up" && (
              <>
                <div className="hero">
                  <ShieldLogo />
                  <h3>Create Your Account</h3>
                  <p>Create an account to unlock cloud sync, personal memory & higher limits.</p>
                </div>

                <label className="fld">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-1a4 4 0 00-4-4H8a4 4 0 00-4 4v1" />
                    <circle cx="12" cy="8" r="4" />
                  </svg>
                  <input
                    type="text"
                    name="rockgpt_signup_name"
                    id="rockgpt_signup_name"
                    placeholder="Full Name"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                    data-lpignore="true"
                    data-form-type="other"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                  />
                </label>

                <label className="fld">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 7l9 6 9-6" />
                  </svg>
                  <input
                    type="email"
                    name="rockgpt_signup_email"
                    id="rockgpt_signup_email"
                    placeholder="Email Address"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck="false"
                    data-lpignore="true"
                    data-form-type="other"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                  />
                </label>

                <label className="fld">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="8" cy="15" r="4" />
                    <path d="M11 12l9-9M16 7l3 3" />
                  </svg>
                  <input
                    type={authShowPw ? "text" : "password"}
                    name="rockgpt_signup_password"
                    id="rockgpt_signup_password"
                    placeholder="Password (min 8 chars)"
                    minLength={8}
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-form-type="other"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="eye"
                    onClick={() => setAuthShowPw((p) => !p)}
                    aria-label="Toggle password visibility"
                  >
                    👁
                  </button>
                </label>

                <label className="fld">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="8" cy="15" r="4" />
                    <path d="M11 12l9-9M16 7l3 3" />
                  </svg>
                  <input
                    type={authShowPw ? "text" : "password"}
                    name="rockgpt_signup_password2"
                    id="rockgpt_signup_password2"
                    placeholder="Confirm Password"
                    minLength={8}
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-form-type="other"
                    required
                    value={authPassword2}
                    onChange={(e) => setAuthPassword2(e.target.value)}
                  />
                </label>

                <div className="chk">
                  <label>
                    <input
                      type="checkbox"
                      checked={authAgreeTos}
                      onChange={(e) => setAuthAgreeTos(e.target.checked)}
                    />
                    <span>
                      I agree to the{" "}
                      <a href="/terms" target="_blank" rel="noopener noreferrer" className="lk" onClick={(e) => e.stopPropagation()}>
                        Terms of Service
                      </a>{" "}
                      and{" "}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="lk" onClick={(e) => e.stopPropagation()}>
                        Privacy Policy
                      </a>
                      .
                    </span>
                  </label>
                </div>

                <button type="submit" className="pbtn" disabled={authLoading}>
                  {authLoading ? "Sending Code…" : "Send Verification Code →"}
                </button>

                <div className="or">OR CONTINUE WITH</div>
                <button
                  type="button"
                  className="pbtn g"
                  onClick={() => {
                    window.location.href = "/api/auth/google";
                  }}
                >
                  {GOOGLE_SVG}
                  <span>Continue with Google</span>
                </button>

                <div className="sw">
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="lk"
                    onClick={() => {
                      setAuthMode("in");
                      setAuthError(null);
                      setAuthEmail("");
                      setAuthPassword("");
                      setAuthPassword2("");
                      setAuthName("");
                    }}
                  >
                    Sign In
                  </button>
                </div>
                <div className="sw">
                  <button
                    type="button"
                    className="lk quiet"
                    onClick={() => {
                      setShowAuthModal(false);
                      setAuthError(null);
                    }}
                  >
                    {guestTimeLeft !== null && guestTimeLeft <= 0 ? "Close window" : "Stay logged out (Continue as guest)"}
                  </button>
                </div>
              </>
            )}

            {/* 6-BOX OTP VERIFICATION VIEW */}
            {authMode === "code" && (
              <>
                <div className="hero">
                  <ShieldLogo />
                  <h3>Check your email</h3>
                  <p>Enter the 6-digit verification code sent to {authEmail}.</p>
                </div>

                <OtpBoxes
                  value={authOtpCode}
                  onChange={setAuthOtpCode}
                  disabled={authLoading}
                />

                <button
                  type="submit"
                  className="pbtn"
                  disabled={authLoading || authOtpCode.length < 6}
                >
                  {authLoading ? "Verifying…" : "Verify & Create Account"}
                </button>

                <div className="sw">
                  {authResendSeconds > 0 ? (
                    <span>Resend code in {authResendSeconds}s</span>
                  ) : (
                    <button
                      type="button"
                      className="lk"
                      onClick={async () => {
                        setAuthLoading(true);
                        setAuthError(null);
                        try {
                          const res = await fetch("/api/auth/resend-otp", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ email: authEmail, type: "signup" }),
                          });
                          const data = await res.json().catch(() => ({}));
                          if (res.ok) {
                            setAuthResendSeconds(60);
                            showToast(data.message || "New 6-digit code sent!");
                          } else {
                            setAuthError(data.error?.message || "Failed to resend code");
                          }
                        } catch {
                          setAuthError("Failed to resend code");
                        } finally {
                          setAuthLoading(false);
                        }
                      }}
                    >
                      Resend code
                    </button>
                  )}
                </div>

                <div className="sw">
                  Wrong email?{" "}
                  <button
                    type="button"
                    className="lk"
                    onClick={() => {
                      setAuthMode("up");
                      setAuthOtpCode("");
                    }}
                  >
                    Go back
                  </button>
                </div>
              </>
            )}

            {/* FORGOT PASSWORD VIEW */}
            {authMode === "forgot" && (
              <>
                <div className="hero">
                  <ShieldLogo />
                  <h3>Reset Password</h3>
                  <p>Enter your email to receive a 6-digit recovery code.</p>
                </div>

                <label className="fld">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 7l9 6 9-6" />
                  </svg>
                  <input
                    type="email"
                    name="rockgpt_forgot_email"
                    id="rockgpt_forgot_email"
                    placeholder="Email Address"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck="false"
                    data-lpignore="true"
                    data-form-type="other"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                  />
                </label>

                <button type="submit" className="pbtn" disabled={authLoading}>
                  {authLoading ? "Sending Recovery Code…" : "Send Recovery Code →"}
                </button>

                <div className="sw">
                  <button
                    type="button"
                    className="lk"
                    onClick={() => setAuthMode("in")}
                  >
                    Back to Sign In
                  </button>
                </div>
              </>
            )}

            {/* RESET PASSWORD VIEW */}
            {authMode === "reset" && (
              <>
                <div className="hero">
                  <ShieldLogo />
                  <h3>Enter Recovery Code</h3>
                  <p>Enter the 6-digit code sent to {authEmail} and your new password.</p>
                </div>

                <OtpBoxes
                  value={authOtpCode}
                  onChange={setAuthOtpCode}
                  disabled={authLoading}
                />

                <label className="fld">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="8" cy="15" r="4" />
                    <path d="M11 12l9-9M16 7l3 3" />
                  </svg>
                  <input
                    type={authShowPw ? "text" : "password"}
                    name="rockgpt_reset_password"
                    id="rockgpt_reset_password"
                    placeholder="New Password (min 8 chars)"
                    minLength={8}
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-form-type="other"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                  />
                </label>

                <button
                  type="submit"
                  className="pbtn"
                  disabled={authLoading || authOtpCode.length < 6}
                >
                  {authLoading ? "Updating…" : "Update Password"}
                </button>

                <div className="sw">
                  {authResendSeconds > 0 ? (
                    <span>Resend recovery code in {authResendSeconds}s</span>
                  ) : (
                    <button
                      type="button"
                      className="lk"
                      onClick={async () => {
                        setAuthLoading(true);
                        setAuthError(null);
                        try {
                          const res = await fetch("/api/auth/resend-otp", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ email: authEmail, type: "reset" }),
                          });
                          const data = await res.json().catch(() => ({}));
                          if (res.ok) {
                            setAuthResendSeconds(60);
                            showToast(data.message || "New recovery code sent!");
                          } else {
                            setAuthError(data.error?.message || "Failed to resend recovery code");
                          }
                        } catch {
                          setAuthError("Failed to resend recovery code");
                        } finally {
                          setAuthLoading(false);
                        }
                      }}
                    >
                      Resend recovery code
                    </button>
                  )}
                </div>
              </>
            )}
          </form>
        </div>
      </div>

      {/* ═══ 4. SETTINGS MODAL ═══ */}
      <div
        id="smodal"
        className={showSettingsModal ? "on" : ""}
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowSettingsModal(false);
        }}
      >
        <div className="card">
          <div className="mh">
            <span className="lg">
              <img className="logo" src="/assets/logo-sm.webp" alt="" draggable="false" />
            </span>
            <span>SETTINGS</span>
            <button
              type="button"
              className="ib"
              id="sx"
              onClick={() => setShowSettingsModal(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="sg" style={{ marginTop: 4 }}>Preferences</div>

          <label className="tgr">
            <span>
              Enter to send
              <small>Off: Ctrl+Enter sends. Shift+Enter is always a new line.</small>
            </span>
            <input
              type="checkbox"
              className="tg"
              checked={settings.enter}
              onChange={(e) => updateSettings({ enter: e.target.checked })}
            />
          </label>

          <label className="tgr">
            <span>Auto-scroll while replying</span>
            <input
              type="checkbox"
              className="tg"
              checked={settings.scroll}
              onChange={(e) => updateSettings({ scroll: e.target.checked })}
            />
          </label>

          <label className="tgr">
            <span>Show intro animation</span>
            <input
              type="checkbox"
              className="tg"
              checked={settings.intro}
              onChange={(e) => updateSettings({ intro: e.target.checked })}
            />
          </label>

          <div className="tgr" style={{ cursor: "default" }}>
            <span>Text size</span>
            <div className="seg">
              {(["s", "m", "l"] as const).map((z) => (
                <button
                  key={z}
                  type="button"
                  className={settings.size === z ? "on" : ""}
                  onClick={() => {
                    updateSettings({ size: z });
                    if (user) {
                      fetch("/api/me/settings", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ textSize: z }),
                      }).catch(() => {});
                    }
                  }}
                >
                  {z === "s" ? "Small" : z === "m" ? "Normal" : "Large"}
                </button>
              ))}
            </div>
          </div>

          <div className="sg">Custom instructions</div>
          <textarea
            id="instr"
            maxLength={600}
            placeholder="Tell ROCKGPT how to answer. e.g. Use simple English and keep replies short."
            value={settings.instr}
            onChange={(e) => {
              const val = e.target.value;
              updateSettings({ instr: val });
              if (user) {
                fetch("/api/me/settings", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ instructions: val }),
                }).catch(() => {});
              }
            }}
          />

          <div className="sg">Data & Plan</div>
          <div className="btnrow">
            <button
              type="button"
              className="sbt"
              onClick={() => {
                setShowSettingsModal(false);
                setShowPricingModal(true);
              }}
            >
              Upgrade plan
            </button>
            <button
              type="button"
              className="sbt"
              onClick={() => {
                if (!chats.length) return showToast("No chats to export");
                const json = JSON.stringify(chats, null, 2);
                const blob = new Blob([json], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "rockgpt-chats.json";
                a.click();
                URL.revokeObjectURL(url);
                showToast("Chats exported");
              }}
            >
              Export all chats
            </button>
            <button
              type="button"
              className="sbt"
              onClick={() => {
                sessionStorage.setItem("rg_force", "1");
                window.location.reload();
              }}
            >
              Replay intro
            </button>
            <button
              type="button"
              className="sbt dg"
              onClick={async () => {
                if (isBusy) return showToast("Wait for the reply to finish");
                if (window.confirm("Delete all chats? This cannot be undone.")) {
                  const ids = chats.map((c) => c.id);
                  setChats([]);
                  startNewChat();
                  setShowSettingsModal(false);
                  if (user && ids.length > 0) {
                    await Promise.all(
                      ids.map((id) => fetch(`/api/chats/${id}`, { method: "DELETE" }).catch(() => {}))
                    );
                  }
                  showToast("All chats deleted");
                }
              }}
            >
              Clear all chats
            </button>
          </div>

          <div className="sg">Shortcuts</div>
          <div className="keys">
            {[
              ["New chat", "Ctrl Shift O"],
              ["Search chats", "Ctrl K"],
              ["Toggle sidebar", "Ctrl B"],
              ["Settings", "Ctrl ,"],
              ["Focus message box", "/"],
              ["Stop generating", "Esc"],
              ["New line", "Shift Enter"],
            ].map(([label, shortcut], idx) => (
              <div key={idx}>
                <span>{label}</span>
                <span>
                  {shortcut.split(" ").map((k, ki) => (
                    <kbd key={ki}>{k}</kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>

          <div className="sg">Legal &amp; Security Policies</div>
          <div className="btnrow">
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="sbt" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              Privacy Policy
            </a>
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="sbt" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              Terms of Service
            </a>
            <a href="/security" target="_blank" rel="noopener noreferrer" className="sbt" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              Security Policy
            </a>
          </div>

          <div className="ver">ROCKGPT · Suman Mansuri</div>
        </div>
      </div>

      {/* ═══ 4B. PLANS & UPI PRICING MODAL ═══ */}
      <div
        id="pmodal"
        className={showPricingModal ? "on" : ""}
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowPricingModal(false);
        }}
      >
        <div className="card">
          <div className="mh">
            <span className="lg">
              <img className="logo" src="/assets/logo-sm.webp" alt="" draggable="false" />
            </span>
            <span>ROCKGPT PLANS</span>
            <button
              type="button"
              className="ib"
              onClick={() => setShowPricingModal(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="plan-grid">
            <div className="plan-card">
              <div className="plan-top">
                <span>Free</span>
                <span className="plan-price">₹0 / mo</span>
              </div>
              <div className="plan-desc">Standard chat streaming, 50 messages/day, file analysis & vision.</div>
            </div>
            <div className="plan-card">
              <div className="plan-top">
                <span>Plus</span>
                <span className="plan-price">₹149 / mo</span>
              </div>
              <div className="plan-desc">Priority neural routing, expanded file uploads, and cloud sync.</div>
            </div>
            <div className="plan-card hi">
              <div className="plan-top">
                <span>Pro</span>
                <span className="plan-price">₹399 / mo</span>
              </div>
              <div className="plan-desc">Unlimited high-speed inference, full context retention & priority access.</div>
            </div>
          </div>

          <div className="upi-box">
            <img src="/upi-qr.png" alt="UPI QR Code" />
            <div className="upi-id">sumanmansuri@oksbi</div>
            <div className="plan-desc">
              Scan UPI QR or pay to ID above, then email your screenshot for manual activation.
            </div>
            <button
              type="button"
              className="sbt"
              onClick={() => {
                navigator.clipboard?.writeText("sumanmansuri@oksbi");
                showToast("UPI ID copied");
              }}
            >
              Copy UPI ID
            </button>
          </div>
        </div>
      </div>

      {/* ═══ 4C. IMAGE LIGHTBOX PREVIEW ═══ */}
      {lightboxImg && (
        <div
          id="lightbox"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightboxImg(null);
          }}
        >
          <div className="lb-inner">
            <img src={lightboxImg.url} alt={lightboxImg.alt} />
            <div className="lb-actions">
              <button
                type="button"
                className="sbt"
                style={{ background: "var(--panel)", color: "var(--text)" }}
                onClick={() => downloadImageUrl(lightboxImg.url, lightboxImg.alt)}
              >
                Download image
              </button>
              <button
                type="button"
                className="sbt"
                style={{ background: "var(--panel)", color: "var(--text)" }}
                onClick={() => setLightboxImg(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 5. DRAG AND DROP FULLSCREEN OVERLAY ═══ */}
      <div id="drop" className={isDragOver ? "on" : ""}>
        <div>Drop files to add to message</div>
      </div>

      {/* ═══ 6. TOAST NOTIFICATIONS ═══ */}
      <div id="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <span>{t.msg}</span>
            {t.act && (
              <button
                type="button"
                onClick={() => {
                  t.act?.fn();
                  setToasts((prev) => prev.filter((x) => x.id !== t.id));
                }}
              >
                {t.act.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
