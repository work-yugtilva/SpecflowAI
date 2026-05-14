"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowUp,
  Circle,
  Clock3,
  FileText,
  Layers3,
  Link2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { Fragment, useEffect } from "react";
import styles from "./landing.module.css";

const overviewCards = [
  {
    id: "landing-card-tl",
    icon: <Zap size={18} />,
    label: "Discovery Time",
    value: "< 5 minutes",
  },
  {
    id: "landing-card-bl",
    icon: <Layers3 size={18} />,
    label: "What you get",
    value: "Brief · Tasks · UI spec",
  },
  {
    id: "landing-card-tr",
    icon: <Link2 size={18} />,
    label: "Works with",
    value: "Jira · Cursor · Claude",
  },
  {
    id: "landing-card-br",
    icon: <Star size={18} />,
    label: "Signal source",
    value: "Real customer data",
  },
];

const pipelineCards = [
  {
    body: "Interviews, tickets, Slack — everything that already tells the story",
    icon: <ArrowUp color="#e4611a" size={32} />,
    id: "landing-pipe-card-1",
    step: "01",
    title: "Connect Sources",
  },
  {
    body: "AI surfaces what users actually need — not just what they said",
    icon: <Sparkles color="#e4611a" size={32} />,
    id: "landing-pipe-card-2",
    step: "02",
    title: "AI Synthesis",
  },
  {
    body: "Rationale, UI changes, data model, tasks — one complete document your whole team actually reads",
    icon: <FileText color="#e4611a" size={32} />,
    id: "landing-pipe-card-3",
    step: "03",
    title: "Feature Brief",
  },
  {
    body: "One click to Jira, Notion, or Cursor — no copy-paste",
    icon: <Send color="#e4611a" size={32} />,
    id: "landing-pipe-card-4",
    step: "04",
    title: "Push to Team",
  },
];

const quotes = [
  {
    attr: "— Head of Product, B2B SaaS · Series B",
    id: "landing-cin-quote-left",
    text: '"We shipped a feature in 3 days that used to take 2 weeks to spec."',
  },
  {
    attr: "— Founding PM, YC W24 · 0→1 product",
    id: "landing-cin-quote-center",
    mark: true,
    text: "Finally, a tool that starts with the customer, not the ticket.",
  },
  {
    attr: "— CEO, developer tools startup · 14-person team",
    id: "landing-cin-quote-right",
    text: `"Our eng lead said it was the clearest brief they'd ever received."`,
  },
];

const beforeItems = [
  "3–5 days writing a PRD from scratch in a blank Google Doc",
  "Research lives in Zoom, Jira, Notion, and Slack — never connected",
  "Engineering starts without full context — then asks questions",
  "Alignment meetings eat the week before a single line of code",
  "Stakeholder edits reopen the scope every time",
];

const afterItems = [
  "Full spec generated from your raw signals in one session",
  "Slack, Gong, Zendesk, and docs unified — automatically cited",
  "Engineering gets context, rationale, and tasks in one doc",
  "Async by default — review when you're ready, not in a meeting",
  "One source of truth. Always traceable to real customer data.",
];

const demoTypingText = `## Checkout Redesign

**Problem statement**
34% of users abandon at payment step.
127 Zendesk tickets · 8 Gong calls · 3 NPS mentions

**Proposed solution**
Collapse 3-step checkout to single page.
Add Apple Pay, Google Pay, and address auto-fill.

**Acceptance criteria**
- Cart → confirm in ≤ 3 taps
- Payment error rate < 0.5%
- Works on iOS Safari 16+

**Tasks for engineering**
- [ ] Redesign checkout route /cart/checkout
- [ ] Integrate Stripe payment request API
- [ ] Add address autocomplete
- [ ] A/B test rollout via feature flag...`;

function ComparePanel({
  footer,
  items,
  title,
  variant,
}: {
  footer: string;
  items: string[];
  title: string;
  variant: "after" | "before";
}) {
  const isAfter = variant === "after";

  return (
    <div className={`${styles.compareInner} ${isAfter ? styles.compareAfter : styles.compareBefore}`}>
      <div className={styles.compareHeader}>
        <div className={styles.compareHeaderLabel}>
          <span className={styles.compareDot} />
          {isAfter ? "SPECFLOW" : "BEFORE"}
        </div>
        {isAfter ? <Star color="#E8561B" size={14} /> : <Clock3 color="#9E9E9E" size={14} />}
      </div>
      <div className={styles.compareTitle}>{title}</div>
      <div className={styles.compareList}>
        {items.map((item) => (
          <div className={styles.compareItem} key={item}>
            {isAfter ? <Circle color="#E8561B" fill="#E8561B" size={18} /> : <Plus color="#9E9E9E" size={18} />}
            <span className={styles.compareItemText}>{item}</span>
          </div>
        ))}
      </div>
      <div className={styles.compareFooter}>
        {isAfter ? <Star color="#E8561B" size={13} /> : <Clock3 color="#9E9E9E" size={13} />}
        <span className={styles.compareFooterText}>{footer}</span>
      </div>
    </div>
  );
}

