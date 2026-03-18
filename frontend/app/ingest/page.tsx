"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface IngestEntry {
  id: string;
  type: "interview" | "product_data";
  content: string;
  metadata: {
    user?: string;
    pain?: string;
    context?: string;
    metrics?: { dropOffRate?: string; activeUsers?: string };
  };
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const TEXTAREA_STYLE: React.CSSProperties = {
  width: "100%",
  minHeight: 200,
  padding: "0.75rem 1rem",
  background: "#FAFAF9",
  border: "1.5px solid #E4DDD4",
  borderRadius: 10,
  fontSize: "0.875rem",
  color: "#0D0D0D",
  outline: "none",
  resize: "vertical",
  fontFamily: "'DM Mono', 'Fira Mono', ui-monospace, monospace",
  lineHeight: 1.65,
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
};

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  background: "#FFFFFF",
  border: "1.5px solid #E4DDD4",
  borderRadius: 8,
  fontSize: "0.8125rem",
  color: "#0D0D0D",
  outline: "none",
  fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
};

function focusBorder(e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) {
  e.currentTarget.style.borderColor = "#E8561B";
  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,86,27,0.10)";
}
function blurBorder(e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) {
  e.currentTarget.style.borderColor = "#E4DDD4";
  e.currentTarget.style.boxShadow = "none";
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="text-[12px] font-medium block mb-1"
      style={{ color: "#6B6B6B" }}
    >
      {children}
    </label>
  );
}

