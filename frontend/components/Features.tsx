"use client";

import { GlowingEffect } from "@/components/ui/glowing-effect";

const FEATURES_COPY = {
  headline1: "Everything that used to take",
  headline2: "days",
  subtext: "Six pipeline stages. Each one replaces a meeting, a doc, or a day.",
};

const features = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
    iconBg: "#E8561B",
    replaces: "3-day research synthesis",
    title: "Problems Page",
    desc: "Upload interviews and notes. Get a prioritized list of user problems in minutes.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
    iconBg: "#8B5CF6",
    replaces: "your backlog grooming meeting",
    title: "Features Page",
    desc: "Problems automatically mapped to buildable features with priority and acceptance criteria.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
    iconBg: "#22C55E",
    replaces: "sprint planning from scratch",
    title: "Tasks Page",
    desc: "Features broken into engineering tasks, sized and sequenced automatically.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
    iconBg: "#F59E0B",
    replaces: "your system design doc",
    title: "Decompose",
    desc: "Data models, UI/UX prompts, and workflow diagrams — generated from your features.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
      </svg>
    ),
    iconBg: "#EC4899",
    replaces: "your research repo",
    title: "Sessions",
    desc: "Isolated workspaces per project. All context, research, and outputs in one place.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    iconBg: "#06B6D4",
    replaces: "2 hours of doc writing",
    title: "PRD Export",
    desc: "One-click PRD compiled from all pipeline outputs. Ready to share with engineering.",
  },
];

export default function Features() {
  return (
    <section className="w-full py-20" style={{ background: "#F8F4EF" }}>
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-14">
          <h2
            className="font-display mb-3"
            style={{
              fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)",
              fontWeight: 400,
              letterSpacing: "-0.025em",
              lineHeight: 1.15,
              color: "#0D0D0D",
            }}
          >
            {FEATURES_COPY.headline1}{" "}
            <span style={{ color: "#E8561B", fontStyle: "italic" }}>
              {FEATURES_COPY.headline2}
            </span>
          </h2>
          <p
            className="font-sans mx-auto"
            style={{
              color: "#6B6B6B",
              fontSize: "1rem",
              lineHeight: 1.6,
              maxWidth: "440px",
            }}
          >
            {FEATURES_COPY.subtext}
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, i) => (
            <div
              key={i}
              className="relative rounded-2xl border p-[2px]"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <GlowingEffect
                spread={40}
                glow
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={3}
              />
              <div className="feature-card relative z-10 h-full !border-0 rounded-[14px]">
                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    background: feature.iconBg,
                    boxShadow: `0 4px 16px ${feature.iconBg}35`,
                  }}
                >
                  {feature.icon}
                </div>

                {/* Replaces tag */}
                <div style={{ marginBottom: 6 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#6B8F71",
                      fontFamily: "var(--font-sans, sans-serif)",
                    }}
                  >
                    Replaces: {feature.replaces}
                  </span>
                </div>

                {/* Title */}
                <h3
                  className="font-sans font-semibold mb-2"
                  style={{
                    fontSize: "1rem",
                    color: "#0D0D0D",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {feature.title}
                </h3>

                {/* Description */}
                <p
                  className="font-sans"
                  style={{
                    fontSize: "0.875rem",
                    lineHeight: 1.65,
                    color: "#6B6B6B",
                  }}
                >
                  {feature.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
