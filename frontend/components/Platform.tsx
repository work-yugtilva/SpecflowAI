"use client";

import {
  Activity,
  BookOpen,
  CircleAlert,
  Inbox,
  Layers,
  ListTodo,
  MessagesSquare,
  Split,
} from "lucide-react";

import RadialOrbitalTimeline, {
  type TimelineItem,
} from "@/components/ui/radial-orbital-timeline";

/** Product areas around the SpecFlow hub (order matches orbital positions after rotation). */
const integrationTimeline: TimelineItem[] = [
  {
    id: 1,
    title: "Signals pipeline",
    date: "Orchestration",
    content:
      "Route events, webhooks, and AI outputs through a single traceable path from signal to shipped spec.",
    category: "Pipeline",
    icon: Activity,
    relatedIds: [2, 8],
    status: "completed",
    energy: 94,
  },
  {
    id: 2,
    title: "Ingest",
    date: "Input",
    content:
      "Pull requirements from docs, tickets, and repos so nothing important stays outside the workflow.",
    category: "Ingest",
    icon: Inbox,
    relatedIds: [1, 3],
    status: "completed",
    energy: 90,
  },
  {
    id: 3,
    title: "Features",
    date: "Scope",
    content:
      "Shape user stories, acceptance criteria, and scope so engineering and PM share one source of truth.",
    category: "Features",
    icon: Layers,
    relatedIds: [2, 4],
    status: "in-progress",
    energy: 88,
  },
  {
    id: 4,
    title: "Problems",
    date: "Risk",
    content:
      "Surface gaps, ambiguities, and conflicts early — before they become expensive surprises.",
    category: "Problems",
    icon: CircleAlert,
    relatedIds: [3, 5],
    status: "in-progress",
    energy: 84,
  },
  {
    id: 5,
    title: "Context",
    date: "Knowledge",
    content:
      "Attach background, constraints, and references so every spec decision stays explainable.",
    category: "Context",
    icon: BookOpen,
    relatedIds: [4, 6],
    status: "pending",
    energy: 78,
  },
  {
    id: 6,
    title: "Decompose",
    date: "Structure",
    content:
      "Break epics into testable units of work with clear ownership and dependencies.",
    category: "Decompose",
    icon: Split,
    relatedIds: [5, 7],
    status: "pending",
    energy: 76,
  },
  {
    id: 7,
    title: "Sessions",
    date: "Collaboration",
    content:
      "Run focused reviews and working sessions with decisions captured next to the spec.",
    category: "Sessions",
    icon: MessagesSquare,
    relatedIds: [6, 8],
    status: "pending",
    energy: 82,
  },
  {
    id: 8,
    title: "Tasks",
    date: "Delivery",
    content:
      "Track execution and coverage so shipping status always reflects the live spec.",
    category: "Tasks",
    icon: ListTodo,
    relatedIds: [7, 1],
    status: "pending",
    energy: 86,
  },
];

export default function Platform() {
  return (
    <section
      className="w-full py-20"
      style={{ background: "var(--bg-dark)" }}
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-10 text-center md:mb-14">
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
            className="font-sans mx-auto max-w-md"
            style={{
              color: "#6B6B6B",
              fontSize: "1rem",
              lineHeight: 1.65,
            }}
          >
            SpecFlow connects with the tools your team already loves — no
            migration, no friction.
          </p>
        </div>

        <RadialOrbitalTimeline
          timelineData={integrationTimeline}
          radius={180}
          className="border-[hsl(var(--border))] bg-[hsl(var(--background))]/90 shadow-[0_24px_80px_rgba(13,13,13,0.06)] backdrop-blur-sm"
        />
      </div>
    </section>
  );
}
