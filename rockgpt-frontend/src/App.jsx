import React, { useState, useEffect, useRef } from "react";
import Intro from "./components/Intro.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Header from "./components/Header.jsx";
import ChatList from "./components/ChatList.jsx";
import Composer from "./components/Composer.jsx";
const AuthModal = React.lazy(() => import("./components/AuthModal.jsx"));
const WelcomeModal = React.lazy(() => import("./components/WelcomeModal.jsx"));
import {
  askRock,
  pingServerHealth,
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

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState("in");
  const [welcomeUser, setWelcomeUser] = useState(null);
  const [isWelcomeNewUser, setIsWelcomeNewUser] = useState(false);

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

  // 1. Sync theme to document & meta tags
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
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

  // 3. Ping server health to wake up Render free tier on mount
  useEffect(() => {
    pingServerHealth();
  }, []);

  // 4. Load chats on mount and when user/token changes
  useEffect(() => {
    async function loadUserChats() {
      if (token) {
        try {
          const remoteChats = await apiGetChats();
          setChats(remoteChats || []);
        } catch {
          setChats([]);
        }
      } else {
        try {
          const local = localStorage.getItem(GUEST_STORAGE_KEY);
          setChats(local ? JSON.parse(local) : []);
        } catch {
          setChats([]);
        }
      }
    }
    loadUserChats();
  }, [token]);

  // 5. Save guest chats to localStorage
  useEffect(() => {
    if (!token && chats.length > 0) {
      try {
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(chats.slice(0, 40)));
      } catch {
        /* storage quota exceeded */
      }
    }
  }, [chats, token]);

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
        const updated = chats.filter((c) => (c.id || c._id) !== chatId);
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(updated));
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
        shownLength += Math.max(1, Math.ceil((target.length - shownLength) / 20));
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
      if (err.name === "AbortError") {
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

      const finalAssistantMsg = {
        role: "assistant",
        content: targetTextRef.current || "(No response)",
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
  const handleOpenAuth = (mode = "in") => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
    setMobileDrawerOpen(false);
  };

  const handleSignIn = async (email, password, remember = true) => {
    const res = await apiSignIn(email, password);
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(USER_KEY, JSON.stringify(res.user));
    storage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    setToken(res.token);
    setAuthModalOpen(false);
    setIsWelcomeNewUser(false);
    setWelcomeUser(res.user);
  };

  const handleSignUp = async (name, email, password) => {
    await apiSignUp(name, email, password);
  };

  const handleVerifyOtp = async (email, code) => {
    const res = await apiVerifyOtp(email, code);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    setToken(res.token);
    setAuthModalOpen(false);
    setIsWelcomeNewUser(true);
    setWelcomeUser(res.user);
  };

  const handleForgotPassword = async (email) => {
    await apiForgotPassword(email);
  };

  const handleResetPassword = async (email, code, newPassword) => {
    const res = await apiResetPassword(email, code, newPassword);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    localStorage.setItem(TOKEN_KEY, res.token);
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
    setUser(res.user);
    setToken(res.token);
    setAuthModalOpen(false);
    setIsWelcomeNewUser(false);
    setWelcomeUser(res.user);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    setCurrentChat(null);
    setChats([]);
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
          onLogout={handleLogout}
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
            onClose={() => setAuthModalOpen(false)}
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