export default function CinematicScroll() {
  useEffect(() => {
    const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const mapRange = (value: number, inStart: number, inEnd: number, outStart: number, outEnd: number) =>
      lerp(outStart, outEnd, clamp01((value - inStart) / (inEnd - inStart)));
    const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let isMobile = window.innerWidth < 768;
    let rafId = 0;
    let resizeRafId = 0;
    let typingTimer: number | null = null;
    let typingIndex = 0;
    let typingActive = false;
    let scrollTicking = false;

    const cinematic = byId<HTMLDivElement>("landing-cinematic");
    const headline = byId<HTMLHeadingElement>("landing-cin-headline");
    const sub = byId<HTMLParagraphElement>("landing-cin-sub");
    const chip = byId<HTMLDivElement>("landing-cin-chip-outer");
    const claim = byId<HTMLParagraphElement>("landing-cin-claim");
    const rule = byId<HTMLDivElement>("landing-cin-rule");
    const eyebrow = byId<HTMLParagraphElement>("landing-cin-eyebrow");
    const cta = byId<HTMLAnchorElement>("landing-cin-cta-btn");
    const sub5 = byId<HTMLParagraphElement>("landing-cin-sub5");
    const progressWrap = byId<HTMLDivElement>("landing-cin-progress-wrap");
    const progressFill = byId<HTMLDivElement>("landing-cin-progress-fill");
    const act6Label = byId<HTMLParagraphElement>("landing-cin-act6-label");
    const pipeLine = byId<HTMLDivElement>("landing-cin-pipe-line");
    const act7Label = byId<HTMLParagraphElement>("landing-cin-act7-label");
    const proofBar = byId<HTMLParagraphElement>("landing-cin-proof-bar");
    const finalHeadline = byId<HTMLParagraphElement>("landing-cin-final-headline");
    const finalRule = byId<HTMLDivElement>("landing-cin-final-rule");
    const finalButtons = byId<HTMLDivElement>("landing-cin-final-btns");
    const finalSub = byId<HTMLParagraphElement>("landing-cin-final-sub");
    const demoLabel = byId<HTMLParagraphElement>("landing-cin-demo-label");
    const demoChrome = byId<HTMLDivElement>("landing-cin-demo-chrome");
    const demoTypingCard = byId<HTMLDivElement>("landing-cin-demo-typing-card");
    const typingOutput = byId<HTMLDivElement>("landing-cin-typing-output");
    const act10Label = byId<HTMLParagraphElement>("landing-cin-act10-label");
    const beforePanel = byId<HTMLDivElement>("landing-cin-before-panel");
    const afterPanel = byId<HTMLDivElement>("landing-cin-after-panel");
    const compareDivider = byId<HTMLDivElement>("landing-cin-compare-divider");
    const compareVs = byId<HTMLDivElement>("landing-cin-compare-vs");
    const compareCta = byId<HTMLDivElement>("landing-cin-compare-cta");
    const cards = overviewCards.map((card) => byId<HTMLDivElement>(card.id));
    const pipeCards = pipelineCards.map((card) => byId<HTMLDivElement>(card.id));
    const pipeArrows = [
      byId<HTMLSpanElement>("landing-pipe-arrow-12"),
      byId<HTMLSpanElement>("landing-pipe-arrow-23"),
      byId<HTMLSpanElement>("landing-pipe-arrow-34"),
    ];
    const quoteLeft = byId<HTMLDivElement>("landing-cin-quote-left");
    const quoteCenter = byId<HTMLDivElement>("landing-cin-quote-center");
    const quoteRight = byId<HTMLDivElement>("landing-cin-quote-right");

    if (
      !cinematic ||
      !headline ||
      !sub ||
      !chip ||
      !claim ||
      !rule ||
      !eyebrow ||
      !cta ||
      !sub5 ||
      !progressWrap ||
      !progressFill ||
      !act6Label ||
      !pipeLine ||
      !act7Label ||
      !proofBar ||
      !finalHeadline ||
      !finalRule ||
      !finalButtons ||
      !finalSub ||
      !demoLabel ||
      !demoChrome ||
      !demoTypingCard ||
      !typingOutput ||
      !act10Label ||
      !beforePanel ||
      !afterPanel ||
      !compareDivider ||
      !compareVs ||
      !compareCta ||
      cards.some((card) => !card) ||
      pipeCards.some((card) => !card) ||
      pipeArrows.some((arrow) => !arrow) ||
      !quoteLeft ||
      !quoteCenter ||
      !quoteRight
    ) {
      return undefined;
    }

    const safeCards = cards as HTMLDivElement[];
    const safePipeCards = pipeCards as HTMLDivElement[];
    const safePipeArrows = pipeArrows as HTMLSpanElement[];

    const headlineLetters: HTMLSpanElement[] = [];
    const claimWords: HTMLSpanElement[] = [];
    const finalWords: HTMLSpanElement[] = [];

    headline.textContent = "";
    claim.textContent = "";
    finalHeadline.textContent = "";

    "From 4 days to 12 minutes.".split("").forEach((character) => {
      const span = document.createElement("span");
      span.className = "landing-cin-letter";
      span.textContent = character === " " ? "\u00A0" : character;
      span.style.opacity = prefersReduced ? "1" : "0";
      span.style.filter = prefersReduced ? "none" : "blur(12px)";
      span.style.transform = prefersReduced ? "none" : "translateY(20px)";
      headline.appendChild(span);
      headlineLetters.push(span);
    });

    "Your next feature is already in your Zendesk.".split(" ").forEach((word) => {
      const span = document.createElement("span");
      span.className = "landing-cin-word";
      span.textContent = word;
      span.style.opacity = prefersReduced ? "1" : "0";
      span.style.transform = prefersReduced ? "none" : "translateY(16px)";
      claim.appendChild(span);
      claimWords.push(span);
    });

    "Stop guessing. Start shipping what users need.".split(" ").forEach((word) => {
      const span = document.createElement("span");
      span.className = "landing-cin-final-word";
      span.textContent = word;
      span.style.opacity = prefersReduced ? "1" : "0";
      span.style.transform = prefersReduced ? "none" : "translateY(16px)";
      finalHeadline.appendChild(span);
      finalWords.push(span);
    });

    const cardTargets = [
      [-320, -130],
      [-320, 130],
      [320, -130],
      [320, 130],
    ] as const;

    const startTyping = () => {
      if (typingActive) {
        return;
      }

      typingActive = true;
      typingTimer = window.setInterval(() => {
        if (typingIndex < demoTypingText.length) {
          typingIndex += 1;
          typingOutput.textContent = demoTypingText.slice(0, typingIndex);
        } else if (typingTimer !== null) {
          window.clearInterval(typingTimer);
          typingTimer = null;
        }
      }, 28);
    };

    const stopTyping = () => {
      if (typingTimer !== null) {
        window.clearInterval(typingTimer);
        typingTimer = null;
      }
      typingActive = false;
      typingIndex = 0;
      typingOutput.textContent = "";
    };

    const resetLayout = () => {
      const offscreen = 620;

      safeCards.forEach((card, index) => {
        const [targetX, targetY] = cardTargets[index];
        const startX = targetX < 0 ? targetX - offscreen : targetX + offscreen;
        card.style.opacity = "0";
        card.style.transform = `translate(calc(-50% + ${startX}px), calc(-50% + ${targetY}px))`;
      });

      quoteLeft.style.transform = "translate(calc(-50% - 600px), -50%) rotate(-4deg)";
      quoteLeft.style.opacity = "0";
      quoteCenter.style.transform = "translate(-50%, calc(-50% + 60px))";
      quoteCenter.style.opacity = "0";
      quoteRight.style.transform = "translate(calc(-50% + 600px), -50%) rotate(4deg)";
      quoteRight.style.opacity = "0";

      if (isMobile) {
        progressWrap.style.display = "none";
      } else {
        progressWrap.style.display = "block";
      }
    };

    const update = () => {
      const rect = cinematic.getBoundingClientRect();
      const scrolled = -rect.top;
      const total = cinematic.offsetHeight - window.innerHeight;
      const progress = clamp01(scrolled / total);

      if (prefersReduced) {
        progressFill.style.height = `${progress * 120}px`;
        return;
      }

      headlineLetters.forEach((letter, index) => {
        const start = (index / headlineLetters.length) * 0.075;
        const end = start + 0.04;
        const letterProgress = clamp01((progress - start) / (end - start));
        letter.style.opacity = `${letterProgress}`;
        letter.style.filter = `blur(${lerp(12, 0, letterProgress)}px)`;
        letter.style.transform = `translateY(${lerp(20, 0, letterProgress)}px)`;
      });

      sub.style.opacity = `${mapRange(progress, 0.06, 0.09, 0, 1)}`;

      const act2Progress = clamp01((progress - 0.1) / 0.075);
      headline.style.transform = `translate(calc(-50% + ${lerp(
        0,
        -window.innerWidth * 0.38,
        act2Progress
      )}px), calc(-50% + ${lerp(0, -window.innerHeight * 0.42, act2Progress)}px)) scale(${lerp(
        1,
        0.22,
        act2Progress
      )})`;
      chip.style.opacity = `${act2Progress}`;
      chip.style.transform = `translate(-50%, calc(-50% + ${lerp(60, 0, act2Progress)}px)) scale(${lerp(
        0.8,
        1,
        act2Progress
      )})`;

      safeCards.forEach((card, index) => {
        if (isMobile) {
          const mobileProgress = clamp01((progress - 0.2) / 0.03);
          const mobileOffsets = [
            [-110, 100],
            [-110, 220],
            [110, 100],
            [110, 220],
          ];
          card.style.opacity = `${mobileProgress}`;
          card.style.transform = `translate(calc(-50% + ${mobileOffsets[index][0]}px), calc(-50% + ${mobileOffsets[index][1]}px))`;
          return;
        }

        const start = 0.2 + index * 0.015;
        const end = 0.29 + index * 0.015;
        const cardProgress = clamp01((progress - start) / (end - start));
        const [targetX, targetY] = cardTargets[index];
        const offscreen = 620;
        const startX = targetX < 0 ? targetX - offscreen : targetX + offscreen;
        card.style.opacity = `${cardProgress}`;
        card.style.transform = `translate(calc(-50% + ${lerp(
          startX,
          targetX,
          cardProgress
        )}px), calc(-50% + ${targetY}px))`;
      });

      const fadeOut4 = 1 - clamp01((progress - 0.3) / 0.04);
      safeCards.forEach((card) => {
        if (Number.parseFloat(card.style.opacity || "0") > 0) {
          card.style.opacity = `${fadeOut4}`;
        }
      });

      if (progress > 0.3) {
        const recede = clamp01((progress - 0.3) / 0.04);
        chip.style.opacity = `${lerp(1, 0.15, recede)}`;
        chip.style.transform = `translate(-50%, -50%) scale(${lerp(1, 0.5, recede)})`;
      }

      if (progress > 0.125) {
        sub.style.opacity = `${1 - clamp01((progress - 0.125) / 0.04)}`;
      }

      claimWords.forEach((word, index) => {
        const start = 0.31 + (index / claimWords.length) * 0.08;
        const wordProgress = clamp01((progress - start) / 0.02);
        word.style.opacity = `${wordProgress}`;
        word.style.transform = `translateY(${lerp(16, 0, wordProgress)}px)`;
      });

      rule.style.width = `${mapRange(progress, 0.37, 0.4, 0, 80)}px`;
      rule.style.opacity = "1";

      const eyebrowProgress = clamp01((progress - 0.41) / 0.03);
      eyebrow.style.opacity = `${eyebrowProgress}`;
      eyebrow.style.transform = `translateY(${lerp(30, 0, eyebrowProgress)}px)`;

      const buttonProgress = clamp01((progress - 0.43) / 0.04);
      cta.style.opacity = `${buttonProgress}`;
      cta.style.transform = `translateY(${lerp(40, 0, buttonProgress)}px)`;

      const sub5Progress = clamp01((progress - 0.45) / 0.03);
      sub5.style.opacity = `${sub5Progress}`;
      sub5.style.transform = `translateY(${lerp(20, 0, sub5Progress)}px)`;

      if (progress >= 0.503) {
        const fade56 = 1 - clamp01((progress - 0.503) / 0.03);
        eyebrow.style.opacity = `${fade56}`;
        cta.style.opacity = `${fade56}`;
        sub5.style.opacity = `${fade56}`;
        claimWords.forEach((word) => {
          word.style.opacity = `${fade56}`;
        });
        rule.style.opacity = `${fade56}`;
      }

      const act6Progress =
        progress >= 0.6
          ? 1 - clamp01((progress - 0.6) / 0.023)
          : mapRange(progress, 0.503, 0.533, 0, 1);
      act6Label.style.opacity = `${act6Progress}`;

      safePipeCards.forEach((card, index) => {
        const start = 0.53 + index * 0.02;
        const end = start + 0.03;
        const cardProgress =
          progress >= 0.6
            ? 1 - clamp01((progress - 0.6) / 0.023)
            : clamp01((progress - start) / (end - start));
        card.style.opacity = `${cardProgress}`;
        card.style.transform =
          progress < 0.6
            ? `translateY(${lerp(30, 0, cardProgress)}px)`
            : `translateY(${lerp(0, -20, 1 - cardProgress)}px)`;
      });

      safePipeArrows.forEach((arrow, index) => {
        const arrowProgress =
          progress >= 0.6
            ? 1 - clamp01((progress - 0.6) / 0.023)
            : mapRange(progress, 0.54 + index * 0.02, 0.56 + index * 0.02, 0, 1);
        arrow.style.opacity = `${arrowProgress}`;
      });

      const pipeWidth = isMobile ? 320 : 180 + 28 + 180 + 28 + 260 + 28 + 180;
      pipeLine.style.width = `${mapRange(progress, 0.53, 0.59, 0, pipeWidth)}px`;
      pipeLine.style.opacity =
        progress >= 0.6 ? `${0.2 * (1 - clamp01((progress - 0.6) / 0.023))}` : "0.2";

      const act7Progress =
        progress >= 0.72
          ? 1 - clamp01((progress - 0.72) / 0.025)
          : mapRange(progress, 0.6, 0.63, 0, 1);
      act7Label.style.opacity = `${act7Progress}`;
      proofBar.style.opacity = `${act7Progress}`;

      const quoteLeftProgress =
        progress >= 0.72 ? 1 - clamp01((progress - 0.72) / 0.025) : clamp01((progress - 0.615) / 0.03);
      const quoteCenterProgress =
        progress >= 0.72 ? 1 - clamp01((progress - 0.72) / 0.025) : clamp01((progress - 0.63) / 0.03);
      const quoteRightProgress =
        progress >= 0.72 ? 1 - clamp01((progress - 0.72) / 0.025) : clamp01((progress - 0.645) / 0.03);

      quoteLeft.style.opacity = `${quoteLeftProgress}`;
      quoteLeft.style.transform = `translate(calc(-50% + ${lerp(-600, -330, quoteLeftProgress)}px), -50%) rotate(${lerp(
        -4,
        -1,
        quoteLeftProgress
      )}deg)`;
      quoteCenter.style.opacity = `${quoteCenterProgress}`;
      quoteCenter.style.transform = `translate(-50%, calc(-50% + ${lerp(60, 0, quoteCenterProgress)}px))`;
      quoteRight.style.opacity = `${quoteRightProgress}`;
      quoteRight.style.transform = `translate(calc(-50% + ${lerp(600, 330, quoteRightProgress)}px), -50%) rotate(${lerp(
        4,
        1,
        quoteRightProgress
      )}deg)`;

      finalWords.forEach((word, index) => {
        const start = 0.745 + (index / finalWords.length) * 0.06;
        const wordProgress =
          progress >= 0.845
            ? 1 - clamp01((progress - 0.845) / 0.02)
            : clamp01((progress - start) / 0.02);
        word.style.opacity = `${wordProgress}`;
        word.style.transform = `translateY(${lerp(16, 0, clamp01((progress - start) / 0.02))}px)`;
      });

      finalRule.style.width = `${mapRange(progress, 0.8, 0.83, 0, 60)}px`;

      const finalButtonsProgress =
        progress >= 0.845 ? 1 - clamp01((progress - 0.845) / 0.02) : clamp01((progress - 0.81) / 0.03);
      finalButtons.style.opacity = `${finalButtonsProgress}`;
      finalButtons.style.transform = `translateX(-50%) translateY(${lerp(40, 0, finalButtonsProgress)}px)`;
      finalSub.style.opacity = `${mapRange(progress, 0.825, 0.845, 0, progress >= 0.845 ? 1 - clamp01((progress - 0.845) / 0.02) : 1)}`;

      const demoFadeIn = clamp01((progress - 0.855) / 0.03);
      demoLabel.style.opacity = `${demoFadeIn}`;
      demoLabel.style.transform = `translateX(-50%) translateY(${lerp(8, 0, demoFadeIn)}px)`;
      demoChrome.style.opacity = `${demoFadeIn}`;
      demoChrome.style.transform = `translateX(-50%) translateY(-50%) scale(${lerp(0.88, 1, clamp01((progress - 0.86) / 0.04))})`;

      const typingCardProgress = clamp01((progress - 0.875) / 0.03);
      demoTypingCard.style.opacity = `${typingCardProgress}`;
      demoTypingCard.style.transform = `translateY(${lerp(20, 0, typingCardProgress)}px)`;
      if (typingCardProgress > 0.5 && !typingActive) {
        startTyping();
      }
      if (progress < 0.855 && typingActive) {
        stopTyping();
      }

      if (progress >= 0.93) {
        const demoFadeOut = 1 - clamp01((progress - 0.93) / 0.02);
        demoChrome.style.opacity = `${demoFadeOut}`;
        demoTypingCard.style.opacity = `${demoFadeOut}`;
        demoLabel.style.opacity = `${demoFadeOut}`;
      }

      const act10Progress = clamp01((progress - 0.95) / 0.025);
      act10Label.style.opacity = `${act10Progress}`;
      const beforeProgress = clamp01((progress - 0.955) / 0.03);
      beforePanel.style.opacity = `${beforeProgress}`;
      beforePanel.style.transform = `translateX(${lerp(-30, 0, beforeProgress)}px)`;
      const afterProgress = clamp01((progress - 0.965) / 0.03);
      afterPanel.style.opacity = `${afterProgress}`;
      afterPanel.style.transform = `translateX(${lerp(30, 0, afterProgress)}px)`;
      const dividerProgress = clamp01((progress - 0.97) / 0.02);
      compareDivider.style.height = `${lerp(0, 380, dividerProgress)}px`;
      compareVs.style.opacity = `${dividerProgress}`;
      const compareCtaProgress = clamp01((progress - 0.98) / 0.02);
      compareCta.style.opacity = `${compareCtaProgress}`;
      compareCta.style.transform = `translateX(-50%) translateY(${lerp(16, 0, compareCtaProgress)}px)`;

      progressFill.style.height = `${progress * 120}px`;
      progressWrap.style.opacity = progress > 0 && progress < 1 ? "1" : "0";
    };

    resetLayout();

    const onScroll = () => {
      if (scrollTicking) {
        return;
      }

      scrollTicking = true;
      rafId = window.requestAnimationFrame(() => {
        update();
        scrollTicking = false;
      });
    };

    const onResize = () => {
      isMobile = window.innerWidth < 768;
      if (resizeRafId) {
        window.cancelAnimationFrame(resizeRafId);
      }
      resizeRafId = window.requestAnimationFrame(() => {
        resetLayout();
        update();
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    rafId = window.requestAnimationFrame(update);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      if (resizeRafId) {
        window.cancelAnimationFrame(resizeRafId);
      }
      stopTyping();
    };
  }, []);

  const scrollToDemo = () => {
    const section = document.getElementById("landing-cinematic");
    if (!section) {
      return;
    }

    const offset = window.innerHeight * 8.75;
    window.scrollTo({
      behavior: "smooth",
      top: section.getBoundingClientRect().top + window.scrollY + offset,
    });
  };

  return (
    <section className={styles.cinematicRoot} id="landing-cinematic-section">
      <div id="landing-cinematic">
        <div id="landing-cin-sticky">
          <h2 aria-label="From 4 days to 12 minutes." id="landing-cin-headline" />
          <p id="landing-cin-sub">The AI system for product discovery — not just delivery.</p>

          <div aria-hidden="true" id="landing-cin-chip-outer">
            <div id="landing-cin-chip-glow" />
            <div id="landing-cin-chip-float">
              <div id="landing-cin-chip-spin">
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="180"
                  viewBox="0 0 180 180"
                  width="180"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    height="180"
                    rx="4"
                    stroke="#e4611a"
                    strokeWidth="1.5"
                    transform="rotate(45 90 90)"
                    width="180"
                    x="0"
                    y="0"
                  />
                  <rect
                    height="100"
                    opacity="0.5"
                    rx="2"
                    stroke="#e4611a"
                    strokeWidth="1"
                    transform="rotate(45 90 90)"
                    width="100"
                    x="40"
                    y="40"
                  />
                  <line opacity="0.5" stroke="#e4611a" strokeWidth="0.8" x1="90" x2="90" y1="90" y2="3" />
                  <line opacity="0.5" stroke="#e4611a" strokeWidth="0.8" x1="90" x2="177" y1="90" y2="90" />
                  <line opacity="0.5" stroke="#e4611a" strokeWidth="0.8" x1="90" x2="90" y1="90" y2="177" />
                  <line opacity="0.5" stroke="#e4611a" strokeWidth="0.8" x1="90" x2="3" y1="90" y2="90" />
                  <circle cx="90" cy="90" fill="#e4611a" r="6" />
                </svg>
              </div>
            </div>
          </div>

          {overviewCards.map((card) => (
            <div className={styles.cinCard} id={card.id} key={card.id}>
              <span className={styles.cinCardIcon}>{card.icon}</span>
              <div className={styles.cinCardLabel}>{card.label}</div>
              <div className={styles.cinCardValue}>{card.value}</div>
            </div>
          ))}

          <div id="landing-cin-claim-layer">
            <p aria-label="Your next feature is already in your Zendesk." id="landing-cin-claim" />
            <div id="landing-cin-rule" />
          </div>

          <div id="landing-cin-cta-layer">
            <p id="landing-cin-eyebrow">Used by 200+ product teams at seed to Series B</p>
            <Link href="/signup" id="landing-cin-cta-btn">
              Get started free →
            </Link>
            <p id="landing-cin-sub5">No credit card · 2-minute setup · Works with Jira, Notion &amp; more</p>
          </div>

          <p id="landing-cin-act6-label">From signal to shipped</p>
          <div id="landing-cin-pipe-row">
            <div id="landing-cin-pipe-line" />
            {pipelineCards.map((card, index) => (
              <Fragment key={card.id}>
                <div className={`${styles.cinCard} ${styles.pipeCard}`} id={card.id}>
                  <span className={styles.pipeStep}>{card.step}</span>
                  <div className={styles.pipeIcon}>{card.icon}</div>
                  <span className={styles.pipeTitle}>{card.title}</span>
                  <span className={styles.pipeBody}>{card.body}</span>
                </div>
                {index < pipelineCards.length - 1 ? (
                  <span className={styles.pipeArrow} id={`landing-pipe-arrow-${index + 1}${index + 2}`}>
                    →
                  </span>
                ) : null}
              </Fragment>
            ))}
          </div>

          <p id="landing-cin-act7-label">From the teams</p>
          <p id="landing-cin-proof-bar">
            2,400+ feature briefs generated <span style={{ color: "var(--orange)", opacity: 0.6 }}>·</span> 200+ product teams{" "}
            <span style={{ color: "var(--orange)", opacity: 0.6 }}>·</span> avg. 11.8 min
          </p>
          {quotes.map((quote) => (
            <div className={`${styles.cinCard} ${styles.quoteCard}`} id={quote.id} key={quote.id}>
              {quote.mark ? <span className={styles.quoteMark}>"</span> : null}
              <p className={styles.quoteText}>{quote.text}</p>
              <span className={styles.quoteAttr}>{quote.attr}</span>
            </div>
          ))}

          <div id="landing-cin-final-headline-wrap">
            <p aria-label="Stop guessing. Start shipping what users need." id="landing-cin-final-headline" />
            <div id="landing-cin-final-rule" />
          </div>
          <div id="landing-cin-final-btns">
            <Link href="/signup" id="landing-cin-final-btn-primary">
              Get started free →
            </Link>
            <button id="landing-cin-final-btn-secondary" onClick={scrollToDemo} type="button">
              Watch a demo
            </button>
          </div>
          <p id="landing-cin-final-sub">No credit card · 2-minute setup · Works with Jira, Notion &amp; more</p>

          <p id="landing-cin-demo-label">A session in progress</p>
          <div id="landing-cin-demo-chrome">
            <div className={styles.demoBrowserBar}>
              <div className={styles.demoTraffic}>
                <span style={{ background: "#FF5F57" }} />
                <span style={{ background: "#FFBD2E" }} />
                <span style={{ background: "#28C840" }} />
              </div>
              <div className={styles.demoUrlBar}>
                <Search size={12} />
                app.specflow.ai/dashboard
              </div>
              <RefreshCw color="#9E9E9E" size={16} />
            </div>
            <div className={styles.demoLayout}>
              <div className={styles.demoSidebar}>
                <div className={styles.demoSidebarLogo}>
                  <div className={styles.demoAvatar}>SF</div>
                  <div className={styles.demoSidebarBrand}>
                    <span>SpecFlow</span>
                    <span>AI Product Manager</span>
                  </div>
                </div>
                <div className={styles.demoNav}>
                  <div className={`${styles.demoNavItem} ${styles.demoNavItemActive}`}>
                    <Layers3 size={13} />
                    Dashboard
                  </div>
                  <div className={styles.demoNavItem}>
                    <FileText size={13} />
                    Sessions
                  </div>
                  <div className={styles.demoNavItem}>
                    <Sparkles size={13} />
                    Build Spec
                  </div>
                  <div className={styles.demoNavItem}>
                    <Send size={13} />
                    Ship Tasks
                  </div>
                </div>
                <div className={styles.demoUpgrade}>
                  <span className={styles.demoUpgradePill}>Upgrade Plan →</span>
                </div>
              </div>

              <div className={styles.demoMain}>
                <div className={styles.demoTopbar}>
                  <div className={styles.demoSearch}>
                    <Search size={12} />
                    Search sessions...
                  </div>
                  <div className={styles.demoSidebarLogo}>
                    <div className={styles.demoAvatar}>SF</div>
                    <div className={styles.demoSidebarBrand}>
                      <span>SpecFlow</span>
                      <span>AI Product Manager</span>
                    </div>
                  </div>
                </div>

                <div className={styles.demoBody}>
                  <div className={styles.demoTitleRow}>
                    <div className={styles.demoTitleText}>
                      <h3>Dashboard</h3>
                      <p>Manage your AI pipeline runs.</p>
                    </div>
                    <div className={styles.demoTitleBtns}>
                      <span className={styles.demoButtonPrimary}>New Session</span>
                      <span className={styles.demoButtonGhost}>Import Research</span>
                    </div>
                  </div>

                  <div className={styles.demoStats}>
                    <div className={`${styles.demoStatCard} ${styles.demoStatCardHero}`}>
                      <span className={styles.demoStatLabel}>TOTAL SESSIONS</span>
                      <span className={styles.demoStatNum}>12</span>
                      <span className={styles.demoStatSub}>↑ +3 this week</span>
                    </div>
                    <div className={`${styles.demoStatCard} ${styles.demoStatCardPlain}`}>
                      <span className={styles.demoStatLabel}>COMPLETED</span>
                      <span className={styles.demoStatNum}>9</span>
                      <span className={styles.demoStatSub}>↑ +2 this week</span>
                    </div>
                    <div className={`${styles.demoStatCard} ${styles.demoStatCardPlain}`}>
                      <span className={styles.demoStatLabel}>ACTIVE</span>
                      <span className={styles.demoStatNum}>3</span>
                      <span className={styles.demoStatSub}>↑ +1 this week</span>
                    </div>
                    <div className={`${styles.demoStatCard} ${styles.demoStatCardPlain}`}>
                      <span className={styles.demoStatLabel}>PRDs GENERATED</span>
                      <span className={styles.demoStatNum}>9</span>
                      <span className={styles.demoStatSub}>↑ +2 this week</span>
                    </div>
                  </div>

                  <div className={styles.demoRow2}>
                    <div className={styles.demoCard}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span className={styles.demoCardTitle}>Pipeline Analytics</span>
                        <span style={{ color: "#6B6B6B", fontSize: "0.68rem" }}>Last 7 days</span>
                      </div>
                      <div className={styles.demoChart}>
                        {[
                          { day: "S", height: 24, strong: false },
                          { day: "M", height: 44, strong: false },
                          { day: "T", height: 32, strong: false },
                          { day: "W", height: 68, strong: true },
                          { day: "T", height: 40, strong: false },
                          { day: "F", height: 56, strong: false },
                          { day: "S", height: 20, strong: false },
                        ].map((bar) => (
                          <div className={styles.demoBarCol} key={bar.day + bar.height}>
                            <div
                              className={styles.demoBar}
                              style={{
                                background: bar.strong ? "#E8561B" : "#0D0D0D",
                                height: `${bar.height}px`,
                                opacity: bar.strong ? 1 : 0.18,
                              }}
                            />
                            <span className={styles.demoBarLabel}>{bar.day}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={styles.demoRightCol}>
                      <div className={styles.demoCard}>
                        <span className={styles.demoCardTitle}>Recent Activity</span>
                        <div style={{ marginTop: "10px" }}>
                          {[
                            ["#3D6B5E", "Checkout Redesign", "2h ago"],
                            ["#E8561B", "Search Autocomplete", "5h ago"],
                            ["#3D6B5E", "Onboarding Flow", "1d ago"],
                          ].map(([color, label, time]) => (
                            <div className={styles.demoActivityRow} key={label}>
                              <span className={styles.demoDot} style={{ background: color }} />
                              <span>{label}</span>
                              <span style={{ color: "#9E9E9E", fontSize: "0.68rem", marginLeft: "auto" }}>
                                {time}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className={styles.demoPlanCard}>
                        <div style={{ color: "white", fontFamily: "var(--font-instrument)", fontSize: "0.92rem" }}>
                          Plan Usage
                        </div>
                        <div className={styles.demoPlanBar}>
                          <div className={styles.demoPlanFill} />
                        </div>
                        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.68rem" }}>2 of 5 runs used</div>
                        <div style={{ color: "#E8561B", fontSize: "0.68rem", fontWeight: 700, marginTop: "8px" }}>
                          Upgrade plan →
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div id="landing-cin-demo-typing-card">
            <div className={styles.demoTypingHeader}>
              <div className={styles.demoPulseDot} />
              <span style={{ color: "var(--text)", flex: 1, fontSize: "0.75rem", fontWeight: 700 }}>
                Writing spec · Checkout Redesign
              </span>
              <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-instrument)", fontSize: "0.72rem" }}>
                PRD · 0.8s elapsed
              </span>
            </div>
            <div id="landing-cin-typing-output" />
            <div className={styles.demoTypingBtns}>
              <span className={styles.demoTypingPrimary}>Push to Jira →</span>
              <span className={styles.demoTypingGhost}>Export PRD</span>
            </div>
          </div>

          <p id="landing-cin-act10-label">Without vs with SpecFlow</p>
          <div id="landing-cin-compare-wrap">
            <div id="landing-cin-before-panel">
              <ComparePanel
                footer="Avg. time to shipped spec: 4–5 days"
                items={beforeItems}
                title="The manual grind"
                variant="before"
              />
            </div>
            <div id="landing-cin-after-panel">
              <ComparePanel
                footer="Avg. time to shipped spec: ~12 minutes"
                items={afterItems}
                title="The brief everyone actually reads"
                variant="after"
              />
            </div>
          </div>
          <div id="landing-cin-compare-divider" />
          <div id="landing-cin-compare-vs">vs</div>
          <div id="landing-cin-compare-cta">
            <Link href="/signup" id="landing-cin-compare-cta-btn">
              Get started free →
            </Link>
            <p>No credit card · 2-minute setup · Works with Jira, Notion &amp; more</p>
          </div>
        </div>
      </div>

      <div aria-hidden="true" id="landing-cin-progress-wrap">
        <div id="landing-cin-progress-track">
          <div id="landing-cin-progress-fill" />
        </div>
      </div>
    </section>
  );
}
