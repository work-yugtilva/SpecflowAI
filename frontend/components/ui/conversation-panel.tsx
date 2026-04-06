"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@/lib/use-conversation";
import type { Message } from "@/lib/use-conversation";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConversationPanelProps {
  sessionId: string | null;
  contextKeys?: string[];
  mode: "sidebar" | "float";
  onClose?: () => void;
  isOpen?: boolean;
}

// ─── Markdown-lite renderer (bold + inline code — pure React, no innerHTML) ──

type InlineSegment =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "code"; value: string };

function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    const idx = m.index ?? 0;
    if (idx > last) {
      segments.push({ kind: "text", value: text.slice(last, idx) });
    }
    if (m[1] !== undefined) {
      segments.push({ kind: "bold", value: m[1] });
    } else if (m[2] !== undefined) {
      segments.push({ kind: "code", value: m[2] });
    }
    last = idx + m[0].length;
  }
  if (last < text.length) {
    segments.push({ kind: "text", value: text.slice(last) });
  }
  return segments;
}

function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, li) => (
        <span key={li}>
          {li > 0 && <br />}
          {parseInline(line).map((seg, si) => {
            if (seg.kind === "bold") {
              return <strong key={si} style={{ fontWeight: 650, color: "#0D0D0D" }}>{seg.value}</strong>;
            }
            if (seg.kind === "code") {
              return (
                <code
                  key={si}
                  style={{
                    background: "rgba(61,107,94,0.10)",
                    color: "#3D6B5E",
                    padding: "1px 5px",
                    borderRadius: 4,
                    fontFamily: "'Courier New', monospace",
                    fontSize: 12,
                  }}
                >
                  {seg.value}
                </code>
              );
            }
            return <span key={si}>{seg.value}</span>;
          })}
        </span>
      ))}
    </>
  );
}

// ─── Context key config ───────────────────────────────────────────────────────

const CONTEXT_KEY_LABELS: Record<string, string> = {
  problems: "Problems",
  features: "Features",
  decompositions: "Decompose",
  tasks: "Tasks",
  prd: "PRD",
};

const SUGGESTED_PROMPTS = [
  "What are the biggest risks in this PRD?",
  "Which features have the weakest evidence?",
  "Summarize the implementation plan",
  "What's missing from the success metrics?",
];

// ─── Streaming dots ───────────────────────────────────────────────────────────

function StreamingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center", padding: "0 2px" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: "#9E9E9E",
            display: "inline-block",
            animation: `chatDot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message, isStreaming }: { message: Message; isStreaming: boolean }) {
  const isUser = message.role === "user";
  const isStreamingThisMessage = isStreaming && message.id === "streaming";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        gap: 2,
      }}
    >
      <div
        style={{
          maxWidth: "85%",
          padding: "9px 13px",
          borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
          background: isUser ? "#E8561B" : "#FFFFFF",
          border: isUser ? "none" : "1px solid #E4DDD4",
          fontSize: 13,
          lineHeight: 1.6,
          color: isUser ? "#FFFFFF" : "#0D0D0D",
          fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
          wordBreak: "break-word",
          boxShadow: isUser
            ? "0 2px 8px rgba(232,86,27,0.2)"
            : "0 1px 4px rgba(0,0,0,0.04)",
        }}
      >
        {isUser ? (
          message.content
        ) : (
          <>
            {message.content ? <MarkdownLite text={message.content} /> : null}
            {isStreamingThisMessage && (
              <>{message.content ? " " : null}<StreamingDots /></>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Panel content (shared between sidebar and float drawer) ──────────────────

function PanelContent({
  sessionId,
  activeContextKeys,
  allContextKeys,
  onToggleKey,
  onClose,
  showClose,
}: {
  sessionId: string | null;
  activeContextKeys: string[];
  allContextKeys: string[];
  onToggleKey: (key: string) => void;
  onClose?: () => void;
  showClose: boolean;
}) {
  const { messages, isStreaming, error, sendMessage, clearMessages, abortStream } =
    useConversation({ sessionId, contextKeys: activeContextKeys, maxHistory: 20 });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await sendMessage(text);
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
  };

  return (
    <>
      <style>{`
        @keyframes chatDot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: "14px 16px 12px",
          borderBottom: "1px solid #E4DDD4",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "#E8561B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#0D0D0D",
              fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            Ask SpecFlow
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              title="Clear chat"
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: 4, borderRadius: 6, color: "#9E9E9E",
                display: "flex", alignItems: "center",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </button>
          )}
          {showClose && onClose && (
            <button
              onClick={onClose}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: 4, borderRadius: 6, color: "#9E9E9E",
                display: "flex", alignItems: "center",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Context pills */}
      {allContextKeys.length > 0 && (
        <div
          style={{
            padding: "10px 14px 8px",
            display: "flex",
            flexWrap: "wrap",
            gap: 5,
            borderBottom: "1px solid #F0EBE4",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "#9E9E9E",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              alignSelf: "center",
              marginRight: 2,
            }}
          >
            Context
          </span>
          {allContextKeys.map((key) => {
            const active = activeContextKeys.includes(key);
            return (
              <button
                key={key}
                onClick={() => onToggleKey(key)}
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  padding: "2px 9px",
                  borderRadius: 20,
                  border: active ? "1.5px solid #E8561B" : "1.5px solid #E4DDD4",
                  background: active ? "rgba(232,86,27,0.08)" : "#FFFFFF",
                  color: active ? "#E8561B" : "#9E9E9E",
                  cursor: "pointer",
                  fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                  transition: "all 0.15s ease",
                }}
              >
                {CONTEXT_KEY_LABELS[key] ?? key}
              </button>
            );
          })}
        </div>
      )}

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 14px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {messages.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p
              style={{
                fontSize: 12,
                color: "#9E9E9E",
                textAlign: "center",
                margin: "0 0 10px",
                fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
              }}
            >
              Try asking...
            </p>
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                style={{
                  textAlign: "left",
                  background: "#F8F4EF",
                  border: "1px solid #E4DDD4",
                  borderRadius: 10,
                  padding: "9px 12px",
                  fontSize: 12,
                  color: "#3D3D3D",
                  cursor: "pointer",
                  fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                  lineHeight: 1.5,
                  transition: "border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#E8561B";
                  (e.currentTarget as HTMLElement).style.background = "rgba(232,86,27,0.04)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#E4DDD4";
                  (e.currentTarget as HTMLElement).style.background = "#F8F4EF";
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} isStreaming={isStreaming} />
          ))
        )}

        {error && (
          <div
            style={{
              fontSize: 12,
              color: "#DC2626",
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 8,
              padding: "8px 12px",
              fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
            }}
          >
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "10px 12px 12px", borderTop: "1px solid #E4DDD4", flexShrink: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            background: "#F8F4EF",
            border: "1.5px solid #E4DDD4",
            borderRadius: 12,
            padding: "8px 10px 8px 12px",
            transition: "border-color 0.15s",
          }}
          onFocusCapture={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#E8561B";
          }}
          onBlurCapture={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#E4DDD4";
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? "Waiting for response..." : "Ask anything..."}
            disabled={isStreaming}
            rows={1}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              resize: "none",
              fontSize: 13,
              color: "#0D0D0D",
              fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
              lineHeight: 1.5,
              minHeight: 20,
              maxHeight: 80,
              overflowY: "auto",
            }}
          />
          <button
            onClick={isStreaming ? abortStream : handleSend}
            disabled={!isStreaming && !input.trim()}
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              border: "none",
              background: isStreaming
                ? "rgba(232,86,27,0.12)"
                : input.trim()
                ? "#E8561B"
                : "#E4DDD4",
              color: isStreaming ? "#E8561B" : input.trim() ? "#FFFFFF" : "#9E9E9E",
              cursor: !isStreaming && !input.trim() ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "background 0.15s, color 0.15s",
            }}
            title={isStreaming ? "Stop" : "Send"}
          >
            {isStreaming ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
        <div
          style={{
            fontSize: 10,
            color: "#C0B8B0",
            textAlign: "center",
            marginTop: 6,
            fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
          }}
        >
          Enter to send · Shift+Enter for newline
        </div>
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConversationPanel({
  sessionId,
  contextKeys: initialContextKeys = [],
  mode,
  onClose,
  isOpen,
}: ConversationPanelProps) {
  const [activeContextKeys, setActiveContextKeys] = useState<string[]>(initialContextKeys);
  const [floatOpen, setFloatOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const toggleKey = useCallback((key: string) => {
    setActiveContextKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  // Close float drawer on outside click
  useEffect(() => {
    if (mode !== "float" || !floatOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setFloatOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mode, floatOpen]);

  // ── Sidebar mode ──
  if (mode === "sidebar") {
    return (
      <div
        style={{
          width: isOpen ? 280 : 0,
          flexShrink: 0,
          overflow: "hidden",
          borderLeft: isOpen ? "1px solid #E4DDD4" : "none",
          background: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
          fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
        }}
      >
        {isOpen && (
          <PanelContent
            sessionId={sessionId}
            activeContextKeys={activeContextKeys}
            allContextKeys={initialContextKeys}
            onToggleKey={toggleKey}
            onClose={onClose}
            showClose={true}
          />
        )}
      </div>
    );
  }

  // ── Float mode ──
  return (
    <div
      ref={drawerRef}
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 50,
        fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
      }}
    >
      {floatOpen && (
        <div
          style={{
            position: "absolute",
            bottom: 64,
            right: 0,
            width: 360,
            height: 480,
            background: "#FFFFFF",
            borderRadius: 16,
            border: "1px solid #E4DDD4",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "chatDrawerIn 0.2s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <style>{`
            @keyframes chatDrawerIn {
              from { opacity: 0; transform: translateY(12px) scale(0.97); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
          <PanelContent
            sessionId={sessionId}
            activeContextKeys={activeContextKeys}
            allContextKeys={initialContextKeys}
            onToggleKey={toggleKey}
            onClose={() => setFloatOpen(false)}
            showClose={true}
          />
        </div>
      )}

      <button
        onClick={() => setFloatOpen((prev) => !prev)}
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "#E8561B",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(232,86,27,0.35), 0 2px 4px rgba(0,0,0,0.1)",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "scale(1.08)";
          (e.currentTarget as HTMLElement).style.boxShadow =
            "0 6px 20px rgba(232,86,27,0.45), 0 2px 6px rgba(0,0,0,0.12)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "scale(1)";
          (e.currentTarget as HTMLElement).style.boxShadow =
            "0 4px 16px rgba(232,86,27,0.35), 0 2px 4px rgba(0,0,0,0.1)";
        }}
        title="Ask SpecFlow"
        aria-label="Open conversation"
      >
        {floatOpen ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
