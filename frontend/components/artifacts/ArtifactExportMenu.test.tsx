import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ArtifactExportMenu } from "./ArtifactExportMenu";
import type { ExportAction } from "./ArtifactExportMenu";

function makeAction(overrides?: Partial<ExportAction>): ExportAction {
  return {
    id: "test-action",
    label: "Copy",
    description: "Copy to clipboard",
    successLabel: "Copied",
    errorLabel: "Copy failed",
    onSelect: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("ArtifactExportMenu", () => {
  it("disabled button does not open menu", () => {
    render(
      <ArtifactExportMenu
        disabled
        disabledReason="Generate this artifact before exporting"
        actions={[makeAction()]}
      />
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    // aria-expanded should be false
    expect(button).toHaveAttribute("aria-expanded", "false");
    // click should not open menu
    fireEvent.click(button);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("clicking button opens menu and shows items", () => {
    render(
      <ArtifactExportMenu
        actions={[
          makeAction({ id: "a", label: "Copy Markdown" }),
          makeAction({ id: "b", label: "Download CSV", badge: ".csv" }),
        ]}
      />
    );
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Copy Markdown")).toBeInTheDocument();
    expect(screen.getByText("Download CSV")).toBeInTheDocument();
    expect(screen.getByText(".csv")).toBeInTheDocument();
  });

  it("clicking outside closes menu", () => {
    render(
      <div>
        <ArtifactExportMenu actions={[makeAction()]} />
      </div>
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    // mousedown on body (outside the container)
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Escape key closes menu", () => {
    render(<ArtifactExportMenu actions={[makeAction()]} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    // fire keyDown on the button — bubbles up to container's onKeyDown
    fireEvent.keyDown(screen.getByRole("button"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("clicking menu item calls onSelect and closes menu", async () => {
    const onSelect = vi.fn().mockResolvedValue(undefined);
    render(<ArtifactExportMenu actions={[makeAction({ onSelect })]} />);
    fireEvent.click(screen.getByRole("button"));
    const item = screen.getByRole("menuitem");
    await act(async () => { fireEvent.click(item); });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("async action shows loading then success feedback", async () => {
    let resolve!: () => void;
    const onSelect = vi.fn().mockReturnValue(
      new Promise<void>((r) => { resolve = r; })
    );
    render(
      <ArtifactExportMenu
        actions={[makeAction({ onSelect, successLabel: "Copied" })]}
      />
    );

    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("menuitem"));

    // loading state
    await waitFor(() =>
      expect(screen.getByRole("button")).toHaveTextContent("Exporting…")
    );

    // resolve action
    await act(async () => { resolve(); await Promise.resolve(); });

    // success feedback
    await waitFor(() =>
      expect(screen.getByRole("button")).toHaveTextContent("Copied ✓")
    );
  });

  it("failed action shows error feedback", async () => {
    const onSelect = vi.fn().mockRejectedValue(new Error("network error"));
    render(
      <ArtifactExportMenu
        actions={[makeAction({ onSelect, errorLabel: "Copy failed" })]}
      />
    );

    fireEvent.click(screen.getByRole("button"));
    await act(async () => { fireEvent.click(screen.getByRole("menuitem")); });

    await waitFor(() =>
      expect(screen.getByRole("button")).toHaveTextContent("Copy failed")
    );
    expect(screen.getByRole("button")).toHaveStyle({ color: "#EF4444" });
  });

  it("shows description and badge on menu items", () => {
    render(
      <ArtifactExportMenu
        actions={[
          makeAction({
            label: "Download Markdown",
            description: "Save readable task list",
            badge: ".md",
          }),
        ]}
      />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Save readable task list")).toBeInTheDocument();
    expect(screen.getByText(".md")).toBeInTheDocument();
  });

  it("uses custom label prop", () => {
    render(<ArtifactExportMenu actions={[makeAction()]} label="Download" />);
    expect(screen.getByRole("button")).toHaveTextContent("Download ▾");
  });
});
