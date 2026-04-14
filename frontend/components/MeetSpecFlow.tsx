const productIcons = [
  {
    bg: "#E8561B",
    label: "Spec Gen",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    bg: "#F5A623",
    label: "AI Review",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
      </svg>
    ),
  },
  {
    bg: "#3D6B5E",
    label: "Coverage",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    bg: "#0D0D0D",
    label: "Integrations",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
      </svg>
    ),
  },
];

const connectionNodes = [
  { x: 50, y: 50, label: "Specs" },
  { x: 200, y: 30, label: "Tests" },
  { x: 320, y: 80, label: "Docs" },
  { x: 100, y: 150, label: "APIs" },
  { x: 260, y: 170, label: "Code" },
  { x: 370, y: 200, label: "PRs" },
];

export default function MeetSpecFlow() {
  return (
    <section className="w-full py-20" style={{ background: "#F8F4EF" }}>
      <div className="max-w-6xl mx-auto px-6">
        {/* Top section - two columns */}
        <div className="grid lg:grid-cols-2 gap-16 items-center mb-20">
          {/* Left: headline + icons */}
          <div>
            <h2 className="font-display mb-4" style={{
              fontSize: "clamp(2rem, 4vw, 3rem)",
              fontWeight: 400,
              letterSpacing: "-0.025em",
              lineHeight: 1.15,
              color: "#0D0D0D",
            }}>
              Meet SpecFlow.{" "}
              <span style={{ display: "block" }}>Your All-In-One</span>
              <span style={{ color: "#E8561B", fontStyle: "italic" }}>
                AI Specs Stack.
              </span>
            </h2>

            <p className="font-sans mb-8" style={{
              fontSize: "1rem",
              lineHeight: 1.7,
              color: "#6B6B6B",
              maxWidth: "420px",
            }}>
              Empowering developers with innovative tools that simplify
              workflows and boost productivity across the entire spec lifecycle.
            </p>

            {/* Icon row */}
            <div className="flex gap-3 flex-wrap">
              {productIcons.map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-1.5">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{
                      background: item.bg,
                      boxShadow: `0 4px 16px ${item.bg}40`,
                    }}
                  >
                    {item.icon}
                  </div>
                  <span className="font-sans text-xs" style={{ color: "#6B6B6B", fontWeight: 500 }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: 3D chip + connection map */}
          <div className="relative flex items-center justify-center" style={{ minHeight: 300 }}>
            {/* Background glow */}
            <div
              className="absolute"
              style={{
                width: 280,
                height: 280,
                background: "radial-gradient(circle, rgba(232,86,27,0.15) 0%, transparent 70%)",
                borderRadius: "50%",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }}
            />

            {/* AI Chip visualization */}
            <div
              style={{
                animation: "floatY 3.5s ease-in-out infinite",
                filter: "drop-shadow(0 8px 32px rgba(232,86,27,0.3))",
              }}
            >
              <svg viewBox="0 0 240 240" width="220" height="220">
                <defs>
                  <radialGradient id="chipBg2" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#2a2520" />
                    <stop offset="100%" stopColor="#111" />
                  </radialGradient>
                  <filter id="glow2">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Outer trace lines */}
                <line x1="0" y1="80" x2="55" y2="80" stroke="#E8561B" strokeWidth="1.5" strokeOpacity="0.6" />
                <line x1="0" y1="110" x2="55" y2="110" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.35" />
                <line x1="0" y1="130" x2="55" y2="130" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.4" />
                <line x1="0" y1="160" x2="55" y2="160" stroke="#E8561B" strokeWidth="1.5" strokeOpacity="0.5" />
                <line x1="185" y1="80" x2="240" y2="80" stroke="#E8561B" strokeWidth="1.5" strokeOpacity="0.5" />
                <line x1="185" y1="110" x2="240" y2="110" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.35" />
                <line x1="185" y1="130" x2="240" y2="130" stroke="#E8561B" strokeWidth="1.5" strokeOpacity="0.6" />
                <line x1="185" y1="160" x2="240" y2="160" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.4" />

                <line x1="80" y1="0" x2="80" y2="55" stroke="#E8561B" strokeWidth="1.5" strokeOpacity="0.5" />
                <line x1="110" y1="0" x2="110" y2="55" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.35" />
                <line x1="130" y1="0" x2="130" y2="55" stroke="#E8561B" strokeWidth="1.5" strokeOpacity="0.6" />
                <line x1="160" y1="0" x2="160" y2="55" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.4" />
                <line x1="80" y1="185" x2="80" y2="240" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.4" />
                <line x1="110" y1="185" x2="110" y2="240" stroke="#E8561B" strokeWidth="1.5" strokeOpacity="0.5" />
                <line x1="130" y1="185" x2="130" y2="240" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.35" />
                <line x1="160" y1="185" x2="160" y2="240" stroke="#E8561B" strokeWidth="1.5" strokeOpacity="0.6" />

                {/* Main body */}
                <rect x="55" y="55" width="130" height="130" rx="14" fill="url(#chipBg2)" />
                <rect x="55" y="55" width="130" height="130" rx="14" fill="none" stroke="#E8561B" strokeWidth="1.5" strokeOpacity="0.7" />
                <rect x="64" y="64" width="112" height="112" rx="10" fill="none" stroke="#E8561B" strokeWidth="0.5" strokeOpacity="0.25" />

                {/* Internal grid */}
                {[85, 100, 120, 140, 155].map((x) =>
                  [85, 100, 120, 140, 155].map((y) => (
                    <rect key={`${x}-${y}`} x={x - 5} y={y - 5} width="10" height="10" rx="2" fill="#E8561B" fillOpacity="0.06" stroke="#E8561B" strokeWidth="0.4" strokeOpacity="0.15" />
                  ))
                )}

                {/* AI label */}
                <rect x="98" y="108" width="44" height="24" rx="6" fill="#E8561B" fillOpacity="0.18" stroke="#E8561B" strokeWidth="1" strokeOpacity="0.6" />
                <text x="120" y="122" textAnchor="middle" fill="#E8561B" fontSize="10" fontWeight="800" fontFamily="monospace" filter="url(#glow2)">AI</text>

                {/* Corner glows */}
                <circle cx="69" cy="69" r="3" fill="#E8561B" fillOpacity="0.6" />
                <circle cx="171" cy="69" r="3" fill="#E8561B" fillOpacity="0.6" />
                <circle cx="69" cy="171" r="3" fill="#E8561B" fillOpacity="0.6" />
                <circle cx="171" cy="171" r="3" fill="#E8561B" fillOpacity="0.6" />

                {/* Center pulse */}
                <circle cx="120" cy="120" r="5" fill="#E8561B" fillOpacity="0.9">
                  <animate attributeName="fillOpacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="r" values="4;7;4" dur="2s" repeatCount="indefinite" />
                </circle>
              </svg>
            </div>

            {/* Floating tags around chip */}
            {[
              { label: "We spark creativity", top: "5%", left: "2%" },
              { label: "and community", top: "15%", right: "2%" },
              { label: "User Experience", bottom: "25%", left: "0%" },
              { label: "Creative Design", bottom: "10%", right: "2%" },
            ].map((tag, i) => (
              <div
                key={i}
                className="float-label absolute hidden lg:block"
                style={{
                  top: tag.top,
                  left: tag.left,
                  right: (tag as { right?: string }).right,
                  bottom: (tag as { bottom?: string }).bottom,
                  animation: `floatY ${3 + i * 0.5}s ease-in-out ${i * 0.4}s infinite`,
                  fontSize: "0.7rem",
                }}
              >
                {tag.label}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: Atlas / Feature detail card + network diagram */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Feature card */}
          <div
            className="rounded-2xl p-8"
            style={{
              background: "#FFFFFF",
              border: "1px solid #E4DDD4",
              boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
              style={{ background: "#E8561B" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <h3 className="font-display mb-2" style={{ fontSize: "1.35rem", fontWeight: 400, color: "#0D0D0D" }}>
              Atlas AI Precision
            </h3>
            <p className="font-sans mb-6" style={{ fontSize: "0.9rem", lineHeight: 1.65, color: "#6B6B6B" }}>
              Our AI-powered products provide precision and affordable options for every team size.
            </p>
            {/* Mock spec preview */}
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #E4DDD4", background: "#F8F4EF" }}>
              <div className="px-4 py-2 flex items-center gap-2" style={{ borderBottom: "1px solid #E4DDD4" }}>
                <div className="w-2 h-2 rounded-full" style={{ background: "#E8561B" }} />
                <span className="font-sans text-xs font-medium" style={{ color: "#6B6B6B" }}>spec.md — Generated</span>
              </div>
              <div className="p-4 font-mono text-xs space-y-1.5" style={{ color: "#3a3530" }}>
                <div className="flex items-start gap-2">
                  <span style={{ color: "#E8561B", fontWeight: 600 }}>#</span>
                  <span>User Authentication Spec</span>
                </div>
                <div className="flex items-start gap-2 pl-3">
                  <span style={{ color: "#9a9085" }}>•</span>
                  <span style={{ color: "#6B6B6B" }}>Acceptance criteria: user can log in with Google OAuth</span>
                </div>
                <div className="flex items-start gap-2 pl-3">
                  <span style={{ color: "#9a9085" }}>•</span>
                  <span style={{ color: "#6B6B6B" }}>OAuth 2.0 flow defined</span>
                </div>
                <div
                  className="mt-2 inline-block px-2 py-1 rounded text-xs font-medium"
                  style={{ background: "rgba(232,86,27,0.10)", color: "#E8561B" }}
                >
                  ✓ AI validated
                </div>
              </div>
            </div>
          </div>

          {/* Network diagram */}
          <div
            className="rounded-2xl p-8 flex flex-col items-center justify-center"
            style={{
              background: "#FFFFFF",
              border: "1px solid #E4DDD4",
              boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
            }}
          >
            <p className="font-sans text-xs font-medium mb-6" style={{ color: "#6B6B6B", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Connected Ecosystem
            </p>
            <svg viewBox="0 0 400 260" width="100%" style={{ maxWidth: 360 }}>
              {/* Lines from center to nodes */}
              {connectionNodes.map((node, i) => (
                <line key={i} x1="200" y1="130" x2={node.x + 22} y2={node.y + 16} stroke="#E8561B" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="4 3" />
              ))}

              {/* Satellite nodes */}
              {connectionNodes.map((node, i) => (
                <g key={i}>
                  <rect x={node.x} y={node.y} width="44" height="32" rx="8" fill="white" stroke="#E4DDD4" strokeWidth="1" />
                  <text x={node.x + 22} y={node.y + 21} textAnchor="middle" fill="#3a3530" fontSize="9" fontFamily="DM Sans, sans-serif" fontWeight="600">
                    {node.label}
                  </text>
                </g>
              ))}

              {/* Center node — SpecFlow */}
              <circle cx="200" cy="130" r="34" fill="#E8561B" fillOpacity="0.12" stroke="#E8561B" strokeWidth="1.5" />
              <circle cx="200" cy="130" r="24" fill="#E8561B">
                <animate attributeName="r" values="22;26;22" dur="3s" repeatCount="indefinite" />
              </circle>
              <text x="200" y="127" textAnchor="middle" fill="white" fontSize="7" fontFamily="monospace" fontWeight="700">SPEC</text>
              <text x="200" y="138" textAnchor="middle" fill="white" fontSize="7" fontFamily="monospace" fontWeight="700">FLOW</text>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
