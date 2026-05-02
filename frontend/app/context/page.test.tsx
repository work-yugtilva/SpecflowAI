import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchScopedContextMock = vi.fn();
const saveScopedContextMock = vi.fn();
const getUserMock = vi.fn();
const upsertMock = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: () => <aside>Sidebar</aside>,
}));

vi.mock("@/lib/active-session-context", () => ({
  useActiveSession: () => ({ activeSessionId: null }),
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

vi.mock("@/lib/api/context", () => ({
  fetchScopedContext: (...args: unknown[]) => fetchScopedContextMock(...args),
  saveScopedContext: (...args: unknown[]) => saveScopedContextMock(...args),
  importGlobalContextToSession: vi.fn(),
}));

const { default: ContextPage } = await import("./page");

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.history.pushState({}, "", "/context?onboarding=1");
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      search: "?onboarding=1",
      href: "",
    },
  });
  fetchScopedContextMock.mockResolvedValue(null);
  saveScopedContextMock.mockResolvedValue({});
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  upsertMock.mockResolvedValue({ error: null });
});

describe("ContextPage onboarding flow", () => {
  it("saves product context and continues to dashboard", async () => {
    render(<ContextPage />);

    fireEvent.change(screen.getByPlaceholderText("SpecFlow"), {
      target: { value: "SpecFlow" },
    });
    fireEvent.change(screen.getByPlaceholderText(/brief description/i), {
      target: { value: "Turns research into product workflows." },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(saveScopedContextMock).toHaveBeenCalled());
    await waitFor(() => expect(window.location.href).toBe("/dashboard"));
  });

  it("does not block dashboard navigation on the best-effort context API sync", async () => {
    saveScopedContextMock.mockReturnValue(new Promise(() => {}));
    render(<ContextPage />);

    fireEvent.change(screen.getByPlaceholderText("SpecFlow"), {
      target: { value: "SpecFlow" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        onboarding_completed_at: expect.any(String),
      }),
      { onConflict: "user_id" }
    ));
    await waitFor(() => expect(window.location.href).toBe("/dashboard"));
  });
});
