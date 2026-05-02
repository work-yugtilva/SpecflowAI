import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LS_CONTEXT } from "@/lib/pipeline-input";

const getUserMock = vi.fn();
const upsertMock = vi.fn();

vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => <img {...props} />,
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
  window.localStorage.clear();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      href: "",
    },
  });
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  upsertMock.mockResolvedValue({ error: null });
});

describe("OnboardingPage", () => {
  it("continues to product context and seeds company context", async () => {
    render(<OnboardingPage />);

    fireEvent.change(screen.getByPlaceholderText("Yug"), { target: { value: "Yug" } });
    fireEvent.change(screen.getByPlaceholderText("Product Manager"), { target: { value: "PM" } });
    fireEvent.change(screen.getByPlaceholderText("Acme Inc."), { target: { value: "Acme" } });
    fireEvent.click(screen.getByRole("button", { name: "Startup" }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(window.location.href).toBe("/context?onboarding=1"));
    expect(JSON.parse(window.localStorage.getItem(LS_CONTEXT) ?? "{}")).toMatchObject({
      companyName: "Acme",
      companyType: "Startup",
    });
  });
});
