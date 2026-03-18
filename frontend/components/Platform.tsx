const integrationNodes = [
  { label: "GitHub", emoji: "🐙", angle: 0 },
  { label: "Jira", emoji: "🔷", angle: 45 },
  { label: "Notion", emoji: "📝", angle: 90 },
  { label: "Figma", emoji: "🎨", angle: 135 },
  { label: "Linear", emoji: "◻", angle: 180 },
  { label: "Slack", emoji: "💬", angle: 225 },
  { label: "VS Code", emoji: "💻", angle: 270 },
  { label: "Vercel", emoji: "▲", angle: 315 },
];

function OrbitDiagram() {
  const cx = 200;
  const cy = 200;
  const r1 = 80;
  const r2 = 150;

  return (
    <svg viewBox="0 0 400 400" width="100%" style={{ maxWidth: 420 }}>
      <defs>
        <radialGradient id="orbitGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E8561B" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#E8561B" stopOpacity="0" />
        </radialGradient>
        <filter id="orbitNodeGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer glow */}
      <circle cx={cx} cy={cy} r="190" fill="url(#orbitGlow)" />

      {/* Orbit rings */}
      <circle cx={cx} cy={cy} r={r2} fill="none" stroke="#E4DDD4" strokeWidth="1" strokeDasharray="6 4" />
      <circle cx={cx} cy={cy} r={r1} fill="none" stroke="#E4DDD4" strokeWidth="1" strokeDasharray="4 4" />

      {/* Lines from center to each node */}
      {integrationNodes.map((node) => {
        const rad = (node.angle * Math.PI) / 180;
        const nx = cx + r2 * Math.cos(rad);
        const ny = cy + r2 * Math.sin(rad);
        return (
          <line
            key={node.label}
            x1={cx}
            y1={cy}
            x2={nx}
            y2={ny}
            stroke="#E8561B"
            strokeWidth="1"
            strokeOpacity="0.2"
            strokeDasharray="3 3"
          />
        );
      })}

      {/* Integration nodes */}
      {integrationNodes.map((node) => {
        const rad = (node.angle * Math.PI) / 180;
        const nx = cx + r2 * Math.cos(rad);
        const ny = cy + r2 * Math.sin(rad);
        return (
          <g key={node.label} filter="url(#orbitNodeGlow)">
            <rect
              x={nx - 24}
              y={ny - 20}
              width="48"
              height="40"
              rx="10"
              fill="white"
              stroke="#E4DDD4"
              strokeWidth="1"
            />
            <text
              x={nx}
              y={ny - 4}
              textAnchor="middle"
              fontSize="14"
            >
              {node.emoji}
            </text>
            <text
              x={nx}
              y={ny + 13}
              textAnchor="middle"
              fill="#6B6B6B"
              fontSize="7"
              fontFamily="DM Sans, sans-serif"
              fontWeight="600"
            >
              {node.label}
            </text>
          </g>
        );
      })}

      {/* Inner ring nodes (4 mid-orbit) */}
      {[0, 90, 180, 270].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const nx = cx + r1 * Math.cos(rad);
        const ny = cy + r1 * Math.sin(rad);
        const colors = ["#E8561B", "#F59E0B", "#8B5CF6", "#06B6D4"];
        return (
          <circle key={i} cx={nx} cy={ny} r="7" fill={colors[i]} fillOpacity="0.8">
            <animate
              attributeName="fillOpacity"
              values="0.5;1;0.5"
              dur={`${2 + i * 0.5}s`}
              repeatCount="indefinite"
            />
          </circle>
        );
      })}

      {/* Center SpecFlow hub */}
      <circle cx={cx} cy={cy} r="36" fill="#E8561B" fillOpacity="0.12" stroke="#E8561B" strokeWidth="1.5">
        <animate attributeName="r" values="34;38;34" dur="3s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r="26" fill="#E8561B" />
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        fill="white"
        fontSize="7"
        fontFamily="monospace"
        fontWeight="800"
      >
        SPEC
      </text>
      <text
        x={cx}
        y={cy + 7}
        textAnchor="middle"
        fill="white"
        fontSize="7"
        fontFamily="monospace"
        fontWeight="800"
      >
        FLOW
      </text>
    </svg>
  );
}

export default function Platform() {
  return (
    <section className="w-full py-20" style={{ background: "#F0EAE1" }}>
      <div className="max-w-6xl mx-auto px-6">
        {/* Heading */}
        <div className="text-center mb-14">
          <h2
            className="font-display mb-3"
            style={{
              fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)",
              fontWeight: 400,
              letterSpacing: "-0.025em",
              lineHeight: 1.15,
              color: "#0D0D0D",
            }}
          >
            Gather Your Tools And Crew{" "}
            <span style={{ color: "#E8561B", fontStyle: "italic" }}>
              For The Journey.
            </span>
          </h2>
          <p
            className="font-sans mx-auto"
            style={{
              color: "#6B6B6B",
              fontSize: "1rem",
              lineHeight: 1.65,
              maxWidth: "400px",
            }}
          >
            SpecFlow connects with the tools your team already loves — no
            migration, no friction.
          </p>
        </div>

        {/* Orbit diagram */}
        <div className="flex justify-center">
          <OrbitDiagram />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-14">
          {[
            { value: "40+", label: "Integrations" },
            { value: "10x", label: "Faster spec writing" },
            { value: "99%", label: "Accuracy rate" },
            { value: "500+", label: "Teams onboarded" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="text-center p-5 rounded-2xl"
              style={{ background: "white", border: "1px solid #E4DDD4" }}
            >
              <div
                className="font-display mb-1"
                style={{
                  fontSize: "2rem",
                  fontWeight: 400,
                  color: "#E8561B",
                  letterSpacing: "-0.03em",
                }}
              >
                {stat.value}
              </div>
              <div
                className="font-sans text-sm"
                style={{ color: "#6B6B6B", fontWeight: 500 }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
