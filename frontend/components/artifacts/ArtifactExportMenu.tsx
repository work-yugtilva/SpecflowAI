"use client";

import React, { useState, useRef, useEffect } from "react";

export type ExportAction = {
  id: string;
  label: string;
  description?: string;
  badge?: string;
  disabled?: boolean;
  successLabel?: string;
  errorLabel?: string;
  onSelect: () => void | Promise<void>;
};

export type ArtifactExportMenuProps = {
  disabled?: boolean;
  disabledReason?: string;
  actions: ExportAction[];
  align?: "left" | "right";
  label?: string;
};

const ITEM_BASE_STYLE: React.CSSProperties = {
  padding: "9px 14px",
  cursor: "pointer",
  border: "none",
  width: "100%",
  textAlign: "left",
  background: "transparent",
  fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
  display: "block",
};

export function ArtifactExportMenu({
  disabled = false,
  disabledReason,
  actions,
  align = "right",
  label = "Export",
}: ArtifactExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isDisabled = disabled || isLoading;
  const buttonText = isLoading ? "Exporting…" : feedback ?? `${label} ▾`;

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  async function handleAction(action: ExportAction) {
    setOpen(false);
    setIsLoading(true);
    try {
      await action.onSelect();
      const msg = action.successLabel ?? "Exported";
      setFeedbackTone("success");
      setFeedback(`${msg} ✓`);
      setTimeout(() => { setFeedback(null); setFeedbackTone(null); }, 1500);
    } catch {
      const msg = action.errorLabel ?? "Export failed";
      setFeedbackTone("error");
      setFeedback(msg);
      setTimeout(() => { setFeedback(null); setFeedbackTone(null); }, 2000);
    } finally {
      setIsLoading(false);
    }
  }

  const triggerStyle: React.CSSProperties = {
    padding: "0.4rem 0.875rem",
    border: "1.5px solid #E4DDD4",
    borderRadius: 8,
    fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
    color: feedbackTone === "error" ? "#EF4444" : "#0D0D0D",
    background: "#F8F4EF",
    fontSize: 13,
    fontWeight: 500,
    cursor: isDisabled ? "not-allowed" : "pointer",
    transition: "background 150ms ease",
    opacity: isDisabled ? 0.45 : 1,
    pointerEvents: isDisabled ? "none" : undefined,
    display: "inline-flex",
    alignItems: "center",
    whiteSpace: "nowrap",
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", display: "inline-block" }}
      onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
    >
      <button
        onClick={() => !isDisabled && setOpen((v) => !v)}
        style={triggerStyle}
        title={isDisabled && !isLoading ? (disabledReason ?? "Generate this artifact before exporting") : undefined}
        disabled={isDisabled}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {buttonText}
      </button>

      {open && actions.length > 0 && (
        <div
          role="menu"
          style={{
            position: "absolute",
            zIndex: 50,
            background: "#FDFAF7",
            border: "1.5px solid #E4DDD4",
            borderRadius: 10,
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            minWidth: 260,
            maxWidth: 320,
            top: "calc(100% + 4px)",
            ...(align === "right" ? { right: 0 } : { left: 0 }),
            overflow: "hidden",
          }}
        >
          {actions.map((action) => (
            <button
              key={action.id}
              role="menuitem"
              disabled={action.disabled}
              style={{
                ...ITEM_BASE_STYLE,
                cursor: action.disabled ? "not-allowed" : "pointer",
                opacity: action.disabled ? 0.45 : 1,
              }}
              onMouseEnter={(e) => {
                if (!action.disabled) e.currentTarget.style.background = "rgba(0,0,0,0.04)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
              onClick={() => !action.disabled && handleAction(action)}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontWeight: 500,
                    fontSize: 13,
                    color: "#0D0D0D",
                    lineHeight: "1.3",
                  }}
                >
                  {action.label}
                </span>
                {action.badge && (
                  <span
                    style={{
                      background: "#E4DDD4",
                      borderRadius: 4,
                      padding: "1px 6px",
                      fontSize: 10,
                      color: "#6B6B6B",
                      fontFamily: "Courier New, monospace",
                      flexShrink: 0,
                      lineHeight: "1.5",
                    }}
                  >
                    {action.badge}
                  </span>
                )}
              </div>
              {action.description && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#9B9189",
                    marginTop: 2,
                    lineHeight: "1.4",
                  }}
                >
                  {action.description}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
