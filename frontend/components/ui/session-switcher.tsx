"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSessionStore } from "@/lib/store/session-store";
import { useActiveSession } from "@/lib/active-session-context";

export function SessionSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { activeSessionId, selectSession } = useActiveSession();
  const sessions = useSessionStore((s) => s.sessions);
  const isSyncing = useSessionStore((s) => s.isSyncing);
  const hydrateSession = useSessionStore((s) => s.hydrateSession);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelect = useCallback(
    (sessionId: string | null) => {
      selectSession(sessionId);
      if (sessionId) hydrateSession(sessionId);
      setOpen(false);
    },
    [selectSession, hydrateSession]
  );

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          padding: "5px 8px",
          borderRadius: 8,
          fontSize: 12,
          fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
          color: activeSession ? "#0D0D0D" : "#9B9189",
          background: open ? "rgba(0,0,0,0.04)" : "transparent",
          border: "1px solid #E4DDD4",
          cursor: "pointer",
          transition: "background 120ms ease",
          minHeight: 32,
        }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.background = "rgba(0,0,0,0.03)";
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.background = "transparent";
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            textAlign: "left",
          }}
        >
          {activeSession
            ? activeSession.session_name
            : "No session selected"}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 150ms ease",
          }}
        >
          <path d="M3 4.5L6 7.5L9 4.5" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "#FFFFFF",
            border: "1px solid #E4DDD4",
            borderRadius: 10,
            boxShadow: "0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)",
            maxHeight: 240,
            overflowY: "auto",
            padding: 4,
          }}
        >
          {/* No session option */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "6px 8px",
              borderRadius: 6,
              fontSize: 12,
              fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
              color: !activeSessionId ? "#E8561B" : "#9B9189",
              fontWeight: !activeSessionId ? 600 : 400,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              transition: "background 100ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0,0,0,0.04)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            No session
          </button>

          {sessions.length === 0 && !isSyncing && (
            <div
              style={{
                padding: "8px",
                fontSize: 11,
                color: "#9B9189",
                textAlign: "center",
              }}
            >
              No sessions yet
            </div>
          )}

          {isSyncing && sessions.length === 0 && (
            <div
              style={{
                padding: "8px",
                fontSize: 11,
                color: "#9B9189",
                textAlign: "center",
              }}
            >
              Loading...
            </div>
          )}

          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => handleSelect(session.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 8px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                  color: isActive ? "#E8561B" : "#0D0D0D",
                  fontWeight: isActive ? 600 : 400,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "background 100ms ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 4,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(0,0,0,0.04)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                >
                  {session.session_name}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: "#9B9189",
                    flexShrink: 0,
                  }}
                >
                  {session.id.slice(0, 6)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
