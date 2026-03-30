"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LS_RESEARCH } from "@/lib/pipeline-input";
import { useActiveSession } from "@/lib/active-session-context";
import {
  migrateGlobalToScopedOnce,
  scopedStorageKey,
} from "@/lib/session-scoped-storage";
import { Sidebar } from "@/components/ui/sidebar";
import {
  createResearchEntry,
  deleteResearchEntry,
  fetchResearchEntries,
  updateResearchEntry,
  type ResearchEntryRecord,
  type ResearchType,
} from "@/lib/api/research";

// ─── Types ────────────────────────────────────────────────────────────────────

type ResearchEntry = ResearchEntryRecord;

interface FormState {
  type: ResearchType;
  title: string;
  content: string;
  user: string;
  pain: string;
  context: string;
  tagsRaw: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RESEARCH_TYPES: ResearchType[] = [
  "Interview",
  "Survey",
  "Analytics",
  "Market Insight",
];

const TYPE_COLORS: Record<ResearchType, { bg: string; color: string }> = {
  Interview: { bg: "#EFF6FF", color: "#3B82F6" },
  Survey: { bg: "#F5F3FF", color: "#7C3AED" },
  Analytics: { bg: "#FFF7ED", color: "#D97706" },
  "Market Insight": { bg: "#F0FDF4", color: "#16A34A" },
};

const EMPTY_FORM: FormState = {
  type: "Interview",
  title: "",
  content: "",
  user: "",
  pain: "",
  context: "",
  tagsRaw: "",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.875rem",
  background: "#FFFFFF",
  border: "1.5px solid #E4DDD4",
  borderRadius: 10,
  fontSize: "0.875rem",
  color: "#0D0D0D",
  outline: "none",
  fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  boxSizing: "border-box",
};

function onFocus(
  e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
) {
  e.currentTarget.style.borderColor = "#E8561B";
  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,86,27,0.12)";
}

function onBlur(
  e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
) {
  e.currentTarget.style.borderColor = "#E4DDD4";
  e.currentTarget.style.boxShadow = "none";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: ResearchType }) {
  const { bg, color } = TYPE_COLORS[type];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 7px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        background: bg,
        color,
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      {type}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#9E9E9E",
        marginBottom: 6,
        marginTop: 18,
      }}
    >
      {children}
    </div>
  );
}

