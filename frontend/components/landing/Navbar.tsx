"use client";

import React from "react";
import Link from "next/link";
import { Menu, Moon, Sun, X } from "lucide-react";
import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import LogoMark from "./LogoMark";
import styles from "./landing.module.css";

type ScrollLink = {
  href: string;
  id: string;
  label: string;
};

const scrollLinks: ScrollLink[] = [
  { href: "#how-it-works", id: "how-it-works", label: "Product" },
  { href: "#integrations", id: "integrations", label: "Pipeline" },
  { href: "#pricing", id: "pricing", label: "Pricing" },
];

export default function Navbar() {
  const [isDark, setIsDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.getAttribute("data-dark") === "true");
  }, []);

  useEffect(() => {
    if (!mobileOpen) {
      return undefined;
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [mobileOpen]);

  const toggleTheme = () => {
    const nextDark = !isDark;
    if (nextDark) {
      document.documentElement.setAttribute("data-dark", "true");
    } else {
      document.documentElement.removeAttribute("data-dark");
    }

    try {
      localStorage.setItem("specflow-theme", nextDark ? "dark" : "light");
    } catch (error) {
      console.error("Unable to persist theme", error);
    }

    setIsDark(nextDark);
  };

  const handleScroll = (
    event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
    sectionId: string
  ) => {
    event.preventDefault();
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
    setMobileOpen(false);
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className={styles.navbarWrap}>
      <header className={`${styles.navbarShell} liquid-glass`} role="banner">
        <Link aria-label="SpecFlow home" className={styles.brand} href="/">
          <LogoMark />
          <span className={styles.brandText}>SpecFlow</span>
        </Link>

        <nav aria-label="Primary navigation" className={styles.desktopNav}>
          {scrollLinks.map((link) => (
            <a
              className="nav-link"
              href={link.href}
              key={link.label}
              onClick={(event) => handleScroll(event, link.id)}
            >
              {link.label}
            </a>
          ))}
          <Link className="nav-link" href="/docs">
            Docs
          </Link>
        </nav>

        <div className={styles.desktopActions}>
          <button
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className={`${styles.iconButton} theme-toggle`}
            onClick={toggleTheme}
            type="button"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link className={styles.navTextLink} href="/login">
            Log in
          </Link>
          <Link className={styles.ctaLink} href="/signup" onClick={closeMobile}>
            Get started free
          </Link>
        </div>

        <div className={styles.mobileControls}>
          <button
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className={`${styles.iconButton} theme-toggle`}
            onClick={toggleTheme}
            type="button"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            aria-controls="mobile-nav"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            className={styles.iconButton}
            onClick={() => setMobileOpen((open) => !open)}
            type="button"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {mobileOpen ? (
        <div
          aria-label="Mobile navigation"
          className={`${styles.mobileDrawer} liquid-glass`}
          id="mobile-nav"
          role="dialog"
        >
          <div className={styles.mobileDrawerInner}>
            {scrollLinks.map((link) => (
              <a
                className={styles.mobileDrawerLink}
                href={link.href}
                key={link.label}
                onClick={(event) => handleScroll(event, link.id)}
              >
                {link.label}
              </a>
            ))}
            <Link className={styles.mobileDrawerLink} href="/docs" onClick={closeMobile}>
              Docs
            </Link>
            <Link className={styles.mobileDrawerLink} href="/login" onClick={closeMobile}>
              Log in
            </Link>
            <Link className={styles.ctaLink} href="/signup" onClick={closeMobile}>
              Get started free
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
