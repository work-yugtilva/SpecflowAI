"use client";

import { memo, useState, useCallback, ReactNode } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

type NavItem = { id: string; label: string };

type NavSection = {
  id: string;
  title: string;
  icon: ReactNode;
  items: NavItem[];
};

// ─── Inline SVG Icons ────────────────────────────────────────────────────────

const HomeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
    <path d="M9 21V12h6v9" />
  </svg>
);

const SignalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12h3m14 0h3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1M12 2v3m0 14v3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const CompassIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
  </svg>
);

const AlertIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const LightbulbIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="9" y1="18" x2="15" y2="18" />
    <line x1="10" y1="22" x2="14" y2="22" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14" />
  </svg>
);

const HammerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 12l-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 010-3L12 9" />
    <path d="M17.64 15L22 10.64M20.35 6.22l-2.83-2.83a1 1 0 00-1.41 0L14.5 5l3.5 3.5 2.35-2.28z" />
  </svg>
);

const ChartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const DocIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const GearIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    style={{
      transform: open ? "rotate(90deg)" : "rotate(0deg)",
      transition: "transform 200ms ease",
    }}
  >
    <path d="M4 2.5L7.5 6 4 9.5" />
  </svg>
);

const CollapseIcon = ({ collapsed }: { collapsed: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    style={{
      transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
      transition: "transform 220ms ease",
    }}
  >
    <path d="M9 2.5L4.5 7 9 11.5" />
  </svg>
);

// ─── Navigation Data ──────────────────────────────────────────────────────────

const NAV_SECTIONS: NavSection[] = [
  { id: "dashboard", title: "Dashboard", icon: <HomeIcon />, items: [] },
  {
    id: "signals",
    title: "Signals",
    icon: <SignalIcon />,
    items: [
      { id: "problems", label: "Problems" },
      { id: "features", label: "Features" },
      { id: "decompose", label: "Decompose" },
      { id: "tasks", label: "Tasks" },
      { id: "sessions", label: "Sessions" },
    ],
  },
  {
    id: "discovery",
    title: "Discovery",
    icon: <CompassIcon />,
    items: [
      { id: "context", label: "Context" },
      { id: "research", label: "Research" },
    ],
  },
  {
    id: "problem",
    title: "Problem",
    icon: <AlertIcon />,
    items: [
      { id: "problem-def", label: "Problem" },
      { id: "root-cause", label: "Root Cause" },
      { id: "success", label: "Success" },
    ],
  },
  {
    id: "solution",
    title: "Solution",
    icon: <LightbulbIcon />,
    items: [
      { id: "strategy", label: "Strategy" },
      { id: "prioritization", label: "Prioritization" },
      { id: "spec", label: "Spec" },
    ],
  },
  {
    id: "build",
    title: "Build",
    icon: <HammerIcon />,
    items: [
      { id: "design", label: "Design" },
      { id: "technical", label: "Technical" },
      { id: "system", label: "System" },
      { id: "build-ops", label: "Build Ops" },
      { id: "release", label: "Release" },
      { id: "rollout", label: "Rollout" },
    ],
  },
  {
    id: "growth",
    title: "Growth",
    icon: <ChartIcon />,
    items: [
      { id: "gtm", label: "Go-To-Market" },
      { id: "adoption", label: "Adoption" },
      { id: "measurement", label: "Measurement" },
      { id: "iteration", label: "Iteration" },
      { id: "experiments", label: "Experiments" },
      { id: "scaling", label: "Scaling" },
    ],
  },
  {
    id: "documents",
    title: "Documents",
    icon: <DocIcon />,
    items: [
      { id: "prds", label: "PRDs" },
      { id: "user-stories", label: "User Stories" },
      { id: "launch-plan", label: "Launch Plan" },
      { id: "rfc", label: "RFC / Tech Spec" },
      { id: "competitive", label: "Competitive Analysis" },
    ],
  },
  { id: "settings", title: "Settings", icon: <GearIcon />, items: [] },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const SidebarItem = memo(function SidebarItem({
  item,
  isActive,
  onSelect,
}: {
  item: NavItem;
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(item.id)}
      className={cn(
        "w-full text-left flex items-center h-8 px-3 rounded-lg text-[13.5px] font-sans",
        "transition-colors duration-150",
        isActive
          ? "font-medium"
          : "text-[#3a3530] hover:bg-black/[0.04]"
      )}
      style={
        isActive
          ? {
              background: "rgba(232,86,27,0.10)",
              borderLeft: "2px solid #E8561B",
              color: "#0D0D0D",
              paddingLeft: "10px",
              fontWeight: 500,
            }
          : {}
      }
    >
      {item.label}
    </button>
  );
});

const SidebarSection = memo(function SidebarSection({
  section,
  isExpanded,
  activeItem,
  onToggle,
  onSelectItem,
}: {
  section: NavSection;
  isExpanded: boolean;
  activeItem: string | null;
  onToggle: (id: string) => void;
  onSelectItem: (id: string) => void;
}) {
  const hasItems = section.items.length > 0;

  return (
    <div className="mb-0.5">
      <button
        onClick={() => hasItems && onToggle(section.id)}
        className={cn(
          "w-full flex items-center justify-between px-3 h-8 rounded-lg text-[12px] font-medium tracking-[0.04em] uppercase",
          "transition-colors duration-150",
          hasItems ? "cursor-pointer hover:bg-black/[0.04]" : "cursor-default"
        )}
        style={{ color: "#6B6B6B" }}
      >
        <span>{section.title}</span>
        {hasItems && (
          <span style={{ color: "#9a9085" }}>
            <ChevronIcon open={isExpanded} />
          </span>
        )}
      </button>

      {/* Expandable items */}
      {hasItems && (
        <div
          style={{
            overflow: "hidden",
            maxHeight: isExpanded ? `${section.items.length * 36}px` : "0px",
            opacity: isExpanded ? 1 : 0,
            transition: "max-height 200ms ease, opacity 180ms ease",
          }}
        >
          <div className="pl-1 pb-1 flex flex-col gap-0.5">
            {section.items.map((item) => (
              <SidebarItem
                key={item.id}
                item={item}
                isActive={activeItem === item.id}
                onSelect={onSelectItem}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// ─── Rail icon button ─────────────────────────────────────────────────────────

const RailButton = memo(function RailButton({
  section,
  isActive,
  onSelect,
}: {
  section: NavSection;
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(section.id)}
      title={section.title}
      className="w-10 h-10 flex items-center justify-center rounded-[10px] transition-colors duration-150"
      style={{
        background: isActive ? "#111111" : "transparent",
        color: isActive ? "#ffffff" : "#6B6B6B",
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = "rgba(0,0,0,0.06)";
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = "transparent";
      }}
      aria-label={section.title}
    >
      {section.icon}
    </button>
  );
});

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

// Items that have dedicated pages
const ROUTED_ITEMS = new Set(["problems", "features", "decompose", "tasks", "sessions", "context", "research"]);

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  // Derive active item from current URL path (e.g. "/ingest" → "ingest")
  const pathnameItem = pathname?.split("/")[1] ?? null;

  const [activeSection, setActiveSection] = useState("dashboard");
  const [activeItem, setActiveItem] = useState<string | null>(pathnameItem);
  const [expandedSections, setExpandedSections] = useState<string[]>(["signals"]);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  const handleSelectSection = useCallback((id: string) => {
    setActiveSection(id);
    const section = NAV_SECTIONS.find((s) => s.id === id);
    if (section && section.items.length > 0) {
      setExpandedSections((prev) =>
        prev.includes(id) ? prev : [...prev, id]
      );
      if (panelCollapsed) setPanelCollapsed(false);
    }
  }, [panelCollapsed]);

  const handleToggleSection = useCallback((id: string) => {
    setExpandedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }, []);

  const handleSelectItem = useCallback((id: string) => {
    setActiveItem(id);
    if (ROUTED_ITEMS.has(id)) {
      router.push(`/${id}`);
    }
  }, [router]);

  // Prefer pathname-derived active item so direct URL navigation highlights correctly
  const effectiveActiveItem = pathnameItem || activeItem;

  const currentSection = NAV_SECTIONS.find((s) => s.id === activeSection);

  return (
    <div className="flex h-full flex-shrink-0" style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>
      {/* ─── Left Rail ──────────────────────────────── */}
      <div
        className="flex flex-col items-center py-3 gap-1 flex-shrink-0"
        style={{
          width: 60,
          background: "#F0EAE1",
          borderRight: "1px solid #E4DDD4",
        }}
      >
        {/* Logo */}
        <a
          href="/"
          className="flex items-center justify-center mb-3 flex-shrink-0"
          style={{ width: 40, height: 40 }}
        >
          <div className="relative overflow-hidden rounded-md" style={{ width: 28, height: 28 }}>
            <Image
              src="/logo.jpeg"
              alt="SpecFlow"
              fill
              className="object-cover"
            />
          </div>
        </a>

        {/* Nav icons */}
        <div className="flex flex-col gap-1 flex-1">
          {NAV_SECTIONS.map((section) => (
            <RailButton
              key={section.id}
              section={section}
              isActive={activeSection === section.id}
              onSelect={handleSelectSection}
            />
          ))}
        </div>
      </div>

      {/* ─── Right Panel ────────────────────────────── */}
      <div
        style={{
          width: panelCollapsed ? 0 : 240,
          opacity: panelCollapsed ? 0 : 1,
          overflow: "hidden",
          transition: "width 220ms ease, opacity 180ms ease",
          flexShrink: 0,
          background: "#FFFFFF",
          borderRight: "1px solid #E4DDD4",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Panel header */}
        <div
          className="flex items-center justify-between px-4 flex-shrink-0"
          style={{ height: 52, borderBottom: "1px solid #E4DDD4" }}
        >
          <span
            className="font-medium truncate"
            style={{ fontSize: 14, color: "#0D0D0D", letterSpacing: "-0.01em" }}
          >
            {currentSection?.title ?? "Dashboard"}
          </span>
          <button
            onClick={() => setPanelCollapsed(true)}
            className="w-7 h-7 flex items-center justify-center rounded-md transition-colors duration-150"
            style={{ color: "#9a9085" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.06)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            aria-label="Collapse sidebar"
          >
            <CollapseIcon collapsed={false} />
          </button>
        </div>

        {/* Scrollable nav list */}
        <div className="flex-1 overflow-y-auto px-2 py-3" style={{ scrollbarWidth: "thin" }}>
          {NAV_SECTIONS.map((section) => (
            <SidebarSection
              key={section.id}
              section={section}
              isExpanded={expandedSections.includes(section.id)}
              activeItem={effectiveActiveItem}
              onToggle={handleToggleSection}
              onSelectItem={handleSelectItem}
            />
          ))}
        </div>

        {/* Sign out */}
        <div style={{ padding: "8px 12px 10px", borderTop: "1px solid #F0EDE9", flexShrink: 0 }}>
          <button
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signOut();
              router.push("/login");
            }}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 10px",
              borderRadius: 7,
              fontSize: 13,
              color: "#9E9E9E",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
              textAlign: "left",
              transition: "background 120ms ease, color 120ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0,0,0,0.04)";
              e.currentTarget.style.color = "#0D0D0D";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#9E9E9E";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 2H3a1 1 0 00-1 1v8a1 1 0 001 1h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M9.5 9.5L12 7l-2.5-2.5M12 7H5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sign out
          </button>
        </div>
      </div>

      {/* Collapsed — expand button */}
      {panelCollapsed && (
        <button
          onClick={() => setPanelCollapsed(false)}
          className="absolute flex items-center justify-center rounded-md transition-colors duration-150"
          style={{
            left: 68,
            top: 14,
            width: 28,
            height: 28,
            background: "#FFFFFF",
            border: "1px solid #E4DDD4",
            color: "#6B6B6B",
            zIndex: 10,
            boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
          }}
          aria-label="Expand sidebar"
        >
          <CollapseIcon collapsed={true} />
        </button>
      )}
    </div>
  );
}
