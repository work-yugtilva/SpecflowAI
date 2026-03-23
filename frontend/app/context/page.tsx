"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/ui/sidebar";
import { useActiveSession } from "@/lib/active-session-context";
import {
  LS_CONTEXT,
} from "@/lib/pipeline-input";
import { scopedStorageKey } from "@/lib/session-scoped-storage";
import {
  fetchScopedContext,
  importGlobalContextToSession,
  saveScopedContext,
  type ContextScope,
} from "@/lib/api/context";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContextForm {
  companyName: string;
  companyType: string;
  productName: string;
  productDescription: string;
  targetUsers: string;
  goals: string;
  constraints: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPANY_TYPES = ["SaaS", "Enterprise", "Agency", "Startup", "Marketplace", "Other"];

const INITIAL_FORM: ContextForm = {
  companyName: "",
  companyType: "",
  productName: "",
  productDescription: "",
  targetUsers: "",
  goals: "",
  constraints: "",
};

// ─── Shared Styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem 0.875rem",
  background: "#FFFFFF",
  border: "1.5px solid #E4DDD4",
  borderRadius: 10,
  fontSize: "0.9375rem",
  color: "#0D0D0D",
  outline: "none",
  fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  boxSizing: "border-box",
};

function focusStyle(
  e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
) {
  e.currentTarget.style.borderColor = "#E8561B";
  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,86,27,0.12)";
}

function blurStyle(
  e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
) {
  e.currentTarget.style.borderColor = "#E4DDD4";
  e.currentTarget.style.boxShadow = "none";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        fontSize: 12,
        fontWeight: 500,
        color: "#6B6B6B",
        marginBottom: 5,
        display: "block",
      }}
    >
      {children}
    </label>
  );
}

function SectionHeader({
  children,
  first,
}: {
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#9E9E9E",
        paddingBottom: 10,
        borderBottom: "1px solid #F0EDE9",
        marginBottom: 14,
        marginTop: first ? 0 : 28,
      }}
    >
      {children}
    </div>
  );
}

function SummaryLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        color: "#C8C2BB",
        marginBottom: 5,
      }}
    >
      {children}
    </div>
  );
}

function SummaryText({
  value,
  placeholder,
}: {
  value: string;
  placeholder: string;
}) {
  return (
    <p
      style={{
        fontSize: 13,
        color: value ? "#3D3D3D" : "#C8C2BB",
        margin: 0,
        lineHeight: 1.7,
        whiteSpace: "pre-wrap",
      }}
    >
      {value || placeholder}
    </p>
  );
}

// ─── Context Page ─────────────────────────────────────────────────────────────

function mergeContextFromStorage(raw: Record<string, unknown>): ContextForm {
  return {
    companyName: String(raw.companyName ?? ""),
    companyType: String(raw.companyType ?? ""),
    productName: String(raw.productName ?? ""),
    productDescription: String(raw.productDescription ?? ""),
    targetUsers: String(raw.targetUsers ?? ""),
    goals: String(raw.goals ?? ""),
    constraints: String(raw.constraints ?? ""),
  };
}

