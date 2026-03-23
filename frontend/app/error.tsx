"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F8F4EF",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'DM Sans', sans-serif",
        gap: 16,
      }}
    >
      <div
        style={{
          background: "#FEF2F2",
          border: "1px solid #FECACA",
          color: "#B91C1C",
          fontWeight: 700,
          fontSize: 40,
          lineHeight: 1,
          padding: "12px 24px",
          borderRadius: 16,
        }}
      >
        Error
      </div>
      <div style={{ fontSize: 20, fontWeight: 600, color: "#0D0D0D" }}>
        Something went wrong
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#9B9189",
          fontFamily: "monospace",
          background: "#FFFFFF",
          border: "1px solid #E4DDD4",
          borderRadius: 8,
          padding: "8px 14px",
          maxWidth: 480,
        }}
      >
        {error.message}
        {error.digest && (
          <span style={{ marginLeft: 8, opacity: 0.6 }}>({error.digest})</span>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button
          onClick={reset}
          style={{
            padding: "9px 20px",
            background: "#0D0D0D",
            color: "#FFFFFF",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <a
          href="/dashboard"
          style={{
            padding: "9px 20px",
            background: "#FFFFFF",
            color: "#0D0D0D",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            border: "1px solid #E4DDD4",
            textDecoration: "none",
          }}
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}