function FieldLabel({
  children,
  optional,
}: {
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <label
      style={{
        fontSize: 12,
        fontWeight: 500,
        color: "#6B6B6B",
        marginBottom: 5,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {children}
      {optional && (
        <span style={{ fontSize: 11, color: "#C8C2BB", fontWeight: 400 }}>
          optional
        </span>
      )}
    </label>
  );
}

// ─── Research Page ────────────────────────────────────────────────────────────

export default function ResearchPage() {
  const { activeSessionId } = useActiveSession();
  const researchScope = activeSessionId ? "session" : "global";
  const researchStorageKey = activeSessionId
    ? scopedStorageKey(activeSessionId, "research")
    : LS_RESEARCH;

  const [entries, setEntries] = useState<ResearchEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [researchHydrated, setResearchHydrated] = useState(false);

  useEffect(() => {
    setResearchHydrated(false);
    setSyncError(null);
    try {
      if (activeSessionId) {
        migrateGlobalToScopedOnce(
          activeSessionId,
          "research",
          LS_RESEARCH
        );
      }
      const raw = localStorage.getItem(researchStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as ResearchEntry[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEntries(parsed);
          setSelectedId(parsed[0].id);
        } else {
          setEntries([]);
          setSelectedId(null);
        }
      } else {
        setEntries([]);
        setSelectedId(null);
      }
    } catch {
      setEntries([]);
      setSelectedId(null);
    }
    let cancelled = false;
    fetchResearchEntries(researchScope, activeSessionId ?? undefined)
      .then((remoteEntries) => {
        if (cancelled) return;
        setEntries(remoteEntries);
        setSelectedId(remoteEntries[0]?.id ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          setSyncError(err instanceof Error ? err.message : "Failed to sync research");
        }
      })
      .finally(() => {
        if (!cancelled) setResearchHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSessionId, researchScope, researchStorageKey]);

  useEffect(() => {
    if (!researchHydrated) return;
    try {
      localStorage.setItem(researchStorageKey, JSON.stringify(entries));
    } catch {
      /* ignore */
    }
  }, [entries, researchHydrated, researchStorageKey]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const selectedEntry = entries.find((e) => e.id === selectedId) ?? null;

  function updateForm(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError(false);
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError(false);
    setShowModal(true);
  }

  function openEdit(entry: ResearchEntry) {
    setForm({
      type: entry.type,
      title: entry.title,
      content: entry.content,
      user: entry.user,
      pain: entry.pain,
      context: entry.context,
      tagsRaw: entry.tags.join(", "),
    });
    setEditingId(entry.id);
    setFormError(false);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setFormError(false);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) {
      setFormError(true);
      return;
    }
    setSyncError(null);
    const tags = form.tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      type: form.type,
      title: form.title,
      content: form.content,
      user: form.user,
      pain: form.pain,
      context: form.context,
      tags,
    };

    try {
      if (editingId) {
        const updated = await updateResearchEntry(editingId, payload);
        setEntries((prev) =>
          prev.map((e) => (e.id === editingId ? updated : e))
        );
      } else {
        const created = await createResearchEntry(
          researchScope,
          payload,
          activeSessionId ?? undefined
        );
        setEntries((prev) => [created, ...prev]);
        setSelectedId(created.id);
      }
      closeModal();
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : "Failed to save research entry"
      );
    }
  }

  async function handleDelete(id: string) {
    setSyncError(null);
    try {
      await deleteResearchEntry(id);
      const remaining = entries.filter((e) => e.id !== id);
      setEntries(remaining);
      if (selectedId === id) {
        setSelectedId(remaining[0]?.id ?? null);
      }
      setConfirmDeleteId(null);
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : "Failed to delete research entry"
      );
    }
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "#F8F4EF",
        fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
      }}
    >
      <Sidebar />

      {/* Main */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* ── Top Bar ── */}
        <header
          style={{
            height: 52,
            background: "#FFFFFF",
            borderBottom: "1px solid #E4DDD4",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            flexShrink: 0,
            gap: 12,
          }}
        >
          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#9E9E9E" }}>Signals</span>
            <span style={{ fontSize: 13, color: "#C8C2BB" }}>›</span>
            <span
              style={{ fontSize: 13, fontWeight: 500, color: "#0D0D0D" }}
            >
              Research
            </span>
            {entries.length > 0 && (
              <span
                style={{
                  marginLeft: 4,
                  fontSize: 11,
                  color: "#9E9E9E",
                  background: "#F0EDE9",
                  borderRadius: 4,
                  padding: "1px 6px",
                }}
              >
                {entries.length}
              </span>
            )}
          </div>

          {/* Add Research */}
          <button
            onClick={openAdd}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "0.4rem 0.875rem",
              borderRadius: 8,
              fontSize: "0.8125rem",
              fontWeight: 500,
              background: "#0D0D0D",
              color: "#FFFFFF",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
              transition: "background 150ms ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "#2A2A2A")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "#0D0D0D")
            }
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 13 13"
              fill="none"
            >
              <path
                d="M6.5 1.5v10M1.5 6.5h10"
                stroke="#FFFFFF"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            Add Research
          </button>
        </header>

        {syncError && (
          <div
            style={{
              padding: "10px 20px",
              background: "rgba(239,68,68,0.08)",
              borderBottom: "1px solid rgba(239,68,68,0.18)",
              color: "#B91C1C",
              fontSize: 12.5,
            }}
          >
            {syncError}
          </div>
        )}

        {/* ── Two-column content ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* LEFT — Entries list */}
          <div
            style={{
              width: 300,
              flexShrink: 0,
              borderRight: "1px solid #E4DDD4",
              background: "#FFFFFF",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* List header */}
            {entries.length > 0 && (
              <div
                style={{
                  padding: "10px 16px",
                  borderBottom: "1px solid #F0EDE9",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#9E9E9E",
                  }}
                >
                  Entries
                </span>
                <span style={{ fontSize: 11, color: "#C8C2BB" }}>
                  {entries.length} total
                </span>
              </div>
            )}

            {/* List body */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {entries.length === 0 ? (
                /* Left empty state */
                <div
                  style={{
                    padding: "32px 20px",
                    textAlign: "center",
                    color: "#C8C2BB",
                  }}
                >
                  <p style={{ fontSize: 13, margin: 0 }}>
                    No entries yet.
                  </p>
                </div>
              ) : (
                entries.map((entry) => {
                  const active = entry.id === selectedId;
                  return (
                    <button
                      key={entry.id}
                      onClick={() => {
                        setSelectedId(entry.id);
                        setConfirmDeleteId(null);
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        display: "flex",
                        flexDirection: "column",
                        gap: 5,
                        padding: "11px 16px",
                        border: "none",
                        borderBottom: "1px solid #F0EDE9",
                        borderLeft: active
                          ? "3px solid #E8561B"
                          : "3px solid transparent",
                        background: active
                          ? "rgba(232,86,27,0.04)"
                          : "transparent",
                        cursor: "pointer",
                        fontFamily:
                          "var(--font-dm-sans), 'DM Sans', sans-serif",
                        transition:
                          "background 120ms ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!active)
                          e.currentTarget.style.background =
                            "rgba(0,0,0,0.02)";
                      }}
                      onMouseLeave={(e) => {
                        if (!active)
                          e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {/* Title row */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: "#0D0D0D",
                            lineHeight: 1.4,
                            flex: 1,
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {entry.title}
                        </span>
                      </div>
                      {/* Preview */}
                      <p
                        style={{
                          fontSize: 11.5,
                          color: "#9E9E9E",
                          margin: 0,
                          lineHeight: 1.5,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {entry.content}
                      </p>
                      {/* Footer */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: 2,
                        }}
                      >
                        <TypeBadge type={entry.type} />
                        <span
                          style={{
                            fontSize: 11,
                            color: "#C8C2BB",
                          }}
                        >
                          {formatDate(
                            entry.createdAt ??
                              entry.updatedAt ??
                              new Date().toISOString()
                          )}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT — Detail / Empty */}
          <div
            style={{
              flex: 1,
              background: "#F8F4EF",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {entries.length === 0 ? (
              /* Full empty state */
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  padding: "40px 24px",
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    background: "rgba(232,86,27,0.07)",
                    border: "1px solid rgba(232,86,27,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                    <circle
                      cx="11"
                      cy="11"
                      r="7"
                      stroke="#E8561B"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M16.5 16.5L21 21"
                      stroke="#E8561B"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M8 11h6M11 8v6"
                      stroke="#E8561B"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div style={{ textAlign: "center" }}>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: "#0D0D0D",
                      margin: 0,
                    }}
                  >
                    No research added yet.
                  </p>
                  <p
                    style={{
                      fontSize: 12.5,
                      color: "#9E9E9E",
                      margin: "4px 0 0",
                      lineHeight: 1.5,
                    }}
                  >
                    Add interviews, surveys, analytics, or market insights.
                  </p>
                </div>
                <button
                  onClick={openAdd}
                  className="btn-dark"
                  style={{
                    fontSize: "0.8125rem",
                    padding: "0.45rem 1rem",
                    marginTop: 4,
                  }}
                >
                  Add Research
                </button>
              </div>
            ) : selectedEntry ? (
              /* Entry detail */
              <div style={{ padding: "24px 28px", flex: 1 }}>
                {/* Title row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 16,
                    marginBottom: 14,
                  }}
                >
                  <h2
                    style={{
                      fontSize: 18,
                      fontWeight: 500,
                      color: "#0D0D0D",
                      letterSpacing: "-0.02em",
                      margin: 0,
                      lineHeight: 1.35,
                      flex: 1,
                    }}
                  >
                    {selectedEntry.title}
                  </h2>
                  <TypeBadge type={selectedEntry.type} />
                </div>

                {/* Meta row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 20,
                  }}
                >
                  <span style={{ fontSize: 12, color: "#9E9E9E" }}>
                    {formatDate(
                      selectedEntry.createdAt ??
                        selectedEntry.updatedAt ??
                        new Date().toISOString()
                    )}
                  </span>
                  {selectedEntry.tags.length > 0 && (
                    <>
                      <span style={{ color: "#E4DDD4", fontSize: 12 }}>
                        •
                      </span>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 5,
                        }}
                      >
                        {selectedEntry.tags.map((tag) => (
                          <span
                            key={tag}
                            style={{
                              fontSize: 11,
                              color: "#6B6B6B",
                              background: "#F0EDE9",
                              borderRadius: 4,
                              padding: "1px 7px",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Divider */}
                <hr
                  style={{
                    border: "none",
                    borderTop: "1px solid #E4DDD4",
                    marginBottom: 20,
                  }}
                />

                {/* Content */}
                <SectionLabel>Content</SectionLabel>
                <p
                  style={{
                    fontSize: 13.5,
                    color: "#3D3D3D",
                    lineHeight: 1.75,
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {selectedEntry.content}
                </p>

                {/* Structured fields */}
                {(selectedEntry.user ||
                  selectedEntry.pain ||
                  selectedEntry.context) && (
                  <>
                    <hr
                      style={{
                        border: "none",
                        borderTop: "1px solid #F0EDE9",
                        margin: "22px 0 0",
                      }}
                    />

                    {selectedEntry.user && (
                      <>
                        <SectionLabel>User</SectionLabel>
                        <p
                          style={{
                            fontSize: 13,
                            color: "#3D3D3D",
                            lineHeight: 1.6,
                            margin: 0,
                          }}
                        >
                          {selectedEntry.user}
                        </p>
                      </>
                    )}

                    {selectedEntry.pain && (
                      <>
                        <SectionLabel>Pain Point</SectionLabel>
                        <p
                          style={{
                            fontSize: 13,
                            color: "#3D3D3D",
                            lineHeight: 1.6,
                            margin: 0,
                          }}
                        >
                          {selectedEntry.pain}
                        </p>
                      </>
                    )}

                    {selectedEntry.context && (
                      <>
                        <SectionLabel>Context</SectionLabel>
                        <p
                          style={{
                            fontSize: 13,
                            color: "#3D3D3D",
                            lineHeight: 1.6,
                            margin: 0,
                          }}
                        >
                          {selectedEntry.context}
                        </p>
                      </>
                    )}
                  </>
                )}

                {/* Actions */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 28,
                    paddingTop: 20,
                    borderTop: "1px solid #F0EDE9",
                  }}
                >
                  <button
                    onClick={() => openEdit(selectedEntry)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "0.4rem 0.875rem",
                      borderRadius: 8,
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                      background: "#FFFFFF",
                      border: "1.5px solid #E4DDD4",
                      color: "#0D0D0D",
                      cursor: "pointer",
                      fontFamily:
                        "var(--font-dm-sans), 'DM Sans', sans-serif",
                      transition:
                        "background 150ms ease, border-color 150ms ease",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#F8F4EF")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "#FFFFFF")
                    }
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z"
                        stroke="#6B6B6B"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Edit
                  </button>

                  {confirmDeleteId === selectedEntry.id ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{ fontSize: 12.5, color: "#6B6B6B" }}
                      >
                        Delete this entry?
                      </span>
                      <button
                        onClick={() => handleDelete(selectedEntry.id)}
                        style={{
                          fontSize: "0.8125rem",
                          fontWeight: 500,
                          color: "#EF4444",
                          background: "rgba(239,68,68,0.08)",
                          border: "1.5px solid rgba(239,68,68,0.25)",
                          borderRadius: 8,
                          padding: "0.35rem 0.75rem",
                          cursor: "pointer",
                          fontFamily:
                            "var(--font-dm-sans), 'DM Sans', sans-serif",
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        style={{
                          fontSize: "0.8125rem",
                          color: "#6B6B6B",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          fontFamily:
                            "var(--font-dm-sans), 'DM Sans', sans-serif",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        setConfirmDeleteId(selectedEntry.id)
                      }
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "0.4rem 0.875rem",
                        borderRadius: 8,
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        background: "transparent",
                        border: "1.5px solid transparent",
                        color: "#9E9E9E",
                        cursor: "pointer",
                        fontFamily:
                          "var(--font-dm-sans), 'DM Sans', sans-serif",
                        transition: "color 150ms ease",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "#EF4444")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "#9E9E9E")
                      }
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Entries exist but nothing selected */
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#C8C2BB",
                  fontSize: 13,
                }}
              >
                ← Select an entry to view details
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            flexShrink: 0,
            padding: "12px 20px",
            borderTop: "1px solid #E4DDD4",
            background: "#FFFFFF",
            fontSize: 12.5,
            color: "#6B6B6B",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <span>
            Entries are saved to your browser and passed as{" "}
            <strong style={{ color: "#3a3530" }}>research</strong> on the next pipeline
            run.
          </span>
          <Link
            href="/sessions"
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "#E8561B",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Open Sessions →
          </Link>
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 16,
              width: "100%",
              maxWidth: 540,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px 28px",
              fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)",
            }}
          >
            {/* Modal header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#0D0D0D",
                  margin: 0,
                  letterSpacing: "-0.015em",
                }}
              >
                {editingId ? "Edit Research" : "Add Research"}
              </h3>
              <button
                onClick={closeModal}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: "#F8F4EF",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#6B6B6B",
                  flexShrink: 0,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                >
                  <path
                    d="M2 2l10 10M12 2L2 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* Form */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Type */}
              <div>
                <FieldLabel>Type</FieldLabel>
                <div style={{ position: "relative" }}>
                  <select
                    value={form.type}
                    onChange={(e) =>
                      updateForm("type", e.target.value as ResearchType)
                    }
                    style={{
                      ...inputStyle,
                      appearance: "none",
                      WebkitAppearance: "none",
                      paddingRight: "2.25rem",
                      cursor: "pointer",
                    }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  >
                    {RESEARCH_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 13 13"
                    fill="none"
                    style={{
                      position: "absolute",
                      right: 11,
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      opacity: 0.4,
                    }}
                  >
                    <path
                      d="M2.5 5L6.5 9L10.5 5"
                      stroke="#0D0D0D"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <div>
                <FieldLabel>
                  Title
                  {formError && !form.title.trim() && (
                    <span style={{ color: "#EF4444", fontSize: 11 }}>
                      required
                    </span>
                  )}
                </FieldLabel>
                <input
                  type="text"
                  placeholder="e.g., User interview with Sarah K."
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                  style={{
                    ...inputStyle,
                    borderColor:
                      formError && !form.title.trim()
                        ? "#EF4444"
                        : "#E4DDD4",
                  }}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              </div>

              {/* Content */}
              <div>
                <FieldLabel>
                  Content
                  {formError && !form.content.trim() && (
                    <span style={{ color: "#EF4444", fontSize: 11 }}>
                      required
                    </span>
                  )}
                </FieldLabel>
                <textarea
                  placeholder="Summarize the research findings, observations, or data…"
                  value={form.content}
                  onChange={(e) => updateForm("content", e.target.value)}
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    minHeight: 100,
                    lineHeight: 1.6,
                    borderColor:
                      formError && !form.content.trim()
                        ? "#EF4444"
                        : "#E4DDD4",
                  }}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              </div>

              {/* Divider */}
              <hr
                style={{
                  border: "none",
                  borderTop: "1px solid #F0EDE9",
                  margin: "2px 0",
                }}
              />

              {/* User */}
              <div>
                <FieldLabel optional>User</FieldLabel>
                <input
                  type="text"
                  placeholder="e.g., Sarah K., Senior PM"
                  value={form.user}
                  onChange={(e) => updateForm("user", e.target.value)}
                  style={inputStyle}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              </div>

              {/* Pain */}
              <div>
                <FieldLabel optional>Pain Point</FieldLabel>
                <input
                  type="text"
                  placeholder="e.g., Context switching wastes 40% of spec time"
                  value={form.pain}
                  onChange={(e) => updateForm("pain", e.target.value)}
                  style={inputStyle}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              </div>

              {/* Context */}
              <div>
                <FieldLabel optional>Context</FieldLabel>
                <textarea
                  placeholder="e.g., Remote session, 30 minutes, via Zoom"
                  value={form.context}
                  onChange={(e) => updateForm("context", e.target.value)}
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    minHeight: 56,
                    lineHeight: 1.6,
                  }}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              </div>

              {/* Tags */}
              <div>
                <FieldLabel optional>Tags</FieldLabel>
                <input
                  type="text"
                  placeholder="e.g., pm, discovery, prd (comma-separated)"
                  value={form.tagsRaw}
                  onChange={(e) => updateForm("tagsRaw", e.target.value)}
                  style={inputStyle}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              </div>

              {/* Actions */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 4,
                  paddingTop: 4,
                }}
              >
                <button
                  onClick={closeModal}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: 8,
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    background: "#FFFFFF",
                    border: "1.5px solid #E4DDD4",
                    color: "#6B6B6B",
                    cursor: "pointer",
                    fontFamily:
                      "var(--font-dm-sans), 'DM Sans', sans-serif",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  style={{
                    padding: "0.5rem 1.125rem",
                    borderRadius: 8,
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    background: "#0D0D0D",
                    color: "#FFFFFF",
                    border: "none",
                    cursor: "pointer",
                    fontFamily:
                      "var(--font-dm-sans), 'DM Sans', sans-serif",
                    transition: "background 150ms ease",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#2A2A2A")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "#0D0D0D")
                  }
                >
                  {editingId ? "Save Changes" : "Add Entry"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