export default function ContextPage() {
  const { activeSessionId } = useActiveSession();
  const [scope, setScope] = useState<ContextScope>("global");
  const [form, setForm] = useState<ContextForm>(INITIAL_FORM);

  useEffect(() => {
    if (!activeSessionId && scope === "session") {
      setScope("global");
    }
  }, [activeSessionId, scope]);

  useEffect(() => {
    const targetScope: ContextScope = scope === "session" && activeSessionId ? "session" : "global";
    const readLocal = () => {
      try {
        if (targetScope === "session" && activeSessionId) {
          return JSON.parse(
            localStorage.getItem(scopedStorageKey(activeSessionId, "context")) || "{}"
          ) as Record<string, unknown>;
        }
        return JSON.parse(localStorage.getItem(LS_CONTEXT) || "{}") as Record<string, unknown>;
      } catch {
        return {};
      }
    };

    setForm(mergeContextFromStorage(readLocal()));

    fetchScopedContext(targetScope, activeSessionId ?? undefined)
      .then((remote) => {
        if (remote) setForm(mergeContextFromStorage(remote as unknown as Record<string, unknown>));
      })
      .catch(() => {
        // Keep local data as fallback if backend context API/auth is unavailable.
      });
  }, [activeSessionId, scope]);

  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  function update(field: keyof ContextForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  function handleSave() {
    const targetScope: ContextScope = scope === "session" && activeSessionId ? "session" : "global";
    try {
      if (targetScope === "session" && activeSessionId) {
        localStorage.setItem(
          scopedStorageKey(activeSessionId, "context"),
          JSON.stringify(form)
        );
      } else {
        localStorage.setItem(LS_CONTEXT, JSON.stringify(form));
      }
    } catch {
      /* ignore */
    }
    setSaveError(null);
    saveScopedContext(targetScope, form, activeSessionId ?? undefined).catch((e: unknown) => {
      setSaveError(String(e));
    });
    setSaved(true);
    if (saveTimer) clearTimeout(saveTimer);
    const t = setTimeout(() => setSaved(false), 2500);
    setSaveTimer(t);
  }

  const isEmpty = Object.values(form).every((v) => !v.trim());

  async function handleImportGlobalToSession() {
    if (!activeSessionId) return;
    try {
      const raw = JSON.parse(localStorage.getItem(LS_CONTEXT) || "{}") as ContextForm;
      localStorage.setItem(scopedStorageKey(activeSessionId, "context"), JSON.stringify(raw));
      setForm(mergeContextFromStorage(raw as unknown as Record<string, unknown>));
      await importGlobalContextToSession(activeSessionId).catch(() => {
        // If backend import fails, local session copy still enables immediate use.
      });
      setSaved(true);
    } catch {
      // ignore
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
            <span style={{ fontSize: 13, color: "#9E9E9E", fontWeight: 400 }}>
              Signals
            </span>
            <span style={{ fontSize: 13, color: "#C8C2BB" }}>›</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#0D0D0D" }}>
              Context
            </span>
            <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 600, color: "#E8561B", background: "rgba(232,86,27,0.1)", border: "1px solid rgba(232,86,27,0.2)", borderRadius: 12, padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {scope === "global" ? "Workspace" : "Session"}
            </span>
          </div>

          {/* Right actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {activeSessionId && (
              <>
                <button
                  onClick={() => setScope("global")}
                  style={{
                    border: "1px solid #E4DDD4",
                    borderRadius: 8,
                    background: scope === "global" ? "#0D0D0D" : "#FFFFFF",
                    color: scope === "global" ? "#FFFFFF" : "#6B6B6B",
                    fontSize: 12,
                    fontWeight: 500,
                    padding: "0.35rem 0.625rem",
                    cursor: "pointer",
                  }}
                >
                  Workspace
                </button>
                <button
                  onClick={() => setScope("session")}
                  style={{
                    border: "1px solid #E4DDD4",
                    borderRadius: 8,
                    background: scope === "session" ? "#0D0D0D" : "#FFFFFF",
                    color: scope === "session" ? "#FFFFFF" : "#6B6B6B",
                    fontSize: 12,
                    fontWeight: 500,
                    padding: "0.35rem 0.625rem",
                    cursor: "pointer",
                  }}
                >
                  Session
                </button>
              </>
            )}

            {activeSessionId && scope === "session" && (
              <button
                onClick={handleImportGlobalToSession}
                style={{
                  fontSize: "0.8125rem",
                  padding: "0.4rem 0.875rem",
                  borderRadius: 8,
                  border: "1px solid #E4DDD4",
                  background: "#FFFFFF",
                  color: "#6B6B6B",
                  cursor: "pointer",
                }}
              >
                Import Workspace
              </button>
            )}

            {/* Saved indicator */}
            {saved && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  color: "#22C55E",
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#22C55E",
                    display: "inline-block",
                  }}
                />
                Saved
              </div>
            )}

            {/* Save Context */}
            <button
              onClick={handleSave}
              className="btn-dark"
              style={{
                fontSize: "0.8125rem",
                padding: "0.4rem 0.875rem",
              }}
            >
              Save Context
            </button>
          </div>
          {saveError && (
            <div style={{ padding: "4px 20px 0", fontSize: 11.5, color: "#DC2626" }}>
              Sync failed: {saveError}
            </div>
          )}
        </header>

        {/* ── Two-Column Content ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* LEFT — Form */}
          <div
            style={{
              width: 480,
              flexShrink: 0,
              borderRight: "1px solid #E4DDD4",
              background: "#FFFFFF",
              overflowY: "auto",
              padding: "24px 28px",
            }}
          >
            {/* ── COMPANY ── */}
            <SectionHeader first>Company</SectionHeader>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              {/* Company Name */}
              <div>
                <FieldLabel>Company Name</FieldLabel>
                <input
                  type="text"
                  placeholder="Acme Inc."
                  value={form.companyName}
                  onChange={(e) => update("companyName", e.target.value)}
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </div>

              {/* Company Type */}
              <div>
                <FieldLabel>Company Type</FieldLabel>
                <div style={{ position: "relative" }}>
                  <select
                    value={form.companyType}
                    onChange={(e) => update("companyType", e.target.value)}
                    style={{
                      ...inputStyle,
                      appearance: "none",
                      WebkitAppearance: "none",
                      paddingRight: "2.25rem",
                      cursor: "pointer",
                    }}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  >
                    <option value="">Select type…</option>
                    {COMPANY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      opacity: 0.45,
                    }}
                  >
                    <path
                      d="M3 5L7 9L11 5"
                      stroke="#0D0D0D"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* ── PRODUCT ── */}
            <SectionHeader>Product</SectionHeader>

            <div style={{ marginBottom: 12 }}>
              <FieldLabel>Product Name</FieldLabel>
              <input
                type="text"
                placeholder="SpecFlow"
                value={form.productName}
                onChange={(e) => update("productName", e.target.value)}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </div>

            <div>
              <FieldLabel>Product Description</FieldLabel>
              <textarea
                placeholder="A brief description of what your product does and the problem it solves."
                value={form.productDescription}
                onChange={(e) => update("productDescription", e.target.value)}
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  minHeight: 80,
                  lineHeight: 1.6,
                }}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </div>

            {/* ── TARGET USERS ── */}
            <SectionHeader>Target Users</SectionHeader>
            <textarea
              placeholder="Who are the primary users of this product? Describe their role, context, and goals."
              value={form.targetUsers}
              onChange={(e) => update("targetUsers", e.target.value)}
              style={{
                ...inputStyle,
                resize: "vertical",
                minHeight: 64,
                lineHeight: 1.6,
              }}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />

            {/* ── GOALS ── */}
            <SectionHeader>Goals</SectionHeader>
            <textarea
              placeholder="What outcomes are you optimizing for? List the key goals for this product or initiative."
              value={form.goals}
              onChange={(e) => update("goals", e.target.value)}
              style={{
                ...inputStyle,
                resize: "vertical",
                minHeight: 80,
                lineHeight: 1.6,
              }}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />

            {/* ── CONSTRAINTS ── */}
            <SectionHeader>Constraints</SectionHeader>
            <textarea
              placeholder="Any technical, business, or time constraints to be aware of."
              value={form.constraints}
              onChange={(e) => update("constraints", e.target.value)}
              style={{
                ...inputStyle,
                resize: "vertical",
                minHeight: 80,
                lineHeight: 1.6,
                marginBottom: 8,
              }}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
          </div>

          {/* RIGHT — Live Preview */}
          <div
            style={{
              flex: 1,
              background: "#F8F4EF",
              overflowY: "auto",
              padding: "24px 28px",
            }}
          >
            {/* Panel label */}
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#9E9E9E",
                marginBottom: 16,
              }}
            >
              Context Preview
            </div>

            {/* Summary card */}
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #E4DDD4",
                borderRadius: 12,
                padding: "20px 22px",
              }}
            >
              {isEmpty ? (
                /* Empty state */
                <div
                  style={{
                    padding: "32px 20px",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 10,
                      background: "rgba(232,86,27,0.06)",
                      border: "1px solid rgba(232,86,27,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 22 22"
                      fill="none"
                    >
                      <rect
                        x="4"
                        y="2"
                        width="14"
                        height="18"
                        rx="2"
                        stroke="#E8561B"
                        strokeWidth="1.4"
                      />
                      <path
                        d="M7 7h8M7 11h8M7 15h5"
                        stroke="#E8561B"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <p
                    style={{
                      fontSize: 13,
                      color: "#C8C2BB",
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    Fill in details to see a live preview.
                  </p>
                </div>
              ) : (
                /* Populated summary */
                <>
                  {/* Company row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 14,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: form.companyName ? "#0D0D0D" : "#C8C2BB",
                      }}
                    >
                      {form.companyName || "—"}
                    </span>
                    {form.companyType && (
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 5,
                          fontSize: 11,
                          fontWeight: 500,
                          background: "rgba(232,86,27,0.08)",
                          border: "1px solid rgba(232,86,27,0.2)",
                          color: "#E8561B",
                          flexShrink: 0,
                        }}
                      >
                        {form.companyType}
                      </span>
                    )}
                  </div>

                  <hr
                    style={{
                      border: "none",
                      borderTop: "1px solid #F0EDE9",
                      margin: "0 0 16px",
                    }}
                  />

                  {/* Product */}
                  <div style={{ marginBottom: 16 }}>
                    <SummaryLabel>Product</SummaryLabel>
                    {form.productName && (
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: "#0D0D0D",
                          margin: "0 0 4px",
                        }}
                      >
                        {form.productName}
                      </p>
                    )}
                    <SummaryText
                      value={form.productDescription}
                      placeholder="No description yet."
                    />
                  </div>

                  {/* Target Users */}
                  <div style={{ marginBottom: 16 }}>
                    <SummaryLabel>Target Users</SummaryLabel>
                    <SummaryText value={form.targetUsers} placeholder="—" />
                  </div>

                  {/* Goals */}
                  <div style={{ marginBottom: 16 }}>
                    <SummaryLabel>Goals</SummaryLabel>
                    <SummaryText value={form.goals} placeholder="—" />
                  </div>

                  {/* Constraints */}
                  <div>
                    <SummaryLabel>Constraints</SummaryLabel>
                    <SummaryText value={form.constraints} placeholder="—" />
                  </div>
                </>
              )}
            </div>
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
            After you <strong style={{ color: "#3a3530" }}>Save Context</strong>, this
            data is merged into pipeline runs as workspace + session context (plus Research and ingest from Sessions).
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
    </div>
  );
}
