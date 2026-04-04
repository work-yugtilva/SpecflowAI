"use client";

import { useState } from "react";

interface SlackIntegrationCardProps {
  connected: boolean;
  workspaceInfo: Record<string, unknown>;
}

function SlackLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <line x1="6" y1="3.5" x2="5" y2="16.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="14" y1="3.5" x2="13" y2="16.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="3" y1="7.5" x2="17" y2="7.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="2.5" y1="12.5" x2="16.5" y2="12.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export default function SlackIntegrationCard({
  connected: initialConnected,
  workspaceInfo,
}: SlackIntegrationCardProps) {
  const [connected, setConnected] = useState(initialConnected);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDisconnect() {
    setDisconnecting(true);
    setConnected(false); // optimistic
    setError(null);

    const res = await fetch("/api/auth/slack/disconnect", { method: "DELETE" });
    if (!res.ok) {
      setConnected(true); // revert
      const body = await res.json().catch(() => ({}));
      setError((body as { error?: string }).error ?? "Failed to disconnect. Please try again.");
    }
    setDisconnecting(false);
  }

  const workspaceLabel =
    typeof workspaceInfo.team_name === "string"
      ? workspaceInfo.team_name
      : null;

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E4DDD4",
        borderRadius: 12,
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        transition: "box-shadow 180ms ease",
      }}
    >
      {/* Left: logo + info */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
        {/* Slack brand mark */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "#4A154B",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <SlackLogo size={18} />
        </div>

        <div style={{ minWidth: 0 }}>
          {/* Title row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#0D0D0D",
                letterSpacing: "-0.01em",
              }}
            >
              Slack
            </span>

            {connected && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#16A34A",
                  background: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  borderRadius: 20,
                  padding: "2px 8px",
                  letterSpacing: "0.02em",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "#16A34A",
                    flexShrink: 0,
                  }}
                />
                Connected
              </span>
            )}
          </div>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 12.5,
              color: "#6B6B6B",
              marginTop: 3,
              lineHeight: 1.4,
            }}
          >
            {connected
              ? workspaceLabel
                ? `Connected to ${workspaceLabel}`
                : "Receive pipeline updates and notifications in Slack"
              : "Receive pipeline updates and notifications in Slack"}
          </p>

          {/* Inline error */}
          {error && (
            <p
              style={{
                fontSize: 12,
                color: "#DC2626",
                marginTop: 5,
                lineHeight: 1.4,
              }}
            >
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Right: action */}
      {connected ? (
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          style={{
            padding: "6px 14px",
            fontSize: 12.5,
            fontWeight: 500,
            color: disconnecting ? "#B0A89E" : "#6B6B6B",
            background: "#F8F4EF",
            border: "1px solid #E4DDD4",
            borderRadius: 8,
            cursor: disconnecting ? "not-allowed" : "pointer",
            transition: "color 120ms ease, border-color 120ms ease, background 120ms ease",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            if (!disconnecting) {
              e.currentTarget.style.color = "#DC2626";
              e.currentTarget.style.borderColor = "#FCA5A5";
              e.currentTarget.style.background = "#FEF2F2";
            }
          }}
          onMouseLeave={(e) => {
            if (!disconnecting) {
              e.currentTarget.style.color = "#6B6B6B";
              e.currentTarget.style.borderColor = "#E4DDD4";
              e.currentTarget.style.background = "#F8F4EF";
            }
          }}
        >
          {disconnecting ? "Disconnecting…" : "Disconnect"}
        </button>
      ) : (
        <a
          href="/api/auth/slack/init"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            fontSize: 12.5,
            fontWeight: 500,
            color: "#FFFFFF",
            background: "#0D0D0D",
            border: "1px solid #0D0D0D",
            borderRadius: 8,
            textDecoration: "none",
            transition: "background 120ms ease",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#2a2a2a";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#0D0D0D";
          }}
        >
          <SlackLogo size={12} />
          Connect Slack
        </a>
      )}
    </div>
  );
}
