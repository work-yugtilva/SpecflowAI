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

const { BillingSettingsClient } = await import("./BillingSettingsClient");

describe("BillingSettingsClient", () => {
  it("loads the current plan from /api/user/plan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            plan: "team",
            plan_label: "Team",
            price_dollars: 99,
            limit_type: "credit",
            api_credit_used_cents: 200,
            api_credit_used_dollars: 2,
            max_credit_cents: 10000,
            max_credit_dollars: 100,
            stripe_customer_id: "cus_123",
          }),
      })
    );

    render(<BillingSettingsClient />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/user/plan", {
        credentials: "same-origin",
        cache: "no-store",
      });
    });
    expect(await screen.findByText("Team")).toBeTruthy();
    expect(screen.getByRole("button", { name: /manage billing/i })).toBeTruthy();
  });

  it("opens Stripe customer portal when manage billing is clicked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              plan: "pro",
              plan_label: "Pro",
              price_dollars: 49,
              limit_type: "credit",
              api_credit_used_cents: 100,
              api_credit_used_dollars: 1,
              max_credit_cents: 1500,
              max_credit_dollars: 15,
              stripe_customer_id: "cus_123",
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ url: "https://billing.stripe.com/session/test" }),
        })
    );

    render(<BillingSettingsClient />);
    fireEvent.click(await screen.findByRole("button", { name: /manage billing/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenNthCalledWith(2, "/api/billing/portal", {
        method: "POST",
      });
      expect(assignMock).toHaveBeenCalledWith("https://billing.stripe.com/session/test");
    });
  });
});
