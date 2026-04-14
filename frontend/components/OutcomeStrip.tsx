"use client";

const OUTCOME_COPY = {
  stats: [
    { value: "20 min", label: "avg time to first PRD" },
    { value: "3 hrs", label: "saved per PRD on average" },
    { value: "Series A–B", label: "PMs who use SpecFlow" },
  ],
};

export default function OutcomeStrip() {
  return (
    <section
      style={{
        background: "#F8F4EF",
        borderTop: "1px solid #E4DDD4",
        borderBottom: "1px solid #E4DDD4",
      }}
    >
      <div
        className="outcome-strip-grid max-w-6xl mx-auto px-6"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1px",
          background: "#E4DDD4",
        }}
      >
        {OUTCOME_COPY.stats.map((stat, i) => (
          <div
            key={i}
            style={{
              background: "#F8F4EF",
              padding: "52px 36px",
              textAlign: "center",
            }}
          >
            <div
              className="font-display"
              style={{
                fontSize: "clamp(2.2rem, 5vw, 3.5rem)",
                fontWeight: 400,
                letterSpacing: "-0.03em",
                color: "#E8561B",
                lineHeight: 1,
                marginBottom: 10,
              }}
            >
              {stat.value}
            </div>
            <div
              className="font-sans"
              style={{
                fontSize: "0.875rem",
                color: "#9a9085",
                letterSpacing: "0.01em",
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>
      <style>{`
        @media (max-width: 640px) {
          .outcome-strip-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}
