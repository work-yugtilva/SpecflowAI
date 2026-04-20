"use client";

import React, { useMemo, useState } from "react";

type PaidPlan = "pro" | "team";

type PricingCard = {
  name: "Free" | "Pro" | "Team";
  priceLabel: string;
  description: string;
  features: string[];
  ctaLabel: string;
  plan?: PaidPlan;
  highlight?: boolean;
};

const PRICING_CARDS: PricingCard[] = [
  {
    name: "Free",
    priceLabel: "$0",
    description: "Try SpecFlow with your first two pipeline runs and no credit card.",
    features: [
      "2 full pipeline runs",
      "All five workflow steps",
      "Session management",
      "PRD generation",
    ],
    ctaLabel: "Stay on Free",
  },
  {
    name: "Pro",
    priceLabel: "$49/mo",
    description: "For solo PMs and operators who want recurring AI-assisted spec work.",
    features: [
      "$15 AI credit each month",
      "Step-level regenerations",
      "Priority support",
      "Hosted customer portal",
    ],
    ctaLabel: "Upgrade to Pro",
    plan: "pro",
    highlight: true,
  },
  {
    name: "Team",
    priceLabel: "$99/mo",
    description: "For teams running SpecFlow continuously across multiple product streams.",
    features: [
      "$100 AI credit each month",
      "Higher monthly usage cap",
      "Shared billing controls",
      "Best fit for active teams",
    ],
    ctaLabel: "Upgrade to Team",
    plan: "team",
  },
];

async function createCheckout(plan: PaidPlan): Promise<string> {
  const response = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      plan,
      success_url: `${window.location.origin}/dashboard?upgraded=true`,
      cancel_url: `${window.location.origin}/pricing`,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error ?? data?.detail ?? "Unable to start checkout");
  }
  return data.url as string;
}

export function BillingPricingClient({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [pendingPlan, setPendingPlan] = useState<PaidPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const freeCard = useMemo(() => PRICING_CARDS[0], []);

  async function handleUpgrade(plan: PaidPlan) {
    if (!isAuthenticated) {
      window.location.assign("/login");
      return;
    }

    try {
      setError(null);
      setPendingPlan(plan);
      const url = await createCheckout(plan);
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout");
      setPendingPlan(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {[freeCard, ...PRICING_CARDS.slice(1)].map((card) => (
        <section
          key={card.name}
          style={{
            background: card.highlight ? "#0D0D0D" : "#FFFFFF",
            color: card.highlight ? "#FFFFFF" : "#0D0D0D",
            border: card.highlight ? "1px solid rgba(232,86,27,0.35)" : "1px solid #E4DDD4",
            borderRadius: 20,
            padding: "2rem",
            boxShadow: card.highlight
              ? "0 16px 48px rgba(232,86,27,0.16)"
              : "0 8px 24px rgba(0,0,0,0.05)",
          }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: card.highlight ? "rgba(255,255,255,0.6)" : "#8E857B",
              marginBottom: 12,
            }}
          >
            {card.name}
          </p>
          <h2
            style={{
              fontFamily: "var(--font-instrument), 'Instrument Serif', Georgia, serif",
              fontSize: "2.6rem",
              fontWeight: 400,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              marginBottom: 12,
            }}
          >
            {card.priceLabel}
          </h2>
          <p
            style={{
              color: card.highlight ? "rgba(255,255,255,0.72)" : "#6B6B6B",
              fontSize: 14,
              lineHeight: 1.6,
              marginBottom: 24,
            }}
          >
            {card.description}
          </p>

          <ul style={{ display: "grid", gap: 10, marginBottom: 24, paddingLeft: 18 }}>
            {card.features.map((feature) => (
              <li
                key={feature}
                style={{
                  color: card.highlight ? "rgba(255,255,255,0.84)" : "#3A3530",
                  fontSize: 13.5,
                  lineHeight: 1.5,
                }}
              >
                {feature}
              </li>
            ))}
          </ul>

          {card.plan ? (
            <button
              type="button"
              onClick={() => void handleUpgrade(card.plan!)}
              disabled={pendingPlan === card.plan}
              style={{
                width: "100%",
                borderRadius: 999,
                padding: "0.8rem 1rem",
                border: card.highlight ? "none" : "1.5px solid #0D0D0D",
                background: card.highlight ? "#E8561B" : "transparent",
                color: card.highlight ? "#FFFFFF" : "#0D0D0D",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                opacity: pendingPlan === card.plan ? 0.7 : 1,
              }}
            >
              {pendingPlan === card.plan ? "Redirecting…" : card.ctaLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => window.location.assign(isAuthenticated ? "/dashboard" : "/login")}
              style={{
                width: "100%",
                borderRadius: 999,
                padding: "0.8rem 1rem",
                border: "1.5px solid #0D0D0D",
                background: "transparent",
                color: "#0D0D0D",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {isAuthenticated ? card.ctaLabel : "Get started free"}
            </button>
          )}
        </section>
      ))}

      {error ? (
        <p
          style={{
            gridColumn: "1 / -1",
            marginTop: 8,
            color: "#B42318",
            fontSize: 13,
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
