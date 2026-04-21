"use client";

const FOOTER_COPY = {
  brand: "SpecFlow AI",
  tagline: "Built for PMs who ship.",
  copyright: "© 2026 All rights reserved.",
  links: ["Privacy", "Terms", "Status", "Contact"],
};

export default function Footer() {
  return (
    <footer
      className="w-full py-8 px-6"
      style={{
        background: "var(--bg)",
        borderTop: "1px solid hsl(var(--border))",
      }}
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="font-sans font-semibold text-sm"
            style={{ color: "#3b352f", letterSpacing: "-0.02em" }}
          >
            {FOOTER_COPY.brand}
          </span>
          <span
            className="font-sans text-xs"
            style={{ color: "#7a6f64", fontStyle: "italic" }}
          >
            {FOOTER_COPY.tagline}
          </span>
          <span className="font-sans text-xs" style={{ color: "#7a6f64" }}>
            {FOOTER_COPY.copyright}
          </span>
        </div>
        <div className="flex gap-6">
          {FOOTER_COPY.links.map((link) => (
            <a
              key={link}
              href="#"
              className="footer-link font-sans text-xs"
              style={{ color: "#7a6f64", textDecoration: "none" }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color = "#3b352f")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color = "#7a6f64")
              }
            >
              {link}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
