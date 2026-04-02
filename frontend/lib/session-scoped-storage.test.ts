import { describe, it, expect, beforeEach } from "vitest";
import {
  scopedStorageKey,
  readScopedRaw,
  writeScopedRaw,
  removeScopedRaw,
} from "./session-scoped-storage";

// ---------------------------------------------------------------------------
// scopedStorageKey — pure function
// ---------------------------------------------------------------------------

describe("scopedStorageKey", () => {
  it("produces a deterministic key", () => {
    const key = scopedStorageKey("sess-abc", "context");
    expect(key).toBe("specflow_s_sess-abc__context");
  });

  it("URL-encodes special characters in session ID", () => {
    const key = scopedStorageKey("sess/123 x", "research");
    expect(key).toContain("sess%2F123%20x");
  });

  it("produces distinct keys for different suffixes", () => {
    const k1 = scopedStorageKey("s", "context");
    const k2 = scopedStorageKey("s", "research");
    expect(k1).not.toBe(k2);
  });

  it("produces distinct keys for different session IDs", () => {
    const k1 = scopedStorageKey("s1", "context");
    const k2 = scopedStorageKey("s2", "context");
    expect(k1).not.toBe(k2);
  });
});

// ---------------------------------------------------------------------------
// localStorage read/write/remove — use jsdom environment
// ---------------------------------------------------------------------------

describe("readScopedRaw / writeScopedRaw / removeScopedRaw", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("write then read returns the same value", () => {
    writeScopedRaw("sess-1", "context", "hello");
    expect(readScopedRaw("sess-1", "context")).toBe("hello");
  });

  it("readScopedRaw returns null when key is absent", () => {
    expect(readScopedRaw("sess-1", "research")).toBeNull();
  });

  it("removeScopedRaw deletes the stored value", () => {
    writeScopedRaw("sess-1", "context", "data");
    removeScopedRaw("sess-1", "context");
    expect(readScopedRaw("sess-1", "context")).toBeNull();
  });

  it("values are isolated per session ID", () => {
    writeScopedRaw("sess-A", "context", "A-data");
    writeScopedRaw("sess-B", "context", "B-data");
    expect(readScopedRaw("sess-A", "context")).toBe("A-data");
    expect(readScopedRaw("sess-B", "context")).toBe("B-data");
  });

  it("values are isolated per suffix", () => {
    writeScopedRaw("sess-1", "context", "ctx");
    writeScopedRaw("sess-1", "research", "res");
    expect(readScopedRaw("sess-1", "context")).toBe("ctx");
    expect(readScopedRaw("sess-1", "research")).toBe("res");
  });
});
