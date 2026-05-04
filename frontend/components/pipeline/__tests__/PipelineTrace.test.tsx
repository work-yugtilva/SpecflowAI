import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { PipelineTrace } from "../PipelineTrace";
import { useSessionStore } from "@/lib/store/session-store";
import type { SessionDetail } from "@/lib/api/session";

function makeSessionDetail(outputs: Record<string, unknown>): SessionDetail {
  return {
    session: {
      id: "session-1",
      session_name: "Trace session",
      status: "active",
      metadata: {},
      created_at: "2026-04-30T00:00:00.000Z",
      updated_at: "2026-04-30T00:00:00.000Z",
    },
    state: {
      session_id: "session-1",
      step: null,
      state: {
        last_completed_step: "tasks",
        outputs,
        regeneration_counts: {},
      },
    },
    events: [],
  };
}

function setOutputs(outputs: Record<string, unknown>) {
  useSessionStore.setState({
    activeSessionDetail: makeSessionDetail(outputs),
  });
}

describe("PipelineTrace", () => {
  beforeEach(() => {
    useSessionStore.setState({
      activeSessionDetail: null,
      activeSessionId: "session-1",
      sessions: [],
      isLoading: false,
      isSyncing: false,
      lastSyncError: null,
    });
  });

  it("renders collapsed by default with the generation trigger", () => {
    setOutputs({
      problems_quality: { score: 91, passed: true },
    });

    render(<PipelineTrace stepKey="problems" />);

    expect(screen.getByRole("button", { name: /How was this generated/i })).toBeInTheDocument();
    expect(screen.queryByText(/Executed by:/i)).not.toBeInTheDocument();
  });

  it("expands to show the typed agent and dependency badges", () => {
    setOutputs({
      features_quality: { score: 83, passed: true },
    });

    render(<PipelineTrace stepKey="features" />);
    fireEvent.click(screen.getByRole("button", { name: /How was this generated/i }));

    expect(screen.getByText("Executed by: FeaturesAgent")).toBeInTheDocument();
    expect(screen.getByText("Built using:")).toBeInTheDocument();
    expect(screen.getByText("Problems")).toBeInTheDocument();
  });

  it("reads decompose quality from decompositions_quality", () => {
    setOutputs({
      decompositions_quality: { score: 74, passed: true },
    });

    render(<PipelineTrace stepKey="decompose" />);
    fireEvent.click(screen.getByRole("button", { name: /How was this generated/i }));

    expect(screen.getByText("74/100")).toBeInTheDocument();
    expect(screen.getByText("Passed")).toBeInTheDocument();
  });

  it("renders rag_context source count and title badges from session outputs", () => {
    setOutputs({
      rag_context: [
        { id: "r1", title: "Interview Notes", source: "Interview" },
        { id: "r2", title: "Signup Funnel", source: "Analytics" },
      ],
      tasks_quality: { score: 88, passed: true },
    });

    render(<PipelineTrace stepKey="tasks" />);
    fireEvent.click(screen.getByRole("button", { name: /How was this generated/i }));

    expect(screen.getByText("Grounded on 2 sources from your uploads.")).toBeInTheDocument();
    expect(screen.getByText("Interview Notes")).toBeInTheDocument();
    expect(screen.getByText("Signup Funnel")).toBeInTheDocument();
  });

  it("renders zero grounded sources when rag_context is missing", () => {
    setOutputs({
      tasks_quality: { score: 88, passed: true },
    });

    render(<PipelineTrace stepKey="tasks" />);
    fireEvent.click(screen.getByRole("button", { name: /How was this generated/i }));

    expect(screen.getByText("Grounded on 0 sources from your uploads.")).toBeInTheDocument();
  });

  it("derives grounded source count from persisted step source_ids", () => {
    setOutputs({
      problems: [
        {
          title: "Webhook failures block activation",
          source_ids: ["source-a", "source-b"],
          research_evidence:
            "[Source: stripe_product_usage_analysis.pdf] Webhook endpoint failures are the #1 support driver.",
        },
      ],
      problems_quality: {
        score: 67,
        passed: true,
        critical_issues: ["One item needs tighter metrics."],
        items: [
          { index: 0, binary_checks: { evidence_cited: true, metrics_concrete: false }, quality_issues: [] },
        ],
      },
    });

    render(<PipelineTrace stepKey="problems" />);
    fireEvent.click(screen.getByRole("button", { name: /How was this generated/i }));

    expect(screen.getByText("Grounded on 2 cited evidence items.")).toBeInTheDocument();
    expect(screen.getByText("stripe_product_usage_analysis.pdf")).toBeInTheDocument();
    expect(screen.getByText("1 quality issue")).toBeInTheDocument();
    expect(screen.getByText("One item needs tighter metrics.")).toBeInTheDocument();
  });

  it("shows failed quality gate state", () => {
    setOutputs({
      problems_quality: { score: 52, passed: false },
    });

    render(<PipelineTrace stepKey="problems" />);
    fireEvent.click(screen.getByRole("button", { name: /How was this generated/i }));

    expect(screen.getByText("52/100")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("does not infer PRD quality when prd_quality is absent", () => {
    setOutputs({
      problems_quality: { score: 90, passed: true },
      features_quality: { score: 91, passed: true },
      decompositions_quality: { score: 92, passed: true },
      tasks_quality: { score: 93, passed: true },
    });

    render(<PipelineTrace stepKey="prd" />);
    fireEvent.click(screen.getByRole("button", { name: /How was this generated/i }));

    expect(screen.getByText("Quality gate unavailable")).toBeInTheDocument();
    expect(screen.queryByText("93/100")).not.toBeInTheDocument();
  });
});
