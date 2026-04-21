"use client";

/**
 * Value prop that lived under the old three-column PainStrip.
 * Restored without the “You ran the interviews” grid.
 */
export default function ProductDiscoveryStrip() {
  return (
    <section
      className="foundry-telemetry flex w-full justify-center overflow-hidden rounded-b-[1.75rem] sm:rounded-b-[2rem] px-6"
      style={{
        borderTop: "1px solid rgba(228,97,26,0.25)",
        background: "var(--charcoal-card)",
        padding: "48px 24px",
      }}
    >
      <p
        className="font-display w-full max-w-[700px] text-center text-balance"
        style={{
          color: "var(--charcoal-text)",
          fontSize: "clamp(1rem, 2vw, 1.35rem)",
          fontStyle: "italic",
          fontWeight: 400,
          lineHeight: 1.55,
          letterSpacing: "-0.01em",
          margin: 0,
          textAlign: "center",
        }}
      >
        Cursor and Claude Code can build the software, but you still spend 20 hours a week figuring out the requirements.{" "}
        <span style={{ color: "var(--orange)" }}>
          Automate the product discovery process so your coding agents actually have something to build.
        </span>
      </p>
    </section>
  );
}
