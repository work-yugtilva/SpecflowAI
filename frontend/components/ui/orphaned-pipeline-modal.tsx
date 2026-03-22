"use client";

import { useState, useCallback } from "react";
import { useSessionStore } from "@/lib/store/session-store";
import { useActiveSession } from "@/lib/active-session-context";

interface OrphanedPipelineModalProps {
  open: boolean;
  onClose: () => void;
  pipelineOutput: Record<string, unknown> | null;
}

export function OrphanedPipelineModal({
  open,
  onClose,
  pipelineOutput,
}: OrphanedPipelineModalProps) {
  const [sessionName, setSessionName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createSession = useSessionStore((s) => s.createSession);
  const { selectSession } = useActiveSession();

  const handleCreate = useCallback(async () => {
    if (!sessionName.trim()) {
      setError("Session name is required.");
      return;
    }
    setError(null);
    setIsCreating(true);
    try {
      const session = await createSession(sessionName.trim(), {
        source: "orphaned_pipeline",
        orphaned_output: pipelineOutput,
      });
      selectSession(session.id);
      setSessionName("");
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsCreating(false);
    }
  }, [sessionName, createSession, pipelineOutput, selectSession, onClose]);

  const handleDismiss = useCallback(() => {
    setSessionName("");
    setError(null);
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 14,
          padding: "28px 28px 22px",
          width: 400,
          maxWidth: "90vw",
          boxShadow:
            "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
          fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 6 }}>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#0D0D0D",
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            Save This Pipeline Run?
          </h3>
          <p
            style={{
              fontSize: 13,
              color: "#6B6B6B",
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            This run completed without a session. Create a session to persist
            the pipeline results.
          </p>
        </div>

        {/* Input */}
        <div style={{ marginTop: 16 }}>
          <input
            type="text"
            placeholder="Session name"
            value={sessionName}
            onChange={(e) => {
              setSessionName(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isCreating) handleCreate();
            }}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #E4DDD4",
              fontSize: 13,
              fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
              outline: "none",
              color: "#0D0D0D",
              transition: "border-color 150ms ease",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#E8561B";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#E4DDD4";
            }}
            autoFocus
          />
          {error && (
            <p style={{ fontSize: 12, color: "#B91C1C", marginTop: 6 }}>
              {error}
            </p>
          )}
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 20,
          }}
        >
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              color: "#6B6B6B",
              background: "transparent",
              border: "1px solid #E4DDD4",
              cursor: "pointer",
              fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
              transition: "background 100ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0,0,0,0.03)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: "#FFFFFF",
              background: isCreating ? "#D4A08A" : "#E8561B",
              border: "none",
              cursor: isCreating ? "not-allowed" : "pointer",
              fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
              transition: "background 100ms ease, transform 80ms ease",
            }}
            onMouseEnter={(e) => {
              if (!isCreating)
                e.currentTarget.style.background = "#D44A15";
            }}
            onMouseLeave={(e) => {
              if (!isCreating)
                e.currentTarget.style.background = "#E8561B";
            }}
            onMouseDown={(e) => {
              if (!isCreating)
                e.currentTarget.style.transform = "scale(0.97)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            {isCreating ? "Creating..." : "Create Session"}
          </button>
        </div>
      </div>
    </div>
  );
}
