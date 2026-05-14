"use client";

import { useState, useEffect } from "react";

function AnimatedHeading({
  text,
  className = "",
  style = {},
  charDelay = 30,
  initialDelay = 200,
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  charDelay?: number;
  initialDelay?: number;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 10);
    return () => clearTimeout(t);
  }, []);

  const lines = text.split("\n");

  return (
    <h1 className={className} style={style}>
      {lines.map((line, lineIndex) => {
        const lineChars = line.length;
        return (
          <span key={lineIndex} style={{ display: "block" }}>
            {[...line].map((ch, charIndex) => {
              const delay =
                initialDelay +
                lineIndex * lineChars * charDelay +
                charIndex * charDelay;
              return (
                <span
                  key={charIndex}
                  style={{
                    display: "inline-block",
                    opacity: shown ? 1 : 0,
                    transform: shown ? "translateX(0)" : "translateX(-18px)",
                    transition: `opacity 500ms ease-out ${delay}ms, transform 500ms ease-out ${delay}ms`,
                    whiteSpace: "pre",
                  }}
                >
                  {ch === " " ? " " : ch}
                </span>
              );
            })}
          </span>
        );
      })}
    </h1>
  );
}

function FadeIn({
  delay = 0,
  duration = 1000,
  children,
  className = "",
  style = {},
}: {
  delay?: number;
  duration?: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div
      className={`transition-opacity ${className}`}
      style={{ opacity: shown ? 1 : 0, transitionDuration: `${duration}ms`, ...style }}
    >
      {children}
    </div>
  );
}

export default function SpecFlowHero() {
  const accent = "var(--orange)";
  const accentDark = "var(--orange-hover)";

  return (
    <section className="relative min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Video background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: 0 }}
      >
        <source src="/assets/blueprint-loop.mp4" type="video/mp4" />
      </video>

      {/* Content centered vertically and horizontally */}
      <div className="px-6 md:px-12 lg:px-16 relative z-10 flex-1 flex flex-col justify-center items-center">
        <div className="flex flex-col items-center text-center max-w-3xl w-full">
          <AnimatedHeading
            text={"From 4 days\nto 12 minutes."}
            className="font-serif font-normal text-5xl md:text-6xl lg:text-7xl xl:text-8xl mb-4"
            style={{
              letterSpacing: "-0.03em",
              lineHeight: 1.02,
              color: "var(--text)",
              fontFamily: "var(--font-instrument), 'Instrument Serif', serif",
            }}
          />
          <FadeIn delay={800} duration={1000} className="w-full">
            <p
              className="text-base md:text-lg mb-6 max-w-lg mx-auto"
              style={{ color: "rgba(13,13,13,0.7)", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
            >
              Feed SpecFlow your research — interviews, tickets, Slack threads. Get back a stakeholder-ready spec with rationale, UI changes, and tasks. Push to Jira, export a handoff, or open in your coding agent.
            </p>
          </FadeIn>
          <FadeIn delay={1200} duration={1000} className="w-full">
            <div className="flex flex-wrap gap-4 justify-center">
              <button
                className="text-white px-8 py-3 rounded-lg font-medium transition-colors"
                style={{ backgroundColor: accent, fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = accentDark)}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = accent)}
              >
                Start your first brief →
              </button>
              <button
                className="liquid-glass border border-black/15 px-8 py-3 rounded-lg font-medium hover:bg-white/60 transition-colors"
                style={{ color: "var(--text)", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
              >
                See it run →
              </button>
            </div>
          </FadeIn>
          <FadeIn delay={1400} duration={1000} className="w-full flex justify-center mt-8">
            <div className="liquid-glass border border-black/15 px-6 py-3 rounded-xl">
              <p
                className="text-base md:text-lg lg:text-xl font-light"
                style={{ color: "rgba(13,13,13,0.8)", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
              >
                Signal → Synthesis → Feature Brief → Dev Tasks
              </p>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
