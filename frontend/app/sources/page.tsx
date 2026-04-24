"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { useActiveSession } from "@/lib/active-session-context";
import {
  deleteSource,
  getSource,
  listSources,
  uploadSourceFiles,
  type SourceDetailResponse,
  type SourceFileRecord,
  type SourceScope,
} from "@/lib/api/sources";

const ACCEPTED_EXTENSIONS = ".txt,.pdf,.docx,.csv";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const pageShell: React.CSSProperties = {
  display: "flex",
  minHeight: "100vh",
  background: "#F8F4EF",
  color: "#0D0D0D",
  fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
};

const panelStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E4DDD4",
  borderRadius: 10,
};

const buttonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 8,
  padding: "0.65rem 0.9rem",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

function formatDate(iso?: string): string {
  if (!iso) return "Unknown";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusColor(status: SourceFileRecord["status"]) {
  if (status === "processed") return { bg: "#F0FDF4", color: "#15803D" };
  if (status === "failed") return { bg: "#FEF2F2", color: "#B91C1C" };
  if (status === "processing") return { bg: "#EFF6FF", color: "#2563EB" };
  return { bg: "#F8F4EF", color: "#6B6B6B" };
}

export default function SourcesPage() {
  const { activeSessionId } = useActiveSession();
  const [scope, setScope] = useState<SourceScope>(activeSessionId ? "session" : "global");
  const [sources, setSources] = useState<SourceFileRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SourceDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!activeSessionId && scope === "session") {
      setScope("global");
    }
  }, [activeSessionId, scope]);

  const sessionId = scope === "session" ? activeSessionId ?? undefined : undefined;
  const canUpload = scope === "global" || Boolean(activeSessionId);

  const loadSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listSources(scope, sessionId);
      setSources(rows);
      setSelectedId((prev) => {
        if (prev && rows.some((row) => row.id === prev)) return prev;
        return rows[0]?.id ?? null;
      });
    } catch (err) {
      setSources([]);
      setSelectedId(null);
      setError(err instanceof Error ? err.message : "Failed to load sources");
    } finally {
      setLoading(false);
    }
  }, [scope, sessionId]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    getSource(selectedId)
      .then((value) => {
        if (!cancelled) setDetail(value);
      })
      .catch((err) => {
        if (!cancelled) {
          setDetail(null);
          setError(err instanceof Error ? err.message : "Failed to load source detail");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedId) ?? null,
    [selectedId, sources]
  );

  function validateFiles(files: File[]): string | null {
    const allowed = new Set(["txt", "pdf", "docx", "csv"]);
    for (const file of files) {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!allowed.has(extension)) {
        return "Unsupported file type. Upload .txt, .pdf, .docx, or .csv.";
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return "File is too large. Each source must be 10MB or smaller.";
      }
    }
    return null;
  }

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    if (!canUpload) {
      setError("Select an active session before uploading session-scoped sources.");
      return;
    }
    const validationError = validateFiles(files);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadSourceFiles(files, scope, sessionId);
      await loadSources();
      setSelectedId(uploaded[0]?.source.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(sourceId: string) {
    setError(null);
    try {
      await deleteSource(sourceId);
      if (selectedId === sourceId) {
        setSelectedId(null);
        setDetail(null);
      }
      await loadSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete source");
    }
  }

  return (
    <div style={pageShell}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, padding: "2rem" }}>
        <header style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#E8561B", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Source Library
          </div>
          <h1 style={{ margin: "6px 0 6px", fontSize: 34, letterSpacing: 0, lineHeight: 1.1 }}>
            Upload source evidence
          </h1>
          <p style={{ margin: 0, color: "#6B6B6B", maxWidth: 720, fontSize: 15 }}>
            Add customer interviews and product usage data. Parsed evidence is stored in Supabase and included in pipeline runs.
          </p>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, alignItems: "start" }}>
          <div style={{ ...panelStyle, padding: 18 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {(["global", "session"] as SourceScope[]).map((option) => {
                const active = scope === option;
                const disabled = option === "session" && !activeSessionId;
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={disabled}
                    onClick={() => setScope(option)}
                    style={{
                      ...buttonStyle,
                      flex: 1,
                      background: active ? "#111111" : "#F8F4EF",
                      color: active ? "#FFFFFF" : disabled ? "#B8AEA4" : "#3A3530",
                      cursor: disabled ? "not-allowed" : "pointer",
                    }}
                  >
                    {option === "global" ? "Global" : "Session"}
                  </button>
                );
              })}
            </div>

            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                void handleFiles(event.dataTransfer.files);
              }}
              style={{
                border: `1.5px dashed ${dragActive ? "#E8561B" : "#D8CFC4"}`,
                borderRadius: 10,
                padding: "1.25rem",
                background: dragActive ? "#FFF7ED" : "#FBF8F4",
                textAlign: "center",
              }}
            >
              <input
                ref={inputRef}
                aria-label="Upload source files"
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                multiple
                onChange={(event) => void handleFiles(event.target.files ?? [])}
                style={{ display: "none" }}
              />
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
                Drop files here
              </div>
              <div style={{ color: "#6B6B6B", fontSize: 13, marginBottom: 14 }}>
                TXT, PDF, DOCX, and CSV files up to 10MB.
              </div>
              <button
                type="button"
                disabled={!canUpload || uploading}
                onClick={() => inputRef.current?.click()}
                style={{
                  ...buttonStyle,
                  background: canUpload ? "#E8561B" : "#E4DDD4",
                  color: canUpload ? "#FFFFFF" : "#8A8178",
                  cursor: canUpload ? "pointer" : "not-allowed",
                }}
              >
                {uploading ? "Uploading..." : "Choose files"}
              </button>
            </div>

            {scope === "session" && !activeSessionId && (
              <div style={{ marginTop: 12, color: "#B91C1C", fontSize: 13 }}>
                Select an active session before uploading session-scoped sources.
              </div>
            )}
            {error && (
              <div role="alert" style={{ marginTop: 12, color: "#B91C1C", fontSize: 13 }}>
                {error}
              </div>
            )}
          </div>

          <div style={{ ...panelStyle, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #EFE8DE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 15 }}>Sources</h2>
              <span style={{ color: "#9B9189", fontSize: 12 }}>{loading ? "Loading" : `${sources.length} total`}</span>
            </div>
            <div style={{ maxHeight: "calc(100vh - 220px)", overflowY: "auto" }}>
              {sources.length === 0 && !loading ? (
                <div style={{ padding: 18, color: "#6B6B6B", fontSize: 14 }}>
                  No sources uploaded for this scope yet.
                </div>
              ) : (
                sources.map((source) => {
                  const active = selectedId === source.id;
                  const colors = statusColor(source.status);
                  return (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => setSelectedId(source.id)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: 14,
                        border: "none",
                        borderBottom: "1px solid #F0EDE9",
                        background: active ? "#FFF7ED" : "#FFFFFF",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <strong style={{ fontSize: 14, overflowWrap: "anywhere" }}>
                          {source.filename}
                        </strong>
                        <span style={{ textTransform: "uppercase", fontSize: 11, color: "#9B9189" }}>
                          {source.fileType}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
                        <span style={{ borderRadius: 4, padding: "2px 7px", fontSize: 11, background: colors.bg, color: colors.color }}>
                          {source.status}
                        </span>
                        <span style={{ fontSize: 12, color: "#6B6B6B" }}>{formatDate(source.createdAt)}</span>
                        <span style={{ fontSize: 12, color: "#6B6B6B" }}>
                          {source.evidenceCount ?? 0} evidence
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ ...panelStyle, minHeight: 420, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #EFE8DE", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 15 }}>
                {selectedSource ? selectedSource.filename : "Source detail"}
              </h2>
              {selectedSource && (
                <button
                  type="button"
                  onClick={() => void handleDelete(selectedSource.id)}
                  style={{ ...buttonStyle, padding: "0.45rem 0.7rem", background: "#FEF2F2", color: "#B91C1C" }}
                >
                  Delete
                </button>
              )}
            </div>

            {!selectedSource ? (
              <div style={{ padding: 18, color: "#6B6B6B", fontSize: 14 }}>
                Select a source to inspect parsed text and evidence.
              </div>
            ) : (
              <div style={{ padding: 18, display: "grid", gap: 18 }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", color: "#6B6B6B", fontSize: 13 }}>
                  <span>{selectedSource.fileType.toUpperCase()}</span>
                  <span>{formatFileSize(selectedSource.fileSizeBytes)}</span>
                  <span>{selectedSource.evidenceCount ?? detail?.evidence.length ?? 0} evidence</span>
                </div>

                <section>
                  <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#6B6B6B" }}>Summary</h3>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
                    {detail?.source.summary || selectedSource.summary || selectedSource.errorMessage || "Summary is not available yet."}
                  </p>
                </section>

                <section>
                  <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#6B6B6B" }}>Parsed text preview</h3>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto", background: "#FBF8F4", border: "1px solid #EFE8DE", borderRadius: 8, padding: 12, fontSize: 12, lineHeight: 1.5, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    {(detail?.source.parsedText ?? selectedSource.parsedText ?? "No parsed text available.").slice(0, 4000)}
                  </pre>
                </section>

                <section>
                  <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#6B6B6B" }}>Evidence</h3>
                  <div style={{ display: "grid", gap: 10 }}>
                    {(detail?.evidence ?? []).length === 0 ? (
                      <div style={{ color: "#9B9189", fontSize: 13 }}>No evidence extracted yet.</div>
                    ) : (
                      (detail?.evidence ?? []).map((item) => (
                        <article key={item.id} style={{ background: "#FBF8F4", border: "1px solid #EFE8DE", borderRadius: 8, padding: 12 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                            <span style={{ textTransform: "uppercase", fontSize: 10, fontWeight: 700, color: "#E8561B" }}>
                              {item.evidenceType}
                            </span>
                            <strong style={{ fontSize: 13 }}>{item.title}</strong>
                          </div>
                          <p style={{ margin: 0, color: "#3A3530", fontSize: 13, lineHeight: 1.5 }}>
                            {item.content}
                          </p>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
