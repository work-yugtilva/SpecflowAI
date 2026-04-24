"use client";

import React from "react";
import Link from "next/link";
import { CheckCircle2, Star } from "lucide-react";
import styles from "./landing.module.css";

const plans = [
  {
    ctaHref: "/signup?plan=starter",
    ctaLabel: "Get started free",
    featured: false,
    name: "Starter",
    period: "forever",
    price: "Free",
    features: ["3 briefs per month", "2 integrations", "Default brief template", "Email support"],
  },
  {
    ctaHref: "/signup?plan=pro",
    ctaLabel: "Start free trial",
    featured: true,
    name: "Pro",
    period: "per month, billed monthly",
    price: "$49",
    features: [
      "Unlimited briefs",
      "All 8 integrations",
      "Custom brief templates",
      "Slack support",
      "Export to Markdown, Notion, Google Doc",
    ],
  },
  {
    ctaHref: "/signup?plan=team",
    ctaLabel: "Talk to sales",
    featured: false,
    name: "Team",
    period: "per month, up to 5 seats",
    price: "$149",
    features: ["Everything in Pro", "5 seats included", "SSO & SAML", "API access", "Priority support"],
  },
];

export default function Pricing() {
  return (
    <>
      <hr className={styles.sectionRule} />
      <section aria-label="Pricing" id="pricing">
        <div className={styles.sectionWrap}>
          <div className="fade-in">
            <p className={styles.sectionEyebrow}>Pricing</p>
            <h2 className={styles.sectionHeading}>Simple, transparent pricing.</h2>
            <p className={styles.sectionSub}>
              Start free. Scale when your team does. No per-seat charges until the Team plan.
            </p>
          </div>

          <div className={`fade-in ${styles.pricingGrid}`}>
            {plans.map((plan) => (
              <div
                className={`${styles.pricingCard} ${
                  plan.featured ? styles.pricingCardFeatured : ""
                }`}
                key={plan.name}
              >
                {plan.featured ? (
                  <div className={styles.pricingBadge}>
                    <Star fill="currentColor" size={10} />
                    Most popular
                  </div>
                ) : null}

                <div className={styles.pricingTier}>{plan.name}</div>
                <p className={styles.pricingPrice}>{plan.price}</p>
                <p className={styles.pricingPriceSub}>{plan.period}</p>
                <div className={styles.pricingDivider} />

                <ul className={styles.pricingFeatures}>
                  {plan.features.map((feature) => (
                    <li className={styles.pricingFeature} key={feature}>
                      <CheckCircle2 color="var(--orange)" size={16} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  className={`${styles.pricingCta} ${
                    plan.featured ? styles.pricingCtaPrimary : styles.pricingCtaGhost
                  }`}
                  href={plan.ctaHref}
                >
                  {plan.ctaLabel}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
