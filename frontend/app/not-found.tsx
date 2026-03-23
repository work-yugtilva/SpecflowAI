export default function NotFound() {
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
          background: "rgba(232,86,27,0.08)",
          color: "#E8561B",
          fontWeight: 700,
          fontSize: 64,
          lineHeight: 1,
          padding: "12px 24px",
          borderRadius: 16,
          letterSpacing: "-0.02em",
        }}
      >
        404
      </div>
      <div style={{ fontSize: 20, fontWeight: 600, color: "#0D0D0D" }}>
        Page not found
      </div>
      <div style={{ fontSize: 14, color: "#6B6B6B", maxWidth: 320, textAlign: "center" }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </div>
      <a
        href="/dashboard"
        style={{
          marginTop: 8,
          padding: "9px 20px",
          background: "#0D0D0D",
          color: "#FFFFFF",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          textDecoration: "none",
        }}
      >
        Back to Dashboard
      </a>
    </div>
  );
}
