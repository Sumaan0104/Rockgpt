import React, { useState, useEffect, useRef } from "react";
import Intro from "./components/Intro.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Header from "./components/Header.jsx";
import ChatList from "./components/ChatList.jsx";
import Composer from "./components/Composer.jsx";
const AuthModal = React.lazy(() => import("./components/AuthModal.jsx"));
const WelcomeModal = React.lazy(() => import("./components/WelcomeModal.jsx"));
const LogoutConfirmModal = React.lazy(() => import("./components/LogoutConfirmModal.jsx"));
import {
  askRock,
  pingServerHealth,
  apiInitGuestSession,
  apiSignIn,
  apiSignUp,
  apiVerifyOtp,
  apiForgotPassword,
  apiResetPassword,
  apiGoogleAuth,
  apiGetChats,
  apiGetChatById,
  apiDeleteChat,
} from "./services/api.js";

const GUEST_STORAGE_KEY = "rockgpt_guest_chats";
const USER_KEY = "rockgpt_user";
const TOKEN_KEY = "rockgpt_token";
const GUEST_MANDATORY_KEY = "rockgpt_guest_mandatory";
const GUEST_TIMER_START_KEY = "rockgpt_guest_start_time";
const GUEST_TOKEN_KEY = "rockgpt_guest_token";
const GUEST_PROMPTED_KEY = "rockgpt_guest_prompted";

// Configurable guest access duration: 150 seconds (2 minutes and 30 seconds)
const GUEST_ACCESS_DURATION_SEC = 150;
const GUEST_ACCESS_DURATION_MS = GUEST_ACCESS_DURATION_SEC * 1000;

function checkInitialGuestMandatory() {
  try {
    const isMandatory =
      localStorage.getItem(GUEST_MANDATORY_KEY) === "true" ||
      sessionStorage.getItem(GUEST_MANDATORY_KEY) === "true";
    if (isMandatory) return true;

    const timerStart = Number(
      localStorage.getItem(GUEST_TIMER_START_KEY) ||
      sessionStorage.getItem(GUEST_TIMER_START_KEY)
    );
    if (timerStart && (Date.now() - timerStart >= GUEST_ACCESS_DURATION_MS)) {
      try {
        localStorage.setItem(GUEST_MANDATORY_KEY, "true");
        sessionStorage.setItem(GUEST_MANDATORY_KEY, "true");
      } catch {
        /* storage error */
      }
      return true;
    }
  } catch {
    /* storage unavailable */
  }
  return false;
}

