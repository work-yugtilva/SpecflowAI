"use client";

import Image from "next/image";
import { useState } from "react";

const navLinks = [
  { label: "Product", hasDropdown: false, href: "#" },
  { label: "Pipeline", hasDropdown: false, href: "#" },
  { label: "Pricing", hasDropdown: false, href: "/pricing" },
  { label: "Docs", hasDropdown: false, href: "#" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const accent = "var(--orange)";
  const accentDark = "var(--orange-hover)";

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
            </a>
          ))}
        </nav>

        {/* Right — Desktop */}
        <div className="hidden md:flex items-center gap-3">
          <a href="/login" className="nav-link px-3 py-1.5">Log in</a>
          <a
            href="#"
            className="text-white text-sm px-5 py-2 rounded-lg font-medium transition-colors"
            style={{ backgroundColor: accent }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.backgroundColor = accentDark)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.backgroundColor = accent)}
          >
            Get started free
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
          <a
            href="#"
            className="text-white text-sm px-5 py-2 rounded-lg font-medium text-center mt-2 transition-colors"
            style={{ backgroundColor: accent }}
            onClick={() => setMobileOpen(false)}
          >
            Get started free
          </a>
        </div>
      )}
    </header>
  );
}
