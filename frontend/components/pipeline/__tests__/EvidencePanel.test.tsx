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
  it("renders the exact warning when evidence is empty", () => {
    render(<EvidencePanel evidence={[]} />);

    expect(
      screen.getByText("No sources linked — rerun with uploaded documents for grounded output.")
    ).toBeInTheDocument();
  });

  it("renders numbered citations with source pills, titles, and blockquotes", () => {
    render(<EvidencePanel evidence={baseEvidence} />);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("interview")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Market Insight")).toBeInTheDocument();
    expect(screen.getByText("Interview with onboarding lead")).toBeInTheDocument();
    expect(screen.getByText("Activation dashboard")).toBeInTheDocument();
    expect(screen.getByText("Market benchmark")).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "show more" }));
    expect(screen.getByText(longContent)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "show less" }));
    expect(screen.getByText(`${longContent.slice(0, 120)}...`)).toBeInTheDocument();
  });

  it("normalizes interview, analytics, and market insight source types", () => {
    render(<EvidencePanel evidence={baseEvidence} />);

    expect(screen.getByText("interview")).toHaveClass("bg-emerald-50");
    expect(screen.getByText("Analytics")).toHaveClass("bg-violet-50");
    expect(screen.getByText("Market Insight")).toHaveClass("bg-amber-50");
  });
});
