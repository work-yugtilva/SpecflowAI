"use client";

import React from "react";
import Link from "next/link";
import { useEffect } from "react";
import styles from "./landing.module.css";

const headline = ["From 4 days", "to 12 minutes."];
const companies = ["Stripe", "Notion", "Vercel", "Retool", "Loom", "Slack"];
const stats = [
  { label: "product teams", value: "200+" },
  { label: "briefs generated", value: "2,400+" },
  { label: "avg. time to spec", value: "11.8 min" },
];

export default function Hero() {
  useEffect(() => {
    const timers: number[] = [];
    const chars = Array.from(document.querySelectorAll<HTMLElement>(".char"));

    chars.forEach((char, index) => {
      const timeout = window.setTimeout(() => {
        char.style.opacity = "1";
        char.style.transform = "translate3d(0, 0, 0)";
        char.style.transition =
          "opacity 500ms ease-out, transform 500ms cubic-bezier(0.16, 1, 0.3, 1)";
      }, 200 + index * 30);

      timers.push(timeout);
    });

    const revealTargets = Array.from(document.querySelectorAll<HTMLElement>(".fade-in"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 }
    );

    revealTargets.forEach((target) => observer.observe(target));

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
    };
  }, []);

  return (
    <section className={styles.hero}>
      <video autoPlay className={styles.heroVideo} loop muted playsInline>
        <source src="/assets/blueprint-loop.mp4" type="video/mp4" />
      </video>
      <div className={styles.heroBackdrop} />

      <div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          <p className={`${styles.heroEyebrow} fade-in`}>
            AI-powered product discovery for teams that ship fast
          </p>

          <h1 className={styles.heroTitle}>
            {headline.map((line) => (
              <span className={styles.heroLine} key={line}>
                {Array.from(line).map((character, index) => (
                  <span
                    className={`${styles.heroChar} char`}
                    key={`${line}-${index}`}
                  >
                    {character === " " ? "\u00A0" : character}
                  </span>
                ))}
              </span>
            ))}
          </h1>

          <p className={`${styles.heroSubtitle} fade-in`}>
            Feed SpecFlow your research — interviews, tickets, Slack threads. Get back a
            stakeholder-ready spec with rationale, UI changes, and tasks. Push to Jira,
            export a handoff, or open in your coding agent—in one flow.
          </p>

          <div className={`${styles.heroActions} fade-in`}>
            <Link className={styles.heroPrimary} href="/signup">
              Get started free →
            </Link>
            <button
              className={styles.heroSecondary}
              onClick={() =>
                document.getElementById("landing-cinematic-section")?.scrollIntoView({
                  behavior: "smooth",
                })
              }
              type="button"
            >
              Watch a demo
            </button>
          </div>

          <div className={`${styles.logoBar} fade-in`}>
            <span className={styles.logoBarLabel}>Trusted by teams at →</span>
            {companies.map((company) => (
              <span className={styles.logoChip} key={company}>
                {company}
              </span>
            ))}
          </div>
        </div>

        <div className="fade-in">
          <div className={`${styles.heroStatCard} liquid-glass`}>
            {stats.map((stat, index) => (
              <div className={styles.heroStatEntry} key={stat.label}>
                {index > 0 ? <div className={styles.heroStatDivider} /> : null}
                <span className={styles.heroStatValue}>{stat.value}</span>
                <span className={styles.heroStatLabel}>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
