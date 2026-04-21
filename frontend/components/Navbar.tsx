"use client";

import Image from "next/image";
import { useState } from "react";

const navLinks = [
  { label: "Product", hasDropdown: true, href: "#" },
  { label: "Docs", hasDropdown: true, href: "#" },
  { label: "Resources", hasDropdown: true, href: "#" },
  { label: "Pricing", hasDropdown: false, href: "/pricing" },
  { label: "Blog", hasDropdown: false, href: "#" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        background: "rgba(247, 244, 240, 0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid hsl(var(--border))",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-[60px] flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 flex-shrink-0">
          <div
            className="relative overflow-hidden rounded-md"
            style={{ width: 28, height: 28 }}
          >
            <Image
              src="/logo.jpeg"
              alt="SpecFlow"
              fill
              className="object-cover"
              priority
            />
          </div>
          <span
            className="font-sans font-semibold text-[15px]"
            style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
          >
            SpecFlow
          </span>
        </a>

        {/* Center Nav — Desktop */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="nav-link px-3 py-1.5 rounded-md hover:bg-black/5"
            >
              {link.label}
              {link.hasDropdown && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  className="opacity-50 ml-0.5"
                >
                  <path
                    d="M3 4.5L6 7.5L9 4.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </a>
          ))}
        </nav>

        {/* Right — Desktop */}
        <div className="hidden md:flex items-center gap-3">
          <a href="/login" className="nav-link px-3 py-1.5">Log in</a>
          <a href="#" className="btn-dark text-sm" style={{ border: "1px solid var(--charcoal)" }}>
            Book a demo
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d={mobileOpen ? "M4 4L16 16M16 4L4 16" : "M3 6h14M3 10h14M3 14h14"}
              stroke="var(--text)"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="md:hidden px-6 pb-4 flex flex-col gap-2"
          style={{ borderTop: "1px solid hsl(var(--border))" }}
        >
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="nav-link py-2 text-[15px]"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <a href="/login" className="nav-link py-2 text-[15px]" onClick={() => setMobileOpen(false)}>Log in</a>
          <a href="#" className="btn-dark mt-2 w-full justify-center" style={{ border: "1px solid var(--charcoal)" }}>
            Book a demo
          </a>
        </div>
      )}
    </header>
  );
}
