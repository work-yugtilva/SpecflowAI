import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const signInWithPasswordMock = vi.fn();
const signUpMock = vi.fn();
const getSessionMock = vi.fn();
const signInWithOAuthMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock("next/image", () => ({
  default: ({ fill: _fill, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => <img {...props} />,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPasswordMock(...args),
      signUp: (...args: unknown[]) => signUpMock(...args),
      getSession: (...args: unknown[]) => getSessionMock(...args),
      signInWithOAuth: (...args: unknown[]) => signInWithOAuthMock(...args),
    },
  }),
}));

vi.mock("@/lib/supabase/env", () => ({
  isSupabaseEnvExplicitlySet: () => true,
}));

const { default: LoginPage } = await import("./page");

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      origin: "https://app.specflow.ai",
      href: "",
    },
  });
  signInWithPasswordMock.mockResolvedValue({ error: null });
  signUpMock.mockResolvedValue({ error: null });
  getSessionMock.mockResolvedValue({ data: { session: null } });
  signInWithOAuthMock.mockResolvedValue({ error: null });
});

describe("LoginPage button async states", () => {
  it("uses window.location.href after successful email login", async () => {
    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText(/email address/i), {
      target: { value: "pm@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^password$/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => expect(window.location.href).toBe("/dashboard"));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("disables Google login while OAuth is starting and shows OAuth errors", async () => {
    let resolveOAuth!: (value: { error: { message: string } }) => void;
    signInWithOAuthMock.mockReturnValue(
      new Promise((resolve) => {
        resolveOAuth = resolve;
      })
    );

    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(screen.getByRole("button", { name: /starting google sign in/i })).toHaveProperty("disabled", true);

    resolveOAuth({ error: { message: "OAuth failed" } });

    expect(await screen.findByText(/oauth failed/i)).toBeTruthy();
  });
});
