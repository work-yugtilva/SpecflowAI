"use client";

import React, { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { posthog } from "@/lib/posthog";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = "pm" | "founder" | "engineer";

interface RoleOption {
  id: UserRole;
  label: string;
  tagline: string;
  description: string;
  redirect: string;
}

// ─── Role definitions ─────────────────────────────────────────────────────────

const ROLES: RoleOption[] = [
  {
    id: "pm",
    label: "Product Manager",
    tagline: "PRDs & specs",
    description:
      "Turn research and stakeholder input into structured PRDs and specs.",
    redirect: "/context?onboarding=1",
  },
  {
    id: "founder",
    label: "Founder",
    tagline: "Signal → what to build",
    description:
      "Find what to build next from raw customer interviews and usage signals.",
    redirect: "/sources",
  },
  {
    id: "engineer",
    label: "Engineer",
    tagline: "Spec-first development",
    description:
      "Get a coding-agent-ready task list before you open your editor.",
    redirect: "/sessions",
  },
];

const ONBOARDING_COMPLETE_COOKIE = "specflow_onboarding_complete";

// ─── Onboarding Page ──────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [selected, setSelected] = useState<UserRole | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!selected || submitting) return;
    setSubmitting(true);

    const role = ROLES.find((r) => r.id === selected)!;

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from("user_profiles").upsert(
          {
            user_id: user.id,
            role: selected,
            onboarding_completed_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      }
      posthog.capture("onboarding_role_selected", { role: selected });
    } catch {
      // Fail open — don't block the user if the DB write fails.
    }

    // Set the workspace gate cookie (non-httpOnly — checked by Server Component layout).
    document.cookie = `${ONBOARDING_COMPLETE_COOKIE}=1; path=/; max-age=31536000; SameSite=Lax`;

    window.location.href = role.redirect;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 1.5rem",
        background: "#F8F4EF",
        fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
      }}
    >
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .role-card {
          cursor: pointer;
          border: 1.5px solid #E4DDD4;
          border-radius: 14px;
          padding: 28px 28px 24px;
          background: #FFFFFF;
          transition: border-color 180ms ease, background 180ms ease, transform 180ms ease, box-shadow 180ms ease;
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 10px;
          opacity: 0;
          animation: fadeUp 0.45s ease forwards;
        }
        .role-card:hover {
          border-color: #0D0D0D;
          box-shadow: 0 4px 20px rgba(0,0,0,0.07);
          transform: translateY(-2px);
        }
        .role-card.selected {
          border-color: #0D0D0D;
          background: #0D0D0D;
        }
        .role-card.selected .card-label {
          color: #FFFFFF;
        }
        .role-card.selected .card-tagline {
          color: rgba(255,255,255,0.5);
          border-color: rgba(255,255,255,0.2);
        }
        .role-card.selected .card-description {
          color: rgba(255,255,255,0.75);
        }
        .role-card.selected .card-check {
          background: #E8561B;
          border-color: #E8561B;
        }
        .role-card.selected .card-check svg {
          display: block;
        }
      `}</style>

      {/* Wordmark */}
      <a
        href="/"
        style={{
          marginBottom: "3rem",
          display: "flex",
          alignItems: "center",
          gap: 8,
          textDecoration: "none",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 28,
            height: 28,
            borderRadius: 6,
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <Image src="/logo.jpeg" alt="SpecFlow" fill className="object-cover" priority />
        </div>
        <span
          style={{
            fontSize: "1.375rem",
            fontWeight: 600,
            color: "#0D0D0D",
            letterSpacing: "-0.025em",
            fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
          }}
        >
          SpecFlow
        </span>
      </a>

      <div
        style={{
          width: "100%",
          maxWidth: 720,
          opacity: 0,
          animation: "fadeUp 0.35s ease forwards",
        }}
      >
        {/* Heading */}
        <div style={{ marginBottom: "2.5rem", textAlign: "center" }}>
          <h1
            style={{
              fontFamily: "var(--font-instrument), 'Instrument Serif', serif",
              fontSize: "clamp(2rem, 5vw, 3rem)",
              fontWeight: 400,
              letterSpacing: "-0.025em",
              color: "#0D0D0D",
              lineHeight: 1.1,
              margin: "0 0 0.75rem",
            }}
          >
            How do you work?
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "#6B6B6B",
              margin: 0,
              lineHeight: 1.6,
              fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
            }}
          >
            SpecFlow adapts its workflow to your role. Pick the one that fits.
          </p>
        </div>

        {/* Role cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: "2rem",
          }}
        >
          {ROLES.map((role, i) => (
            <button
              key={role.id}
              type="button"
              onClick={() => setSelected(role.id)}
              className={`role-card${selected === role.id ? " selected" : ""}`}
              style={{ animationDelay: `${0.1 + i * 0.07}s` }}
              aria-pressed={selected === role.id}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span
                  className="card-tagline"
                  style={{
                    display: "inline-block",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase" as const,
                    color: "#9E9E9E",
                    border: "1px solid #E4DDD4",
                    borderRadius: 99,
                    padding: "3px 10px",
                    fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                    transition: "color 180ms ease, border-color 180ms ease",
                  }}
                >
                  {role.tagline}
                </span>
                {/* Check indicator */}
                <div
                  className="card-check"
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: "1.5px solid #E4DDD4",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 180ms ease, border-color 180ms ease",
                  }}
                >
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 12 12"
                    fill="none"
                    style={{ display: "none" }}
                  >
                    <polyline
                      points="2 6 5 9 10 3"
                      stroke="#FFFFFF"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              <div
                className="card-label"
                style={{
                  fontFamily:
                    "var(--font-instrument), 'Instrument Serif', serif",
                  fontSize: "1.625rem",
                  fontWeight: 400,
                  color: "#0D0D0D",
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  transition: "color 180ms ease",
                }}
              >
                {role.label}
              </div>

              <div
                className="card-description"
                style={{
                  fontSize: 14,
                  color: "#6B6B6B",
                  lineHeight: 1.6,
                  fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                  transition: "color 180ms ease",
                }}
              >
                {role.description}
              </div>
            </button>
          ))}
        </div>

        {/* CTA */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selected || submitting}
            style={{
              minWidth: 200,
              padding: "13px 32px",
              background: selected && !submitting ? "#0D0D0D" : "#E4DDD4",
              color: selected && !submitting ? "#FFFFFF" : "#9E9E9E",
              border: "none",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 500,
              cursor: selected && !submitting ? "pointer" : "not-allowed",
              fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
              transition: "background 200ms ease, color 200ms ease",
              letterSpacing: "-0.01em",
            }}
          >
            {submitting ? "Setting up…" : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}
