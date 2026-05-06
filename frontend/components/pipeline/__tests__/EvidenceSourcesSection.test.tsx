import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  EvidenceSourcesSection,
  type EvidenceSource,
} from "../EvidenceSourcesSection";

const longExcerpt =
  "Webhook endpoint failures are the #1 source of support tickets at activation. Common causes include SSL certificate mistakes, stale endpoint URLs, and missing retry handling.";

const baseSources: EvidenceSource[] = [
  {
    id: "af82975b",
    filename: "stripe_product_usage_analysis.pdf",
    type: "uploaded",
    excerpt: longExcerpt,
  },
  {
    id: "9adc458c",
    filename: "Zendesk activation tickets",
    type: "integration",
    excerpt: "Customers repeatedly ask where webhook retries are configured.",
  },
];

describe("EvidenceSourcesSection", () => {
  it("renders only the muted empty state when no sources are cited", () => {
    render(<EvidenceSourcesSection sources={[]} />);

    expect(screen.getByText("No sources cited.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sources" })).not.toBeInTheDocument();
  });

  it("renders source filename, type badge, truncated excerpt, and no raw ids", () => {
    render(<EvidenceSourcesSection sources={[baseSources[0]]} />);

    expect(screen.getByRole("heading", { name: "Sources" })).toBeInTheDocument();
    expect(screen.getByText("stripe_product_usage_analysis.pdf")).toHaveClass("font-semibold");
    expect(screen.getByText("UPLOADED")).toBeInTheDocument();
    expect(screen.getByText(`${longExcerpt.slice(0, 120)}...`)).toBeInTheDocument();
    expect(screen.queryByText("af82975b")).not.toBeInTheDocument();
  });

  it("expands and collapses each source independently", () => {
    render(<EvidenceSourcesSection sources={baseSources} />);

    const firstCard = screen
      .getByText("stripe_product_usage_analysis.pdf")
      .closest("article");
    const secondCard = screen.getByText("Zendesk activation tickets").closest("article");

    expect(firstCard).not.toBeNull();
    expect(secondCard).not.toBeNull();

    fireEvent.click(
      within(firstCard as HTMLElement).getByRole("button", {
        name: "Show full excerpt ↓",
      })
    );

    expect(within(firstCard as HTMLElement).getByText(longExcerpt)).toBeInTheDocument();
    expect(within(firstCard as HTMLElement).getByRole("button", { name: "Hide ↑" })).toBeInTheDocument();
    expect(
      within(secondCard as HTMLElement).queryByRole("button", {
        name: "Hide ↑",
      })
    ).not.toBeInTheDocument();

    fireEvent.click(within(firstCard as HTMLElement).getByRole("button", { name: "Hide ↑" }));
    expect(within(firstCard as HTMLElement).getByText(`${longExcerpt.slice(0, 120)}...`)).toBeInTheDocument();
  });

  it("does not show a toggle or ellipsis for short excerpts", () => {
    render(<EvidenceSourcesSection sources={[baseSources[1]]} />);

    expect(
      screen.getByText("Customers repeatedly ask where webhook retries are configured.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /excerpt/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/\.\.\.$/)).not.toBeInTheDocument();
  });

  it("omits unreadable filenames without falling back to chunk ids", () => {
    render(
      <EvidenceSourcesSection
        sources={[
          {
            id: "9adc458c",
            filename: "",
            type: "url",
            excerpt: "A readable citation name was unavailable for this excerpt.",
          },
        ]}
      />
    );

    expect(screen.getByText("URL")).toBeInTheDocument();
    expect(screen.queryByText("9adc458c")).not.toBeInTheDocument();
  });
});
