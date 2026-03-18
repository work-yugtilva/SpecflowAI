"use client";

export default function CTASection() {
  return (
    <section
      className="relative w-full overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #E8561B 0%, #D44A12 60%, #C23E0A 100%)",
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
            color: "white",
          }}
        >
          Build your dream{" "}
          <span style={{ fontStyle: "italic", opacity: 0.9 }}>
            spec workflow!
          </span>
        </h2>

        <p
          className="font-sans mb-8 mx-auto"
          style={{
            fontSize: "1.0625rem",
            lineHeight: 1.65,
            color: "rgba(255,255,255,0.82)",
            maxWidth: "420px",
          }}
        >
          Join 500+ teams shipping better software with SpecFlow AI. Start free,
          no credit card required.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href="#" className="btn-white">
            Get started free
          </a>
          <a
            href="#"
            className="font-sans text-sm font-medium"
            style={{
              color: "rgba(255,255,255,0.85)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "white")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.85)")}
          >
            See a demo
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-6 mt-10 flex-wrap">
          {[
            { icon: "🔒", label: "SOC 2 compliant" },
            { icon: "⚡", label: "99.9% uptime" },
            { icon: "🌍", label: "GDPR ready" },
          ].map((badge) => (
            <div
              key={badge.label}
              className="flex items-center gap-1.5 font-sans text-xs"
              style={{ color: "rgba(255,255,255,0.75)", fontWeight: 500 }}
            >
              <span>{badge.icon}</span>
              {badge.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
