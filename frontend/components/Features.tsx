"use client";

import type { ReactNode } from "react";
import { GlowingEffect } from "@/components/ui/glowing-effect";

const FEATURES_COPY = {
  headline1: "From raw signals to",
  headline2: "shipped work",
  subtext: "Four steps: ingest what you already have, structure it, ship a PRD your team trusts, then push tickets to where engineering lives.",
};

type FeatureItem = {
  id: string;
  gridClass: string;
  cardClass?: string;
  titleClass?: string;
  descClass?: string;
  icon: ReactNode;
  iconBg: string;
  replaces: string;
  title: string;
  desc: string;
};

const features: FeatureItem[] = [
  {
    id: "ingest",
    gridClass: "",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
    iconBg: "#E8561B",
    replaces: "scattered exports and screenshots",
    title: "Upload your inputs",
    desc: "Pull in Slack threads, Gong calls, Zendesk tickets, and docs—everything that already tells the story of what to build next.",
  },
  {
    id: "structure",
    gridClass: "",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
    iconBg: "#3D6B5E",
    replaces: "hours of manual synthesis",
    title: "Generate context and structure",
    desc: "SpecFlow turns messy inputs into product context, problems, and scope you can reason about—so the work is grounded, not guessed.",
  },
  {
    id: "prd",
    gridClass: "md:col-span-2",
    cardClass: "!p-8 md:!py-10 md:!px-10 lg:min-h-[11rem]",
    titleClass: "text-lg md:text-xl lg:text-[1.35rem] tracking-tight",
    descClass: "text-[0.9375rem] md:text-base max-w-3xl",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    iconBg: "#0D0D0D",
    replaces: "the blank Google Doc",
    title: "Generate your PRD and outputs",
    desc: "One pass from structured context to a stakeholder-ready PRD—clear narrative, acceptance-ready detail, and citations back to the signals that matter.",
  },
  {
    id: "ship",
    gridClass: "md:col-span-2",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    ),
    iconBg: "#3D6B5E",
    replaces: "copy-paste into another tool",
    title: "Push to execution",
    desc: "Send prioritized work to Linear or Jira so engineering sees the same scope you approved—no re-typing, no drift between spec and board.",
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
              maxWidth: "520px",
            }}
          >
            {FEATURES_COPY.subtext}
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {features.map((feature) => (
            <div
              key={feature.id}
              className={`relative rounded-2xl border p-[2px] ${feature.gridClass}`}
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <GlowingEffect
                spread={feature.id === "prd" ? 48 : 40}
                glow
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={3}
              />
              <div
                className={`feature-card relative z-10 h-full !border-0 rounded-[14px] ${feature.cardClass ?? ""}`}
              >
                {/* Icon */}
                <div
                  className={`rounded-xl flex items-center justify-center mb-4 ${feature.id === "prd" ? "w-11 h-11" : "w-10 h-10"}`}
                  style={{
                    background: feature.iconBg,
                    boxShadow: `0 4px 16px ${feature.iconBg}35`,
                  }}
                >
                  {feature.icon}
                </div>

                {/* Replaces tag */}
                <div style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 400,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "#9a9085",
                      marginBottom: 2,
                      fontFamily: "var(--font-sans, sans-serif)",
                    }}
                  >
                    ↳ replaces
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#E8561B",
                      fontFamily: "var(--font-sans, sans-serif)",
                    }}
                  >
                    {feature.replaces}
                  </span>
                </div>

                {/* Title */}
                <h3
                  className={`font-sans font-semibold mb-2 ${feature.titleClass ?? ""}`}
                  style={{
                    fontSize: feature.titleClass ? undefined : "1rem",
                    color: "#0D0D0D",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {feature.title}
                </h3>

                {/* Description */}
                <p
                  className={`font-sans ${feature.descClass ?? ""}`}
                  style={{
                    fontSize: feature.descClass ? undefined : "0.875rem",
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
