import React, { useRef, useState, useEffect } from "react";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit

export default function Composer({
  onSendMessage,
  onStopStreaming,
  isStreaming = false,
  isWaiting = false,
  inputRef,
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);

  // Sync external inputRef with internal textareaRef
  useEffect(() => {
    if (inputRef) {
      inputRef.current = textareaRef.current;
    }
  }, [inputRef]);

  // Web Speech API recognition setup
  const hasSpeech =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const toggleRecording = () => {
    if (!hasSpeech) return;

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRec();
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";

    const baseText = text;

    rec.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join("");
      setText(`${baseText} ${transcript}`.trim());
      adjustTextareaHeight();
    };

    rec.onerror = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    rec.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = rec;
    rec.start();
    setIsRecording(true);
  };

  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  const handleInputChange = (e) => {
    setText(e.target.value);
    adjustTextareaHeight();
  };

  const handleFileSelection = (fileList) => {
    if (!fileList || !fileList.length) return;

    const newFiles = [];
    for (const f of Array.from(fileList)) {
      if (f.size > MAX_FILE_SIZE) {
        alert(`File "${f.name}" exceeds the 5MB size limit.`);
        continue;
      }
      const isMedia = f.type.startsWith("image/") || f.type.startsWith("video/");
      const url = isMedia ? URL.createObjectURL(f) : "";
      newFiles.push({
        name: f.name,
        type: f.type || "",
        size: f.size,
        file: f,
        url,
      });
    }

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (idxToRemove) => {
    setFiles((prev) => {
      const target = prev[idxToRemove];
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((_, idx) => idx !== idxToRemove);
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // Desktop sends on Enter; Mobile adds new line
      const isMobile =
        typeof window !== "undefined" &&
        window.matchMedia("(pointer: coarse)").matches;

      if (!isMobile) {
        e.preventDefault();
        handleSubmit();
      }
    }
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if ((!trimmed && !files.length) || isWaiting || isStreaming) return;

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
    }

    onSendMessage(trimmed, files);
    setText("");
    setFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handlePaste = (e) => {
    const clipboardFiles = e.clipboardData?.files;
    if (clipboardFiles && clipboardFiles.length > 0) {
      e.preventDefault();
      handleFileSelection(clipboardFiles);
    }
  };

  const hasContent = text.trim().length > 0 || files.length > 0;
  const isBusy = isWaiting || isStreaming;

  return (
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
          handleFileSelection(e.dataTransfer.files);
        }}
      >
        {/* Attachment preview tray */}
        {files.length > 0 && (
          <div id="tray">
            {files.map((f, idx) => (
              <div key={idx} className="pv">
                {f.type.startsWith("image/") ? (
                  <img src={f.url} alt={f.name} />
                ) : f.type.startsWith("video/") ? (
                  <video src={f.url} muted playsInline />
                ) : (
                  <div className="fc">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5" />
                    </svg>
                    <span>{f.name}</span>
                  </div>
                )}
                <i onClick={() => removeFile(idx)} role="button" title="Remove attachment">
                  ×
                </i>
              </div>
            ))}
          </div>
        )}

        <div className="row">
          {/* File picker button */}
          <button
            className="ib"
            id="clip"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach files"
            title="Attach images, documents, or code"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>

          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            multiple
            hidden
            onChange={(e) => {
              handleFileSelection(e.target.files);
              e.target.value = "";
            }}
            accept="image/*,video/*,.pdf,.txt,.md,.csv,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.js,.py,.html,.css"
          />

          {/* Auto-resizing textarea */}
          <textarea
            ref={textareaRef}
            id="input"
            rows="1"
            placeholder="Ask RockGPT…"
            enterKeyHint="send"
            value={text}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
          />

          {/* Mic voice input */}
          {hasSpeech && (
            <button
              className={`ib ${isRecording ? "rec" : ""}`}
              id="mic"
              type="button"
              onClick={toggleRecording}
              aria-label="Voice input"
              title={isRecording ? "Listening... tap to stop" : "Voice input"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0014 0M12 18v3" />
              </svg>
            </button>
          )}

          {/* Send or Stop button */}
          {isStreaming ? (
            <button
              id="send"
              className="on"
              type="button"
              onClick={onStopStreaming}
              aria-label="Stop generation"
              title="Stop generation"
              style={{ background: "var(--inv)", color: "var(--invt)" }}
            >
              {/* Square Stop Icon */}
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              id="send"
              className={hasContent && !isBusy ? "on" : ""}
              type="button"
              onClick={handleSubmit}
              disabled={!hasContent || isBusy}
              aria-label="Send message"
              title="Send"
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="note">ROCKGPT can make mistakes. Check important info.</div>
    </footer>
  );
}
