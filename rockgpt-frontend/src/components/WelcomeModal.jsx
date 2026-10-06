import React, { useEffect, useState } from "react";
import Logo from "./Logo.jsx";

export default function WelcomeModal({
  isOpen = false,
  user = null,
  onClose,
  isNewUser = false,
}) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setClosing(false);

    // Auto-dismiss after 3.4 seconds
    const timer = setTimeout(() => {
      handleDismiss();
    }, 3400);

    const handleKeyDown = (e) => {
      if (e.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDismiss = () => {
    setClosing(true);
    setTimeout(() => {
      if (onClose) onClose();
      setClosing(false);
    }, 350);
  };

  const displayName = user?.name
    ? user.name.split(" ")[0]
    : user?.email
    ? user.email.split("@")[0]
    : "Member";

  return (
    <div
      className={`welcome-overlay ${closing ? "closing" : ""}`}
      onClick={(e) => {
        if (e.target.classList.contains("welcome-overlay")) handleDismiss();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to RockGPT"
    >
      <div className={`welcome-card ${closing ? "closing" : ""}`}>
        <div className="welcome-glow-border" />

        {/* Animated RockGPT Vector Logo */}
        <div className="welcome-logo-wrap">
          <Logo size={52} draw />
        </div>

        {/* Headline */}
        <h2 className="welcome-title">Welcome to RockGPT</h2>

        {/* Subtitle */}
        <p className="welcome-subtitle">
          {isNewUser
            ? `Your account has been created successfully, ${displayName}! Enjoy unlimited intelligence, vision, and real-time streaming.`
            : `Welcome back, ${displayName}! All your chats, memories, and preferences are synchronized and ready.`}
        </p>

        {/* Status Badge */}
        <div className="welcome-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Verified &bull; Cloud Sync Active</span>
        </div>

        {/* Action Button */}
        <button
          className="welcome-btn"
          type="button"
          onClick={handleDismiss}
        >
          Start Chatting &rarr;
        </button>
      </div>
    </div>
  );
}
