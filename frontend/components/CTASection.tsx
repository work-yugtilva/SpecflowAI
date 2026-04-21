"use client";

const CTA_COPY = {
  headline1: "The PM tool",
  headline2: "that does the work.",
  subhead: "Start free. Get your first PRD in 20 minutes. No credit card required.",
  ctaPrimary: "Generate your first spec for free",
  ctaSecondary: "See a demo",
  badges: ["· Solo PMs", "· Series A–B teams", "· No credit card"],
};

export default function CTASection() {
  return (
    <section
      className="relative w-full overflow-hidden foundry-scanline"
      style={{
        background: "linear-gradient(135deg, var(--orange) 0%, var(--orange-hover) 60%, #a83b12 100%)",
        padding: "80px 24px",
      }}
    >
      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`,
          opacity: 0.6,
        }}
      />

      {/* Radial glow spots */}
      <div
        className="absolute"
        style={{
          width: 400,
          height: 400,
          background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)",
          top: "-100px",
          right: "10%",
          pointerEvents: "none",
        }}
      />
      <div
        className="absolute"
        style={{
          width: 300,
          height: 300,
          background: "radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 70%)",
          bottom: "-60px",
          left: "15%",
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div className="relative max-w-3xl mx-auto text-center">
        <h2
          className="font-display mb-4"
          style={{
            fontSize: "clamp(2rem, 5vw, 3.5rem)",
            fontWeight: 400,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            color: "var(--charcoal-text)",
          }}
        >
          {CTA_COPY.headline1}{" "}
          <span style={{ fontStyle: "italic", opacity: 0.9 }}>
            {CTA_COPY.headline2}
          </span>
        </h2>

        <p
          className="font-sans mb-8 mx-auto"
          style={{
            fontSize: "1.0625rem",
            lineHeight: 1.65,
            color: "rgba(249,247,244,0.84)",
            maxWidth: "420px",
          }}
        >
          {CTA_COPY.subhead}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href="#" className="btn-white">
            {CTA_COPY.ctaPrimary}
          </a>
          <a
            href="#"
            className="font-sans text-sm font-medium"
            style={{
              color: "rgba(249,247,244,0.86)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color = "var(--charcoal-text)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(249,247,244,0.86)")
            }
          >
            {CTA_COPY.ctaSecondary}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        {/* Trust badges — plain text, no emojis */}
        <div className="flex items-center justify-center gap-6 mt-10 flex-wrap">
          {CTA_COPY.badges.map((badge) => (
            <span
              key={badge}
              className="font-sans text-xs"
              style={{ color: "rgba(249,247,244,0.76)", fontWeight: 500 }}
            >
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
