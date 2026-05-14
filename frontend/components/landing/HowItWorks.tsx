import React from "react";
import { CheckCircle2 } from "lucide-react";
import styles from "./landing.module.css";

export default function HowItWorks() {
  return (
    <>
      <hr className={styles.sectionRule} />
      <section aria-label="How it works" id="how-it-works">
        <div className={styles.sectionWrap}>
          <div className="fade-in">
            <p className={styles.sectionEyebrow}>How it works</p>
            <h2 className={styles.sectionHeading}>
              From raw signal
              <br />
              to shipped spec.
            </h2>
          </div>

          <div className={`fade-in ${styles.hiwStep}`}>
            <div>
              <p className={styles.hiwNumber}>01</p>
              <h3 className={styles.hiwTitle}>Drop in your signals</h3>
              <p className={styles.hiwBody}>
                Paste a Zoom transcript, link your Zendesk, drop a Slack thread. SpecFlow reads
                what your users actually said — not what you remember from the last retro.
              </p>
            </div>
            <div aria-hidden="true" className={styles.hiwCard}>
              <div className={styles.hiwCardLabel}>Sources connected</div>
              <div className={styles.sourceRow}>
                <span className={styles.sourceDot} style={{ background: "#4a9fd4" }} />
                <span>Zoom · Checkout friction call</span>
                <span className={styles.sourceMeta}>48 min</span>
              </div>
              <div className={styles.sourceRow}>
                <span className={styles.sourceDot} style={{ background: "#87b5a2" }} />
                <span>Zendesk · Payment errors</span>
                <span className={styles.sourceMeta}>127 tickets</span>
              </div>
              <div className={styles.sourceRow}>
                <span className={styles.sourceDot} style={{ background: "#e8a838" }} />
                <span>Slack · #product-feedback</span>
                <span className={styles.sourceMeta}>38 messages</span>
              </div>
              <div className={styles.readyRow}>
                <div className={styles.readyTrack}>
                  <div className={styles.readyFill} style={{ width: "100%" }} />
                </div>
                <span className={styles.readyLabel}>Ready</span>
              </div>
            </div>
          </div>

          <div className={`fade-in ${styles.hiwStep} ${styles.hiwStepFlip}`}>
            <div>
              <p className={styles.hiwNumber}>02</p>
              <h3 className={styles.hiwTitle}>AI synthesizes the brief</h3>
              <p className={styles.hiwBody}>
                In under 12 minutes, SpecFlow surfaces the real need, writes the rationale,
                proposes UI changes, and maps the data model. No hallucinated requirements —
                every claim cites its source.
              </p>
            </div>
            <div aria-hidden="true" className={styles.hiwCard}>
              <div className={styles.hiwCardLabel}>Generating brief</div>
              <div className={styles.progressRow}>
                <div className={styles.progressLabel}>
                  <span>Analysing signals</span>
                  <span style={{ color: "var(--orange)" }}>Done</span>
                </div>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: "100%" }} />
                </div>
              </div>
              <div className={styles.progressRow}>
                <div className={styles.progressLabel}>
                  <span>Writing rationale</span>
                  <span style={{ color: "var(--orange)" }}>Done</span>
                </div>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: "100%" }} />
                </div>
              </div>
              <div className={styles.progressRow}>
                <div className={styles.progressLabel}>
                  <span>Proposing UI changes</span>
                  <span>Writing…</span>
                </div>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: "68%" }} />
                </div>
              </div>
              <div className={styles.progressRow}>
                <div className={styles.progressLabel}>
                  <span>Mapping tasks</span>
                  <span>Queued</span>
                </div>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: "0%" }} />
                </div>
              </div>
              <div className={styles.progressNote}>~4 min remaining · Checkout Redesign</div>
            </div>
          </div>

          <div className={`fade-in ${styles.hiwStep}`}>
            <div>
              <p className={styles.hiwNumber}>03</p>
              <h3 className={styles.hiwTitle}>Ship it to your stack</h3>
              <p className={styles.hiwBody}>
                One click sends the full brief to Jira, Notion, or directly to your
                coding agent. No copy-paste. No reformatting. Your whole team works from a single
                source of truth.
              </p>
            </div>
            <div aria-hidden="true" className={styles.hiwCard}>
              <div className={styles.hiwCardLabel}>Send brief to</div>
              <div className={styles.destGrid}>
                {["GitHub", "Notion", "Jira", "Cursor"].map((item) => (
                  <div className={styles.destChip} key={item}>
                    <CheckCircle2 color="var(--orange)" size={14} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className={styles.successRow}>
                <CheckCircle2 size={14} />
                <span>Brief pushed to Jira · 3 tasks created</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
