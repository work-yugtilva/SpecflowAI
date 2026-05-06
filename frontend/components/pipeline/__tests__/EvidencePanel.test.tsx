import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EvidencePanel } from "../EvidencePanel";
import type { ResearchEvidence } from "@/lib/pipeline-contracts";

const baseEvidence: ResearchEvidence[] = [
  {
    title: "Interview with onboarding lead",
    content: "New users cannot tell which workflow step owns the next action.",
    source: "interview",
  },
  {
    title: "Activation dashboard",
    content: "Completion drops by 18 percent after users leave the problems page.",
    source: "Analytics",
  },
  {
    title: "Market benchmark",
    content: "Teams expect generated planning artifacts to cite the documents that shaped them.",
    source: "Market Insight",
  },
];

describe("EvidencePanel", () => {
  it("renders the Sources empty state when evidence is empty", () => {
    render(<EvidencePanel evidence={[]} />);

    expect(screen.getByText("No sources cited.")).toBeInTheDocument();
    expect(screen.queryByText("Evidence Trace")).not.toBeInTheDocument();
  });

  it("renders source cards with titles and normalized type badges", () => {
    render(<EvidencePanel evidence={baseEvidence} />);

    expect(screen.getByRole("heading", { name: "Sources" })).toBeInTheDocument();
    expect(screen.getByText("Interview with onboarding lead")).toBeInTheDocument();
    expect(screen.getByText("Activation dashboard")).toBeInTheDocument();
    expect(screen.getByText("Market benchmark")).toBeInTheDocument();
    expect(screen.getAllByText("INTEGRATION")).toHaveLength(3);
    expect(
      screen.getByText("New users cannot tell which workflow step owns the next action.")
    ).toBeInTheDocument();
  });

  it("truncates long content to 120 characters and expands with a toggle", () => {
    const longContent =
      "This source paragraph is deliberately long so the evidence citation can demonstrate truncation before revealing the full source text to the reader.";

    render(
      <EvidencePanel
        evidence={[
          {
            title: "Long interview excerpt",
            content: longContent,
            source: "interview",
          },
        ]}
      />
    );

    expect(screen.queryByText(longContent)).not.toBeInTheDocument();
    expect(screen.getByText(`${longContent.slice(0, 120)}...`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show full excerpt ↓" }));
    expect(screen.getByText(longContent)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide ↑" }));
    expect(screen.getByText(`${longContent.slice(0, 120)}...`)).toBeInTheDocument();
  });

  it("does not leak raw vector chunk ids from source labels", () => {
    render(
      <EvidencePanel
        evidence={[
          {
            title: "Activation ticket export",
            content: "Webhook setup is confusing for newly activated teams.",
            source: "af82975b",
          },
        ]}
      />
    );

    expect(screen.getByText("Activation ticket export")).toBeInTheDocument();
    expect(screen.queryByText("af82975b")).not.toBeInTheDocument();
  });
});
