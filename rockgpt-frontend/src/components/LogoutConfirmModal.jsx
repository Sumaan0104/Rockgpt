import { useEffect, useState, useCallback } from "react";

export default function LogoutConfirmModal({
  isOpen = false,
  onClose,
  onConfirm,
  isLoggingOut = false,
}) {
  const [closing, setClosing] = useState(false);

  const handleCancel = useCallback(() => {
    if (isLoggingOut) return;
    setClosing(true);
    setTimeout(() => {
      if (onClose) onClose();
      setClosing(false);
    }, 200);
  }, [isLoggingOut, onClose]);

  const handleLogout = () => {
    if (isLoggingOut) return;
    if (onConfirm) onConfirm();
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isLoggingOut) {
        handleCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoggingOut, handleCancel]);

  if (!isOpen) return null;

  return (
    <div
      className={`logout-overlay ${closing ? "closing" : ""}`}
      onClick={(e) => {
        if (e.target.classList.contains("logout-overlay") && !isLoggingOut) {
          handleCancel();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-confirm-title"
      aria-describedby="logout-confirm-desc"
    >
      <div className={`logout-card ${closing ? "closing" : ""}`}>
        <div className="logout-icon-wrap" aria-hidden="true">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </div>

        <h3 id="logout-confirm-title" className="logout-title">
          Are you sure you want to log out?
        </h3>

        <p id="logout-confirm-desc" className="logout-desc">
          You will be logged out of your ROCKGPT account. Do you want to continue?
        </p>

        <div className="logout-actions">
          <button
            type="button"
            className="logout-btn-cancel"
            onClick={handleCancel}
            disabled={isLoggingOut}
          >
            Cancel
          </button>
          <button
            type="button"
            className="logout-btn-confirm"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? "Logging out..." : "Log Out"}
          </button>
        </div>
      </div>
    </div>
  );
}
