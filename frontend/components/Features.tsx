const features = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
    iconBg: "#E8561B",
    title: "AI Spec Generation",
    desc: "Auto-generate detailed specifications from prompts, user stories, or rough ideas in seconds.",
    mockup: (
      <div className="rounded-lg overflow-hidden mt-4" style={{ border: "1px solid #E4DDD4", background: "#F8F4EF" }}>
        <div className="px-3 py-2 flex items-center gap-1.5" style={{ borderBottom: "1px solid #E4DDD4" }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#E8561B" }} />
          <span className="font-sans text-[10px]" style={{ color: "#9a9085" }}>spec_output.md</span>
        </div>
        <div className="p-3 font-mono text-[10px] space-y-1" style={{ color: "#3a3530" }}>
          <div><span style={{ color: "#E8561B" }}>#</span> Feature: Login Flow</div>
          <div style={{ color: "#9a9085" }}>  - Given user is on login page</div>
          <div style={{ color: "#9a9085" }}>  - When credentials are entered</div>
          <div style={{ color: "#6B6B6B" }}>  - Then redirect to dashboard</div>
        </div>
      </div>
    ),
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
    iconBg: "#22C55E",
    title: "Reduce Manual Errors",
    desc: "AI-powered validation catches inconsistencies, missing acceptance criteria, and ambiguous requirements automatically.",
    mockup: (
      <div className="rounded-lg mt-4 p-3 flex items-start gap-2" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" className="mt-0.5 flex-shrink-0">
          <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" />
        </svg>
        <span className="font-sans text-[11px]" style={{ color: "#3a3530" }}>0 validation errors found — spec is complete and consistent.</span>
      </div>
    ),
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
    iconBg: "#8B5CF6",
    title: "Custom Templates",
    desc: "Brand-ready spec templates tailored to your team's process — from Agile user stories to RFC documents.",
    mockup: (
      <div className="flex gap-2 mt-4 flex-wrap">
        {["User Story", "RFC", "PRD", "API Spec"].map((t) => (
          <span key={t} className="font-sans text-[10px] font-medium px-2.5 py-1 rounded-full" style={{ background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.2)", color: "#8B5CF6" }}>
            {t}
          </span>
        ))}
      </div>
    ),
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
      </svg>
    ),
    iconBg: "#F59E0B",
    title: "Integrate Your Stack",
    desc: "Connect Jira, GitHub, Linear, Notion and 40+ tools — specs sync automatically with your existing workflow.",
    mockup: (
      <div className="flex items-center gap-3 mt-4">
        {["Jira", "GitHub", "Linear", "Notion"].map((tool, i) => (
          <div key={tool} className="w-8 h-8 rounded-lg flex items-center justify-center font-mono text-[9px] font-bold" style={{ background: ["#0052CC", "#24292E", "#5E6AD2", "#191919"][i], color: "white" }}>
            {tool[0]}
          </div>
        ))}
        <span className="font-sans text-[10px]" style={{ color: "#9a9085" }}>+36</span>
      </div>
    ),
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    iconBg: "#EC4899",
    title: "Avoid Spec Bottlenecks",
    desc: "Real-time collaboration for PMs, engineers, and QA — comment, resolve, and sign off without email threads.",
    mockup: (
      <div className="flex items-center gap-2 mt-4">
        {["PM", "Dev", "QA"].map((role, i) => (
          <div key={role} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(236,72,153,0.08)", border: "1px solid rgba(236,72,153,0.2)" }}>
            <div className="w-4 h-4 rounded-full flex items-center justify-center font-mono text-[7px] font-bold text-white" style={{ background: ["#EC4899", "#E8561B", "#8B5CF6"][i] }}>
              {role[0]}
            </div>
            <span className="font-sans text-[10px]" style={{ color: "#3a3530", fontWeight: 500 }}>{role}</span>
          </div>
        ))}
        <span className="text-[10px]" style={{ color: "#22C55E" }}>● Live</span>
      </div>
    ),
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    iconBg: "#06B6D4",
    title: "Track Test Coverage",
    desc: "Live coverage metrics linked directly to specs — see which requirements are tested and which have gaps.",
    mockup: (
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-sans text-[10px]" style={{ color: "#6B6B6B" }}>Spec coverage</span>
          <span className="font-sans text-[10px] font-bold" style={{ color: "#06B6D4" }}>87%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "#E4DDD4" }}>
          <div className="h-full rounded-full" style={{ width: "87%", background: "linear-gradient(90deg, #06B6D4, #0EA5E9)" }} />
        </div>
      </div>
    ),
  },
];

export default function Features() {
  return (
    <section className="w-full py-20" style={{ background: "#F8F4EF" }}>
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-14">
          <h2 className="font-display mb-3" style={{
            fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)",
            fontWeight: 400,
            letterSpacing: "-0.025em",
            lineHeight: 1.15,
            color: "#0D0D0D",
          }}>
            Awesome Ways To Improve{" "}
            <span style={{ color: "#E8561B", fontStyle: "italic" }}>Software Quality!</span>
          </h2>
          <p className="font-sans mx-auto" style={{ color: "#6B6B6B", fontSize: "1rem", lineHeight: 1.6, maxWidth: "440px" }}>
            Everything your team needs to write, review, and ship specs without the chaos.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, i) => (
            <div key={i} className="feature-card">
              {/* Icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{
                  background: feature.iconBg,
                  boxShadow: `0 4px 16px ${feature.iconBg}35`,
                }}
              >
                {feature.icon}
              </div>

              {/* Content */}
              <h3 className="font-sans font-semibold mb-2" style={{ fontSize: "1rem", color: "#0D0D0D", letterSpacing: "-0.01em" }}>
                {feature.title}
              </h3>
              <p className="font-sans" style={{ fontSize: "0.875rem", lineHeight: 1.65, color: "#6B6B6B" }}>
                {feature.desc}
              </p>

              {/* Mockup */}
              {feature.mockup}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
