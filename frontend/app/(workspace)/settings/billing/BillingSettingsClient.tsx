"use client";

import React from "react";
import Link from "next/link";
import { useEffect, useState } from "react";

type UserPlan = {
  plan: string;
  plan_label: string;
  price_dollars: number;
  pipeline_runs_used: number;
  api_credit_used_cents: number;
  api_credit_used_dollars: number;
  limit_type: "runs" | "credit";
  max_pipeline_runs?: number;
  max_credit_dollars?: number;
  stripe_customer_id?: string | null;
};

export function BillingSettingsClient() {
  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPlan() {
      try {
        const response = await fetch("/api/user/plan", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error ?? data?.detail ?? "Unable to load billing state");
        }
        if (!cancelled) {
          setPlan(data as UserPlan);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load billing state");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPlan();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleManageBilling() {
    try {
      setManaging(true);
      const response = await fetch("/api/billing/portal", {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? data?.detail ?? "Unable to open billing portal");
      }
      window.location.assign(data.url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open billing portal");
      setManaging(false);
    }
  }

  if (loading) {
    return <p style={{ fontSize: 14, color: "#6B6B6B" }}>Loading billing details…</p>;
  }

  if (error) {
    return <p style={{ fontSize: 14, color: "#B42318" }}>{error}</p>;
  }

  if (!plan) {
    return <p style={{ fontSize: 14, color: "#6B6B6B" }}>No billing data available.</p>;
  }

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E4DDD4",
        borderRadius: 18,
        padding: 28,
        display: "grid",
        gap: 20,
      }}
    >
      <div>
        <p
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#8E857B",
            marginBottom: 8,
          }}
        >
          Current Plan
        </p>
        <h2
          style={{
            fontFamily: "var(--font-instrument), 'Instrument Serif', Georgia, serif",
            fontSize: "2.4rem",
            fontWeight: 400,
            letterSpacing: "-0.04em",
            color: "#0D0D0D",
            marginBottom: 6,
          }}
        >
          {plan.plan_label}
        </h2>
        <p style={{ fontSize: 14, color: "#6B6B6B", lineHeight: 1.6 }}>
          {plan.price_dollars === 0
            ? "You are currently on the free tier."
            : `$${plan.price_dollars}/month with Stripe-managed billing.`}
        </p>
      </div>

      <div
        style={{
          background: "#F8F4EF",
          borderRadius: 14,
          padding: 18,
          display: "grid",
          gap: 8,
        }}
      >
        <p style={{ fontSize: 13, fontWeight: 600, color: "#0D0D0D" }}>Usage</p>
        <p style={{ fontSize: 13.5, color: "#6B6B6B", margin: 0 }}>
          {plan.limit_type === "runs"
            ? `${plan.pipeline_runs_used} of ${plan.max_pipeline_runs ?? 0} runs used`
            : `$${(plan.api_credit_used_dollars ?? 0).toFixed(2)} of $${(plan.max_credit_dollars ?? 0).toFixed(0)} used`}
        </p>
      </div>

      {plan.stripe_customer_id ? (
        <button
          type="button"
          onClick={() => void handleManageBilling()}
          disabled={managing}
          style={{
            width: "fit-content",
            borderRadius: 999,
            padding: "0.8rem 1.1rem",
            background: "#0D0D0D",
            color: "#FFFFFF",
            border: "none",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            opacity: managing ? 0.7 : 1,
          }}
        >
          {managing ? "Opening…" : "Manage Billing"}
        </button>
      ) : (
        <Link
          href="/pricing"
          style={{
            width: "fit-content",
            borderRadius: 999,
            padding: "0.8rem 1.1rem",
            background: "#E8561B",
            color: "#FFFFFF",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Upgrade Plan
        </Link>
      )}
    </div>
  );
}
