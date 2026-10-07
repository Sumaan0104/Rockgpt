import { useState } from "react";

export function NewChatButton({ onClick, disabled = false, className = "" }) {
  const [popped, setPopped] = useState(false);

  const handleClick = () => {
    if (disabled) return;
    setPopped(true);
    setTimeout(() => setPopped(false), 600);
    if (onClick) onClick();
  };

  return (
    <button
      className={`new-top ${popped ? "pop" : ""} ${className}`}
      onClick={handleClick}
      disabled={disabled}
      aria-label="Start a new chat"
      title={disabled ? "Please wait for response to finish" : "Start a new chat"}
      style={{ opacity: disabled ? 0.6 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
    >
      <span className="nt-i">
        <svg viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
      <span className="nt-l">New chat</span>
    </button>
  );
}

export default function Header({ onToggleSidebar, onNewChat, busy = false }) {
  return (
    <header>
      <button
        className="ib"
        id="menu"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
      >
        <svg viewBox="0 0 24 24">
          <path d="M4 7h16M4 12h10M4 17h16" />
        </svg>
      </button>

      <h1>ROCKGPT</h1>

      <NewChatButton onClick={onNewChat} disabled={busy} />
    </header>
  );
}
