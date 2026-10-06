import React, { useRef, useEffect } from "react";
import Logo from "./Logo.jsx";

const MoonIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
  </svg>
);

const SunIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export default function Sidebar({
  chats = [],
  currentChat = null,
  user = null,
  theme = "dark",
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onToggleTheme,
  onOpenAuth,
  onLogout,
  busy = false,
}) {
  const rsRef = useRef(null);

  // Desktop drag resizer for sidebar width (240px - 420px)
  useEffect(() => {
    const rs = rsRef.current;
    if (!rs) return;

    let dragging = false;

    const handlePointerDown = (e) => {
      dragging = true;
      document.getElementById("app")?.classList.add("drag");
      rs.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e) => {
      if (!dragging) return;
      const newWidth = Math.min(420, Math.max(240, e.clientX));
      document.documentElement.style.setProperty("--sw", `${newWidth}px`);
    };

    const handlePointerUp = (e) => {
      if (dragging) {
        dragging = false;
        document.getElementById("app")?.classList.remove("drag");
        try {
          rs.releasePointerCapture(e.pointerId);
        } catch {}
      }
    };

    rs.addEventListener("pointerdown", handlePointerDown);
    rs.addEventListener("pointermove", handlePointerMove);
    rs.addEventListener("pointerup", handlePointerUp);
    rs.addEventListener("pointercancel", handlePointerUp);

    return () => {
      rs.removeEventListener("pointerdown", handlePointerDown);
      rs.removeEventListener("pointermove", handlePointerMove);
      rs.removeEventListener("pointerup", handlePointerUp);
      rs.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  return (
    <aside id="side">
      <div className="sin">
        <div className="brand">
          <Logo size={26} />
          <span>ROCKGPT</span>
        </div>

        <button
          className="btn"
          id="new"
          onClick={onNewChat}
          disabled={busy}
          title={busy ? "Generating reply..." : "Start a fresh chat"}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New chat
        </button>

        <div id="hist">
          {chats.length > 0 && <div className="hl">Recent</div>}
          {chats.map((c) => {
            const isSelected = currentChat && (currentChat.id === c.id || currentChat._id === c._id);
            return (
              <div
                key={c.id || c._id}
                className={`it ${isSelected ? "on" : ""}`}
                onClick={() => onSelectChat(c)}
              >
                <span>{c.title || "Untitled Conversation"}</span>
                <b
                  title="Delete chat"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChat(c);
                  }}
                >
                  ✕
                </b>
              </div>
            );
          })}
        </div>

        <div className="sfoot">
          <div className="theme">
            <span className="tl">
              {theme === "light" ? <SunIcon size={17} /> : <MoonIcon size={17} />}
              Theme
            </span>
            <div className="seg" id="tseg">
              <button
                className={theme === "light" ? "on" : ""}
                onClick={() => onToggleTheme("light")}
                type="button"
                aria-label="Light mode"
              >
                <SunIcon size={15} /> Light
              </button>
              <button
                className={theme === "dark" ? "on" : ""}
                onClick={() => onToggleTheme("dark")}
                type="button"
                aria-label="Dark mode"
              >
                <MoonIcon size={15} /> Dark
              </button>
            </div>
          </div>

          <div id="acct">
            {user ? (
              <div className="me">
                <span className="av">
                  {(user.name || user.email || "?")[0].toUpperCase()}
                </span>
                <div>
                  <span>{user.name || "Member"}</span>
                  <small>{user.email}</small>
                </div>
                <button onClick={onLogout} title="Log out">
                  Log out
                </button>
              </div>
            ) : (
              <div className="auth">
                <button onClick={() => onOpenAuth("in")} type="button">
                  Log in
                </button>
                <button
                  className="fill"
                  onClick={() => onOpenAuth("up")}
                  type="button"
                >
                  Sign up
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div id="rs" ref={rsRef} title="Drag to resize sidebar" />
    </aside>
  );
}