function UploadZone({ label }: { label: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="w-full flex items-center gap-2.5 px-4 py-3 transition-colors duration-150"
      style={{
        border: "1.5px dashed #D4CDC5",
        borderRadius: 10,
        background: "transparent",
        cursor: "pointer",
        textAlign: "left",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.02)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#9a9085"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <span className="text-[12.5px]" style={{ color: "#9a9085" }}>
        {label}
      </span>
      <input ref={inputRef} type="file" className="hidden" tabIndex={-1} />
    </button>
  );
}

function RecentEntry({ entry }: { entry: IngestEntry }) {
  const typeLabel = entry.type === "interview" ? "Interview" : "Product Data";
  const typeColor = entry.type === "interview" ? "#E8561B" : "#8B5CF6";
  return (
    <div
      className="flex items-center gap-3 py-2.5"
      style={{ borderBottom: "1px solid #F0EAE1" }}
    >
      <span
        className="text-[10.5px] font-medium px-2 py-0.5 flex-shrink-0"
        style={{
          background: `${typeColor}12`,
          border: `1px solid ${typeColor}30`,
          borderRadius: 5,
          color: typeColor,
        }}
      >
        {typeLabel}
      </span>
      <p
        className="flex-1 text-[12.5px] truncate min-w-0"
        style={{ color: "#6B6B6B" }}
      >
        {entry.content.trim().slice(0, 100)}
      </p>
      <span className="text-[11.5px] flex-shrink-0" style={{ color: "#9a9085" }}>
        {relativeTime(entry.createdAt)}
      </span>
    </div>
  );
}

// ─── Ingest Page ──────────────────────────────────────────────────────────────

export default function IngestPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"interviews" | "product_data">("interviews");

  // Interview state
  const [interviewContent, setInterviewContent] = useState("");
  const [interviewMeta, setInterviewMeta] = useState({ user: "", pain: "", context: "" });

  // Product data state
  const [productContent, setProductContent] = useState("");
  const [productMeta, setProductMeta] = useState({ dropOffRate: "", activeUsers: "" });

  // Misc
  const [recentInputs, setRecentInputs] = useState<IngestEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ingest_entries");
      if (stored) setRecentInputs(JSON.parse(stored).slice(0, 3));
    } catch {
      // ignore
    }
  }, []);

  function handleContinue() {
    const content = activeTab === "interviews" ? interviewContent : productContent;
    if (!content.trim()) {
      setError("Please add some data before continuing.");
      return;
    }
    setError(null);

    const entry: IngestEntry = {
      id: Date.now().toString(),
      type: activeTab === "interviews" ? "interview" : "product_data",
      content,
      metadata:
        activeTab === "interviews"
          ? interviewMeta
          : { metrics: productMeta },
      createdAt: new Date().toISOString(),
    };

    try {
      const existing = JSON.parse(localStorage.getItem("ingest_entries") || "[]");
      localStorage.setItem(
        "ingest_entries",
        JSON.stringify([entry, ...existing].slice(0, 10))
      );
    } catch {
      // ignore storage errors
    }

    router.push("/problems");
  }

  const tabs: { id: "interviews" | "product_data"; label: string }[] = [
    { id: "interviews", label: "Customer Interviews" },
    { id: "product_data", label: "Product Data" },
  ];

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        background: "#F8F4EF",
        fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
      }}
    >
      {/* Sidebar */}
      <div className="h-full relative flex-shrink-0">
        <Sidebar />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className="flex items-center justify-between px-6 flex-shrink-0"
          style={{
            height: 52,
            background: "#FFFFFF",
            borderBottom: "1px solid #E4DDD4",
          }}
        >
          {/* Breadcrumb */}
          <div
            className="flex items-center gap-1.5 text-[13px]"
            style={{ color: "#6B6B6B" }}
          >
            <span>Signals</span>
            <span style={{ color: "#C0B8B0" }}>/</span>
            <span className="font-medium" style={{ color: "#0D0D0D" }}>
              Ingest
            </span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-150"
              style={{ color: "#6B6B6B" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(0,0,0,0.05)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
              aria-label="Search"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </button>

            <div style={{ width: 1, height: 20, background: "#E4DDD4" }} />

            <button
              className="flex items-center gap-2 px-2 py-1 rounded-lg transition-colors duration-150"
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(0,0,0,0.04)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0"
                style={{ background: "#E8561B" }}
              >
                Y
              </div>
              <span
                className="text-[13px] font-medium hidden sm:block"
                style={{ color: "#0D0D0D" }}
              >
                Yug
              </span>
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {/* Page heading */}
          <div className="mb-6 fade-up">
            <h1
              className="font-display"
              style={{
                fontSize: "1.625rem",
                fontWeight: 400,
                letterSpacing: "-0.02em",
                color: "#0D0D0D",
                lineHeight: 1.2,
              }}
            >
              Ingest Data.
            </h1>
            <p
              className="text-[13.5px] mt-1"
              style={{ color: "#6B6B6B", lineHeight: 1.6 }}
            >
              Add product data and user insights to continue.
            </p>
          </div>

          {/* Main card */}
          <div
            className="fade-up-1 rounded-2xl overflow-hidden"
            style={{
              background: "#FFFFFF",
              border: "1px solid #E4DDD4",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              maxWidth: 780,
            }}
          >
            {/* Tab strip */}
            <div
              className="flex items-center gap-0"
              style={{ borderBottom: "1px solid #E4DDD4" }}
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setError(null);
                    }}
                    className="px-5 py-3.5 text-[13px] transition-colors duration-150 relative"
                    style={{
                      color: isActive ? "#0D0D0D" : "#6B6B6B",
                      fontWeight: isActive ? 500 : 400,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                      borderBottom: isActive
                        ? "2px solid #E8561B"
                        : "2px solid transparent",
                      marginBottom: -1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.color = "#0D0D0D";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.color = "#6B6B6B";
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="p-5 flex flex-col gap-4">
              {activeTab === "interviews" ? (
                <>
                  {/* Main textarea */}
                  <div>
                    <FieldLabel>Interview Notes</FieldLabel>
                    <textarea
                      placeholder="Paste interview notes, transcripts, or feedback..."
                      value={interviewContent}
                      onChange={(e) => {
                        setInterviewContent(e.target.value);
                        if (error) setError(null);
                      }}
                      style={TEXTAREA_STYLE}
                      onFocus={focusBorder}
                      onBlur={blurBorder}
                      autoFocus
                    />
                  </div>

                  {/* Metadata row */}
                  <div>
                    <p
                      className="text-[11.5px] font-medium mb-2.5 uppercase tracking-[0.06em]"
                      style={{ color: "#9a9085" }}
                    >
                      Optional details
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <FieldLabel>User</FieldLabel>
                        <input
                          type="text"
                          placeholder="e.g. Sarah, PM at Acme"
                          value={interviewMeta.user}
                          onChange={(e) =>
                            setInterviewMeta((p) => ({
                              ...p,
                              user: e.target.value,
                            }))
                          }
                          style={INPUT_STYLE}
                          onFocus={focusBorder}
                          onBlur={blurBorder}
                        />
                      </div>
                      <div>
                        <FieldLabel>Pain</FieldLabel>
                        <input
                          type="text"
                          placeholder="e.g. slow onboarding"
                          value={interviewMeta.pain}
                          onChange={(e) =>
                            setInterviewMeta((p) => ({
                              ...p,
                              pain: e.target.value,
                            }))
                          }
                          style={INPUT_STYLE}
                          onFocus={focusBorder}
                          onBlur={blurBorder}
                        />
                      </div>
                      <div>
                        <FieldLabel>Context</FieldLabel>
                        <input
                          type="text"
                          placeholder="e.g. enterprise trial user"
                          value={interviewMeta.context}
                          onChange={(e) =>
                            setInterviewMeta((p) => ({
                              ...p,
                              context: e.target.value,
                            }))
                          }
                          style={INPUT_STYLE}
                          onFocus={focusBorder}
                          onBlur={blurBorder}
                        />
                      </div>
                    </div>
                  </div>

                  {/* File upload */}
                  <UploadZone label="Attach file (optional) — .txt, .md, .pdf" />
                </>
              ) : (
                <>
                  {/* JSON / raw textarea */}
                  <div>
                    <FieldLabel>Raw Data</FieldLabel>
                    <textarea
                      placeholder="Paste JSON, logs, or raw product data..."
                      value={productContent}
                      onChange={(e) => {
                        setProductContent(e.target.value);
                        if (error) setError(null);
                      }}
                      style={TEXTAREA_STYLE}
                      onFocus={focusBorder}
                      onBlur={blurBorder}
                      autoFocus
                    />
                  </div>

                  {/* CSV upload */}
                  <UploadZone label="Upload CSV (optional)" />

                  {/* Metrics row */}
                  <div>
                    <p
                      className="text-[11.5px] font-medium mb-2.5 uppercase tracking-[0.06em]"
                      style={{ color: "#9a9085" }}
                    >
                      Metrics (optional)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <FieldLabel>Drop-off Rate (%)</FieldLabel>
                        <input
                          type="number"
                          placeholder="e.g. 42"
                          min={0}
                          max={100}
                          value={productMeta.dropOffRate}
                          onChange={(e) =>
                            setProductMeta((p) => ({
                              ...p,
                              dropOffRate: e.target.value,
                            }))
                          }
                          style={INPUT_STYLE}
                          onFocus={focusBorder}
                          onBlur={blurBorder}
                        />
                      </div>
                      <div>
                        <FieldLabel>Active Users</FieldLabel>
                        <input
                          type="number"
                          placeholder="e.g. 1200"
                          min={0}
                          value={productMeta.activeUsers}
                          onChange={(e) =>
                            setProductMeta((p) => ({
                              ...p,
                              activeUsers: e.target.value,
                            }))
                          }
                          style={INPUT_STYLE}
                          onFocus={focusBorder}
                          onBlur={blurBorder}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Error */}
              {error && (
                <p className="text-[12px]" style={{ color: "#EF4444" }}>
                  {error}
                </p>
              )}

              {/* CTA */}
              <button
                onClick={handleContinue}
                className="btn-dark w-full mt-1"
                style={{
                  fontSize: "0.9375rem",
                  padding: "0.75rem 1.5rem",
                  borderRadius: 10,
                }}
              >
                Continue →
              </button>
            </div>
          </div>

          {/* Recent Inputs */}
          {recentInputs.length > 0 && (
            <div
              className="fade-up-2 mt-5 rounded-2xl p-5"
              style={{
                background: "#FFFFFF",
                border: "1px solid #E4DDD4",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                maxWidth: 780,
              }}
            >
              <h2
                className="text-[13px] font-semibold mb-1"
                style={{ color: "#0D0D0D" }}
              >
                Recent Inputs
              </h2>
              <p
                className="text-[12px] mb-3"
                style={{ color: "#9a9085" }}
              >
                Last {recentInputs.length} ingested{" "}
                {recentInputs.length === 1 ? "entry" : "entries"}
              </p>
              <div>
                {recentInputs.map((entry) => (
                  <RecentEntry key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
