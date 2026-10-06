import React, { useEffect, useRef } from "react";
import Logo from "./Logo.jsx";
import AiRow from "./AiRow.jsx";

const SUGGESTIONS = [
  "Plan my day",
  "Help me learn coding",
  "Give me a study tip",
];

export default function ChatList({
  messages = [],
  currentChat = null,
  currentStreamingText = "",
  isStreaming = false,
  isWaiting = false,
  user = null,
  onSelectSuggestion,
  onRegenerate,
  onEditUserMessage,
  scrollRef,
}) {
  const listRef = useRef(null);

  // Auto-scroll when new content arrives, only if already near bottom (< 150px)
  useEffect(() => {
    const sc = scrollRef?.current;
    if (!sc) return;

    const isNearBottom =
      sc.scrollHeight - sc.scrollTop - sc.clientHeight < 150;

    if (isNearBottom || isWaiting) {
      sc.scrollTo({
        top: sc.scrollHeight,
        behavior: isStreaming ? "auto" : "smooth",
      });
    }
  }, [messages, currentStreamingText, isWaiting, isStreaming, scrollRef]);

  const isEmpty = messages.length === 0 && !isWaiting && !isStreaming;

  return (
    <main id="sc" ref={scrollRef}>
      {currentChat?.isLoading ? (
        <div id="empty" style={{ opacity: 0.85 }}>
          <div id="eLogo">
            <Logo size={64} />
          </div>
          <div style={{ marginTop: "16px", color: "var(--muted)", fontSize: "14px" }}>
            Loading conversation...
          </div>
        </div>
      ) : isEmpty ? (
        <div id="empty">
          <div id="eLogo">
            <Logo draw size={96} />
          </div>
          <h2 id="hello">
            {currentChat && currentChat.title
              ? currentChat.title
              : user
              ? `Welcome back, ${user.name ? user.name.split(" ")[0] : "there"}`
              : "How can I help you today?"}
          </h2>
          {currentChat && currentChat.title ? (
            <p style={{ color: "var(--muted)", fontSize: "14px", marginTop: "8px" }}>
              No messages recorded yet. Send a message below to continue.
            </p>
          ) : (
            <div className="chips">
              {SUGGESTIONS.map((s, idx) => (
                <button
                  key={s}
                  className="chip"
                  onClick={() => onSelectSuggestion(s)}
                  type="button"
                  style={{ animationDelay: `${0.4 + idx * 0.1}s` }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div id="list" ref={listRef}>
          {messages.map((m, idx) => {
            if (m.role === "user") {
              const isLastUserMsg =
                idx === messages.length - 1 ||
                (idx === messages.length - 2 &&
                  messages[messages.length - 1].role === "assistant");

              return (
                <div key={idx} className="msg user">
                  {m.files && m.files.length > 0 && (
                    <div className="att">
                      {m.files.map((f, fIdx) => (
                        <div key={fIdx} className="att-item">
                          {f.url && f.type?.startsWith("image/") ? (
                            <img src={f.url} alt={f.name || "Uploaded image"} />
                          ) : f.url && f.type?.startsWith("video/") ? (
                            <video src={f.url} controls playsInline />
                          ) : (
                            <div className="fc">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5" />
                              </svg>
                              <span>{f.name}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {m.content && <div className="bub">{m.content}</div>}

                  {isLastUserMsg && onEditUserMessage && (
                    <button
                      className="edit-user-btn"
                      onClick={() => onEditUserMessage(m.content)}
                      type="button"
                      title="Edit this message"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      <span>Edit</span>
                    </button>
                  )}
                </div>
              );
            }

            const isLastMsg = idx === messages.length - 1;
            return (
              <AiRow
                key={idx}
                content={m.content}
                quiet={m.quiet}
                isStreaming={false}
                isWaiting={false}
                canRegenerate={isLastMsg && !isStreaming}
                onRegenerate={onRegenerate}
              />
            );
          })}

          {/* Currently streaming or waiting AI response */}
          {(isWaiting || isStreaming) && (
            <AiRow
              content={currentStreamingText}
              isStreaming={isStreaming}
              isWaiting={isWaiting}
              quiet={false}
            />
          )}
        </div>
      )}
    </main>
  );
}
