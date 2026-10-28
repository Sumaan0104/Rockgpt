"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { renderMarkdown } from "@/lib/markdown";

type UserData = {
  id?: string;
  name?: string;
  email?: string;
  theme?: "dark" | "light";
  avatar_url?: string;
};

type ChatItem = {
  id: string;
  title: string;
  project_id: string | null;
  mode: "chat" | "deep";
  created_at: string;
  updated_at: string;
};

type MessageItem = {
  id?: string;
  role: "user" | "assistant" | "bot";
  content: string;
  research_card?: {
    step: number;
    subQuestions: string[];
    status: "running" | "done" | "failed";
  };
};

type ProjectItem = {
  id: string;
  name: string;
  chat_count: number;
  created_at?: string;
};

export function RockGPTApp() {
  // Splash State
  const [showSplash, setShowSplash] = useState(true);
  const [introOut, setIntroOut] = useState(false);

  // User & Theme State
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Sidebar & Sheets State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeSheet, setActiveSheet] = useState<"proj" | "canvas" | null>(null);

  // Chats & Active Session
  const [chatsList, setChatsList] = useState<ChatItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isHidingTyping, setIsHidingTyping] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Mode Chips
  const [deepMode, setDeepMode] = useState(false);
  const [activeProject, setActiveProject] = useState<ProjectItem | null>(null);
  const [projectsList, setProjectsList] = useState<ProjectItem[]>([]);

  // Composer State
  const [inputVal, setInputVal] = useState("");
  const [showScrollDown, setShowScrollDown] = useState(false);

  // Projects Sheet State
  const [showNewProjForm, setShowNewProjForm] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [expandedProjId, setExpandedProjId] = useState<string | null>(null);

  // Canvas State
  const [canvasTitle, setCanvasTitle] = useState("");
  const [canvasText, setCanvasText] = useState("");
  const [canvasSavedNotice, setCanvasSavedNotice] = useState(false);
  const canvasSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "signup" | "otp" | "forgot" | "reset">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState("");
  const [authOtpCode, setAuthOtpCode] = useState("");
  const [authShowPassword, setAuthShowPassword] = useState(false);
  const [authResendSeconds, setAuthResendSeconds] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Toast State
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [heroBye, setHeroBye] = useState(false);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // DOM Refs
  const feedRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const sheetWaveRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const appRef = useRef<HTMLElement | null>(null);
  const scrimRef = useRef<HTMLDivElement | null>(null);
  const touchStateRef = useRef<{
    startX: number;
    startY: number;
    lastX: number;
    lastTime: number;
    vx: number;
    isOpen: boolean;
    drawerW: number;
    active: boolean;
  } | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 2000);
  }, []);

  // Theme Synchronizer
  const applyThemeMode = useCallback((mode: "dark" | "light", save = true) => {
    setTheme(mode);
    if (typeof document !== "undefined") {
      document.body.classList.toggle("light", mode === "light");
    }
    if (save) {
      localStorage.setItem("rockgpt_theme", mode);
      fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: mode }),
      }).catch(() => {});
    }
  }, []);

  // 1. Initial Load: Splash Animation (synchronous with media_1793129248177.html)
  const dismissSplash = useCallback(() => {
    setIntroOut(true);
    if (typeof document !== "undefined") {
      document.body.classList.add("ready");
    }
    setTimeout(() => {
      setShowSplash(false);
    }, 680);
  }, []);

  useEffect(() => {
    const timer = setTimeout(dismissSplash, 3400);
    return () => clearTimeout(timer);
  }, [dismissSplash]);

  // Check saved theme
  useEffect(() => {
    const saved = localStorage.getItem("rockgpt_theme") as "dark" | "light" | null;
    if (saved) applyThemeMode(saved, false);
  }, [applyThemeMode]);

  // Viewport Height Sync
  useEffect(() => {
    const updateVh = () => {
      const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty("--vh", `${h}px`);
    };
    updateVh();
    window.addEventListener("resize", updateVh);
    window.visualViewport?.addEventListener("resize", updateVh);
    return () => {
      window.removeEventListener("resize", updateVh);
      window.visualViewport?.removeEventListener("resize", updateVh);
    };
  }, []);

  // Fetch Session User
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/me");
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setCurrentUser(data.user);
          if (data.user.theme) applyThemeMode(data.user.theme, false);
        }
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    }
  }, [applyThemeMode]);

  // Fetch Chats
  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch("/api/chats");
      if (res.ok) {
        const data = await res.json();
        setChatsList(data.chats || []);
      }
    } catch {
      // offline / guest
    }
  }, []);

  // Fetch Projects
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjectsList(data.projects || []);
      }
    } catch {
      // offline / guest
    }
  }, []);

  // Fetch Canvas
  const fetchCanvas = useCallback(async () => {
    try {
      const res = await fetch("/api/canvas");
      if (res.ok) {
        const data = await res.json();
        if (data.canvas) {
          setCanvasTitle(data.canvas.title || "");
          setCanvasText(data.canvas.content || "");
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchSession();
    fetchChats();
    fetchProjects();
    fetchCanvas();

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("auth") === "google_success") {
        showToast("Signed in with Google successfully!");
        fetchSession();
        window.history.replaceState({}, "", "/");
      } else if (url.searchParams.get("error")) {
        const errorParam = url.searchParams.get("error");
        if (errorParam === "google_cancelled") {
          showToast("Google sign-in was cancelled.");
        } else if (errorParam === "google_not_configured") {
          showToast("Google OAuth is not configured in Google Cloud Console.");
        } else if (errorParam === "invalid_oauth_state") {
          showToast("Authentication security check failed (CSRF mismatch).");
        } else if (errorParam === "unverified_google_email") {
          showToast("Your Google account email is not verified.");
        } else {
          showToast("Google authentication failed. Please try again.");
        }
        setShowAuthModal(true);
        window.history.replaceState({}, "", "/");
      }
    }
  }, [fetchSession, fetchChats, fetchProjects, fetchCanvas, showToast]);

  // OTP resend countdown effect
  useEffect(() => {
    if (authResendSeconds <= 0) return;
    const timer = setInterval(() => {
      setAuthResendSeconds(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [authResendSeconds]);

  // Autosave Canvas with 450ms Debounce
  const handleCanvasChange = (newTitle: string, newText: string) => {
    setCanvasTitle(newTitle);
    setCanvasText(newText);
    if (canvasSaveTimerRef.current) clearTimeout(canvasSaveTimerRef.current);
    canvasSaveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/canvas", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle, content: newText }),
        });
        if (res.ok) {
          setCanvasSavedNotice(true);
          setTimeout(() => setCanvasSavedNotice(false), 1200);
        }
      } catch {}
    }, 450);
  };

  // Touch Drag for Sidebar Drawer
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || showAuthModal) return;
      const t = e.touches[0];
      const drawerW = drawerRef.current?.offsetWidth || 320;
      if (!drawerOpen && t.clientX > 32) return;
      touchStateRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        lastX: t.clientX,
        lastTime: performance.now(),
        vx: 0,
        isOpen: drawerOpen,
        drawerW,
        active: false,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!touchStateRef.current) return;
      const t = e.touches[0];
      const dx = t.clientX - touchStateRef.current.startX;
      const dy = t.clientY - touchStateRef.current.startY;

      if (!touchStateRef.current.active) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
          touchStateRef.current = null;
          return;
        }
        if (Math.abs(dx) > 8) {
          touchStateRef.current.active = true;
          setIsDragging(true);
        } else {
          return;
        }
      }

      const now = performance.now();
      const dt = Math.max(1, now - touchStateRef.current.lastTime);
      touchStateRef.current.vx = (t.clientX - touchStateRef.current.lastX) / dt;
      touchStateRef.current.lastX = t.clientX;
      touchStateRef.current.lastTime = now;

      const base = touchStateRef.current.isOpen ? 0 : -touchStateRef.current.drawerW;
      const offset = Math.min(0, Math.max(-touchStateRef.current.drawerW, base + dx));
      const progress = 1 + offset / touchStateRef.current.drawerW;

      if (drawerRef.current) {
        drawerRef.current.style.transform = `translate3d(${offset}px, 0, 0)`;
      }
      if (appRef.current) {
        appRef.current.style.transform = `translate3d(${progress * touchStateRef.current.drawerW * 0.28}px, 0, 0)`;
      }
      if (scrimRef.current) {
        scrimRef.current.style.opacity = String(progress);
      }
    };

    const onTouchEnd = () => {
      if (!touchStateRef.current) return;
      if (!touchStateRef.current.active) {
        touchStateRef.current = null;
        return;
      }
      const dx = touchStateRef.current.lastX - touchStateRef.current.startX;
      const base = touchStateRef.current.isOpen ? 0 : -touchStateRef.current.drawerW;
      const finalOffset = Math.min(0, Math.max(-touchStateRef.current.drawerW, base + dx));
      const progress = 1 + finalOffset / touchStateRef.current.drawerW;

      let shouldOpen = progress > 0.45;
      if (Math.abs(touchStateRef.current.vx) > 0.35) {
        shouldOpen = touchStateRef.current.vx > 0;
      }
      touchStateRef.current = null;
      setIsDragging(false);
      setDrawerOpen(shouldOpen);
      if (drawerRef.current) drawerRef.current.style.transform = "";
      if (appRef.current) appRef.current.style.transform = "";
      if (scrimRef.current) scrimRef.current.style.opacity = "";
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [drawerOpen, showAuthModal]);

  // Synchronize drawer body class & empty state
  useEffect(() => {
    document.body.classList.toggle("open", drawerOpen);
    document.body.classList.toggle("dragging", isDragging);
    document.body.classList.toggle("empty", messages.length === 0);
  }, [drawerOpen, isDragging, messages.length]);

  // Keyboard Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showAuthModal) setShowAuthModal(false);
        else if (activeSheet) setActiveSheet(null);
        else if (drawerOpen) setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showAuthModal, activeSheet, drawerOpen]);

  // Auto-scroll feed
  const scrollToBottom = useCallback((smooth = true) => {
    if (feedRef.current) {
      feedRef.current.scrollTo({
        top: feedRef.current.scrollHeight + 1000,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

  // Monitor scroll for scrollDownBtn
  const handleFeedScroll = () => {
    if (!feedRef.current) return;
    const dist = feedRef.current.scrollHeight - feedRef.current.scrollTop - feedRef.current.clientHeight;
    setShowScrollDown(dist > 110);
  };

  // Fresh Chat (New Chat Trigger)
  const startFreshChat = useCallback(() => {
    if (isStreaming) return;
    if (sheetWaveRef.current) {
      sheetWaveRef.current.classList.remove("run");
      void sheetWaveRef.current.offsetWidth;
      sheetWaveRef.current.classList.add("run");
    }
    setActiveChatId(null);
    setMessages([]);
    setDrawerOpen(false);
  }, [isStreaming]);

  // Load existing chat
  const loadChat = async (id: string) => {
    if (isStreaming) return;
    try {
      const res = await fetch(`/api/chats/${id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveChatId(id);
        setMessages(
          (data.messages || []).map((m: { role: "user" | "assistant"; content: string }) => ({
            role: m.role,
            content: m.content,
          }))
        );
        if (data.chat?.project_id) {
          const matchedProj = projectsList.find(p => p.id === data.chat.project_id);
          if (matchedProj) setActiveProject(matchedProj);
        }
        setDrawerOpen(false);
      }
    } catch {
      showToast("Failed to load chat");
    }
  };

  // Delete chat
  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/chats/${id}`, { method: "DELETE" });
      if (res.ok) {
        setChatsList(prev => prev.filter(c => c.id !== id));
        if (activeChatId === id) {
          startFreshChat();
        }
        showToast("Chat deleted");
      } else {
        showToast("Failed to delete chat");
      }
    } catch {
      showToast("Error deleting chat");
    }
  };

  // Stop Generation
  const stopGeneration = async () => {
    if (!activeChatId) return;
    try {
      await fetch(`/api/chats/${activeChatId}/stop`, { method: "POST" });
    } catch {}
    setIsStreaming(false);
    setIsThinking(false);
    setIsHidingTyping(false);
  };

  // Send Message Flow
  const handleSend = async (overrideText?: string) => {
    const textToSend = (overrideText ?? inputVal).trim();
    if (!textToSend || isStreaming) return;

    setInputVal("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setStreamError(null);

    // If transitioning from the empty hero view, execute smooth exit fade
    if (messages.length === 0) {
      setHeroBye(true);
      await new Promise(r => setTimeout(r, 220));
      setHeroBye(false);
    }

    // Optimistic user message
    const newMsgList: MessageItem[] = [...messages, { role: "user", content: textToSend }];
    setMessages(newMsgList);
    setIsStreaming(true);
    setIsThinking(true);
    setIsHidingTyping(false);
    setTimeout(() => scrollToBottom(false), 30);

    let chatId = activeChatId;

    // Deep Research Mode Flow
    if (deepMode) {
      try {
        const researchRes = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: textToSend, chat_id: chatId ?? undefined }),
        });

        if (!researchRes.ok) {
          if (researchRes.status === 401) {
            setShowAuthModal(true);
            setIsStreaming(false);
            setIsThinking(false);
            return;
          }
          if (researchRes.status === 429) {
            showToast("Daily research limit reached");
            setIsStreaming(false);
            setIsThinking(false);
            return;
          }
          throw new Error("Research failed to start");
        }

        const reader = researchRes.body?.getReader();
        if (!reader) throw new Error("No stream reader");

        const decoder = new TextDecoder();
        let buffer = "";
        let currentStep = 1;
        let subQuestions: string[] = [];
        let reportText = "";

        setIsThinking(false);
        // Add research card to messages
        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            content: "",
            research_card: { step: 1, subQuestions: [], status: "running" },
          },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            const eventMatch = line.match(/^event: (.*)/m);
            const dataMatch = line.match(/^data: (.*)/m);
            if (!eventMatch || !dataMatch) continue;

            const event = eventMatch[1].trim();
            const data = JSON.parse(dataMatch[1].trim());

            if (event === "start" && data.chat_id) {
              chatId = data.chat_id;
              setActiveChatId(chatId);
              fetchChats();
            } else if (event === "plan") {
              currentStep = 1;
              subQuestions = data.subQuestions || [];
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.research_card) {
                  last.research_card = { step: 1, subQuestions, status: "running" };
                }
                return next;
              });
            } else if (event === "search" || event === "read" || event === "verify") {
              currentStep = event === "search" ? 2 : event === "read" ? 3 : 4;
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.research_card) {
                  last.research_card = { step: currentStep, subQuestions, status: "running" };
                }
                return next;
              });
            } else if (event === "write") {
              currentStep = 5;
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.research_card) {
                  last.research_card = { step: 5, subQuestions, status: "done" };
                }
                return next;
              });
            } else if (event === "delta") {
              reportText += data.chunk || "";
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last) last.content = reportText;
                return next;
              });
              requestAnimationFrame(() => scrollToBottom(false));
            } else if (event === "done") {
              fetchChats();
            }
          }
        }
      } catch (err) {
        console.error("Deep research stream error:", err);
        setStreamError("Deep research failed. Click to retry.");
      } finally {
        setIsStreaming(false);
        setIsThinking(false);
        setIsHidingTyping(false);
      }
      return;
    }

    // Standard Chat Stream Flow
    try {
      // 1. If no active chat, instantly assign client UUID and auto-create on server
      if (!chatId) {
        chatId = crypto.randomUUID();
        setActiveChatId(chatId);
        // Sync chat list in the background without blocking the stream
        setTimeout(() => fetchChats().catch(() => {}), 100);
      }

      const streamUrl = `/api/chats/${chatId}/messages`;

      const res = await fetch(streamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: textToSend }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setShowAuthModal(true);
          setIsStreaming(false);
          setIsThinking(false);
          return;
        }
        if (res.status === 429) {
          showToast("Slow down a moment");
          setIsStreaming(false);
          setIsThinking(false);
          return;
        }
        throw new Error(`Server returned ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No readable stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      let currentEvent = "";
      let firstChunkReceived = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) {
            currentEvent = "";
            continue;
          }
          if (line.startsWith("event:")) {
            currentEvent = line.replace(/^event:\s*/, "");
          } else if (line.startsWith("data:")) {
            const jsonStr = line.replace(/^data:\s*/, "");
            try {
              const data = JSON.parse(jsonStr);
              const chunk = data.chunk ?? data.text ?? "";
              if (chunk) {
                if (!firstChunkReceived) {
                  firstChunkReceived = true;
                  // Gracefully fade out 3D spheres before revealing reply
                  setIsHidingTyping(true);
                  await new Promise(r => setTimeout(r, 160));
                  setIsThinking(false);
                  setIsHidingTyping(false);
                  accumulated += chunk;
                  setMessages(prev => [...prev, { role: "assistant", content: accumulated }]);
                } else {
                  accumulated += chunk;
                  setMessages(prev => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
                      updated[lastIdx] = { ...updated[lastIdx], content: accumulated };
                    }
                    return updated;
                  });
                }
                requestAnimationFrame(() => {
                  if (feedRef.current) {
                    const dist = feedRef.current.scrollHeight - feedRef.current.scrollTop - feedRef.current.clientHeight;
                    if (dist < 160) {
                      feedRef.current.scrollTop = feedRef.current.scrollHeight;
                    }
                  }
                });
              }
            } catch {}
          }
        }
      }

      fetchChats();

    } catch (err) {
      console.error("Chat streaming error:", err);
      setStreamError("Something went wrong. Click to retry.");
    } finally {
      setIsStreaming(false);
      setIsThinking(false);
      setIsHidingTyping(false);
    }
  };

  // Resend OTP Code
  const handleResendOtp = async () => {
    if (authResendSeconds > 0 || authLoading) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, type: authTab === "reset" ? "reset" : "signup" }),
      });
      const data = await res.json();
      if (res.ok) {
        setAuthResendSeconds(60);
        showToast("New 6-digit code sent!");
      } else {
        setAuthError(data.error?.message || "Failed to resend code");
      }
    } catch {
      setAuthError("Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Auth Submit (Signup with OTP / Login / Verify OTP / Forgot / Reset)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (authTab === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: authName, email: authEmail, password: authPassword }),
        });
        const data = await res.json();
        if (res.ok) {
          setAuthTab("otp");
          setAuthResendSeconds(60);
          showToast("Verification code sent to your email!");
        } else {
          setAuthError(data.error?.message || "Failed to create account");
        }
      } else if (authTab === "otp") {
        const res = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: authEmail, code: authOtpCode, type: "signup" }),
        });
        const data = await res.json();
        if (res.ok && data.user) {
          setCurrentUser(data.user);
          setShowAuthModal(false);
          setAuthPassword("");
          setAuthOtpCode("");
          fetchChats();
          fetchProjects();
          showToast(`Welcome, ${data.user.name.split(" ")[0]}!`);
        } else {
          setAuthError(data.error?.message || "Invalid verification code");
        }
      } else if (authTab === "forgot") {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: authEmail }),
        });
        const data = await res.json();
        if (res.ok) {
          setAuthTab("reset");
          setAuthResendSeconds(60);
          showToast("Password recovery code sent!");
        } else {
          setAuthError(data.error?.message || "Failed to process request");
        }
      } else if (authTab === "reset") {
        if (authPassword !== authPasswordConfirm) {
          setAuthError("Passwords do not match");
          setAuthLoading(false);
          return;
        }
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: authEmail, code: authOtpCode, newPassword: authPassword }),
        });
        const data = await res.json();
        if (res.ok && data.user) {
          setCurrentUser(data.user);
          setShowAuthModal(false);
          setAuthPassword("");
          setAuthPasswordConfirm("");
          setAuthOtpCode("");
          fetchChats();
          fetchProjects();
          showToast("Password reset successfully! You are signed in.");
        } else {
          setAuthError(data.error?.message || "Failed to reset password");
        }
      } else {
        // Login
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: authEmail, password: authPassword }),
        });
        const data = await res.json();
        if (res.ok && data.user) {
          setCurrentUser(data.user);
          setShowAuthModal(false);
          setAuthPassword("");
          fetchChats();
          fetchProjects();
          showToast(`Welcome back, ${data.user.name.split(" ")[0]}!`);
        } else {
          setAuthError(data.error?.message || "Invalid email or password");
        }
      }
    } catch {
      setAuthError("Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleContinueWithGoogle = () => {
    setAuthLoading(true);
    setAuthError(null);
    window.location.href = "/api/auth/google";
  };

  // Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setCurrentUser(null);
      setChatsList([]);
      startFreshChat();
      showToast("Logged out");
    } catch {
      showToast("Failed to log out");
    }
  };

  // Speech Recognition (Voice Dictation)
  const handleVoiceInput = () => {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showToast("Voice input not supported in this browser");
      return;
    }

    try {
      const recognizer = new SpeechRecognition();
      recognizer.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setInputVal(prev => (prev ? `${prev} ` : "") + transcript);
      };
      recognizer.start();
      showToast("Listening…");
    } catch {
      showToast("Microphone permission needed");
    }
  };

  // Copy Code block button delegate
  const handleFeedClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains("code-copy-btn")) {
      const code = decodeURIComponent(target.dataset.copy || "");
      if (code) {
        navigator.clipboard.writeText(code).then(() => {
          const oldText = target.textContent;
          target.textContent = "Copied!";
          setTimeout(() => (target.textContent = oldText), 1500);
        });
      }
    }
  };

  const isFeedEmpty = messages.length === 0;

  return (
    <>
      {/* SVG Sprite containing the full Origami ROCK Wordmark and Icons */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <path id="ringO" fillRule="evenodd" d="M134 10h20a30 30 0 0 1 30 30v20a30 30 0 0 1-30 30h-20a30 30 0 0 1-30-30V40a30 30 0 0 1 30-30zM140 28a12 12 0 0 0-12 12v20a12 12 0 0 0 12 12h8a12 12 0 0 0 12-12V40a12 12 0 0 0-12-12z"/>
          <path id="ringC" fillRule="evenodd" d="M232 10h20a30 30 0 0 1 30 30v20a30 30 0 0 1-30 30h-20a30 30 0 0 1-30-30V40a30 30 0 0 1 30-30zM238 28a12 12 0 0 0-12 12v20a12 12 0 0 0 12 12h8a12 12 0 0 0 12-12V40a12 12 0 0 0-12-12z"/>
          <clipPath id="oL"><rect x="0" y="0" width="144.5" height="100"/></clipPath>
          <clipPath id="oT"><rect x="143.5" y="0" width="60" height="50.5"/></clipPath>
          <clipPath id="oB"><rect x="143.5" y="49.5" width="60" height="60"/></clipPath>
          <clipPath id="cL"><rect x="0" y="0" width="242.5" height="100"/></clipPath>
          <clipPath id="cT"><polygon points="241.5,0 300,0 300,22 262,50 241.5,50"/></clipPath>
          <clipPath id="cB"><polygon points="241.5,100 300,100 300,78 262,50 241.5,50"/></clipPath>
          <clipPath id="oIn"><use href="#ringO" clipRule="evenodd"/></clipPath>
          <clipPath id="cIn"><use href="#ringC" clipRule="evenodd"/></clipPath>

          <g id="a" fill="#fff">
            <path d="M12 10h20v80H12z"/>
            <use href="#ringO" clipPath="url(#oL)"/>
            <use href="#ringC" clipPath="url(#cL)"/>
            <path d="M298 10h20v80h-20z"/>
          </g>
          <g id="b" fill="#fff">
            <path d="M32 10h22c20 0 28 12 28 26s-8 24-28 24H32V44h20c8 0 12-3 12-8s-4-10-12-10H32z"/>
            <use href="#ringO" clipPath="url(#oT)"/>
            <use href="#ringC" clipPath="url(#cT)"/>
            <path d="M318 50L346 10h23l-28 40z"/>
          </g>
          <g id="c" fill="#fff">
            <path d="M44 60h22l20 30H62z"/>
            <use href="#ringO" clipPath="url(#oB)"/>
            <use href="#ringC" clipPath="url(#cB)"/>
            <path d="M318 50L346 90h23l-28-40z"/>
          </g>
          <g id="d" fill="#a8a8a8">
            <path d="M32 44h20L32 60z"/>
            <g clipPath="url(#oIn)"><path d="M104 10h32L104 42z"/></g>
            <g clipPath="url(#cIn)"><path d="M202 10h32L202 42z"/></g>
            <path d="M318 50h23L329.5 34z"/>
          </g>
          <g id="e" fill="#a8a8a8">
            <path d="M44 60h22L54 76z"/>
            <g clipPath="url(#oIn)"><path d="M184 90h-32l32-32z"/></g>
            <g clipPath="url(#cIn)"><path d="M202 90h32l-32-32z"/></g>
            <path d="M318 50h23l-11.500 16z"/>
          </g>

          <g id="R">
            <use href="#a"/>
            <use href="#b"/>
            <use href="#c"/>
            <use href="#d"/>
            <use href="#e"/>
          </g>

          <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 9h16M4 15h10"/></symbol>
          <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
          <symbol id="i-mic" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></symbol>
          <symbol id="i-wave" viewBox="0 0 24 24"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10v4"/></symbol>
          <symbol id="i-up" viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></symbol>
          <symbol id="i-down" viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></symbol>
          <symbol id="i-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>
          <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></symbol>
          <symbol id="i-moon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></symbol>
          <symbol id="i-back" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></symbol>
          <symbol id="i-chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></symbol>
        </defs>
      </svg>

      {/* 1. INTRO SPLASH */}
      {showSplash && (
        <div id="intro" className={introOut ? "out" : ""} onClick={dismissSplash}>
          <div className="stage">
            <div className="mark">
              <svg className="p1" viewBox="0 0 370 100"><use href="#a"/></svg>
              <svg className="p2" viewBox="0 0 370 100"><use href="#b"/></svg>
              <svg className="p3" viewBox="0 0 370 100"><use href="#c"/></svg>
              <svg className="p4" viewBox="0 0 370 100"><use href="#d"/></svg>
              <svg className="p5" viewBox="0 0 370 100"><use href="#e"/></svg>
            </div>
            <div className="word" aria-label="RockGPT">
              {"ROCKGPT".split("").map((c, i) => (
                <b key={i}><i style={{ ["--i" as string]: `${i}` }}>{c}</i></b>
              ))}
            </div>
            <div className="ticker">
              <div><p>Chat</p><p>Create</p><p>Code</p><p>Explore</p><p>Anything</p></div>
            </div>
          </div>
        </div>
      )}

      {/* 2. SIDEBAR DRAWER */}
      <aside className="drawer" id="drawer" ref={drawerRef} aria-label="Sidebar navigation">
        <div className="s-brand">
          <div className="s-brand-left">
            <svg className="logo-rock" viewBox="0 0 370 100" aria-label="ROCK"><use href="#R"/></svg>
            <span className="gpt-tag">GPT</span>
          </div>
        </div>

        <button className="new-chat-pill" id="newd" onClick={startFreshChat} type="button">
          <svg className="i"><use href="#i-plus"/></svg>
          <span>New chat</span>
        </button>

        <nav className="nav" aria-label="Tools">
          <button
            className={`nav-item ${activeProject ? "on" : ""}`}
            style={{ ["--i" as string]: 0 }}
            onClick={() => { setDrawerOpen(false); setActiveSheet("proj"); }}
            type="button"
          >
            <span className="ni-ico">
              <svg viewBox="0 0 24 24">
                <path className="lid" d="M3 8V6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v1"/>
                <path d="M3 10.5h18l-1.4 8a1.5 1.5 0 0 1-1.5 1.2H5.9a1.5 1.5 0 0 1-1.5-1.2z"/>
              </svg>
            </span>
            <span className="ni-t">Projects</span>
            <span className="ni-tag">{projectsList.length || ""}</span>
          </button>

          <button
            className={`nav-item ${deepMode ? "on" : ""}`}
            style={{ ["--i" as string]: 1 }}
            onClick={() => {
              const next = !deepMode;
              setDeepMode(next);
              showToast(next ? "Deep Research on" : "Deep Research off");
              setTimeout(() => setDrawerOpen(false), 200);
            }}
            type="button"
          >
            <span className="ni-ico">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8.5"/>
                <circle cx="12" cy="12" r="3.5"/>
                <path className="sweep" d="M12 12V3.5"/>
              </svg>
            </span>
            <span className="ni-t">Deep Research</span>
            <span className="ni-tag">{deepMode ? "On" : ""}</span>
          </button>

          <button
            className="nav-item"
            style={{ ["--i" as string]: 2 }}
            onClick={() => { setDrawerOpen(false); setActiveSheet("canvas"); }}
            type="button"
          >
            <span className="ni-ico">
              <svg viewBox="0 0 24 24">
                <path d="M5 4h9l5 5v11H5z"/>
                <path d="M14 4v5h5"/>
                <path className="pen" d="M8.5 15.5l5-5 1.8 1.8-5 5-2.3.5z"/>
              </svg>
            </span>
            <span className="ni-t">Canvas</span>
          </button>
        </nav>

        <div className="s-label">Recent</div>
        <div id="list">
          {chatsList.length === 0 ? (
            <p className="empty-note">Your chats will appear here</p>
          ) : (
            chatsList.map((chat, idx) => (
              <div
                key={chat.id}
                className={`hist-row ${chat.id === activeChatId ? "active" : ""}`}
                style={{ ["--i" as string]: Math.min(idx, 9) }}
              >
                <button
                  className="hist-title"
                  type="button"
                  onClick={() => loadChat(chat.id)}
                >
                  {chat.title}
                </button>
                <button
                  className="hist-del"
                  type="button"
                  aria-label="Delete chat"
                  onClick={(e) => deleteChat(chat.id, e)}
                >
                  <svg className="i"><use href="#i-close"/></svg>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="s-foot">
          <div className="theme-card">
            <div className="theme-label">
              <svg className="i"><use href="#i-moon"/></svg>
              <span>Theme</span>
            </div>
            <div className="theme-switch">
              <button
                className={`t-opt ${theme === "light" ? "active" : ""}`}
                onClick={() => applyThemeMode("light")}
                type="button"
              >
                <svg className="i"><use href="#i-sun"/></svg>
                <span>Light</span>
              </button>
              <button
                className={`t-opt ${theme === "dark" ? "active" : ""}`}
                onClick={() => applyThemeMode("dark")}
                type="button"
              >
                <svg className="i"><use href="#i-moon"/></svg>
                <span>Dark</span>
              </button>
            </div>
          </div>

          {(() => {
            const isGuest = !currentUser || (currentUser.email && currentUser.email.startsWith("guest-"));
            return (
              <div className="profile-card">
                <div
                  className="p-left"
                  onClick={() => {
                    if (isGuest) {
                      setShowAuthModal(true);
                    } else {
                      showToast(`Signed in as ${currentUser?.name}`);
                    }
                  }}
                >
                  <div className="p-avatar">
                    {isGuest ? "G" : (currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "U")}
                  </div>
                  <div className="p-info">
                    <div className="p-name">{isGuest ? "Guest User" : (currentUser?.name || "User")}</div>
                    <div className="p-mail">{isGuest ? "Sign in to save & sync" : currentUser?.email}</div>
                  </div>
                </div>
                <button
                  className="p-auth-btn"
                  id="authBtn"
                  type="button"
                  onClick={() => {
                    if (isGuest) setShowAuthModal(true);
                    else handleLogout();
                  }}
                >
                  {isGuest ? "Sign in" : "Log out"}
                </button>
              </div>
            );
          })()}
        </div>
      </aside>

      <div
        className="app-scrim"
        id="scrim"
        ref={scrimRef}
        onClick={() => setDrawerOpen(false)}
      />
      <div className="sheet-wave" id="sheetWave" ref={sheetWaveRef} />

      {/* 3. MAIN APPLICATION COLUMN */}
      <main className="app" id="app" ref={appRef}>
        <header className="top rise">
          <button
            className="pill round"
            id="menu"
            aria-label="Open sidebar"
            onClick={() => setDrawerOpen(true)}
            type="button"
          >
            <svg className="i"><use href="#i-menu"/></svg>
          </button>

          <button
            className="sym-btn"
            id="newt"
            aria-label="New chat"
            title="Start new chat"
            onClick={(e) => {
              const btn = e.currentTarget;
              btn.classList.add("flip");
              setTimeout(() => btn.classList.remove("flip"), 500);
              startFreshChat();
            }}
            type="button"
          >
            <svg viewBox="0 0 24 24">
              <path className="sym-sheet" d="M11 4H6.8A2.8 2.8 0 0 0 4 6.8v10.4A2.8 2.8 0 0 0 6.8 20h10.4a2.8 2.8 0 0 0 2.8-2.8V13"/>
              <path className="sym-nib" d="M13.5 10.5L19.2 4.8"/>
              <path className="sym-spark" d="M18.5 2.2L19.4 4.6L21.8 5.5L19.4 6.4L18.5 8.8L17.6 6.4L15.2 5.5L17.6 4.6Z"/>
            </svg>
          </button>
        </header>

        {/* HERO SECTION */}
        {isFeedEmpty && (
          <section className={`hero ${heroBye ? "bye" : ""}`} id="hero" style={{ display: "flex" }}>
            <svg className="logo-rock-hero hi" style={{ ["--d" as string]: ".1s" }} viewBox="0 0 370 100" aria-label="ROCK">
              <use href="#R"/>
            </svg>
            <h1 id="heroGreeting">
              <b className="hi" style={{ ["--d" as string]: ".2s", ["--i" as string]: 0 }}>Welcome</b>
              <b className="hi" style={{ ["--d" as string]: ".2s", ["--i" as string]: 1 }}>
                {currentUser?.name ? "back," : "back"}
              </b>
              <b className="hi" style={{ ["--d" as string]: ".2s", ["--i" as string]: 2 }}>
                {currentUser?.name ? currentUser.name.split(" ")[0] : ""}
              </b>
            </h1>
            <div className="chips">
              <button
                className="chip hi"
                style={{ ["--i" as string]: 0 }}
                onClick={() => handleSend("Plan my day")}
                type="button"
              >
                Plan my day
              </button>
              <button
                className="chip hi"
                style={{ ["--i" as string]: 1 }}
                onClick={() => handleSend("Help me learn coding")}
                type="button"
              >
                Help me learn coding
              </button>
              <button
                className="chip hi"
                style={{ ["--i" as string]: 2 }}
                onClick={() => handleSend("Give me a study tip")}
                type="button"
              >
                Give me a study tip
              </button>
            </div>
          </section>
        )}

        {/* CHAT FEED */}
        {!isFeedEmpty && (
          <div id="feed" ref={feedRef} onScroll={handleFeedScroll} onClick={handleFeedClick}>
            {messages.map((msg, i) => (
              <div key={i} className={`m ${msg.role === "user" ? "user" : "bot"}`}>
                {msg.research_card && (
                  <div className={`m rcard ${msg.research_card.status === "done" ? "done" : ""}`}>
                    <div className="rc-h">
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="8.5"/>
                        <circle cx="12" cy="12" r="3.5"/>
                        <path className="sweep" d="M12 12V3.5"/>
                      </svg>
                      <span className="rc-t">
                        {msg.research_card.status === "done" ? "Research complete" : "Deep Researching"}
                      </span>
                      <small>Live Engine</small>
                    </div>
                    <div className="rc-bar">
                      <i style={{ width: `${(msg.research_card.step / 5) * 100}%` }} />
                    </div>
                    <div className="rc-steps">
                      {[
                        "Understanding question and planning",
                        "Searching primary verified sources",
                        "Extracting page insights",
                        "Cross-checking and verification",
                        "Synthesizing final research report",
                      ].map((stepText, sIdx) => {
                        const stepNum = sIdx + 1;
                        const isDone = msg.research_card!.step > stepNum || msg.research_card!.status === "done";
                        const isCurrent = msg.research_card!.step === stepNum && msg.research_card!.status === "running";
                        return (
                          <div
                            key={sIdx}
                            className={`rc-step ${isDone ? "ok" : isCurrent ? "run" : ""}`}
                          >
                            <span className="d"/>
                            <span>{stepText}</span>
                          </div>
                        );
                      })}
                    </div>
                    {msg.research_card.subQuestions.length > 0 && (
                      <div className="rc-q">
                        {msg.research_card.subQuestions.map((q, qIdx) => (
                          <div key={qIdx} style={{ marginTop: 4 }}>• {q}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {msg.content && (
                  <div
                    className="msg-content"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(
                        msg.content,
                        msg.role === "assistant" && isStreaming && i === messages.length - 1
                      ),
                    }}
                  />
                )}
              </div>
            ))}

            {/* Creative 3D Harmonic Waiting & Replying Indicator */}
            {isStreaming && (isThinking || (!messages[messages.length - 1] || messages[messages.length - 1].role === "user")) && (
              <div className="m bot">
                <div className={`typing-3d ${isHidingTyping ? "gone" : ""}`} role="status" aria-label="RockGPT is thinking">
                  <span className="orb-wrap"><i className="orb"/><span className="orb-shadow"/></span>
                  <span className="orb-wrap"><i className="orb"/><span className="orb-shadow"/></span>
                  <span className="orb-wrap"><i className="orb"/><span className="orb-shadow"/></span>
                  <span className="typing-status-text">Thinking</span>
                </div>
              </div>
            )}

            {streamError && (
              <div className="m bot" style={{ color: "#ef4444" }}>
                <span>{streamError}</span>
                <button
                  type="button"
                  style={{ marginLeft: 8, textDecoration: "underline", cursor: "pointer" }}
                  onClick={() => {
                    const lastUserMsg = messages.filter(m => m.role === "user").pop();
                    if (lastUserMsg) handleSend(lastUserMsg.content);
                  }}
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}

        {/* Scroll-to-bottom Floating Button */}
        <button
          className={`scroll-down ${showScrollDown ? "on" : ""}`}
          id="scrollDownBtn"
          aria-label="Scroll to bottom"
          onClick={() => scrollToBottom(true)}
          type="button"
        >
          <svg className="i"><use href="#i-down"/></svg>
        </button>

        {/* Message Composer Bar */}
        <div className="comp rise" style={{ ["--d" as string]: ".35s" }}>
          <div className="mode-row" id="modeRow">
            {activeProject && (
              <div className="mchip">
                <svg className="i" viewBox="0 0 24 24">
                  <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2.5h8.5A1.5 1.5 0 0 1 21 10v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"/>
                </svg>
                <span>{activeProject.name}</span>
                <button
                  type="button"
                  aria-label="Leave project"
                  onClick={() => setActiveProject(null)}
                >
                  <svg className="i"><use href="#i-close"/></svg>
                </button>
              </div>
            )}
            {deepMode && (
              <div className="mchip deep">
                <span className="dot" />
                <span>Deep Research</span>
                <button
                  type="button"
                  aria-label="Disable deep research"
                  onClick={() => setDeepMode(false)}
                >
                  <svg className="i"><use href="#i-close"/></svg>
                </button>
              </div>
            )}
          </div>

          <div className={`box ${inputVal.trim() ? "has" : ""}`} id="box">
            <button
              className="ic"
              id="plus"
              aria-label="Attach file"
              type="button"
              onClick={() => {
                const el = document.getElementById("file-input");
                el?.click();
              }}
            >
              <svg className="i"><use href="#i-plus"/></svg>
            </button>

            <textarea
              id="in"
              ref={textareaRef}
              rows={1}
              value={inputVal}
              placeholder={deepMode ? "What should I research?" : "Reply to RockGPT"}
              onChange={(e) => {
                setInputVal(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 132)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />

            {!inputVal.trim() && (
              <button
                className="ic"
                id="mic"
                aria-label="Voice input"
                type="button"
                onClick={handleVoiceInput}
              >
                <svg className="i"><use href="#i-mic"/></svg>
              </button>
            )}

            <button
              className={`go ${isStreaming ? "stop-mode" : ""}`}
              id="go"
              aria-label={isStreaming ? "Stop generation" : "Send message"}
              type="button"
              onClick={isStreaming ? stopGeneration : () => handleSend()}
            >
              {isStreaming ? (
                <svg className="i stp" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="7" y="7" width="10" height="10" rx="2" />
                </svg>
              ) : (
                <>
                  <svg className="i wav"><use href="#i-wave"/></svg>
                  <svg className="i snd"><use href="#i-up"/></svg>
                </>
              )}
            </button>
          </div>
        </div>

        <input
          type="file"
          id="file-input"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) showToast(`Attached: ${f.name}`);
          }}
        />
      </main>

      {/* 4. PROJECTS SHEET */}
      <section
        className={`sheet ${activeSheet === "proj" ? "on" : ""}`}
        id="shProj"
        aria-hidden={activeSheet !== "proj"}
        aria-label="Projects"
      >
        <header className="sh-top">
          <button
            className="sh-back"
            type="button"
            aria-label="Back"
            onClick={() => setActiveSheet(null)}
          >
            <svg className="i"><use href="#i-back"/></svg>
          </button>
          <h2>Projects</h2>
          <button
            className="sh-act"
            type="button"
            onClick={() => setShowNewProjForm(prev => !prev)}
          >
            + New
          </button>
        </header>
        <div className="sh-body">
          {showNewProjForm && (
            <div className="pf on">
              <input
                type="text"
                maxLength={28}
                placeholder="Project name"
                value={newProjName}
                onChange={(e) => setNewProjName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!newProjName.trim()) {
                      showToast("Give it a name");
                      return;
                    }
                    fetch("/api/projects", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: newProjName.trim() }),
                    })
                      .then(res => res.json())
                      .then(d => {
                        if (d.project) {
                          setProjectsList(prev => [d.project, ...prev]);
                          setNewProjName("");
                          setShowNewProjForm(false);
                          showToast("Project created");
                        }
                      });
                  }
                }}
              />
              <div className="row">
                <button type="button" onClick={() => { setShowNewProjForm(false); setNewProjName(""); }}>Cancel</button>
                <button
                  type="button"
                  className="pri"
                  onClick={async () => {
                    if (!newProjName.trim()) {
                      showToast("Give it a name");
                      return;
                    }
                    const res = await fetch("/api/projects", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: newProjName.trim() }),
                    });
                    if (res.ok) {
                      const d = await res.json();
                      setProjectsList(prev => [d.project, ...prev]);
                      setNewProjName("");
                      setShowNewProjForm(false);
                      showToast("Project created");
                    }
                  }}
                >
                  Create
                </button>
              </div>
            </div>
          )}

          {projectsList.length === 0 ? (
            <div className="empty-art">
              <svg viewBox="0 0 24 24">
                <path d="M3 8V6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v1"/>
                <path d="M3 10.5h18l-1.4 8a1.5 1.5 0 0 1-1.5 1.2H5.9a1.5 1.5 0 0 1-1.5-1.2z"/>
              </svg>
              <br />
              Group related chats into a project, then start any new chat inside it.
            </div>
          ) : (
            projectsList.map((p, pIdx) => {
              const isExpanded = expandedProjId === p.id;
              const isProjActive = activeProject?.id === p.id;
              const projChats = chatsList.filter(c => c.project_id === p.id);

              return (
                <div
                  key={p.id}
                  className={`proj ${isProjActive ? "act" : ""} ${isExpanded ? "open" : ""}`}
                  style={{ ["--i" as string]: pIdx }}
                >
                  <button
                    className="proj-h"
                    type="button"
                    onClick={() => setExpandedProjId(isExpanded ? null : p.id)}
                  >
                    <span className="proj-tile">{p.name.charAt(0).toUpperCase()}</span>
                    <span className="proj-n">
                      <b>{p.name}</b>
                      <span>{p.chat_count} chats{isProjActive ? " · active" : ""}</span>
                    </span>
                    <svg className="i proj-chev"><use href="#i-chev"/></svg>
                  </button>

                  <div className="proj-more">
                    <div>
                      <div className="proj-in">
                        {projChats.length === 0 ? (
                          <div className="proj-empty-note">No chats yet. Make this the active project and send a message.</div>
                        ) : (
                          projChats.map(c => (
                            <button
                              key={c.id}
                              className="proj-chat"
                              type="button"
                              onClick={() => { setActiveSheet(null); loadChat(c.id); }}
                            >
                              {c.title}
                            </button>
                          ))
                        )}
                        <div className="proj-btns">
                          <button
                            type="button"
                            className="pri"
                            onClick={() => {
                              setActiveProject(isProjActive ? null : p);
                              showToast(isProjActive ? "Left project" : `Project active: ${p.name}`);
                              setActiveSheet(null);
                            }}
                          >
                            {isProjActive ? "Leave project" : "Use project"}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
                              setProjectsList(prev => prev.filter(x => x.id !== p.id));
                              if (activeProject?.id === p.id) setActiveProject(null);
                              showToast("Project deleted");
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 5. CANVAS SHEET */}
      <section
        className={`sheet ${activeSheet === "canvas" ? "on" : ""}`}
        id="shCanvas"
        aria-hidden={activeSheet !== "canvas"}
        aria-label="Canvas"
      >
        <header className="sh-top">
          <button
            className="sh-back"
            type="button"
            aria-label="Back"
            onClick={() => setActiveSheet(null)}
          >
            <svg className="i"><use href="#i-back"/></svg>
          </button>
          <h2>Canvas</h2>
          <button
            className="sh-act"
            type="button"
            onClick={() => {
              handleCanvasChange("", "");
              showToast("Canvas cleared");
            }}
          >
            Clear
          </button>
        </header>
        <div className="sh-body" style={{ gap: 6 }}>
          <input
            className="cv-title"
            placeholder="Untitled"
            maxLength={60}
            value={canvasTitle}
            onChange={(e) => handleCanvasChange(e.target.value, canvasText)}
          />
          <textarea
            className="cv-text"
            placeholder="Write, outline or draft anything. It saves as you type."
            value={canvasText}
            onChange={(e) => handleCanvasChange(canvasTitle, e.target.value)}
          />
          <div className="cv-bar">
            <span>
              {(canvasText.trim().match(/\S+/g) || []).length} words
            </span>
            <span className={`cv-saved ${canvasSavedNotice ? "on" : ""}`}>Saved</span>
            <span className="sp" />
            <button
              type="button"
              onClick={() => {
                const combined = (canvasTitle ? `${canvasTitle}\n\n` : "") + canvasText;
                navigator.clipboard.writeText(combined).then(() => showToast("Copied"));
              }}
            >
              Copy
            </button>
            <button
              type="button"
              className="pri"
              onClick={() => {
                const combined = (canvasTitle ? `${canvasTitle}\n\n` : "") + canvasText;
                if (!combined.trim()) return showToast("Canvas is empty");
                setInputVal(combined);
                setActiveSheet(null);
                showToast("Added to composer");
              }}
            >
              Send to chat
            </button>
          </div>
        </div>
      </section>

      {/* 6. AUTHENTICATION MODAL */}
      <div
        className={`auth-modal ${showAuthModal ? "on" : ""}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if ((e.target as HTMLElement).classList.contains("auth-modal")) {
            setShowAuthModal(false);
          }
        }}
      >
        <form className="auth-box" onSubmit={handleAuthSubmit}>
          <div className="auth-head">
            <h2>
              {authTab === "signup" && "Create Account"}
              {authTab === "login" && "Sign in to RockGPT"}
              {authTab === "otp" && "Verify Email"}
              {authTab === "forgot" && "Reset Password"}
              {authTab === "reset" && "Enter Recovery Code"}
              {authTab === "google_select" && "Sign in with Google"}
            </h2>
            <button
              type="button"
              className="auth-close"
              aria-label="Close"
              onClick={() => { setShowAuthModal(false); setAuthError(null); }}
            >
              <svg className="i"><use href="#i-close"/></svg>
            </button>
          </div>

          {(authTab === "login" || authTab === "signup") && (
            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab ${authTab === "login" ? "active" : ""}`}
                onClick={() => { setAuthTab("login"); setAuthError(null); }}
              >
                Sign in
              </button>
              <button
                type="button"
                className={`auth-tab ${authTab === "signup" ? "active" : ""}`}
                onClick={() => { setAuthTab("signup"); setAuthError(null); }}
              >
                Create Account
              </button>
            </div>
          )}

          {authError && (
            <p style={{ color: "#ef4444", fontSize: 13.5, margin: "2px 0" }}>{authError}</p>
          )}

          {/* Mode 1: Sign Up */}
          {authTab === "signup" && (
            <>
              <div className="auth-field">
                <label>Your Name</label>
                <input
                  type="text"
                  placeholder="e.g. Suman Mansuri"
                  required
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                />
              </div>
              <div className="auth-field">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                />
              </div>
              <div className="auth-field">
                <label>Password (min 8 chars)</label>
                <div className="auth-input-wrap">
                  <input
                    type={authShowPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="auth-eye"
                    onClick={() => setAuthShowPassword(!authShowPassword)}
                    aria-label="Toggle password"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>
              <button type="submit" className="auth-submit" disabled={authLoading}>
                {authLoading ? "Sending Verification Code…" : "Send Verification Code →"}
              </button>
            </>
          )}

          {/* Mode 2: Sign In */}
          {authTab === "login" && (
            <>
              <div className="auth-field">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                />
              </div>
              <div className="auth-field">
                <label>Password</label>
                <div className="auth-input-wrap">
                  <input
                    type={authShowPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="auth-eye"
                    onClick={() => setAuthShowPassword(!authShowPassword)}
                    aria-label="Toggle password"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="auth-links">
                <span />
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => { setAuthTab("forgot"); setAuthError(null); }}
                >
                  Forgot password?
                </button>
              </div>
              <button type="submit" className="auth-submit" disabled={authLoading}>
                {authLoading ? "Signing in…" : "Sign in"}
              </button>
            </>
          )}

          {/* Mode 3: OTP Verification */}
          {authTab === "otp" && (
            <>
              <div className="auth-badge">
                <div className="shield-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
                  </svg>
                </div>
                <h3>Check your inbox</h3>
                <p>We sent a 6-digit verification code to <b>{authEmail}</b>.</p>
              </div>
              <div className="auth-field">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  className="auth-otp-input"
                  required
                  autoFocus
                  value={authOtpCode}
                  onChange={(e) => setAuthOtpCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <button type="submit" className="auth-submit" disabled={authLoading || authOtpCode.length < 6}>
                {authLoading ? "Verifying…" : "Verify Code & Sign In →"}
              </button>
              <div className="auth-links">
                <button
                  type="button"
                  className="auth-link"
                  onClick={handleResendOtp}
                  disabled={authResendSeconds > 0 || authLoading}
                >
                  {authResendSeconds > 0 ? `Resend code in ${authResendSeconds}s` : "Resend code"}
                </button>
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => { setAuthTab("signup"); setAuthError(null); }}
                >
                  Change email
                </button>
              </div>
            </>
          )}

          {/* Mode 4: Forgot Password */}
          {authTab === "forgot" && (
            <>
              <div className="auth-badge">
                <div className="shield-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="8" cy="15" r="4" />
                    <path d="M11 12l9-9M16 7l3 3" />
                  </svg>
                </div>
                <h3>Forgot password?</h3>
                <p>Enter your email to receive a 6-digit recovery code.</p>
              </div>
              <div className="auth-field">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                />
              </div>
              <button type="submit" className="auth-submit" disabled={authLoading}>
                {authLoading ? "Sending Recovery Code…" : "Send Recovery Code →"}
              </button>
              <div className="auth-links" style={{ justifyContent: "center" }}>
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => { setAuthTab("login"); setAuthError(null); }}
                >
                  Back to Sign In
                </button>
              </div>
            </>
          )}

          {/* Mode 5: Reset Password */}
          {authTab === "reset" && (
            <>
              <div className="auth-badge">
                <div className="shield-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
                  </svg>
                </div>
                <h3>Create New Password</h3>
                <p>Enter the 6-digit code sent to <b>{authEmail}</b>.</p>
              </div>
              <div className="auth-field">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  className="auth-otp-input"
                  required
                  value={authOtpCode}
                  onChange={(e) => setAuthOtpCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div className="auth-field">
                <label>New Password (min 8 chars)</label>
                <div className="auth-input-wrap">
                  <input
                    type={authShowPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="auth-eye"
                    onClick={() => setAuthShowPassword(!authShowPassword)}
                    aria-label="Toggle password"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="auth-field">
                <label>Confirm Password</label>
                <div className="auth-input-wrap">
                  <input
                    type={authShowPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    value={authPasswordConfirm}
                    onChange={(e) => setAuthPasswordConfirm(e.target.value)}
                  />
                </div>
              </div>
              <button type="submit" className="auth-submit" disabled={authLoading || authOtpCode.length < 6}>
                {authLoading ? "Resetting…" : "Reset Password & Log In →"}
              </button>
              <div className="auth-links">
                <button
                  type="button"
                  className="auth-link"
                  onClick={handleResendOtp}
                  disabled={authResendSeconds > 0 || authLoading}
                >
                  {authResendSeconds > 0 ? `Resend in ${authResendSeconds}s` : "Resend code"}
                </button>
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => { setAuthTab("login"); setAuthError(null); }}
                >
                  Back to Sign In
                </button>
              </div>
            </>
          )}

          {/* Google Sign In Button (shown on login & signup tabs) */}
          {(authTab === "login" || authTab === "signup") && (
            <button
              type="button"
              className="google-btn"
              onClick={handleContinueWithGoogle}
              disabled={authLoading}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          )}
        </form>
      </div>

      {/* 7. TOAST NOTIFICATION */}
      <div className={`toast ${toastMsg ? "on" : ""}`} id="toast">
        {toastMsg}
      </div>
    </>
  );
}
