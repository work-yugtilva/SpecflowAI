import React from "react";
import styles from "./landing.module.css";

const integrations = [
  { alt: "Linear logo", name: "Linear", slug: "linear" },
  { alt: "Jira logo", name: "Jira", slug: "jira" },
  { alt: "Notion logo", name: "Notion", slug: "notion" },
  { alt: "Slack logo", name: "Slack", slug: "slack" },
  { alt: "Zendesk logo", name: "Zendesk", slug: "zendesk" },
  { alt: "GitHub logo", name: "GitHub", slug: "github" },
  { alt: "Cursor logo", name: "Cursor", slug: "cursor" },
  { alt: "Anthropic logo", name: "Claude", slug: "anthropic" },
];

export default function Integrations() {
  return (
    <>
      <hr className={styles.sectionRule} />
      <section aria-label="Integrations" className={styles.integrationSection} id="integrations">
        <div className={styles.sectionWrap}>
          <div className="fade-in">
            <p className={styles.sectionEyebrow}>Integrations</p>
            <h2 className={styles.sectionHeading}>Works with your entire stack.</h2>
            <p className={styles.sectionSub}>
              SpecFlow connects to the tools your team already lives in — no new workflows to
              force.
            </p>
          </div>

          <div className={`fade-in ${styles.integrationGrid}`}>
            {integrations.map((integration) => (
              <div className={styles.integrationTile} key={integration.name}>
                <img
                  alt={integration.alt}
                  height={28}
                  loading="lazy"
                  src={`https://cdn.simpleicons.org/${integration.slug}`}
                  width={28}
                />
                <span className={styles.integrationName}>{integration.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
