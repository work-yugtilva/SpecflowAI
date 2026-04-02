import { describe, it, expect } from "vitest";
import { formatAuthErrorMessage } from "./auth-errors";

describe("formatAuthErrorMessage", () => {
  it("returns message from Error object", () => {
    const err = new Error("Invalid credentials");
    expect(formatAuthErrorMessage(err)).toBe("Invalid credentials");
  });

  it("returns message from object with message property", () => {
    const err = { message: "Token expired" };
    expect(formatAuthErrorMessage(err)).toBe("Token expired");
  });

  it("converts non-Error, non-object to string", () => {
    expect(formatAuthErrorMessage("something went wrong")).toBe(
      "something went wrong"
    );
  });

  it("converts null to string", () => {
    expect(formatAuthErrorMessage(null)).toBe("null");
  });

  it("maps 'failed to fetch' to network error copy", () => {
    const result = formatAuthErrorMessage(new Error("Failed to fetch"));
    expect(result).toContain("Network error");
    expect(result).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("maps 'networkerror' (case-insensitive) to network error copy", () => {
    const result = formatAuthErrorMessage({ message: "NetworkError occurred" });
    expect(result).toContain("Network error");
  });

  it("maps 'load failed' to network error copy", () => {
    const result = formatAuthErrorMessage(new Error("Load failed"));
    expect(result).toContain("Network error");
  });

  it("maps 'network request failed' to network error copy", () => {
    const result = formatAuthErrorMessage(new Error("Network request failed"));
    expect(result).toContain("Network error");
  });

  it("passes through non-network messages unchanged", () => {
    const result = formatAuthErrorMessage(new Error("User not found"));
    expect(result).toBe("User not found");
  });

  it("ignores object with empty message, falls through to string", () => {
    const result = formatAuthErrorMessage({ message: "   " });
    expect(result).toBe("[object Object]");
  });
});
