"use client";

import { useRef, useEffect } from "react";

export default function CinematicScroll() {
  const containerRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const cardTLRef = useRef<HTMLDivElement>(null);
  const cardBLRef = useRef<HTMLDivElement>(null);
  const cardTRRef = useRef<HTMLDivElement>(null);
  const cardBRRef = useRef<HTMLDivElement>(null);
  const claimRef = useRef<HTMLParagraphElement>(null);
  const ruleRef = useRef<HTMLDivElement>(null);
  const eyebrowRef = useRef<HTMLParagraphElement>(null);
  const ctaBtnRef = useRef<HTMLButtonElement>(null);
  const sub5Ref = useRef<HTMLParagraphElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const progressWrapRef = useRef<HTMLDivElement>(null);
  const act6LabelRef = useRef<HTMLParagraphElement>(null);
  const pipeLineRef = useRef<HTMLDivElement>(null);
  const pipeCard1Ref = useRef<HTMLDivElement>(null);
  const pipeCard2Ref = useRef<HTMLDivElement>(null);
  const pipeCard3Ref = useRef<HTMLDivElement>(null);
  const pipeCard4Ref = useRef<HTMLDivElement>(null);
  const pipeArrow12Ref = useRef<HTMLSpanElement>(null);
  const pipeArrow23Ref = useRef<HTMLSpanElement>(null);
  const pipeArrow34Ref = useRef<HTMLSpanElement>(null);
  const act7LabelRef = useRef<HTMLParagraphElement>(null);
  const proofBarRef = useRef<HTMLParagraphElement>(null);
  const quoteLeftRef = useRef<HTMLDivElement>(null);
  const quoteCenterRef = useRef<HTMLDivElement>(null);
  const quoteRightRef = useRef<HTMLDivElement>(null);
  const finalHeadlineRef = useRef<HTMLParagraphElement>(null);
  const finalRuleRef = useRef<HTMLDivElement>(null);
  const finalBtnsRef = useRef<HTMLDivElement>(null);
  const finalSubRef = useRef<HTMLParagraphElement>(null);
  const demoLabelRef = useRef<HTMLParagraphElement>(null);
  const demoChromeRef = useRef<HTMLDivElement>(null);
  const demoTypingCardRef = useRef<HTMLDivElement>(null);
  const typingOutputRef = useRef<HTMLDivElement>(null);
  const act10LabelRef = useRef<HTMLParagraphElement>(null);
  const beforePanelRef = useRef<HTMLDivElement>(null);
  const afterPanelRef = useRef<HTMLDivElement>(null);
  const compareDividerRef = useRef<HTMLDivElement>(null);
  const compareVsRef = useRef<HTMLDivElement>(null);
  const compareCtaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
    function clamp01(v: number) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function mapRange(v: number, i0: number, i1: number, o0: number, o1: number) {
      return lerp(o0, o1, clamp01((v - i0) / (i1 - i0)));
    }

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let isMobile = window.innerWidth < 768;

    const hlText = "From 4 days to 12 minutes.";
    const hlEl = headlineRef.current;
    const letters: HTMLSpanElement[] = [];
    if (hlEl) {
      hlEl.innerHTML = "";
      hlText.split("").forEach((ch) => {
        const s = document.createElement("span");
        s.className = "cin-letter";
        s.textContent = ch === " " ? " " : ch;
        s.style.opacity = prefersReduced ? "1" : "0";
        s.style.filter = prefersReduced ? "none" : "blur(12px)";
        s.style.transform = prefersReduced ? "none" : "translateY(20px)";
        hlEl.appendChild(s);
        letters.push(s);
      });
    }

    const claimText = "Your next feature is already in your Zendesk.";
    const claimEl = claimRef.current;
    const claimWords: HTMLSpanElement[] = [];
    if (claimEl) {
      claimEl.innerHTML = "";
      claimText.split(" ").forEach((word) => {
        const s = document.createElement("span");
        s.className = "cin-word";
        s.textContent = word;
        s.style.opacity = prefersReduced ? "1" : "0";
        s.style.transform = prefersReduced ? "none" : "translateY(16px)";
        claimEl.appendChild(s);
        claimWords.push(s);
      });
    }

    const finalHlText = "Stop guessing. Start shipping what users need.";
    const finalHlEl = finalHeadlineRef.current;
    const finalWords: HTMLSpanElement[] = [];
    if (finalHlEl) {
      finalHlEl.innerHTML = "";
      finalHlText.split(" ").forEach((word) => {
        const s = document.createElement("span");
        s.className = "cin-final-word";
        s.textContent = word;
        s.style.opacity = prefersReduced ? "1" : "0";
        s.style.transform = prefersReduced ? "none" : "translateY(16px)";
        finalHlEl.appendChild(s);
        finalWords.push(s);
      });
    }

    const cards = [cardTLRef.current, cardBLRef.current, cardTRRef.current, cardBRRef.current];
    const cardTargets = [[-320, -130], [-320, 130], [320, -130], [320, 130]];
    const offscreen = 620;
    cards.forEach((c, i) => {
      if (!c) return;
      const tx = cardTargets[i][0] < 0 ? cardTargets[i][0] - offscreen : cardTargets[i][0] + offscreen;
      c.style.opacity = "0";
      c.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${cardTargets[i][1]}px))`;
    });

    if (quoteLeftRef.current) {
      quoteLeftRef.current.style.transform = "translate(calc(-50% - 600px), -50%) rotate(-4deg)";
      quoteLeftRef.current.style.opacity = "0";
    }
    if (quoteCenterRef.current) {
      quoteCenterRef.current.style.transform = "translate(-50%, calc(-50% + 60px))";
      quoteCenterRef.current.style.opacity = "0";
    }
    if (quoteRightRef.current) {
      quoteRightRef.current.style.transform = "translate(calc(-50% + 600px), -50%) rotate(4deg)";
      quoteRightRef.current.style.opacity = "0";
    }

    if (isMobile && progressWrapRef.current) progressWrapRef.current.style.display = "none";
    if (isMobile) cards.forEach((c) => { if (c) c.style.width = "130px"; });

    const typingText = "## Checkout Redesign\n\n**Problem statement**\n34% of users abandon at payment step.\n127 Zendesk tickets · 8 Gong calls · 3 NPS mentions\n\n**Proposed solution**\nCollapse 3-step checkout to single page.\nAdd Apple Pay, Google Pay, and address auto-fill.\n\n**Acceptance criteria**\n- Cart → confirm in ≤ 3 taps\n- Payment error rate < 0.5%\n- Works on iOS Safari 16+\n\n**Tasks for engineering**\n- [ ] Redesign checkout route /cart/checkout\n- [ ] Integrate Stripe payment request API\n- [ ] Add address autocomplete (Google Places)\n- [ ] A/B test rollout via feature flag...";
    let typingIndex = 0;
    let typingTimer: ReturnType<typeof setInterval> | null = null;
    let typingActive = false;

    function startTyping() {
      if (typingActive) return;
      typingActive = true;
      typingTimer = setInterval(() => {
        if (typingIndex < typingText.length) {
          typingIndex++;
          if (typingOutputRef.current) typingOutputRef.current.textContent = typingText.slice(0, typingIndex);
        } else {
          if (typingTimer) clearInterval(typingTimer);
          typingTimer = null;
        }
      }, 28);
    }

    function stopTyping() {
      if (typingTimer) { clearInterval(typingTimer); typingTimer = null; }
      typingActive = false;
      typingIndex = 0;
      if (typingOutputRef.current) typingOutputRef.current.textContent = "";
    }

    const cinEl = containerRef.current;
    const pipeCards = [pipeCard1Ref.current, pipeCard2Ref.current, pipeCard3Ref.current, pipeCard4Ref.current];
    const pipeArrows = [pipeArrow12Ref.current, pipeArrow23Ref.current, pipeArrow34Ref.current];

    function update() {
      if (!cinEl) return;
      const rect = cinEl.getBoundingClientRect();
      const scrolled = -rect.top;
      const total = cinEl.offsetHeight - window.innerHeight;
      const p = clamp01(scrolled / total);

      const fillEl = fillRef.current;
      if (prefersReduced) {
        if (fillEl) fillEl.style.height = "120px";
        return;
      }

      const n = letters.length;

      letters.forEach((span, i) => {
        const pStart = (i / n) * 0.075;
        const pEnd = pStart + 0.040;
        const lp = clamp01((p - pStart) / (pEnd - pStart));
        span.style.opacity = String(lp);
        span.style.filter = `blur(${lerp(12, 0, lp)}px)`;
        span.style.transform = `translateY(${lerp(20, 0, lp)}px)`;
      });
      if (subRef.current) subRef.current.style.opacity = String(mapRange(p, 0.060, 0.090, 0, 1));

      const act2p = clamp01((p - 0.100) / 0.075);
      const hlElRef = headlineRef.current;
      if (hlElRef) {
        hlElRef.style.transform = `translate(calc(-50% + ${lerp(0, -window.innerWidth * 0.38, act2p)}px), calc(-50% + ${lerp(0, -window.innerHeight * 0.42, act2p)}px)) scale(${lerp(1, 0.22, act2p)})`;
      }
      const chipEl = chipRef.current;
      if (chipEl) {
        chipEl.style.opacity = String(act2p);
        chipEl.style.transform = `translate(-50%, calc(-50% + ${lerp(60, 0, act2p)}px)) scale(${lerp(0.8, 1, act2p)})`;
      }

      cards.forEach((card, i) => {
        if (!card) return;
        const cStart = 0.200 + i * 0.015;
        const cEnd = 0.290 + i * 0.015;
        if (isMobile) {
          const mp = clamp01((p - 0.200) / 0.030);
          const mOff = [[-110, 100], [-110, 220], [110, 100], [110, 220]];
          card.style.opacity = String(mp);
          card.style.transform = `translate(calc(-50% + ${mOff[i][0]}px), calc(-50% + ${mOff[i][1]}px))`;
          return;
        }
        const cp = clamp01((p - cStart) / (cEnd - cStart));
        const isLeft = cardTargets[i][0] < 0;
        const startTx = cardTargets[i][0] + (isLeft ? -offscreen : offscreen);
        card.style.opacity = String(cp);
        card.style.transform = `translate(calc(-50% + ${lerp(startTx, cardTargets[i][0], cp)}px), calc(-50% + ${cardTargets[i][1]}px))`;
      });

      const fadeOut4 = 1 - clamp01((p - 0.300) / 0.040);
      cards.forEach((card) => {
        if (card && parseFloat(card.style.opacity) > 0) card.style.opacity = String(fadeOut4);
      });
      if (p > 0.300 && chipEl) {
        const recede = clamp01((p - 0.300) / 0.040);
        chipEl.style.opacity = String(lerp(1, 0.15, recede));
        chipEl.style.transform = `translate(-50%, -50%) scale(${lerp(1, 0.5, recede)})`;
      }
      if (p > 0.125 && subRef.current) {
        subRef.current.style.opacity = String(1 - clamp01((p - 0.125) / 0.040));
      }

      const wn = claimWords.length;
      claimWords.forEach((w, i) => {
        const wStart = 0.310 + (i / wn) * 0.080;
        const wp = clamp01((p - wStart) / 0.020);
        w.style.opacity = String(wp);
        w.style.transform = `translateY(${lerp(16, 0, wp)}px)`;
      });
      if (ruleRef.current) {
        ruleRef.current.style.width = mapRange(p, 0.370, 0.400, 0, 80) + "px";
        ruleRef.current.style.opacity = "1";
      }

      const ebP = clamp01((p - 0.410) / 0.030);
      if (eyebrowRef.current) {
        eyebrowRef.current.style.opacity = String(ebP);
        eyebrowRef.current.style.transform = `translateY(${lerp(30, 0, ebP)}px)`;
      }
      const btnP = clamp01((p - 0.430) / 0.040);
      if (ctaBtnRef.current) {
        ctaBtnRef.current.style.opacity = String(btnP);
        ctaBtnRef.current.style.transform = `translateY(${lerp(40, 0, btnP)}px)`;
      }
      const s5P = clamp01((p - 0.450) / 0.030);
      if (sub5Ref.current) {
        sub5Ref.current.style.opacity = String(s5P);
        sub5Ref.current.style.transform = `translateY(${lerp(20, 0, s5P)}px)`;
      }

      if (p >= 0.503) {
        const f56 = 1 - clamp01((p - 0.503) / 0.030);
        if (eyebrowRef.current) eyebrowRef.current.style.opacity = String(f56);
        if (ctaBtnRef.current) ctaBtnRef.current.style.opacity = String(f56);
        if (sub5Ref.current) sub5Ref.current.style.opacity = String(f56);
        claimWords.forEach((w) => { w.style.opacity = String(f56); });
        if (ruleRef.current) ruleRef.current.style.opacity = String(f56);
      }

      const a6p = p >= 0.600 ? 1 - clamp01((p - 0.600) / 0.023) : mapRange(p, 0.503, 0.533, 0, 1);
      if (act6LabelRef.current) act6LabelRef.current.style.opacity = String(a6p);
      let lw = mapRange(p, 0.518, 0.593, 0, 804);
      if (p >= 0.600) lw = lerp(804, 0, clamp01((p - 0.600) / 0.023));
      if (pipeLineRef.current) pipeLineRef.current.style.width = lw + "px";
      const pStarts = [0.518, 0.533, 0.548, 0.563];
      const pEnds = [0.555, 0.570, 0.585, 0.600];
      pipeCards.forEach((card, i) => {
        if (!card) return;
        const appear = clamp01((p - pStarts[i]) / (pEnds[i] - pStarts[i]));
        const fade6 = p >= 0.600 ? 1 - clamp01((p - 0.600) / 0.023) : 1;
        card.style.opacity = String(appear * fade6);
        card.style.transform = `translateX(${lerp(-28, 0, appear)}px)`;
        if (i < 3 && pipeArrows[i]) pipeArrows[i]!.style.opacity = String(appear * fade6);
      });

      const a7p = p >= 0.675 ? 1 - clamp01((p - 0.675) / 0.023) : mapRange(p, 0.600, 0.623, 0, 1);
      if (act7LabelRef.current) act7LabelRef.current.style.opacity = String(a7p);
      if (proofBarRef.current) proofBarRef.current.style.opacity = String(mapRange(p, 0.600, 0.623, 0, 1) * mapRange(p, 0.875, 0.900, 1, 0));
      const qFade = p >= 0.675 ? 1 - clamp01((p - 0.675) / 0.023) : 1;
      const qcP = clamp01((p - 0.615) / 0.038);
      if (quoteCenterRef.current) {
        quoteCenterRef.current.style.opacity = String(qcP * qFade);
        quoteCenterRef.current.style.transform = `translate(-50%, calc(-50% + ${lerp(60, 0, qcP)}px))`;
      }
      const qlP = clamp01((p - 0.623) / 0.038);
      if (quoteLeftRef.current) {
        quoteLeftRef.current.style.opacity = String(qlP * qFade);
        quoteLeftRef.current.style.transform = `translate(calc(-50% + ${lerp(-600, -280, qlP)}px), -50%) rotate(-4deg)`;
      }
      const qrP = clamp01((p - 0.630) / 0.038);
      if (quoteRightRef.current) {
        quoteRightRef.current.style.opacity = String(qrP * qFade);
        quoteRightRef.current.style.transform = `translate(calc(-50% + ${lerp(600, 280, qrP)}px), -50%) rotate(4deg)`;
      }

      if (p >= 0.675 && chipEl) {
        const cb = clamp01((p - 0.675) / 0.023);
        chipEl.style.opacity = String(lerp(0.15, 0.08, cb));
        chipEl.style.transform = `translate(-50%, -50%) scale(${lerp(0.5, 1.4, cb)})`;
      }
      const fwn = finalWords.length;
      finalWords.forEach((w, i) => {
        const ws = 0.683 + (i / fwn) * 0.038;
        const fw = clamp01((p - ws) / 0.019);
        w.style.opacity = String(fw);
        w.style.transform = `translateY(${lerp(16, 0, fw)}px)`;
      });
      if (finalRuleRef.current) {
        finalRuleRef.current.style.width = mapRange(p, 0.713, 0.728, 0, 60) + "px";
        finalRuleRef.current.style.opacity = "1";
      }
      const fbP = clamp01((p - 0.713) / 0.030);
      if (finalBtnsRef.current) {
        finalBtnsRef.current.style.opacity = String(fbP);
        finalBtnsRef.current.style.transform = `translateX(-50%) translateY(${lerp(40, 0, fbP)}px)`;
      }
      if (finalSubRef.current) finalSubRef.current.style.opacity = String(mapRange(p, 0.728, 0.750, 0, 1));

      if (p >= 0.750) {
        const f89 = 1 - clamp01((p - 0.750) / 0.020);
        if (chipEl) chipEl.style.opacity = String(0.08 * f89);
        finalWords.forEach((w) => { w.style.opacity = String(f89); });
        if (finalRuleRef.current) finalRuleRef.current.style.opacity = String(f89);
        if (finalBtnsRef.current) finalBtnsRef.current.style.opacity = String(f89);
        if (finalSubRef.current) finalSubRef.current.style.opacity = String(f89);
      }

      const a9l = p >= 0.875 ? 1 - clamp01((p - 0.875) / 0.025) : mapRange(p, 0.750, 0.780, 0, 1);
      if (demoLabelRef.current) {
        demoLabelRef.current.style.opacity = String(a9l);
        demoLabelRef.current.style.transform = `translateX(-50%) translateY(${lerp(8, 0, clamp01((p - 0.750) / 0.030))}px)`;
      }
      const chrRaw = clamp01((p - 0.770) / 0.040);
      const chrP = p >= 0.875 ? 1 - clamp01((p - 0.875) / 0.025) : chrRaw;
      if (demoChromeRef.current) {
        demoChromeRef.current.style.opacity = String(chrP);
        demoChromeRef.current.style.transform = `translateX(-50%) translateY(-50%) scale(${lerp(0.88, 1, chrRaw)})`;
      }
      const tcRaw = clamp01((p - 0.820) / 0.040);
      const tcP = p >= 0.875 ? 1 - clamp01((p - 0.875) / 0.025) : tcRaw;
      if (demoTypingCardRef.current) {
        demoTypingCardRef.current.style.opacity = String(tcP);
        demoTypingCardRef.current.style.transform = `translateY(${lerp(20, 0, tcRaw)}px)`;
      }
      if (p >= 0.840 && p < 0.875) startTyping();
      else stopTyping();

      if (act10LabelRef.current) act10LabelRef.current.style.opacity = String(mapRange(p, 0.875, 0.905, 0, 1));
      const bfP = clamp01((p - 0.900) / 0.050);
      if (beforePanelRef.current) {
        beforePanelRef.current.style.opacity = String(bfP);
        beforePanelRef.current.style.transform = `translateX(${lerp(-80, 0, bfP)}px)`;
      }
      const afP = clamp01((p - 0.920) / 0.050);
      if (afterPanelRef.current) {
        afterPanelRef.current.style.opacity = String(afP);
        afterPanelRef.current.style.transform = `translateX(${lerp(80, 0, afP)}px)`;
      }
      if (compareDividerRef.current) compareDividerRef.current.style.height = mapRange(p, 0.900, 0.950, 0, 380) + "px";
      if (compareVsRef.current) compareVsRef.current.style.opacity = String(mapRange(p, 0.930, 0.960, 0, 1));
      const ctP = clamp01((p - 0.960) / 0.040);
      if (compareCtaRef.current) {
        compareCtaRef.current.style.opacity = String(ctP);
        compareCtaRef.current.style.transform = `translateX(-50%) translateY(${lerp(16, 0, ctP)}px)`;
      }

      if (fillEl) {
        fillEl.style.height = (p * 120) + "px";
        fillEl.style.opacity = (p > 0 && p < 1) ? "1" : "0";
      }
    }

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => { update(); ticking = false; });
        ticking = true;
      }
    };
    const onResize = () => {
      isMobile = window.innerWidth < 768;
      requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    requestAnimationFrame(update);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      stopTyping();
    };
  }, []);

  return (
    <>
      <div id="cinematic" ref={containerRef}>
        <div id="cin-sticky">
          {/* Headline */}
          <h2 id="cin-headline" ref={headlineRef} aria-label="From 4 days to 12 minutes." />
          <p id="cin-sub" ref={subRef}>The AI system for product discovery — not just delivery.</p>

          {/* Chip */}
          <div id="cin-chip-outer" ref={chipRef}>
            <div id="cin-chip-glow" />
            <div id="cin-chip-float">
              <div id="cin-chip-spin">
                <svg width="180" height="180" viewBox="0 0 180 180" fill="none" aria-hidden="true">
                  <rect x="0" y="0" width="180" height="180" rx="4" transform="rotate(45 90 90)" stroke="#e4611a" strokeWidth="1.5" />
                  <rect x="40" y="40" width="100" height="100" rx="2" transform="rotate(45 90 90)" stroke="#e4611a" strokeWidth="1" opacity="0.5" />
                  <line x1="90" y1="90" x2="90" y2="3" stroke="#e4611a" strokeWidth="0.8" opacity="0.5" />
                  <line x1="90" y1="90" x2="177" y2="90" stroke="#e4611a" strokeWidth="0.8" opacity="0.5" />
                  <line x1="90" y1="90" x2="90" y2="177" stroke="#e4611a" strokeWidth="0.8" opacity="0.5" />
                  <line x1="90" y1="90" x2="3" y2="90" stroke="#e4611a" strokeWidth="0.8" opacity="0.5" />
                  <circle cx="90" cy="90" r="6" fill="#e4611a" />
                </svg>
              </div>
            </div>
          </div>

          {/* Cards */}
          <div className="cin-card" id="card-tl" ref={cardTLRef} aria-label="Discovery Time">
            <span className="cin-card-icon">⚡</span>
            <div className="cin-card-label">Discovery Time</div>
            <div className="cin-card-value">&lt; 5 minutes</div>
          </div>
          <div className="cin-card" id="card-bl" ref={cardBLRef} aria-label="What you get">
            <span className="cin-card-icon">🧩</span>
            <div className="cin-card-label">What you get</div>
            <div className="cin-card-value">Brief · Tasks · UI spec</div>
          </div>
          <div className="cin-card" id="card-tr" ref={cardTRRef} aria-label="Works with">
            <span className="cin-card-icon">🔗</span>
            <div className="cin-card-label">Works with</div>
            <div className="cin-card-value">Jira · Cursor · Claude</div>
          </div>
          <div className="cin-card" id="card-br" ref={cardBRRef} aria-label="Signal source">
            <span className="cin-card-icon">✦</span>
            <div className="cin-card-label">Signal source</div>
            <div className="cin-card-value">Real customer data</div>
          </div>

          {/* Claim */}
          <div id="cin-claim-layer">
            <p id="cin-claim" ref={claimRef} aria-label="Your next feature is already in your Zendesk." />
            <div id="cin-rule" ref={ruleRef} />
          </div>

          {/* CTA */}
          <div id="cin-cta-layer">
            <p id="cin-eyebrow" ref={eyebrowRef}>Used by 200+ product teams at seed to Series B</p>
            <button id="cin-cta-btn" ref={ctaBtnRef}>Get started free →</button>
            <p id="cin-sub5" ref={sub5Ref}>No credit card · 2-minute setup · Works with Jira, Notion &amp; more</p>
          </div>

          {/* Act 6: Pipeline */}
          <p id="cin-act6-label" ref={act6LabelRef}>From signal to shipped</p>
          <div id="cin-pipe-row">
            <div id="cin-pipe-line" ref={pipeLineRef} />
            <div id="pipe-card-1" className="cin-card pipe-card" ref={pipeCard1Ref}>
              <span className="pipe-step">01</span>
              <div className="pipe-icon">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                  <circle cx="16" cy="16" r="11" stroke="#e4611a" strokeWidth="1.5" />
                  <path d="M16 22V12M12 16L16 12L20 16" stroke="#e4611a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="pipe-title">Connect Sources</span>
              <span className="pipe-body">Interviews, tickets, Slack — everything that already tells the story</span>
            </div>
            <span id="pipe-arrow-12" className="pipe-arrow" ref={pipeArrow12Ref}>→</span>
            <div id="pipe-card-2" className="cin-card pipe-card" ref={pipeCard2Ref}>
              <span className="pipe-step">02</span>
              <div className="pipe-icon">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                  <path d="M16 5L17.8 13.2L26 16L17.8 18.8L16 27L14.2 18.8L6 16L14.2 13.2L16 5Z" stroke="#e4611a" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="pipe-title">AI Synthesis</span>
              <span className="pipe-body">AI surfaces what users actually need — not just what they said</span>
            </div>
            <span id="pipe-arrow-23" className="pipe-arrow" ref={pipeArrow23Ref}>→</span>
            <div id="pipe-card-3" className="cin-card pipe-card" ref={pipeCard3Ref}>
              <span className="pipe-step">03</span>
              <div className="pipe-icon">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                  <rect x="7" y="5" width="18" height="22" rx="2" stroke="#e4611a" strokeWidth="1.5" />
                  <line x1="11" y1="11" x2="21" y2="11" stroke="#e4611a" strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="11" y1="15" x2="21" y2="15" stroke="#e4611a" strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="11" y1="19" x2="17" y2="19" stroke="#e4611a" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
              <span className="pipe-title">Feature Brief</span>
              <span className="pipe-body">Rationale, UI changes, data model, tasks — one complete document</span>
            </div>
            <span id="pipe-arrow-34" className="pipe-arrow" ref={pipeArrow34Ref}>→</span>
            <div id="pipe-card-4" className="cin-card pipe-card" ref={pipeCard4Ref}>
              <span className="pipe-step">04</span>
              <div className="pipe-icon">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                  <path d="M5 16L27 6L19 28L15 18L5 16Z" stroke="#e4611a" strokeWidth="1.5" strokeLinejoin="round" />
                  <line x1="15" y1="18" x2="27" y2="6" stroke="#e4611a" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <span className="pipe-title">Push to Team</span>
              <span className="pipe-body">One click to Jira, Notion, or Cursor — no copy-paste</span>
            </div>
          </div>

          {/* Act 7: Testimonials */}
          <p id="cin-act7-label" ref={act7LabelRef}>From the teams</p>
          <p id="cin-proof-bar" ref={proofBarRef}>
            2,400+ feature briefs generated <span style={{ color: "var(--orange)", opacity: 0.6 }}>·</span> 200+ product teams <span style={{ color: "var(--orange)", opacity: 0.6 }}>·</span> avg. 11.8 min
          </p>
          <div id="cin-quote-left" className="cin-card quote-card" ref={quoteLeftRef}>
            <p className="quote-text">&ldquo;We shipped a feature in 3 days that used to take 2 weeks to spec.&rdquo;</p>
            <span className="quote-attr">— Head of Product, B2B SaaS · Series B</span>
          </div>
          <div id="cin-quote-center" className="cin-card quote-card" ref={quoteCenterRef}>
            <span className="quote-mark">&ldquo;</span>
            <p className="quote-text">Finally, a tool that starts with the customer, not the ticket.</p>
            <span className="quote-attr">— Founding PM, YC W24 · 0→1 product</span>
          </div>
          <div id="cin-quote-right" className="cin-card quote-card" ref={quoteRightRef}>
            <p className="quote-text">&ldquo;Our eng lead said it was the clearest brief they&apos;d ever received.&rdquo;</p>
            <span className="quote-attr">— CEO, developer tools startup · 14-person team</span>
          </div>

          {/* Act 8: Final CTA */}
          <div id="cin-final-headline-wrap">
            <p id="cin-final-headline" ref={finalHeadlineRef} aria-label="Stop guessing. Start shipping what users need." />
            <div id="cin-final-rule" ref={finalRuleRef} />
          </div>
          <div id="cin-final-btns" ref={finalBtnsRef}>
            <button id="cin-final-btn-primary">Start your first brief →</button>
            <button id="cin-final-btn-secondary">Book a 15-min demo</button>
          </div>
          <p id="cin-final-sub" ref={finalSubRef}>No credit card · 2-minute setup · Works with Jira, Notion &amp; more</p>

          {/* Act 9: Live Demo */}
          <p id="cin-demo-label" ref={demoLabelRef}>A session in progress</p>
          <div id="cin-demo-chrome" ref={demoChromeRef}>
            <div className="demo-browser-bar">
              <div className="demo-traff">
                <span style={{ background: "#FF5F57" }} />
                <span style={{ background: "#FFBD2E" }} />
                <span style={{ background: "#28C840" }} />
              </div>
              <div className="demo-url-bar">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <rect x="2" y="5.5" width="8" height="5.5" rx="1" stroke="#6B6B6B" strokeWidth="1.2" />
                  <path d="M4 5.5V3.5a2 2 0 014 0V5.5" stroke="#6B6B6B" strokeWidth="1.2" fill="none" />
                </svg>
                app.specflow.ai/dashboard
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M13 8A5 5 0 103 8" stroke="#9E9E9E" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M13 4v4h-4" stroke="#9E9E9E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="demo-layout">
              <div className="demo-sidebar">
                <div className="demo-sidebar-logo">
                  <div className="demo-avatar">SF</div>
                  <div className="demo-sidebar-brand">
                    <span>SpecFlow</span>
                    <span>AI Product Manager</span>
                  </div>
                </div>
                <div className="demo-nav">
                  <div className="demo-nav-item active">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                      <rect x="1" y="1" width="4.5" height="4.5" rx="1" fill="#E8561B" />
                      <rect x="7.5" y="1" width="4.5" height="4.5" rx="1" fill="#E8561B" />
                      <rect x="1" y="7.5" width="4.5" height="4.5" rx="1" fill="#E8561B" />
                      <rect x="7.5" y="7.5" width="4.5" height="4.5" rx="1" fill="#E8561B" />
                    </svg>
                    Dashboard
                  </div>
                  <div className="demo-nav-item">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                      <rect x="1" y="2.5" width="11" height="2" rx="1" fill="#9E9E9E" />
                      <rect x="1" y="5.5" width="11" height="2" rx="1" fill="#9E9E9E" />
                      <rect x="1" y="8.5" width="7" height="2" rx="1" fill="#9E9E9E" />
                    </svg>
                    Sessions
                  </div>
                  <div className="demo-nav-item">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                      <rect x="2" y="1" width="9" height="11" rx="1.5" stroke="#9E9E9E" strokeWidth="1.2" />
                      <line x1="4" y1="4.5" x2="9" y2="4.5" stroke="#9E9E9E" strokeWidth="1" />
                      <line x1="4" y1="6.5" x2="9" y2="6.5" stroke="#9E9E9E" strokeWidth="1" />
                      <line x1="4" y1="8.5" x2="7" y2="8.5" stroke="#9E9E9E" strokeWidth="1" />
                    </svg>
                    Build Spec
                  </div>
                  <div className="demo-nav-item">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                      <path d="M2 6.5L11 2L8 11L6 7L2 6.5Z" stroke="#9E9E9E" strokeWidth="1.2" strokeLinejoin="round" />
                    </svg>
                    Ship Tasks
                  </div>
                </div>
                <div className="demo-upgrade"><span className="demo-upgrade-pill">Upgrade Plan →</span></div>
              </div>
              <div className="demo-main">
                <div className="demo-topbar">
                  <div className="demo-search">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <circle cx="5" cy="5" r="3.5" stroke="#9E9E9E" strokeWidth="1.2" />
                      <path d="M8 8L10.5 10.5" stroke="#9E9E9E" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                    Search sessions...
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="demo-avatar">SF</div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontFamily: "var(--font-dm-sans),'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, color: "#0D0D0D" }}>SpecFlow</span>
                      <span style={{ fontFamily: "var(--font-dm-sans),'DM Sans',sans-serif", fontSize: 10, color: "#6B6B6B" }}>AI Product Manager</span>
                    </div>
                  </div>
                </div>
                <div className="demo-body">
                  <div className="demo-title-row">
                    <div className="demo-title-text">
                      <h3>Dashboard</h3>
                      <p>Manage your AI pipeline runs.</p>
                    </div>
                    <div className="demo-title-btns">
                      <button className="demo-btn-primary">New Session</button>
                      <button className="demo-btn-ghost">Import Research</button>
                    </div>
                  </div>
                  <div className="demo-stats">
                    <div className="demo-stat-card hero">
                      <span className="demo-stat-label">TOTAL SESSIONS</span>
                      <span className="demo-stat-num">12</span>
                      <span className="demo-stat-sub">↑ +3 this week</span>
                    </div>
                    <div className="demo-stat-card plain">
                      <span className="demo-stat-label">COMPLETED</span>
                      <span className="demo-stat-num">9</span>
                      <span className="demo-stat-sub">↑ +2 this week</span>
                    </div>
                    <div className="demo-stat-card plain">
                      <span className="demo-stat-label">ACTIVE</span>
                      <span className="demo-stat-num">3</span>
                      <span className="demo-stat-sub">↑ +1 this week</span>
                    </div>
                    <div className="demo-stat-card plain">
                      <span className="demo-stat-label">PRDs GENERATED</span>
                      <span className="demo-stat-num">9</span>
                      <span className="demo-stat-sub">↑ +2 this week</span>
                    </div>
                  </div>
                  <div className="demo-row2">
                    <div className="demo-card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span className="demo-card-title">Pipeline Analytics</span>
                        <span style={{ fontFamily: "var(--font-dm-sans),'DM Sans',sans-serif", fontSize: 11, color: "#6B6B6B" }}>Last 7 days</span>
                      </div>
                      <div className="demo-chart">
                        <div className="demo-bar-col"><div className="demo-bar" style={{ height: 24, background: "#0D0D0D", opacity: 0.15 }} /><span className="demo-bar-lbl">S</span></div>
                        <div className="demo-bar-col"><div className="demo-bar" style={{ height: 44, background: "#0D0D0D", opacity: 0.22 }} /><span className="demo-bar-lbl">M</span></div>
                        <div className="demo-bar-col"><div className="demo-bar" style={{ height: 32, background: "#0D0D0D", opacity: 0.15 }} /><span className="demo-bar-lbl">T</span></div>
                        <div className="demo-bar-col" style={{ position: "relative" }}>
                          <span style={{ position: "absolute", top: -18, fontFamily: "var(--font-dm-sans),'DM Sans',sans-serif", fontSize: 10, fontWeight: 700, color: "#E8561B" }}>85%</span>
                          <div className="demo-bar" style={{ height: 68, background: "#E8561B" }} />
                          <span className="demo-bar-lbl">W</span>
                        </div>
                        <div className="demo-bar-col"><div className="demo-bar" style={{ height: 40, background: "#0D0D0D", opacity: 0.22 }} /><span className="demo-bar-lbl">T</span></div>
                        <div className="demo-bar-col"><div className="demo-bar" style={{ height: 56, background: "#0D0D0D", opacity: 0.18 }} /><span className="demo-bar-lbl">F</span></div>
                        <div className="demo-bar-col"><div className="demo-bar" style={{ height: 20, background: "#0D0D0D", opacity: 0.15 }} /><span className="demo-bar-lbl">S</span></div>
                      </div>
                    </div>
                    <div className="demo-right-col">
                      <div className="demo-card" style={{ flex: 1 }}>
                        <span className="demo-card-title">Recent Activity</span>
                        <div style={{ marginTop: 10 }}>
                          <div className="demo-activity-row"><div className="demo-dot" style={{ background: "#3D6B5E" }} /><span>Checkout Redesign</span><span style={{ marginLeft: "auto", color: "#9E9E9E", fontSize: 11 }}>2h ago</span></div>
                          <div className="demo-activity-row"><div className="demo-dot" style={{ background: "#E8561B" }} /><span>Search Autocomplete</span><span style={{ marginLeft: "auto", color: "#9E9E9E", fontSize: 11 }}>5h ago</span></div>
                          <div className="demo-activity-row"><div className="demo-dot" style={{ background: "#3D6B5E" }} /><span>Onboarding Flow</span><span style={{ marginLeft: "auto", color: "#9E9E9E", fontSize: 11 }}>1d ago</span></div>
                        </div>
                      </div>
                      <div className="demo-plan-card">
                        <div style={{ fontFamily: "var(--font-instrument),'Instrument Serif',serif", fontSize: 14, color: "white" }}>Plan Usage</div>
                        <div className="demo-plan-bar"><div className="demo-plan-fill" /></div>
                        <div style={{ fontFamily: "var(--font-dm-sans),'DM Sans',sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>2 of 5 runs used</div>
                        <div style={{ fontFamily: "var(--font-dm-sans),'DM Sans',sans-serif", fontSize: 11, fontWeight: 600, color: "#E8561B", marginTop: 8 }}>Upgrade plan →</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Typing card */}
          <div id="cin-demo-typing-card" ref={demoTypingCardRef}>
            <div className="demo-typing-header">
              <div className="demo-pulse-dot" />
              <span style={{ fontFamily: "var(--font-dm-sans),'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, color: "var(--text)", flex: 1 }}>Writing spec · Checkout Redesign</span>
              <span style={{ fontFamily: "var(--font-instrument),'Instrument Serif',serif", fontStyle: "italic", fontSize: 11, color: "var(--text-muted)" }}>PRD · 0.8s elapsed</span>
            </div>
            <div id="cin-typing-output" ref={typingOutputRef} />
            <div className="demo-typing-btns">
              <button className="demo-typing-btn-primary">Push to Jira →</button>
              <button className="demo-typing-btn-ghost">Export PRD</button>
            </div>
          </div>

          {/* Act 10: Before / After */}
          <p id="cin-act10-label" ref={act10LabelRef}>Without vs with SpecFlow</p>
          <div id="cin-compare-wrap">
            <div id="cin-before-panel" ref={beforePanelRef}>
              <div className="compare-inner before">
                <div className="compare-header">
                  <div className="compare-header-lbl"><div className="compare-dot" />BEFORE</div>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="5.5" stroke="#9E9E9E" strokeWidth="1.2" /><path d="M7 4.5V7L8.5 8.5" stroke="#9E9E9E" strokeWidth="1.2" strokeLinecap="round" /></svg>
                </div>
                <div className="compare-title">The manual grind</div>
                <div className="compare-list">
                  {[
                    "3–5 days writing a PRD from scratch in a blank Google Doc",
                    "Research lives in Zoom, Jira, Notion, and Slack — never connected",
                    "Engineering starts without full context — then asks questions",
                    "Alignment meetings eat the week before a single line of code",
                    "Stakeholder edits reopen the scope every time",
                  ].map((text, i) => (
                    <div key={i} className="compare-item">
                      <svg className="compare-icon" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7.5" stroke="#9E9E9E" strokeWidth="1.5" /><path d="M6 6l6 6M12 6l-6 6" stroke="#9E9E9E" strokeWidth="1.5" strokeLinecap="round" /></svg>
                      <span className="compare-item-text">{text}</span>
                    </div>
                  ))}
                </div>
                <div className="compare-footer">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><circle cx="6.5" cy="6.5" r="5" stroke="#9E9E9E" strokeWidth="1.2" /><path d="M6.5 3.5V6.5L8 8" stroke="#9E9E9E" strokeWidth="1.2" strokeLinecap="round" /></svg>
                  <span className="compare-footer-text">Avg. time to shipped spec: 4–5 days</span>
                </div>
              </div>
            </div>
            <div id="cin-after-panel" ref={afterPanelRef}>
              <div className="compare-inner after">
                <div className="compare-header">
                  <div className="compare-header-lbl"><div className="compare-dot" />SPECFLOW</div>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 1.5L8.5 5.5H13L9.5 8L11 12L7 9.5L3 12L4.5 8L1 5.5H5.5L7 1.5Z" stroke="#E8561B" strokeWidth="1.2" strokeLinejoin="round" fill="none" /></svg>
                </div>
                <div className="compare-title">The brief everyone actually reads</div>
                <div className="compare-list">
                  {[
                    "Full spec generated from your raw signals in one session",
                    "Slack, Gong, Zendesk, and docs unified — automatically cited",
                    "Engineering gets context, rationale, and tasks in one doc",
                    "Async by default — review when you're ready, not in a meeting",
                    "One source of truth. Always traceable to real customer data.",
                  ].map((text, i) => (
                    <div key={i} className="compare-item">
                      <svg className="compare-icon" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7.5" stroke="#E8561B" strokeWidth="1.5" /><path d="M5.5 9l2.5 2.5 5-5" stroke="#E8561B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      <span className="compare-item-text">{text}</span>
                    </div>
                  ))}
                </div>
                <div className="compare-footer">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M6.5 1L7.8 4.5H11.5L8.5 6.5L9.8 10.5L6.5 8.5L3.2 10.5L4.5 6.5L1.5 4.5H5.2L6.5 1Z" stroke="#E8561B" strokeWidth="1.1" strokeLinejoin="round" fill="none" /></svg>
                  <span className="compare-footer-text">Avg. time to shipped spec: ~12 minutes</span>
                </div>
              </div>
            </div>
          </div>

          <div id="cin-compare-divider" ref={compareDividerRef} />
          <div id="cin-compare-vs" ref={compareVsRef}>vs</div>
          <div id="cin-compare-cta" ref={compareCtaRef}>
            <button id="cin-compare-cta-btn">Start your first brief →</button>
            <p>No credit card · 2-minute setup · Works with Jira, Notion &amp; more</p>
          </div>
        </div>
      </div>

      {/* Progress indicator */}
      <div id="cin-progress-wrap" ref={progressWrapRef}>
        <div id="cin-progress-track">
          <div id="cin-progress-fill" ref={fillRef} />
        </div>
      </div>
    </>
  );
}
