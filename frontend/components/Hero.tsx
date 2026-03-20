"use client";

import Link from "next/link";
import { MoveRight, PhoneCall } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DEFAULT_ROTATING_WORDS,
  RotatingHeroTitle,
} from "@/components/ui/animated-hero";

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
      {/* Glow filter */}
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
          <stop offset="100%" stopColor="#1a1510" />
        </linearGradient>
        <linearGradient id="traceGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E8561B" stopOpacity="0" />
          <stop offset="50%" stopColor="#E8561B" stopOpacity="1" />
          <stop offset="100%" stopColor="#FF7B3B" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="traceGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E8561B" stopOpacity="0" />
          <stop offset="50%" stopColor="#E8561B" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#FF7B3B" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Outer glow circle */}
      <circle cx="200" cy="200" r="180" fill="url(#bgGlow)" />

      {/* Circuit traces — horizontal */}
      <line x1="20" y1="140" x2="120" y2="140" stroke="url(#traceGrad)" strokeWidth="1.5" />
      <line x1="20" y1="175" x2="120" y2="175" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.4" />
      <line x1="20" y1="225" x2="120" y2="225" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.3" />
      <line x1="20" y1="260" x2="120" y2="260" stroke="url(#traceGrad)" strokeWidth="1.5" />
      <line x1="280" y1="140" x2="380" y2="140" stroke="#E8561B" strokeWidth="1.5" strokeOpacity="0.7" />
      <line x1="280" y1="175" x2="380" y2="175" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.3" />
      <line x1="280" y1="225" x2="380" y2="225" stroke="url(#traceGrad)" strokeWidth="1.5" />
      <line x1="280" y1="260" x2="380" y2="260" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.4" />

      {/* Circuit traces — vertical */}
      <line x1="140" y1="20" x2="140" y2="120" stroke="url(#traceGrad2)" strokeWidth="1.5" />
      <line x1="175" y1="20" x2="175" y2="120" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.35" />
      <line x1="225" y1="20" x2="225" y2="120" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.5" />
      <line x1="260" y1="20" x2="260" y2="120" stroke="url(#traceGrad2)" strokeWidth="1.5" />
      <line x1="140" y1="280" x2="140" y2="380" stroke="#E8561B" strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="175" y1="280" x2="175" y2="380" stroke="url(#traceGrad2)" strokeWidth="1.5" />
      <line x1="225" y1="280" x2="225" y2="380" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.4" />
      <line x1="260" y1="280" x2="260" y2="380" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.3" />

      {/* Connector dots on traces */}
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

      {/* Main chip body */}
      <rect x="120" y="120" width="160" height="160" rx="16" fill="url(#chipGrad)" />
      <rect x="120" y="120" width="160" height="160" rx="16" fill="none" stroke="#E8561B" strokeWidth="1.5" strokeOpacity="0.6" />

      {/* Inner chip highlight */}
      <rect x="130" y="130" width="140" height="140" rx="12" fill="none" stroke="#E8561B" strokeWidth="0.5" strokeOpacity="0.3" />

      {/* Chip grid pattern */}
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

      {/* Center AI label */}
      <rect x="162" y="175" width="76" height="50" rx="8" fill="#E8561B" fillOpacity="0.15" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.5" />
      <text
        x="200"
        y="197"
        textAnchor="middle"
        fill="#E8561B"
        fontSize="11"
        fontWeight="700"
        fontFamily="monospace"
        filter="url(#glow)"
      >
        AI
      </text>
      <text
        x="200"
        y="215"
        textAnchor="middle"
        fill="#E8561B"
        fontSize="7"
        fontFamily="monospace"
        fillOpacity="0.8"
      >
        SPECFLOW
      </text>

      {/* Corner notches */}
      <circle cx="136" cy="136" r="4" fill="#E8561B" fillOpacity="0.5" filter="url(#glow)" />
      <circle cx="264" cy="136" r="4" fill="#E8561B" fillOpacity="0.5" filter="url(#glow)" />
      <circle cx="136" cy="264" r="4" fill="#E8561B" fillOpacity="0.5" filter="url(#glow)" />
      <circle cx="264" cy="264" r="4" fill="#E8561B" fillOpacity="0.5" filter="url(#glow)" />

      {/* Animated glow dot */}
      <circle cx="200" cy="200" r="6" fill="#FF7B3B" filter="url(#softGlow)" fillOpacity="0.9">
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
        {/* Intro + launch link */}
        <div className="fade-up mb-6 flex flex-col items-center gap-5">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
            style={{
              background: "rgba(232,86,27,0.10)",
              border: "1px solid rgba(232,86,27,0.25)",
              color: "#E8561B",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "#E8561B" }}
            />
            Introducing SpecFlow AI — Now in Beta
          </div>
          <Button variant="secondary" size="sm" className="gap-2 rounded-full" asChild>
            <Link href="/features">
              Read our launch article <MoveRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Headline + rotating line */}
        <h1
          className="fade-up-1 font-display mb-6 max-w-[780px] text-center"
          style={{
            fontSize: "clamp(2.4rem, 6vw, 4.5rem)",
            lineHeight: 1.12,
            letterSpacing: "-0.03em",
            color: "#0D0D0D",
          }}
        >
          <span className="font-semibold">Build specs that ship</span>
          <RotatingHeroTitle
            words={DEFAULT_ROTATING_WORDS}
            intervalMs={2000}
            className="my-1 text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.12]"
          />
          <span
            className="mt-1 block font-normal italic"
            style={{ color: "#E8561B" }}
          >
            Your AI workflow.
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className="fade-up-2 font-sans mb-10 max-w-lg text-center text-muted-foreground"
          style={{
            fontSize: "1.0625rem",
            lineHeight: 1.7,
          }}
        >
          SpecFlow connects AI tools with your development workflow, uniting
          engineers and PMs to tackle key spec challenges — faster, together.
        </p>

        {/* CTAs */}
        <div className="fade-up-3 flex flex-row flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            variant="outline"
            className="gap-2 rounded-full border-[hsl(var(--border))] bg-background"
            asChild
          >
            <a href="mailto:hello@specflow.app">
              Book a demo <PhoneCall className="h-4 w-4" />
            </a>
          </Button>
          <Button size="lg" className="gap-2 rounded-full" asChild>
            <Link href="/login">
              Get started <MoveRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Hero visual area */}
        <div
          className="relative w-full mt-12 flex items-center justify-center"
          style={{ minHeight: 480 }}
        >
          {/* Outer ambient glow */}
          <div
            className="absolute"
            style={{
              width: 520,
              height: 520,
              background:
                "radial-gradient(circle, rgba(232,86,27,0.18) 0%, transparent 65%)",
              borderRadius: "50%",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              animation: "glowPulse 4s ease-in-out infinite",
            }}
          />
          {/* Inner glow behind chip */}
          <div
            className="absolute"
            style={{
              width: 380,
              height: 380,
              background:
                "radial-gradient(circle, rgba(232,86,27,0.32) 0%, transparent 70%)",
              borderRadius: "50%",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              animation: "glowPulse 3s ease-in-out infinite 0.5s",
            }}
          />

          {/* Chip SVG */}
          <div
            className="relative chip-container"
            style={{ width: 380, height: 380, zIndex: 2 }}
          >
            <ChipSVG />
          </div>

          {/* Left floating labels */}
          {floatingLabelsLeft.map((item, i) => (
            <div
              key={item.label}
              className="float-label absolute hidden sm:block"
              style={{
                top: item.top,
                left: item.left,
                animation: `floatY ${3 + i * 0.4}s ease-in-out ${i * 0.3}s infinite`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block mr-1.5"
                style={{ background: "#E8561B", verticalAlign: "middle" }}
              />
              {item.label}
            </div>
          ))}

          {/* Right floating labels */}
          {floatingLabelsRight.map((item, i) => (
            <div
              key={item.label}
              className="float-label absolute hidden sm:block"
              style={{
                top: item.top,
                right: item.right,
                animation: `floatY ${3.2 + i * 0.35}s ease-in-out ${
                  0.5 + i * 0.3
                }s infinite`,
              }}
            >
              {item.label}
              <span
                className="w-1.5 h-1.5 rounded-full inline-block ml-1.5"
                style={{ background: "#E8561B", verticalAlign: "middle" }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
