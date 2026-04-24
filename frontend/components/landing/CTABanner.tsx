import React from "react";
import Link from "next/link";
import styles from "./landing.module.css";

export default function CTABanner() {
  return (
    <section className={`${styles.ctaBanner} fade-in`} aria-label="Final call to action">
      <div className={styles.sectionWrap}>
        <p className={styles.sectionEyebrow}>Ready?</p>
        <h2 className={`${styles.sectionHeading} ${styles.ctaBannerHeading}`}>
          Your next feature is already
          <br />
          in your data.
        </h2>
        <p className={`${styles.sectionSub} ${styles.ctaBannerSub}`}>
          Stop writing PRDs from memory. SpecFlow turns your raw signals into a brief your whole
          team will actually read — in the time it takes to brew a coffee.
        </p>
        <div className={styles.ctaBannerBtns}>
          <Link className={styles.ctaBannerPrimary} href="/signup">
            Start your first brief →
          </Link>
          <Link className={styles.ctaBannerGhost} href="/docs">
            Book a demo
          </Link>
        </div>
        <p className={styles.ctaBannerFine}>No credit card · 2-minute setup · Cancel anytime</p>
      </div>
    </section>
  );
}
