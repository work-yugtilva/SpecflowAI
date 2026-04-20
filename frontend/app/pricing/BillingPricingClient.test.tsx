import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const assignMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(window, "location", {
    value: {
      origin: "https://app.specflow.ai",
      assign: assignMock,
    },
    writable: true,
  });
});

const { BillingPricingClient } = await import("./BillingPricingClient");

describe("BillingPricingClient", () => {
  it("renders Free, Pro, and Team plans", () => {
    render(<BillingPricingClient isAuthenticated={true} />);

    expect(screen.getByText("Free")).toBeTruthy();
    expect(screen.getByText("Pro")).toBeTruthy();
    expect(screen.getByText("Team")).toBeTruthy();
    expect(screen.getByText("$49/mo")).toBeTruthy();
    expect(screen.getByText("$99/mo")).toBeTruthy();
  });

  it("starts Stripe checkout for authenticated upgrades", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ url: "https://checkout.stripe.com/pay/cs_test_123" }),
      })
    );

    render(<BillingPricingClient isAuthenticated={true} />);
    fireEvent.click(screen.getByRole("button", { name: /upgrade to pro/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "pro",
          success_url: "https://app.specflow.ai/dashboard?upgraded=true",
          cancel_url: "https://app.specflow.ai/pricing",
        }),
      });
      expect(assignMock).toHaveBeenCalledWith("https://checkout.stripe.com/pay/cs_test_123");
    });
  });

  it("routes unauthenticated upgrades to login", () => {
    render(<BillingPricingClient isAuthenticated={false} />);
    fireEvent.click(screen.getByRole("button", { name: /upgrade to team/i }));

    expect(assignMock).toHaveBeenCalledWith("/login");
  });
});
