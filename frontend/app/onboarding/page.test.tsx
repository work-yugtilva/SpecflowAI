import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();
const upsertMock = vi.fn();

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
  }) => <img {...props} />,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args),
    },
    from: () => ({
      upsert: (...args: unknown[]) => upsertMock(...args),
    }),
  }),
}));

vi.mock("@/lib/posthog", () => ({
  posthog: {
    capture: vi.fn(),
  },
}));

const { default: OnboardingPage } = await import("./page");

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { href: "" },
  });
  Object.defineProperty(document, "cookie", {
    configurable: true,
    writable: true,
    value: "",
  });
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  upsertMock.mockResolvedValue({ error: null });
});

describe("OnboardingPage", () => {
  it("renders three role cards", () => {
    render(<OnboardingPage />);
    expect(screen.getByRole("button", { name: /product manager/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /founder/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /engineer/i })).toBeDefined();
  });

  it("Continue button is disabled until a role is selected", () => {
    render(<OnboardingPage />);
    const btn = screen.getByRole("button", { name: /continue/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("selecting a role enables Continue", () => {
    render(<OnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: /founder/i }));
    const btn = screen.getByRole("button", { name: /continue/i });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("PM selection upserts role and redirects to /context?onboarding=1", async () => {
    render(<OnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: /product manager/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() =>
      expect(window.location.href).toBe("/context?onboarding=1")
    );
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: "pm", user_id: "user-1" }),
      { onConflict: "user_id" }
    );
  });

  it("Founder selection upserts role and redirects to /sources", async () => {
    render(<OnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: /founder/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(window.location.href).toBe("/sources"));
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: "founder", user_id: "user-1" }),
      { onConflict: "user_id" }
    );
  });

  it("Engineer selection upserts role and redirects to /sessions", async () => {
    render(<OnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: /engineer/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(window.location.href).toBe("/sessions"));
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: "engineer", user_id: "user-1" }),
      { onConflict: "user_id" }
    );
  });

  it("fails open — redirects even when upsert fails", async () => {
    upsertMock.mockRejectedValue(new Error("DB error"));
    render(<OnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: /engineer/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(window.location.href).toBe("/sessions"));
  });
});
