"use client";

const PAIN_COPY = {
  columns: [
    "You ran the interviews.",
    "You have the data.",
    "You're still writing the PRD manually.",
  ],
};

export default function PainStrip() {
  return (
    <section style={{ background: "#1a1510", width: "100%" }}>
      <div
        className="pain-strip-grid max-w-6xl mx-auto px-6"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1px",
          background: "rgba(232,86,27,0.12)",
        }}
      >
        {PAIN_COPY.columns.map((text, i) => (
          <div
            key={i}
            style={{
              background: "#1a1510",
              padding: "48px 36px",
              textAlign: "center",
            }}
          >
            <p
              className="font-display"
              style={{
                color: "#F8F4EF",
                fontSize: "clamp(1.1rem, 2.2vw, 1.5rem)",
                fontStyle: "italic",
                fontWeight: 400,
                lineHeight: 1.4,
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              {text}
            </p>
          </div>
        ))}
      </div>
      <style>{`
        @media (max-width: 640px) {
          .pain-strip-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}
