"use client";

const CHECK_ICON = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    style={{ flexShrink: 0 }}
  >
    <circle cx="8" cy="8" r="8" fill="rgba(232,86,27,0.12)" />
    <path
      d="M5 8l2 2 4-4"
      stroke="#E8561B"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Try SpecFlow with your first two products — no credit card needed.",
    limit: "2 full pipeline runs",
    limitNote: "Single-step regenerations included",
    features: [
      "2 complete pipeline runs",
      "All 5 pipeline steps",
      "Session management",
      "PRD generation",
      "Linear sync",
    ],
    cta: "Get started free",
    ctaHref: "/login",
    highlight: false,
    badge: null,
  },
  {
    name: "Pro",
    price: "$30",
    period: "/ month",
    description:
      "For PMs who ship continuously. $15 of AI credit covers ~30 full pipeline runs.",
    limit: "$15 AI credit / month",
    limitNote: "≈30 full runs · ≈150 step regenerations",
    features: [
      "Everything in Free",
      "$15 of monthly AI credit",
      "~30 full pipeline runs",
      "Step-level regenerations",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
    ctaHref: "/login",
    highlight: true,
    badge: "Most popular",
  },
  {
    name: "Unlimited",
    price: "$199",
    period: "/ month",
    description:
      "For teams who run SpecFlow daily. $100 of AI credit — never think about limits.",
    limit: "$100 AI credit / month",
    limitNote: "≈200 full runs · unlimited regenerations",
    features: [
      "Everything in Pro",
      "$100 of monthly AI credit",
      "~200 full pipeline runs",
      "Team collaboration (coming soon)",
      "Dedicated onboarding",
      "SLA support",
    ],
    cta: "Go Unlimited",
    ctaHref: "/login",
    highlight: false,
    badge: "Best value",
  },
];

export default function PricingSection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
      {plans.map((plan) => (
        <div
          key={plan.name}
          style={{
            background: plan.highlight ? "#0D0D0D" : "#FFFFFF",
            border: plan.highlight
              ? "1px solid rgba(232,86,27,0.4)"
              : "1px solid #E4DDD4",
            borderRadius: 20,
            padding: "2rem",
            position: "relative",
            boxShadow: plan.highlight
              ? "0 8px 40px rgba(232,86,27,0.15), 0 2px 8px rgba(0,0,0,0.12)"
              : "0 2px 12px rgba(0,0,0,0.04)",
            transition: "transform 0.22s ease, box-shadow 0.22s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
            (e.currentTarget as HTMLDivElement).style.boxShadow = plan.highlight
              ? "0 16px 56px rgba(232,86,27,0.22), 0 4px 16px rgba(0,0,0,0.16)"
              : "0 8px 32px rgba(0,0,0,0.10)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
            (e.currentTarget as HTMLDivElement).style.boxShadow = plan.highlight
              ? "0 8px 40px rgba(232,86,27,0.15), 0 2px 8px rgba(0,0,0,0.12)"
              : "0 2px 12px rgba(0,0,0,0.04)";
          }}
        >
          {/* Badge */}
          {plan.badge && (
            <div
              style={{
                position: "absolute",
                top: -14,
                left: "50%",
                transform: "translateX(-50%)",
                background: plan.highlight ? "#E8561B" : "#0D0D0D",
                color: "#FFFFFF",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "4px 12px",
                borderRadius: 99,
                whiteSpace: "nowrap",
              }}
            >
              {plan.badge}
            </div>
          )}

          {/* Plan name */}
          <p
            style={{
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: plan.highlight ? "rgba(255,255,255,0.5)" : "#9E9E9E",
              marginBottom: 12,
            }}
          >
            {plan.name}
          </p>

          {/* Price */}
          <div className="flex items-end gap-1 mb-2">
            <span
              style={{
                fontFamily: "var(--font-instrument), 'Instrument Serif', Georgia, serif",
                fontSize: "clamp(2.5rem, 4vw, 3.25rem)",
                fontWeight: 400,
                letterSpacing: "-0.03em",
                lineHeight: 1,
                color: plan.highlight ? "#FFFFFF" : "#0D0D0D",
              }}
            >
              {plan.price}
            </span>
            <span
              style={{
                fontSize: 14,
                color: plan.highlight ? "rgba(255,255,255,0.45)" : "#9E9E9E",
                paddingBottom: 6,
              }}
            >
              {plan.period}
            </span>
          </div>

          {/* Description */}
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: plan.highlight ? "rgba(255,255,255,0.6)" : "#6B6B6B",
              marginBottom: 20,
            }}
          >
            {plan.description}
          </p>

          {/* Usage limit chip */}
          <div
            style={{
              background: plan.highlight
                ? "rgba(232,86,27,0.18)"
                : "rgba(232,86,27,0.07)",
              border: plan.highlight
                ? "1px solid rgba(232,86,27,0.35)"
                : "1px solid rgba(232,86,27,0.18)",
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 24,
            }}
          >
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: plan.highlight ? "#FF8A5C" : "#E8561B",
                marginBottom: 2,
              }}
            >
              {plan.limit}
            </p>
            <p
              style={{
                fontSize: 11.5,
                color: plan.highlight ? "rgba(255,255,255,0.45)" : "#9E9E9E",
              }}
            >
              {plan.limitNote}
            </p>
          </div>

          {/* CTA */}
          <a
            href={plan.ctaHref}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              padding: "0.75rem 1.25rem",
              borderRadius: 99,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              textDecoration: "none",
              transition: "transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease",
              background: plan.highlight ? "#E8561B" : "transparent",
              color: plan.highlight ? "#FFFFFF" : "#0D0D0D",
              border: plan.highlight ? "none" : "1.5px solid #0D0D0D",
              marginBottom: 24,
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.transform = "translateY(-1px)";
              if (plan.highlight) {
                el.style.background = "#D44A12";
                el.style.boxShadow = "0 4px 16px rgba(232,86,27,0.4)";
              } else {
                el.style.background = "#0D0D0D";
                el.style.color = "#FFFFFF";
              }
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.transform = "translateY(0)";
              if (plan.highlight) {
                el.style.background = "#E8561B";
                el.style.boxShadow = "none";
              } else {
                el.style.background = "transparent";
                el.style.color = "#0D0D0D";
              }
            }}
          >
            {plan.cta}
          </a>

          {/* Features */}
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {plan.features.map((f) => (
              <li key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {CHECK_ICON}
                <span
                  style={{
                    fontSize: 13.5,
                    color: plan.highlight ? "rgba(255,255,255,0.75)" : "#444",
                  }}
                >
                  {f}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
