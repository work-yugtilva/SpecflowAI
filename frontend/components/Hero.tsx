"use client";

import React from "react";
import Link from "next/link";
import { MoveRight, PhoneCall } from "lucide-react";

import { Button } from "@/components/ui/button";

const HERO_COPY = {
  badge: "Introducing SpecFlow AI — Now in Beta",
  headline1: "Cursor for Product Management.",
  headline2: "",
  headline3: "",
  subtitle:
    "Upload customer interviews and feedback. SpecFlow instantly generates backed-by-data PRDs, UI changes, and dev-ready tickets. You just review and ship.",
  ctaPrimary: "Generate your first spec for free",
  ctaSecondary: "Book a demo",
  pipeline: ["Research", "Problems", "Features", "Tasks", "PRD"],
};

const floatingLabelsLeft = [
  { label: "Requirements", top: "12%", left: "4%" },
  { label: "User Stories", top: "32%", left: "1%" },
  { label: "Test Cases", top: "54%", left: "4%" },
  { label: "API Specs", top: "74%", left: "2%" },
];

const floatingLabelsRight = [
  { label: "Test Coverage", top: "12%", right: "4%" },
  { label: "Version Control", top: "32%", right: "1%" },
  { label: "AI Review", top: "54%", right: "4%" },
  { label: "Integrations", top: "74%", right: "2%" },
];

