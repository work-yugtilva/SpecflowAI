/**
 * Session-scoped localStorage keys — derived from session_id, no hardcoded ids.
 */

const PREFIX = "specflow_s_";

export type SessionScopedSuffix =
  | "context"
  | "research"
  | "pending_input"
  | "autorun"
  | "ingest_entries";

function enc(sessionId: string): string {
  return encodeURIComponent(sessionId);
}

/** Deterministic storage key for a session + logical suffix. */
export function scopedStorageKey(
  sessionId: string,
  suffix: SessionScopedSuffix
): string {
  return `${PREFIX}${enc(sessionId)}__${suffix}`;
}

function migrationFlagKey(sessionId: string, suffix: SessionScopedSuffix): string {
  return `${PREFIX}${enc(sessionId)}__migrated__${suffix}`;
}

function hasMigrated(sessionId: string, suffix: SessionScopedSuffix): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(migrationFlagKey(sessionId, suffix)) === "1";
}

function markMigrated(sessionId: string, suffix: SessionScopedSuffix): void {
  try {
    localStorage.setItem(migrationFlagKey(sessionId, suffix), "1");
  } catch {
    /* ignore */
  }
}

/** Read raw string for scoped key; null if missing. */
export function readScopedRaw(
  sessionId: string,
  suffix: SessionScopedSuffix
): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(scopedStorageKey(sessionId, suffix));
}

export function writeScopedRaw(
  sessionId: string,
  suffix: SessionScopedSuffix,
  value: string
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(scopedStorageKey(sessionId, suffix), value);
  } catch {
    /* ignore */
  }
}

export function removeScopedRaw(
  sessionId: string,
  suffix: SessionScopedSuffix
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(scopedStorageKey(sessionId, suffix));
  } catch {
    /* ignore */
  }
}

/**
 * One-time copy global → scoped when scoped is empty (per session + suffix).
 */
export function migrateGlobalToScopedOnce(
  sessionId: string,
  suffix: SessionScopedSuffix,
  globalKey: string
): void {
  if (typeof window === "undefined" || hasMigrated(sessionId, suffix)) return;
  const scopedKey = scopedStorageKey(sessionId, suffix);
  const existing = localStorage.getItem(scopedKey);
  if (existing != null && existing !== "") {
    markMigrated(sessionId, suffix);
    return;
  }
  const globalVal = localStorage.getItem(globalKey);
  if (globalVal != null && globalVal !== "" && globalVal !== "[]" && globalVal !== "{}") {
    try {
      localStorage.setItem(scopedKey, globalVal);
    } catch {
      /* ignore */
    }
  }
  markMigrated(sessionId, suffix);
}
