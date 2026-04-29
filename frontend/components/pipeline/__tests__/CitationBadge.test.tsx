import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { CitationBadge } from "../CitationBadge";

const evidence = [
  { title: "User Interview #3", content: "Users reported friction when navigating between steps.", source: "Interview" },
  { title: "Analytics Q4", content: "Drop-off rate increased 18% at the decompose step.", source: "Analytics" },
];

describe("CitationBadge", () => {
  it("renders nothing when researchEvidence is empty", () => {
    const { container } = render(<CitationBadge researchEvidence={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one badge per evidence item showing the title", () => {
    render(<CitationBadge researchEvidence={evidence} />);
    expect(screen.getByText(/User Interview #3/)).toBeInTheDocument();
    expect(screen.getByText(/Analytics Q4/)).toBeInTheDocument();
  });

  it("does not show content panel initially", () => {
    render(<CitationBadge researchEvidence={evidence} />);
    expect(screen.queryByText("Users reported friction")).not.toBeInTheDocument();
  });

  it("expands inline panel showing content when badge is clicked", () => {
    render(<CitationBadge researchEvidence={evidence} />);
    fireEvent.click(screen.getByText(/User Interview #3/));
    expect(screen.getByText("Users reported friction when navigating between steps.")).toBeInTheDocument();
  });

  it("shows the source type label in the expanded panel", () => {
    render(<CitationBadge researchEvidence={evidence} />);
    fireEvent.click(screen.getByText(/User Interview #3/));
    expect(screen.getByText("Interview")).toBeInTheDocument();
  });

  it("collapses the panel when the same badge is clicked again", () => {
    render(<CitationBadge researchEvidence={evidence} />);
    fireEvent.click(screen.getByText(/User Interview #3/));
    fireEvent.click(screen.getByText(/User Interview #3/));
    expect(screen.queryByText("Users reported friction")).not.toBeInTheDocument();
  });

  it("switches to a different badge's content when another badge is clicked", () => {
    render(<CitationBadge researchEvidence={evidence} />);
    fireEvent.click(screen.getByText(/User Interview #3/));
    fireEvent.click(screen.getByText(/Analytics Q4/));
    expect(screen.queryByText("Users reported friction")).not.toBeInTheDocument();
    expect(screen.getByText("Drop-off rate increased 18% at the decompose step.")).toBeInTheDocument();
  });
});