function ChipSVG() {
  return (
    <svg
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      <defs>
        <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E8561B" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#E8561B" stopOpacity="0" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="6" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="chipGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2a2520" />
          <stop offset="100%" stopColor="#0D0D0D" />
        </linearGradient>
        <linearGradient id="traceGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E8561B" stopOpacity="0" />
          <stop offset="50%" stopColor="#E8561B" stopOpacity="1" />
          <stop offset="100%" stopColor="#E8561B" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="traceGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E8561B" stopOpacity="0" />
          <stop offset="50%" stopColor="#E8561B" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#E8561B" stopOpacity="0" />
        </linearGradient>
      </defs>

      <circle cx="200" cy="200" r="180" fill="url(#bgGlow)" />

      <line x1="20" y1="140" x2="120" y2="140" stroke="url(#traceGrad)" strokeWidth="1.5" />
      <line x1="20" y1="175" x2="120" y2="175" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.4" />
      <line x1="20" y1="225" x2="120" y2="225" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.3" />
      <line x1="20" y1="260" x2="120" y2="260" stroke="url(#traceGrad)" strokeWidth="1.5" />
      <line x1="280" y1="140" x2="380" y2="140" stroke="#E8561B" strokeWidth="1.5" strokeOpacity="0.7" />
      <line x1="280" y1="175" x2="380" y2="175" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.3" />
      <line x1="280" y1="225" x2="380" y2="225" stroke="url(#traceGrad)" strokeWidth="1.5" />
      <line x1="280" y1="260" x2="380" y2="260" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.4" />

      <line x1="140" y1="20" x2="140" y2="120" stroke="url(#traceGrad2)" strokeWidth="1.5" />
      <line x1="175" y1="20" x2="175" y2="120" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.35" />
      <line x1="225" y1="20" x2="225" y2="120" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.5" />
      <line x1="260" y1="20" x2="260" y2="120" stroke="url(#traceGrad2)" strokeWidth="1.5" />
      <line x1="140" y1="280" x2="140" y2="380" stroke="#E8561B" strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="175" y1="280" x2="175" y2="380" stroke="url(#traceGrad2)" strokeWidth="1.5" />
      <line x1="225" y1="280" x2="225" y2="380" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.4" />
      <line x1="260" y1="280" x2="260" y2="380" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.3" />

      {[140, 175, 225, 260].map((x, i) => (
        <circle key={`dt${i}`} cx={x} cy="120" r="2.5" fill="#E8561B" fillOpacity="0.8" />
      ))}
      {[140, 175, 225, 260].map((x, i) => (
        <circle key={`db${i}`} cx={x} cy="280" r="2.5" fill="#E8561B" fillOpacity="0.6" />
      ))}
      {[140, 175, 225, 260].map((y, i) => (
        <circle key={`dl${i}`} cx="120" cy={y} r="2.5" fill="#E8561B" fillOpacity="0.7" />
      ))}
      {[140, 175, 225, 260].map((y, i) => (
        <circle key={`dr${i}`} cx="280" cy={y} r="2.5" fill="#E8561B" fillOpacity="0.5" />
      ))}

      <rect x="120" y="120" width="160" height="160" rx="16" fill="url(#chipGrad)" />
      <rect x="120" y="120" width="160" height="160" rx="16" fill="none" stroke="#E8561B" strokeWidth="1.5" strokeOpacity="0.6" />
      <rect x="130" y="130" width="140" height="140" rx="12" fill="none" stroke="#E8561B" strokeWidth="0.5" strokeOpacity="0.3" />

      {[155, 175, 195, 215, 235].map((x) =>
        [155, 175, 195, 215, 235].map((y) => (
          <rect
            key={`${x}-${y}`}
            x={x - 6}
            y={y - 6}
            width="12"
            height="12"
            rx="2"
            fill="#E8561B"
            fillOpacity="0.08"
            stroke="#E8561B"
            strokeWidth="0.5"
            strokeOpacity="0.2"
          />
        ))
      )}

      <rect x="162" y="175" width="76" height="50" rx="8" fill="#E8561B" fillOpacity="0.15" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.5" />
      <text x="200" y="197" textAnchor="middle" fill="#E8561B" fontSize="11" fontWeight="700" fontFamily="monospace" filter="url(#glow)">
        AI
      </text>
      <text x="200" y="215" textAnchor="middle" fill="#E8561B" fontSize="7" fontFamily="monospace" fillOpacity="0.8">
        SPECFLOW
      </text>

      <circle cx="136" cy="136" r="4" fill="#E8561B" fillOpacity="0.5" filter="url(#glow)" />
      <circle cx="264" cy="136" r="4" fill="#E8561B" fillOpacity="0.5" filter="url(#glow)" />
      <circle cx="136" cy="264" r="4" fill="#E8561B" fillOpacity="0.5" filter="url(#glow)" />
      <circle cx="264" cy="264" r="4" fill="#E8561B" fillOpacity="0.5" filter="url(#glow)" />

      <circle cx="200" cy="200" r="6" fill="#E8561B" filter="url(#softGlow)" fillOpacity="0.9">
        <animate attributeName="fillOpacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
        <animate attributeName="r" values="5;8;5" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

export default function Hero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse 90% 70% at 50% 30%, rgba(232,86,27,0.06) 0%, transparent 65%), #F8F4EF",
        minHeight: "calc(100vh - 60px)",
      }}
    >
      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#E4DDD4 1px, transparent 1px), linear-gradient(90deg, #E4DDD4 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          opacity: 0.25,
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-12 flex flex-col items-center text-center">
        {/* Positioning chip */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            border: "1px solid #E4DDD4",
            background: "#FFFFFF",
            color: "#0D0D0D",
            fontSize: 13,
            fontWeight: 500,
            borderRadius: 99,
            padding: "4px 14px",
            marginBottom: 12,
          }}
        >
          The Cursor experience, built for Product Managers
        </div>

        {/* Intro badge + launch link */}
        <div className="fade-up mb-6 flex flex-col items-center gap-5">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
            style={{
              background: "rgba(232,86,27,0.10)",
              border: "1px solid rgba(232,86,27,0.25)",
              color: "#E8561B",
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#E8561B" }} />
            {HERO_COPY.badge}
          </div>
          <Button variant="secondary" size="sm" className="gap-2 rounded-full" asChild>
            <Link href="/features">
              Read our launch article <MoveRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Headline */}
        <h1
          className="fade-up-1 font-display mb-6 max-w-[780px] text-center font-semibold"
          style={{
            fontSize: "clamp(2.4rem, 6vw, 4.5rem)",
            lineHeight: 1.12,
            letterSpacing: "-0.03em",
            color: "#0D0D0D",
          }}
        >
          {HERO_COPY.headline1}
        </h1>

        {/* Subtitle */}
        <p
          className="fade-up-2 font-sans mb-10 max-w-lg text-center text-muted-foreground"
          style={{ fontSize: "1.0625rem", lineHeight: 1.7 }}
        >
          {HERO_COPY.subtitle}
        </p>

        {/* CTAs */}
        <div className="fade-up-3 flex flex-row flex-wrap items-center justify-center gap-5">
          <Button size="lg" className="shrink-0 gap-2 rounded-full" asChild>
            <Link href="/login" className="no-underline">
              {HERO_COPY.ctaPrimary} <MoveRight className="h-4 w-4 shrink-0" aria-hidden />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="shrink-0 gap-2 rounded-full border-[hsl(var(--border))] bg-background text-foreground"
            asChild
          >
            <a href="mailto:hello@specflow.app" className="no-underline">
              {HERO_COPY.ctaSecondary} <PhoneCall className="h-4 w-4 shrink-0" aria-hidden />
            </a>
          </Button>
        </div>

        {/* Hero visual area — side-by-side: messy inputs → structured PRD */}
        {/* TODO: replace with side-by-side visual */}
        <div className="relative w-full mt-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {/* Left: messy customer feedback / Slack messages */}
            <div
              style={{
                background: "#1a1510",
                borderRadius: 16,
                border: "1px solid rgba(232,86,27,0.2)",
                padding: "24px",
                minHeight: 280,
              }}
            >
              <div
                className="font-sans"
                style={{
                  color: "#9a9085",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", display: "inline-block", flexShrink: 0 }} />
                #product-feedback · 47 messages
              </div>
              {[
                { name: "Sarah K.", time: "9:14 AM", msg: "The onboarding is really confusing — I had to email support twice just to get past step 3." },
                { name: "James T.", time: "9:31 AM", msg: "Bulk export is a blocker for us. Finance needs it for quarterly reports and we're doing it manually." },
                { name: "Priya M.", time: "10:02 AM", msg: "Love the core product but the settings page is a nightmare. I can never find what I'm looking for." },
              ].map((m, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div className="font-sans" style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
                    <span style={{ color: "#E8561B", fontSize: 12, fontWeight: 600 }}>{m.name}</span>
                    <span style={{ color: "#5a5047", fontSize: 10 }}>{m.time}</span>
                  </div>
                  <p className="font-sans" style={{ color: "#c9bfb4", fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
                    &ldquo;{m.msg}&rdquo;
                  </p>
                </div>
              ))}
              <div className="font-sans" style={{ marginTop: 16, color: "#5a5047", fontSize: 11 }}>
                + 44 more messages · 3 user interviews attached
              </div>
            </div>

            {/* Right: structured PRD output */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 16,
                border: "1px solid #E4DDD4",
                padding: "24px",
                minHeight: 280,
              }}
            >
              <div style={{ marginBottom: 18 }}>
                <div
                  className="font-sans"
                  style={{ color: "#9a9085", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}
                >
                  Generated PRD · 12s ago
                </div>
                <div
                  className="font-display"
                  style={{ color: "#0D0D0D", fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}
                >
                  Onboarding Redesign
                </div>
              </div>
              {[
                {
                  label: "Problem",
                  color: "#E8561B",
                  items: [
                    "Users drop off at step 3 (47% abandonment) due to unclear next actions",
                    "Support tickets cite onboarding as top pain point — 38 this month",
                  ],
                },
                {
                  label: "Features",
                  color: "#3D6B5E",
                  items: [
                    "Step-by-step progress wizard with contextual help",
                    "Inline tooltips triggered on first interaction",
                  ],
                },
                {
                  label: "Tasks",
                  color: "#6B6B6B",
                  items: ["Redesign step 3 flow · 3 pts", "Add progress bar component · 2 pts"],
                },
              ].map((section) => (
                <div key={section.label} style={{ marginBottom: 14 }}>
                  <div
                    className="font-sans"
                    style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: section.color, marginBottom: 5 }}
                  >
                    {section.label}
                  </div>
                  {section.items.map((item, j) => (
                    <div key={j} className="font-sans" style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
                      <span style={{ color: section.color, fontSize: 10, marginTop: 3, flexShrink: 0 }}>▸</span>
                      <span style={{ color: "#0D0D0D", fontSize: 12.5, lineHeight: 1.55 }}>{item}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Pipeline flow strip */}
          <div
            style={{
              marginTop: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 0,
              flexWrap: "wrap",
              rowGap: 8,
            }}
          >
            {HERO_COPY.pipeline.map((node, i) => (
              <React.Fragment key={node}>
                <span
                  style={{
                    padding: "4px 14px",
                    borderRadius: 20,
                    border: "1px solid rgba(232,86,27,0.35)",
                    background: "rgba(232,86,27,0.06)",
                    color: "#E8561B",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    fontFamily: "var(--font-sans, sans-serif)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {node}
                </span>
                {i < HERO_COPY.pipeline.length - 1 && (
                  <svg
                    width="32"
                    height="10"
                    viewBox="0 0 32 10"
                    style={{ flexShrink: 0 }}
                    aria-hidden
                  >
                    <line
                      x1="0"
                      y1="5"
                      x2="28"
                      y2="5"
                      stroke="#E8561B"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                      strokeOpacity="0.6"
                    >
                      <animate
                        attributeName="stroke-dashoffset"
                        from="0"
                        to="-14"
                        dur="1.2s"
                        repeatCount="indefinite"
                      />
                    </line>
                    <polygon points="26,2 32,5 26,8" fill="#E8561B" fillOpacity="0.6" />
                  </svg>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
