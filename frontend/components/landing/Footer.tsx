import React from "react";
import Link from "next/link";
import { Linkedin, Twitter } from "lucide-react";
import LogoMark from "./LogoMark";
import styles from "./landing.module.css";

export default function Footer() {
  return (
    <footer className={styles.siteFooter} role="contentinfo">
      <div className={styles.footerBrand}>
        <LogoMark size={20} />
        <span>© 2026 SpecFlow AI</span>
      </div>
      <nav aria-label="Footer navigation" className={styles.footerLinks}>
        <Link className={styles.footerLink} href="/docs">
          Docs
        </Link>
        <a className={styles.footerLink} href="mailto:hello@specflow.app">
          Contact
        </a>
        <a className={styles.footerLink} href="https://x.com/specflowai" rel="noopener noreferrer" target="_blank">
          <Twitter aria-hidden="true" size={14} />
          <span className="sr-only">SpecFlow on X</span>
        </a>
        <a
          className={styles.footerLink}
          href="https://www.linkedin.com/company/specflow-ai"
          rel="noopener noreferrer"
          target="_blank"
        >
          <Linkedin aria-hidden="true" size={14} />
          <span className="sr-only">SpecFlow on LinkedIn</span>
        </a>
      </nav>
    </footer>
  );
}
