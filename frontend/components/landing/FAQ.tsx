"use client";

import React from "react";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import styles from "./landing.module.css";

const faqs = [
  {
    answer:
      "SpecFlow is purpose-built for product discovery — not general text generation. It understands the structure of a feature brief and actively pulls signal from connected sources like Zendesk, Gong, and Slack, not just what you type into a prompt. Every output is traceable back to real customer data, so you can defend every line in a stakeholder review.",
    question: "How is SpecFlow different from ChatGPT or Notion AI?",
  },
  {
    answer:
      "SpecFlow connects to Zendesk, Gong, Intercom, Slack, Jira, Notion, GitHub, and uploaded transcripts or documents. You can also paste raw text or meeting notes directly into the editor. More integrations are added monthly based on team requests.",
    question: "What data sources can I connect?",
  },
  {
    answer:
      "Most briefs are ready in under 12 minutes from signal to finished document. Complex features with many data sources may take up to 20 minutes. You can queue multiple briefs and review them async — SpecFlow notifies you when each one is ready.",
    question: "How long does it take to generate a brief?",
  },
  {
    answer:
      "Yes. SpecFlow never uses your customer data to train any model — it is processed and then discarded. All data is encrypted in transit and at rest, and each workspace is fully isolated from others. We are SOC 2 Type II certified.",
    question: "Is my data private and secure?",
  },
  {
    answer:
      "Pro and Team plans include custom brief templates where you define sections, tone, level of detail, and output format — Markdown, Notion, or Google Doc. Starter users get the default SpecFlow template, which covers the most common PM workflows.",
    question: "Can I customize the brief output format?",
  },
  {
    answer: (
      <>
        Yes. The Team plan includes SSO, 5 seats, and API access. For larger organizations needing
        custom seat counts, SLAs, or dedicated onboarding, we offer enterprise agreements — email{" "}
        <a href="mailto:hello@specflow.app">hello@specflow.app</a> to get started.
      </>
    ),
    question: "Do you support enterprise teams?",
  },
] as { answer: ReactNode; question: string }[];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <hr className={styles.sectionRule} />
      <section aria-label="Frequently asked questions" className={styles.faqSection}>
        <div className={styles.sectionWrap}>
          <div className="fade-in">
            <p className={styles.sectionEyebrow}>FAQ</p>
            <h2 className={styles.sectionHeading}>Common questions.</h2>
          </div>

          <div className={`fade-in ${styles.faqList}`}>
            {faqs.map((faq, index) => {
              const isOpen = openIndex === index;

              return (
                <div className={styles.faqItem} key={faq.question}>
                  <button
                    aria-controls={`faq-panel-${index}`}
                    aria-expanded={isOpen}
                    className={styles.faqQuestion}
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    type="button"
                  >
                    <span>{faq.question}</span>
                    <span aria-hidden="true" className={styles.faqIcon}>
                      <Plus size={12} />
                    </span>
                  </button>
                  <div
                    className={styles.faqAnswer}
                    id={`faq-panel-${index}`}
                    role="region"
                    style={{ maxHeight: isOpen ? "200px" : "0" }}
                  >
                    <p className={styles.faqAnswerInner}>{faq.answer}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