export default function App() {
  // Theme State
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("rockgpt_theme") || "dark";
    } catch {
      return "dark";
    }
  });

  // User & Auth State
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;
    } catch {
      return null;
    }
  });

  const [authModalOpen, setAuthModalOpen] = useState(() => {
    try {
      const storedUser = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
      const storedToken = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
      if (storedUser || storedToken) return false;
      return checkInitialGuestMandatory();
    } catch {
      return false;
    }
  });
  const [authModalMode, setAuthModalMode] = useState("in");
  const [isAuthMandatory, setIsAuthMandatory] = useState(() => {
    try {
      const storedUser = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
      const storedToken = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
      if (storedUser || storedToken) return false;
      return checkInitialGuestMandatory();
    } catch {
      return false;
    }
  });
  const [welcomeUser, setWelcomeUser] = useState(null);
  const [isWelcomeNewUser, setIsWelcomeNewUser] = useState(false);

  // Logout Confirmation State
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Chat State
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamingText, setCurrentStreamingText] = useState("");

  // Layout & Responsive State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // References
  const abortControllerRef = useRef(null);
  const scrollRef = useRef(null);
  const composerInputRef = useRef(null);
  const targetTextRef = useRef("");
  const animFrameRef = useRef(null);
  const deletedChatBackupRef = useRef(null);
  const currentChatRef = useRef(currentChat);
  useEffect(() => {
    currentChatRef.current = currentChat;
  }, [currentChat]);

  // 1. Sync theme to document & meta tags
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    document.body.style.backgroundColor = "";
    try {
      localStorage.setItem("rockgpt_theme", theme);
    } catch {
      /* storage disabled or quota exceeded */
    }

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.content = theme === "light" ? "#ffffff" : "#000000";
    }
  }, [theme]);

  // 2. Set dynamic --vh viewport height to prevent mobile keyboard layout shift
  useEffect(() => {
    const updateVH = () => {
      const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty("--vh", `${height}px`);
    };

    updateVH();
    window.addEventListener("resize", updateVH);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateVH);
      window.visualViewport.addEventListener("scroll", updateVH);
    }

    return () => {
      window.removeEventListener("resize", updateVH);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateVH);
        window.visualViewport.removeEventListener("scroll", updateVH);
      }
    };
  }, []);

  // 3. Ping server health to wake up Render free tier on mount and keep warm
  useEffect(() => {
    pingServerHealth();
    const interval = setInterval(pingServerHealth, 4 * 60 * 1000); // 4-minute heartbeat keepalive
    const onFocus = () => pingServerHealth();
    window.addEventListener("focus", onFocus);
    const onVisibility = () => {
      if (document.visibilityState === "visible") pingServerHealth();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // 4. Initial visit authentication popup for unauthenticated guests
  useEffect(() => {
    if (user || token) return;

    try {
      const isMandatory =
        localStorage.getItem(GUEST_MANDATORY_KEY) === "true" ||
        sessionStorage.getItem(GUEST_MANDATORY_KEY) === "true";
      if (isMandatory) return;

      const timerStart = Number(
        localStorage.getItem(GUEST_TIMER_START_KEY) ||
        sessionStorage.getItem(GUEST_TIMER_START_KEY)
      );
      if (timerStart) return;

      const prompted =
        localStorage.getItem(GUEST_PROMPTED_KEY) ||
        sessionStorage.getItem(GUEST_PROMPTED_KEY);
      if (!prompted) {
        // Smooth entrance after intro splash (~3200ms)
        const timer = setTimeout(() => {
          if (!user && !token) {
            try {
              sessionStorage.setItem(GUEST_PROMPTED_KEY, "true");
              localStorage.setItem(GUEST_PROMPTED_KEY, "true");
            } catch (err) {
              void err;
            }
            setAuthModalMode("in");
            setIsAuthMandatory(false);
            setAuthModalOpen(true);
          }
        }, 3200);
        return () => clearTimeout(timer);
      }
    } catch (err) {
      void err;
    }
  }, [user, token]);

  // 5. Timed guest access: 150 seconds (2m 30s) countdown starting upon "Stay logged out"
  useEffect(() => {
    if (user || token) return;

    try {
      const isMandatoryStored =
        localStorage.getItem(GUEST_MANDATORY_KEY) === "true" ||
        sessionStorage.getItem(GUEST_MANDATORY_KEY) === "true";
      const triggerLock = () => {
        if (!user && !token) {
          try {
            localStorage.setItem(GUEST_MANDATORY_KEY, "true");
            sessionStorage.setItem(GUEST_MANDATORY_KEY, "true");
          } catch (err) {
            void err;
          }
          setIsAuthMandatory(true);
          setAuthModalMode("in");
          setAuthModalOpen(true);
        }
      };

      if (isMandatoryStored) {
        triggerLock();
        return;
      }

      const timerStart = Number(
        localStorage.getItem(GUEST_TIMER_START_KEY) ||
        sessionStorage.getItem(GUEST_TIMER_START_KEY)
      );

      // Only run countdown if visitor clicked "Stay logged out"
      if (!timerStart) return;

      const elapsed = Date.now() - timerStart;
      if (elapsed >= GUEST_ACCESS_DURATION_MS) {
        triggerLock();
        return;
      }

      const remaining = Math.max(0, GUEST_ACCESS_DURATION_MS - elapsed);

      const mandatoryTimer = setTimeout(() => {
        if (isWaiting || isStreaming) {
          // If response is streaming, let it finish gracefully before showing modal
          const waitInterval = setInterval(() => {
            if (!isWaiting && !isStreaming) {
              clearInterval(waitInterval);
              triggerLock();
            }
          }, 800);
        } else {
          triggerLock();
        }
      }, remaining);

      return () => clearTimeout(mandatoryTimer);
    } catch (err) {
      void err;
    }
  }, [user, token, isWaiting, isStreaming]);

  // 6. Multi-tab synchronization (tabs share localStorage state)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === GUEST_MANDATORY_KEY && e.newValue === "true") {
        if (!user && !token) {
          setIsAuthMandatory(true);
          setAuthModalMode("in");
          setAuthModalOpen(true);
        }
      } else if (e.key === TOKEN_KEY) {
        if (e.newValue) {
          setToken(e.newValue);
          try {
            const u = localStorage.getItem(USER_KEY);
            if (u) setUser(JSON.parse(u));
          } catch {
            /* storage error */
          }
          setIsAuthMandatory(false);
          setAuthModalOpen(false);
        } else if (!e.newValue && (user || token)) {
          setUser(null);
          setToken(null);
          setCurrentChat(null);
          setChats([]);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [user, token]);

  // 7. Load chats on mount and when user/token changes (preserving active guest conversation)
  useEffect(() => {
    async function loadUserChats() {
      if (token) {
        try {
          const remoteChats = await apiGetChats();
          const active = currentChatRef.current;
          if (active && Array.isArray(active.messages) && active.messages.length > 0) {
            const currentId = String(active.id || active._id);
            const exists = (remoteChats || []).some((c) => String(c.id || c._id) === currentId);
            setChats(exists ? (remoteChats || []) : [active, ...(remoteChats || [])]);
          } else {
            setChats(remoteChats || []);
          }
        } catch {
          const active = currentChatRef.current;
          setChats(active ? [active] : []);
        }
      } else {
        // Guests do NOT persist chats across reload. Clear any guest storage.
        try {
          localStorage.removeItem(GUEST_STORAGE_KEY);
          sessionStorage.removeItem(GUEST_STORAGE_KEY);
        } catch {
          /* storage unavailable */
        }
        setChats([]);
        setCurrentChat(null);
      }
    }
    loadUserChats();
  }, [token]);

  // 5. Ensure guest chats are strictly ephemeral and never stored in device storage
  useEffect(() => {
    if (!token) {
      try {
        localStorage.removeItem(GUEST_STORAGE_KEY);
      } catch {
        /* storage unavailable */
      }
    }
  }, [chats, token]);

  // 6. Warn unauthenticated guest users before reload so they don't accidentally lose their active chat
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!token) {
        const hasMessages =
          (currentChat?.messages && currentChat.messages.length > 0) ||
          (chats && chats.length > 0 && chats.some((c) => c.messages && c.messages.length > 0));

        if (hasMessages) {
          e.preventDefault();
          e.returnValue = "Are you sure you want to refresh? Your guest conversation will be lost unless you log in or sign up.";
          return e.returnValue;
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [token, currentChat, chats]);

  // Handlers
  const handleToggleTheme = (newTheme) => {
    setTheme(newTheme);
  };

  const handleToggleSidebar = () => {
    const isMobile = window.matchMedia("(max-width: 820px)").matches;
    if (isMobile) {
      setMobileDrawerOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  };

  const handleNewChat = () => {
    if (isWaiting || isStreaming) return;
    setCurrentChat(null);
    setCurrentStreamingText("");
    setMobileDrawerOpen(false);
  };

  const handleSelectChat = async (chat) => {
    if (isWaiting || isStreaming) return;
    const targetId = chat.id || chat._id;
    if (!targetId) return;

    // Snappily close mobile drawer
    setMobileDrawerOpen(false);

    // Check if local cache in state already has messages
    const localInState = chats.find(
      (c) => String(c.id || c._id) === String(targetId)
    );

    const hasLocalMessages =
      localInState &&
      Array.isArray(localInState.messages) &&
      localInState.messages.length > 0;

    if (hasLocalMessages) {
      setCurrentChat({
        ...localInState,
        id: targetId,
        _id: targetId,
        isLoading: false,
      });
      return;
    }

    // Set optimistic chat state with loading flag while fetching
    setCurrentChat({
      ...chat,
      id: targetId,
      _id: targetId,
      messages: chat.messages || [],
      isLoading: Boolean(token),
    });

    // If authenticated, fetch full conversation with messages from DB
    if (token) {
      try {
        const fullChat = await apiGetChatById(targetId);
        if (fullChat) {
          const loadedChat = {
            ...fullChat,
            id: fullChat.id || fullChat._id || targetId,
            _id: fullChat._id || fullChat.id || targetId,
            messages: Array.isArray(fullChat.messages) ? fullChat.messages : [],
            isLoading: false,
          };
          setCurrentChat(loadedChat);
          setChats((prev) =>
            prev.map((c) =>
              String(c.id || c._id) === String(targetId)
                ? { ...c, ...loadedChat }
                : c
            )
          );
        } else {
          setCurrentChat((prev) => (prev ? { ...prev, isLoading: false } : null));
        }
      } catch (err) {
        console.warn("apiGetChatById fetch warning:", err);
        setCurrentChat((prev) => (prev ? { ...prev, isLoading: false } : null));
      }
    }
  };

  const handleDeleteChat = async (chatToDelete) => {
    const chatId = chatToDelete.id || chatToDelete._id;
    deletedChatBackupRef.current = chatToDelete;

    // Optimistic UI removal
    setChats((prev) => prev.filter((c) => (c.id || c._id) !== chatId));
    if (currentChat && (currentChat.id || currentChat._id) === chatId) {
      setCurrentChat(null);
    }

    // Trigger toast with undo
    setToast({
      message: "Chat deleted",
      onUndo: () => {
        if (deletedChatBackupRef.current) {
          setChats((prev) => [deletedChatBackupRef.current, ...prev]);
          setCurrentChat(deletedChatBackupRef.current);
          setToast(null);
        }
      },
    });

    if (token) {
      try {
        await apiDeleteChat(chatId);
      } catch {
        /* ignore delete sync error */
      }
    } else {
      try {
        localStorage.removeItem(GUEST_STORAGE_KEY);
      } catch {
        /* storage unavailable */
      }
    }
  };

  // Convert uploaded attachments for AI payload
  const packAttachments = async (fileList) => {
    return Promise.all(
      fileList.map(async (item) => {
        const fileObj = { name: item.name, type: item.type };
        if (item.file && item.file.size < 5 * 1024 * 1024) {
          if (item.type.startsWith("image/")) {
            fileObj.dataUrl = await new Promise((res) => {
              const reader = new FileReader();
              reader.onload = () => res(reader.result);
              reader.onerror = () => res(null);
              reader.readAsDataURL(item.file);
            });
          } else if (
            /^text|json|javascript/.test(item.type) ||
            /\.(md|csv|py|js|html|css|txt)$/i.test(item.name)
          ) {
            fileObj.text = await new Promise((res) => {
              const reader = new FileReader();
              reader.onload = () => res(reader.result);
              reader.onerror = () => res(null);
              reader.readAsText(item.file);
            });
          }
        }
        return fileObj;
      })
    );
  };

  // ═══ SEND MESSAGE ═══
  const handleSendMessage = async (text, fileList = []) => {
    if ((!text && !fileList.length) || isWaiting || isStreaming) return;

    // Guard: if guest session has expired, require sign in / sign up
    const isGuestExpired =
      isAuthMandatory ||
      (!user && !token && (
        localStorage.getItem(GUEST_MANDATORY_KEY) === "true" ||
        sessionStorage.getItem(GUEST_MANDATORY_KEY) === "true"
      ));

    if (isGuestExpired) {
      setIsAuthMandatory(true);
      setAuthModalMode("in");
      setAuthModalOpen(true);
      return;
    }

    if (!user && !token) {
      const startTime = Number(
        localStorage.getItem(GUEST_TIMER_START_KEY) ||
        sessionStorage.getItem(GUEST_TIMER_START_KEY)
      );
      if (startTime && (Date.now() - startTime >= GUEST_ACCESS_DURATION_MS)) {
        try {
          localStorage.setItem(GUEST_MANDATORY_KEY, "true");
          sessionStorage.setItem(GUEST_MANDATORY_KEY, "true");
        } catch {
          /* storage error */
        }
        setIsAuthMandatory(true);
        setAuthModalMode("in");
        setAuthModalOpen(true);
        return;
      }
    }

    // 1. Instantly trigger optimistic AI waiting animation and show user message (0ms latency)
    setIsWaiting(true);
    setIsStreaming(false);
    setCurrentStreamingText("");
    targetTextRef.current = "";

    const newUserMsg = {
      role: "user",
      content: text,
      files: fileList.map((f) => ({ name: f.name, type: f.type, url: f.url })),
      attachments: [],
    };

    // Initialize or update current chat immediately
    let activeChat = currentChat;
    const isNew = !activeChat;
    if (isNew) {
      const generatedTitle = (text || fileList[0]?.name || "New Chat").slice(0, 42);
      const tempId = Date.now().toString();
      activeChat = {
        id: tempId,
        _id: tempId,
        title: generatedTitle,
        messages: [],
      };
      setChats((prev) => [activeChat, ...prev]);
    }

    const updatedMessages = [...(activeChat.messages || []), newUserMsg];
    activeChat = { ...activeChat, messages: updatedMessages };
    setCurrentChat(activeChat);

    abortControllerRef.current = new AbortController();

    // requestAnimationFrame throttled stream renderer
    let shownLength = 0;
    const tick = () => {
      const target = targetTextRef.current;
      if (shownLength < target.length) {
        shownLength += Math.max(3, Math.ceil((target.length - shownLength) / 4));
        if (shownLength > target.length) shownLength = target.length;
        setCurrentStreamingText(target.slice(0, shownLength));
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);

    // 2. Pack file attachments asynchronously while the animation is already running smoothly
    if (fileList && fileList.length > 0) {
      const packedFiles = await packAttachments(fileList);
      newUserMsg.attachments = packedFiles;
    }

    try {
      const apiPayload = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments,
      }));

      await askRock(
        apiPayload,
        (fullChunk) => {
          setIsWaiting(false);
          setIsStreaming(true);
          targetTextRef.current = fullChunk;
          if (shownLength === 0 && fullChunk.length > 0) {
            shownLength = Math.min(fullChunk.length, 3);
            setCurrentStreamingText(fullChunk.slice(0, shownLength));
          }
        },
        {
          signal: abortControllerRef.current.signal,
          chatId: activeChat.id || activeChat._id,
          onChatIdAssigned: (serverChatId) => {
            if (serverChatId) {
              const oldId = activeChat.id || activeChat._id;
              activeChat.id = serverChatId;
              activeChat._id = serverChatId;
              setCurrentChat((prev) => (prev ? { ...prev, id: serverChatId, _id: serverChatId } : prev));
              setChats((prev) =>
                prev.map((c) =>
                  (c.id === oldId || c._id === oldId || c.id === serverChatId || c._id === serverChatId)
                    ? { ...c, id: serverChatId, _id: serverChatId }
                    : c
                )
              );
            }
          },
        }
      );

      // Finish smooth text drain
      while (shownLength < targetTextRef.current.length) {
        shownLength = targetTextRef.current.length;
        setCurrentStreamingText(targetTextRef.current);
      }
    } catch (err) {
      if (err.guestExpired || err.status === 403) {
        try {
          localStorage.setItem(GUEST_MANDATORY_KEY, "true");
          sessionStorage.setItem(GUEST_MANDATORY_KEY, "true");
        } catch {
          /* storage error */
        }
        setIsAuthMandatory(true);
        setAuthModalMode("in");
        setAuthModalOpen(true);
        targetTextRef.current = "";
      } else if (err.name === "AbortError") {
        targetTextRef.current = targetTextRef.current || "(Reply cancelled)";
      } else {
        targetTextRef.current =
          "Couldn't reach ROCKGPT. Please check your connection and tap Regenerate.";
      }
      setCurrentStreamingText(targetTextRef.current);
    } finally {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      setIsWaiting(false);
      setIsStreaming(false);

      if (targetTextRef.current) {
        const finalAssistantMsg = {
          role: "assistant",
          content: targetTextRef.current,
        };

        const finalMessages = [...updatedMessages, finalAssistantMsg];
        const completedChat = {
          ...activeChat,
          id: activeChat.id || activeChat._id,
          _id: activeChat._id || activeChat.id,
          messages: finalMessages,
        };
        setCurrentChat(completedChat);
        setChats((prev) =>
          prev.map((c) => {
            const match =
              (c.id && (c.id === completedChat.id || c.id === completedChat._id)) ||
              (c._id && (c._id === completedChat.id || c._id === completedChat._id));
            return match ? completedChat : c;
          })
        );
      } else {
        setCurrentChat(activeChat);
      }
      setCurrentStreamingText("");
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleRegenerate = () => {
    if (!currentChat || !currentChat.messages.length || isWaiting || isStreaming) return;
    const msgs = [...currentChat.messages];
    if (msgs[msgs.length - 1].role === "assistant") {
      msgs.pop();
    }
    const lastUserMsg = msgs.pop();
    if (lastUserMsg) {
      setCurrentChat({ ...currentChat, messages: msgs });
      handleSendMessage(lastUserMsg.content, lastUserMsg.files || []);
    }
  };

  const handleEditUserMessage = (text) => {
    if (composerInputRef.current) {
      composerInputRef.current.value = text;
      composerInputRef.current.focus();
      composerInputRef.current.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  // ═══ AUTH MODAL ACTIONS ═══
  const clearGuestSessionLock = () => {
    setIsAuthMandatory(false);
    try {
      localStorage.removeItem(GUEST_MANDATORY_KEY);
      localStorage.removeItem(GUEST_TIMER_START_KEY);
      localStorage.removeItem(GUEST_TOKEN_KEY);
      sessionStorage.removeItem(GUEST_MANDATORY_KEY);
      sessionStorage.removeItem(GUEST_TIMER_START_KEY);
      sessionStorage.removeItem(GUEST_TOKEN_KEY);
      sessionStorage.removeItem(GUEST_PROMPTED_KEY);
    } catch {
      /* storage disabled */
    }
  };

  const handleOpenAuth = (mode = "in", mandatory = false) => {
    setAuthModalMode(mode);
    setIsAuthMandatory(mandatory);
    setAuthModalOpen(true);
    setMobileDrawerOpen(false);
  };

  const handleStayLoggedOut = async () => {
    try {
      sessionStorage.setItem(GUEST_PROMPTED_KEY, "true");
      localStorage.setItem(GUEST_PROMPTED_KEY, "true");
      const now = Date.now();
      localStorage.setItem(GUEST_TIMER_START_KEY, String(now));
      sessionStorage.setItem(GUEST_TIMER_START_KEY, String(now));

      // Fetch signed guest session token from backend
      try {
        const guestData = await apiInitGuestSession();
        if (guestData?.guestToken) {
          localStorage.setItem(GUEST_TOKEN_KEY, guestData.guestToken);
          sessionStorage.setItem(GUEST_TOKEN_KEY, guestData.guestToken);
        }
      } catch (tokenErr) {
        console.warn("Guest session token initialization warning:", tokenErr.message);
      }
    } catch {
      /* storage disabled */
    }
    setAuthModalOpen(false);
  };

  const handleSignIn = async (email, password, remember = true) => {
    const res = await apiSignIn(email, password);
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(USER_KEY, JSON.stringify(res.user));
    storage.setItem(TOKEN_KEY, res.token);
    clearGuestSessionLock();
    setUser(res.user);
    setToken(res.token);
    setAuthModalOpen(false);
    setIsWelcomeNewUser(false);
    setWelcomeUser(res.user);
  };

  const handleSignUp = async (name, email, password) => {
    const res = await apiSignUp(name, email, password);
    if (res?.user && res?.token) {
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      localStorage.setItem(TOKEN_KEY, res.token);
      clearGuestSessionLock();
      setUser(res.user);
      setToken(res.token);
      setIsWelcomeNewUser(true);
      setWelcomeUser(res.user);
    }
    return res;
  };

  const handleVerifyOtp = async (email, code) => {
    const res = await apiVerifyOtp(email, code);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    localStorage.setItem(TOKEN_KEY, res.token);
    clearGuestSessionLock();
    setUser(res.user);
    setToken(res.token);
    setAuthModalOpen(false);
    setIsWelcomeNewUser(true);
    setWelcomeUser(res.user);
  };

  const handleForgotPassword = async (email) => {
    return await apiForgotPassword(email);
  };

  const handleResetPassword = async (email, code, newPassword) => {
    const res = await apiResetPassword(email, code, newPassword);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    localStorage.setItem(TOKEN_KEY, res.token);
    clearGuestSessionLock();
    setUser(res.user);
    setToken(res.token);
    setAuthModalOpen(false);
    setIsWelcomeNewUser(false);
    setWelcomeUser(res.user);
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    const token =
      credentialResponse?.credential ||
      credentialResponse?.code ||
      credentialResponse?.token ||
      credentialResponse;

    const res = await apiGoogleAuth(token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    localStorage.setItem(TOKEN_KEY, res.token);
    clearGuestSessionLock();
    setUser(res.user);
    setToken(res.token);
    setAuthModalOpen(false);
    setIsWelcomeNewUser(false);
    setWelcomeUser(res.user);
  };

  const handleOpenLogoutConfirm = () => {
    setLogoutModalOpen(true);
    setMobileDrawerOpen(false);
  };

  const handleConfirmLogout = () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      setUser(null);
      setToken(null);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      clearGuestSessionLock();
      setCurrentChat(null);
      setChats([]);
      setToast({ message: "You have been logged out of your account." });
      setTimeout(() => setToast(null), 3000);
      setLogoutModalOpen(false);
      // Open initial authentication popup
      setAuthModalMode("in");
      setIsAuthMandatory(false);
      setAuthModalOpen(true);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const appClass = [
    sidebarCollapsed ? "collapsed" : "",
    mobileDrawerOpen ? "m-open" : "",
  ].filter(Boolean).join(" ");

  return (
    <>
      <Intro />

      <div id="app" className={appClass}>
        <Sidebar
          chats={chats}
          currentChat={currentChat}
          user={user}
          theme={theme}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onDeleteChat={handleDeleteChat}
          onToggleTheme={handleToggleTheme}
          onOpenAuth={handleOpenAuth}
          onLogout={handleOpenLogoutConfirm}
          busy={isWaiting || isStreaming}
        />

        {/* Dimmed mobile drawer backdrop */}
        <div
          id="back"
          onClick={() => setMobileDrawerOpen(false)}
          aria-hidden="true"
        />

        <div id="main">
          <Header
            onToggleSidebar={handleToggleSidebar}
            onNewChat={handleNewChat}
            busy={isWaiting || isStreaming}
          />

          <ChatList
            messages={currentChat?.messages || []}
            currentChat={currentChat}
            currentStreamingText={currentStreamingText}
            isStreaming={isStreaming}
            isWaiting={isWaiting}
            user={user}
            onSelectSuggestion={(suggestion) => handleSendMessage(suggestion, [])}
            onRegenerate={handleRegenerate}
            onEditUserMessage={handleEditUserMessage}
            scrollRef={scrollRef}
          />

          <Composer
            onSendMessage={handleSendMessage}
            onStopStreaming={handleStopStreaming}
            isStreaming={isStreaming}
            isWaiting={isWaiting}
            disabled={isAuthMandatory}
            onDisabledClick={() => {
              setIsAuthMandatory(true);
              setAuthModalMode("in");
              setAuthModalOpen(true);
            }}
            inputRef={composerInputRef}
          />
        </div>
      </div>

      {/* Lazy-Loaded Modals */}
      <React.Suspense fallback={null}>
        {authModalOpen && (
          <AuthModal
            isOpen={authModalOpen}
            initialMode={authModalMode}
            isMandatory={isAuthMandatory}
            onClose={() => {
              if (!isAuthMandatory) setAuthModalOpen(false);
            }}
            onStayLoggedOut={handleStayLoggedOut}
            onSignIn={handleSignIn}
            onSignUp={handleSignUp}
            onVerifyOtp={handleVerifyOtp}
            onForgotPassword={handleForgotPassword}
            onResetPassword={handleResetPassword}
            onGoogleSuccess={handleGoogleSuccess}
          />
        )}

        {Boolean(welcomeUser) && (
          <WelcomeModal
            isOpen={Boolean(welcomeUser)}
            user={welcomeUser}
            isNewUser={isWelcomeNewUser}
            onClose={() => setWelcomeUser(null)}
          />
        )}

        {logoutModalOpen && (
          <LogoutConfirmModal
            isOpen={logoutModalOpen}
            isLoggingOut={isLoggingOut}
            onClose={() => setLogoutModalOpen(false)}
            onConfirm={handleConfirmLogout}
          />
        )}
      </React.Suspense>

      {/* Undo Toast */}
      {toast && (
        <div className="rock-toast" role="alert">
          <span>{toast.message}</span>
          {toast.onUndo && (
            <button onClick={toast.onUndo} type="button">
              Undo
            </button>
          )}
        </div>
      )}
    </>
  );
}
