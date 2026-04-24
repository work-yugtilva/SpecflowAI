import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const scrollIntoViewMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  document.documentElement.removeAttribute("data-dark");
  document.body.innerHTML = "";

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  Storage.prototype.getItem = vi.fn(() => null);
  Storage.prototype.setItem = vi.fn();

  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoViewMock,
  });
});

const { default: Navbar } = await import("./Navbar");
const { default: FAQ } = await import("./FAQ");

describe("landing navbar", () => {
  it("toggles dark mode and persists the theme safely", async () => {
    document.documentElement.setAttribute("data-dark", "true");

    render(<Navbar />);

    const [toggle] = await screen.findAllByRole("button", {
      name: /switch to light mode/i,
    });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(document.documentElement.getAttribute("data-dark")).toBeNull();
      expect(localStorage.setItem).toHaveBeenCalledWith("specflow-theme", "light");
    });
  });

  it("opens the mobile menu, scrolls to sections, and closes after link clicks", async () => {
    const pricingSection = document.createElement("section");
    pricingSection.id = "pricing";
    document.body.appendChild(pricingSection);

    render(<Navbar />);

    fireEvent.click(screen.getByRole("button", { name: /open navigation menu/i }));
    const dialog = await screen.findByRole("dialog", { name: /mobile navigation/i });
    const pricingLink = within(dialog).getByRole("link", { name: /^pricing$/i });

    fireEvent.click(pricingLink);

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });
      expect(screen.queryByRole("dialog", { name: /mobile navigation/i })).toBeNull();
    });
  });
});

describe("landing faq", () => {
  it("expands only the selected answer", () => {
    render(<FAQ />);

    const firstQuestion = screen.getByRole("button", {
      name: /how is specflow different from chatgpt or notion ai/i,
    });
    const secondQuestion = screen.getByRole("button", {
      name: /what data sources can i connect/i,
    });

    fireEvent.click(firstQuestion);

    expect(firstQuestion.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByText(/purpose-built for product discovery/i).parentElement?.getAttribute("style")
    ).toContain("max-height: 200px");

    fireEvent.click(secondQuestion);

    expect(firstQuestion.getAttribute("aria-expanded")).toBe("false");
    expect(secondQuestion.getAttribute("aria-expanded")).toBe("true");
  });
});
