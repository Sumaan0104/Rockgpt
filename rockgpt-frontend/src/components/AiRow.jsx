import React, { useState } from "react";
import Logo from "./Logo.jsx";
import MarkdownView from "./MarkdownView.jsx";

export default function AiRow({
  content = "",
  isStreaming = false,
  isWaiting = false,
  quiet = false,
  onRegenerate,
  canRegenerate = false,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyAll = () => {
    if (!content) return;
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const markClass = isWaiting || isStreaming ? "live" : !quiet ? "done" : "";

  return (
    <div className={`msg ai-msg ${quiet ? "quiet-msg" : ""}`}>
      <div className={`ai-mark ${markClass}`} aria-hidden="true">
        <Logo className="ai-logo" />
      </div>

      <div className="ai-content">
        <div className="ai-header-row">
          <div className={`ai-mark-inline ${markClass}`} aria-hidden="true">
            <Logo className="ai-logo" />
          </div>
          <div className="ai-name">ROCKGPT</div>
        </div>

        {isWaiting && !content ? (
          <div className="body">
            <span className="thinking">
              <i />
              <i />
              <i />
            </span>
          </div>
        ) : (
          <div className="body fadein">
            <MarkdownView content={content} />
            {isStreaming && <span className="caret" />}
          </div>
        )}

        {/* Message action buttons */}
        {!isStreaming && !isWaiting && content && (
          <div className="msg-actions">
            <button
              className="msg-act-btn"
              onClick={handleCopyAll}
              type="button"
              title="Copy entire response"
            >
              {copied ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  <span>Copy</span>
                </>
              )}
            </button>

            {canRegenerate && onRegenerate && (
              <button
                className="msg-act-btn"
                onClick={onRegenerate}
                type="button"
                title="Regenerate this response"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38l5.67-5.19" />
                </svg>
                <span>Regenerate</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
