"use client";

import Image from "next/image";
import { useState } from "react";

const navLinks = [
  { label: "Product", hasDropdown: true },
  { label: "Docs", hasDropdown: true },
  { label: "Resources", hasDropdown: true },
  { label: "Pricing", hasDropdown: false },
  { label: "Blog", hasDropdown: false },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        background: "rgba(248, 244, 239, 0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid #E4DDD4",
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
            style={{ color: "#0D0D0D", letterSpacing: "-0.02em" }}
          >
            SpecFlow
          </span>
        </a>

        {/* Center Nav — Desktop */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href="#"
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
          <a href="#" className="btn-dark text-sm">
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
              stroke="#0D0D0D"
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
          style={{ borderTop: "1px solid #E4DDD4" }}
        >
          {navLinks.map((link) => (
            <a
              key={link.label}
              href="#"
              className="nav-link py-2 text-[15px]"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <a href="/login" className="nav-link py-2 text-[15px]" onClick={() => setMobileOpen(false)}>Log in</a>
          <a href="#" className="btn-dark mt-2 w-full justify-center">
            Book a demo
          </a>
        </div>
      )}
    </header>
  );
}
