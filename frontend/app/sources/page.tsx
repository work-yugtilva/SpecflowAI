// FIX: source scoping fallback added — May 2026
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/ui/sidebar";
import { useActiveSession } from "@/lib/active-session-context";
import { getActiveSessionId } from "@/lib/pipeline-input";
import {
  createResearchEntry,
  deleteResearchEntry,
  fetchResearchEntries,
  updateResearchEntry,
  type ResearchEntryRecord,
  type ResearchType,
} from "@/lib/api/research";
import {
  deleteSource,
  getSource,
  listSources,
  uploadSourceFiles,
  type SourceDetailResponse,
  type SourceFileRecord,
  type SourceScope,
  type SourceUploadResponse,
} from "@/lib/api/sources";

const ACCEPTED_EXTENSIONS = ".txt,.pdf,.docx,.csv";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const RESEARCH_TYPES: ResearchType[] = [
  "Interview",
  "Survey",
  "Analytics",
  "Market Insight",
];

type ResearchEntry = ResearchEntryRecord;

interface ResearchFormState {
  type: ResearchType;
  title: string;
  content: string;
  user: string;
  pain: string;
  context: string;
  tagsRaw: string;
  metricName: string;
  metricValue: string;
  metricBaseline: string;
  metricUnit: string;
  timePeriod: string;
  dataSource: string;
}

const EMPTY_RESEARCH_FORM: ResearchFormState = {
  type: "Interview",
  title: "",
  content: "",
  user: "",
  pain: "",
  context: "",
  tagsRaw: "",
  metricName: "",
  metricValue: "",
  metricBaseline: "",
  metricUnit: "",
  timePeriod: "",
  dataSource: "",
};

const TYPE_COLORS: Record<ResearchType, { bg: string; color: string }> = {
  Interview: { bg: "#EFF6FF", color: "#3B82F6" },
  Survey: { bg: "#F5F3FF", color: "#7C3AED" },
  Analytics: { bg: "#FFF7ED", color: "#D97706" },
  "Market Insight": { bg: "#F0FDF4", color: "#16A34A" },
};

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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.875rem",
  background: "#FFFFFF",
  border: "1.5px solid #E4DDD4",
  borderRadius: 8,
  fontSize: "0.875rem",
  color: "#0D0D0D",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
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

function formatUploadFileCount(count: number): string {
  return count === 1 ? "1 file" : `${count} files`;
}

function formatUploadFailures(uploaded: SourceUploadResponse[]): string {
  return uploaded
    .map(({ source }) => {
      const reason = source.errorMessage || source.summary || "Unable to parse file";
      return `${source.filename}: ${reason}`;
    })
    .join("; ");
}

function TypeBadge({ type }: { type: ResearchType }) {
  const colors = TYPE_COLORS[type];
  return (
    <span style={{ borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 600, background: colors.bg, color: colors.color, whiteSpace: "nowrap" }}>
      {type}
    </span>
  );
}

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, color: "#6B6B6B", fontSize: 12, fontWeight: 600 }}>
      {children}
      {optional && <span style={{ color: "#B8AEA4", fontWeight: 400 }}>optional</span>}
    </label>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ margin: "16px 0 6px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9B9189" }}>
      {children}
    </div>
  );
}

export default function SourcesPage() {
  const { activeSessionId } = useActiveSession();
  const [scope, setScope] = useState<SourceScope>(activeSessionId ? "session" : "global");
  const [sources, setSources] = useState<SourceFileRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SourceDetailResponse | null>(null);
  const [researchEntries, setResearchEntries] = useState<ResearchEntry[]>([]);
  const [selectedResearchId, setSelectedResearchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [researchLoading, setResearchLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [sourceMessage, setSourceMessage] = useState<string | null>(null);
  const [researchMessage, setResearchMessage] = useState<string | null>(null);
  const [showResearchModal, setShowResearchModal] = useState(false);
  const [researchSaving, setResearchSaving] = useState(false);
  const [deletingResearchId, setDeletingResearchId] = useState<string | null>(null);
  const [editingResearchId, setEditingResearchId] = useState<string | null>(null);
  const [researchForm, setResearchForm] = useState<ResearchFormState>(EMPTY_RESEARCH_FORM);
  const [researchFormError, setResearchFormError] = useState(false);
  const [confirmResearchDeleteId, setConfirmResearchDeleteId] = useState<string | null>(null);
  const [showSlackModal, setShowSlackModal] = useState(false);
  const [slackChannels, setSlackChannels] = useState<Array<{ id: string; name: string }>>([]);
  const [slackChannelsLoading, setSlackChannelsLoading] = useState(false);
  const [slackSelectedIds, setSlackSelectedIds] = useState<Set<string>>(new Set());
  const [slackImporting, setSlackImporting] = useState(false);
  const [slackImportMsg, setSlackImportMsg] = useState<string | null>(null);
  const [slackError, setSlackError] = useState<string | null>(null);
  const [slackNotConnected, setSlackNotConnected] = useState(false);
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

  const loadResearch = useCallback(async () => {
    setResearchLoading(true);
    setResearchError(null);
    try {
      const rows = await fetchResearchEntries(scope, sessionId);
      setResearchEntries(rows);
      setSelectedResearchId((prev) => {
        if (prev && rows.some((row) => row.id === prev)) return prev;
        return rows[0]?.id ?? null;
      });
    } catch (err) {
      setResearchEntries([]);
      setSelectedResearchId(null);
      setResearchError(err instanceof Error ? err.message : "Failed to load research");
    } finally {
      setResearchLoading(false);
    }
  }, [scope, sessionId]);

  useEffect(() => {
    void loadResearch();
  }, [loadResearch]);

  const selectedResearch = useMemo(
    () => researchEntries.find((entry) => entry.id === selectedResearchId) ?? null,
    [selectedResearchId, researchEntries]
  );

  function updateResearchForm(field: keyof ResearchFormState, value: string) {
    setResearchForm((prev) => ({ ...prev, [field]: value }));
    if (researchFormError) setResearchFormError(false);
  }

  function openAddResearch() {
    setResearchForm(EMPTY_RESEARCH_FORM);
    setEditingResearchId(null);
    setResearchFormError(false);
    setShowResearchModal(true);
  }

  function openEditResearch(entry: ResearchEntry) {
    setResearchForm({
      type: entry.type,
      title: entry.title,
      content: entry.content,
      user: entry.user,
      pain: entry.pain,
      context: entry.context,
      tagsRaw: entry.tags.join(", "),
      metricName: entry.metricName ?? "",
      metricValue: entry.metricValue != null ? String(entry.metricValue) : "",
      metricBaseline: entry.metricBaseline != null ? String(entry.metricBaseline) : "",
      metricUnit: entry.metricUnit ?? "",
      timePeriod: entry.timePeriod ?? "",
      dataSource: entry.dataSource ?? "",
    });
    setEditingResearchId(entry.id);
    setResearchFormError(false);
    setShowResearchModal(true);
  }

  function closeResearchModal() {
    setShowResearchModal(false);
    setEditingResearchId(null);
    setResearchFormError(false);
  }

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
    const latestActiveSessionId = getActiveSessionId() ?? activeSessionId;
    const uploadSessionId =
      scope === "session" ? latestActiveSessionId ?? undefined : undefined;
    if (scope === "session" && !uploadSessionId) {
      setError("Select an active session before uploading session-scoped sources.");
      setSourceMessage(null);
      return;
    }
    const validationError = validateFiles(files);
    if (validationError) {
      setError(validationError);
      setSourceMessage(null);
      return;
    }

    setUploading(true);
    setError(null);
    setSourceMessage(null);
    try {
      const uploaded = await uploadSourceFiles(files, scope, uploadSessionId);
      await loadSources();
      setSelectedId(uploaded[0]?.source.id ?? null);
      const failedUploads = uploaded.filter(({ source }) => source.status === "failed");
      const completedUploads = uploaded.filter(({ source }) => source.status !== "failed");

      if (failedUploads.length > 0 && failedUploads.length === uploaded.length) {
        setError(`Upload failed to parse: ${formatUploadFailures(failedUploads)}`);
        setSourceMessage(null);
        return;
      }

      if (completedUploads.length > 0) {
        setSourceMessage(`Uploaded ${formatUploadFileCount(completedUploads.length)}`);
      }
      if (failedUploads.length > 0) {
        setError(`Some files failed to parse: ${formatUploadFailures(failedUploads)}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setSourceMessage(null);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(sourceId: string) {
    if (deletingSourceId) return;
    setDeletingSourceId(sourceId);
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
    } finally {
      setDeletingSourceId(null);
    }
  }

  async function handleResearchSave() {
    if (researchSaving) return;
    if (!researchForm.title.trim() || !researchForm.content.trim()) {
      setResearchFormError(true);
      return;
    }

    setResearchSaving(true);
    setResearchError(null);
    setResearchMessage(null);
    const payload = {
      type: researchForm.type,
      title: researchForm.title,
      content: researchForm.content,
      user: researchForm.user,
      pain: researchForm.pain,
      context: researchForm.context,
      tags: researchForm.tagsRaw
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      ...(researchForm.type === "Analytics" && {
        metricName: researchForm.metricName || undefined,
        metricValue: researchForm.metricValue ? Number.parseFloat(researchForm.metricValue) : undefined,
        metricBaseline: researchForm.metricBaseline ? Number.parseFloat(researchForm.metricBaseline) : undefined,
        metricUnit: researchForm.metricUnit || undefined,
        timePeriod: researchForm.timePeriod || undefined,
        dataSource: researchForm.dataSource || undefined,
      }),
    };

    try {
      let savedId: string;
      if (editingResearchId) {
        const updated = await updateResearchEntry(editingResearchId, payload);
        savedId = updated.id;
      } else {
        const created = await createResearchEntry(scope, payload, sessionId);
        savedId = created.id;
      }
      await loadResearch();
      setSelectedResearchId(savedId);
      setResearchMessage("Research entry saved");
      closeResearchModal();
    } catch (err) {
      setResearchError(err instanceof Error ? err.message : "Failed to save research entry");
      setResearchMessage(null);
    } finally {
      setResearchSaving(false);
    }
  }

  async function handleResearchDelete(id: string) {
    if (deletingResearchId) return;
    setDeletingResearchId(id);
    setResearchError(null);
    try {
      await deleteResearchEntry(id);
      const remaining = researchEntries.filter((entry) => entry.id !== id);
      setResearchEntries(remaining);
      if (selectedResearchId === id) {
        setSelectedResearchId(remaining[0]?.id ?? null);
      }
      setConfirmResearchDeleteId(null);
    } catch (err) {
      setResearchError(err instanceof Error ? err.message : "Failed to delete research entry");
    } finally {
      setDeletingResearchId(null);
    }
  }

  async function openSlackModal() {
    if (slackChannelsLoading) return;
    setSlackNotConnected(false);
    setSlackImportMsg(null);
    setSlackError(null);
    setSlackChannelsLoading(true);
    setSlackChannels([]);
    setSlackSelectedIds(new Set());

    try {
      const res = await fetch("/api/slack/channels");
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { code?: string };
        if (body.code === "slack_not_connected") setSlackNotConnected(true);
        else setSlackError("Failed to load Slack channels. Please try again.");
        return;
      }
      const data = (await res.json()) as { channels?: Array<{ id: string; name: string }> };
      setSlackChannels(data.channels ?? []);
      setShowSlackModal(true);
    } catch {
      setSlackError("Failed to load Slack channels. Please try again.");
    } finally {
      setSlackChannelsLoading(false);
    }
  }

  function closeSlackModal() {
    setShowSlackModal(false);
    setSlackSelectedIds(new Set());
  }

  function toggleSlackChannel(id: string) {
    setSlackSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSlackImport() {
    if (slackSelectedIds.size === 0 || slackImporting) return;
    setSlackImporting(true);
    setSlackError(null);
    let totalImported = 0;
    let failedImports = 0;

    for (const channel of slackChannels.filter((item) => slackSelectedIds.has(item.id))) {
      try {
        const res = await fetch("/api/slack/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel_id: channel.id,
            channel_name: channel.name,
            ...(scope === "session" && activeSessionId ? { session_id: activeSessionId } : {}),
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { imported?: number };
          totalImported += data.imported ?? 0;
        } else {
          const body = (await res.json().catch(() => ({}))) as { code?: string };
          if (body.code === "slack_not_connected") {
            setSlackNotConnected(true);
            closeSlackModal();
            setSlackImporting(false);
            return;
          }
          failedImports += 1;
        }
      } catch {
        failedImports += 1;
      }
    }

    await loadResearch().catch(() => {});
    setSlackImporting(false);
    closeSlackModal();
    if (failedImports > 0 && totalImported === 0) {
      setSlackError("Failed to import Slack messages. Please try again.");
      return;
    }
    const label = totalImported === 1 ? "1 message" : `${totalImported} messages`;
    setSlackImportMsg(`Imported ${label}`);
    setTimeout(() => setSlackImportMsg(null), 3000);
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
            Sources
          </h1>
          <p style={{ margin: 0, color: "#6B6B6B", maxWidth: 720, fontSize: 15 }}>
            Manage reference links, uploaded evidence, and long-form research in one library for pipeline runs.
          </p>
        </header>

        <section style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "end", marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: "0 0 4px", fontSize: 20, letterSpacing: 0 }}>References & Links</h2>
              <p style={{ margin: 0, color: "#6B6B6B", fontSize: 13 }}>
                Short-form citations, uploaded documents, and extracted evidence.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, alignItems: "start" }}>
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
              {scope === "session" && activeSessionId ? (
                <div className="text-xs text-muted-foreground mb-2">
                  Uploading to session:{" "}
                  <span className="font-mono font-medium">
                    {activeSessionId.slice(0, 8)}
                  </span>
                </div>
              ) : scope === "global" && activeSessionId ? (
                <div className="text-xs text-muted-foreground mb-2">
                  Uploading globally — sources will be available as fallback.
                </div>
              ) : (
                <div className="text-xs text-amber-600 mb-2">
                  No active session — sources will be stored globally.
                </div>
              )}
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
            {sourceMessage && (
              <div role="status" style={{ marginTop: 12, color: "#15803D", fontSize: 13 }}>
                {sourceMessage}
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
                  aria-label={`Delete source ${selectedSource.filename}`}
                  onClick={() => void handleDelete(selectedSource.id)}
                  disabled={deletingSourceId === selectedSource.id}
                  style={{ ...buttonStyle, padding: "0.45rem 0.7rem", background: "#FEF2F2", color: "#B91C1C", cursor: deletingSourceId === selectedSource.id ? "not-allowed" : "pointer", opacity: deletingSourceId === selectedSource.id ? 0.65 : 1 }}
                >
                  {deletingSourceId === selectedSource.id ? "Deleting..." : "Delete"}
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
          </div>
        </section>

        <section style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "end", marginBottom: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: "0 0 4px", fontSize: 20, letterSpacing: 0 }}>Research & Articles</h2>
              <p style={{ margin: 0, color: "#6B6B6B", fontSize: 13 }}>
                Longer-form notes, articles, and reading material that shape product decisions.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => void openSlackModal()}
                disabled={slackChannelsLoading}
                style={{ ...buttonStyle, background: "#FFFFFF", color: slackChannelsLoading ? "#B8AEA4" : "#6B6B6B", border: "1px solid #E4DDD4" }}
              >
                {slackChannelsLoading ? "Loading..." : "Import from Slack"}
              </button>
              <button
                type="button"
                onClick={openAddResearch}
                style={{ ...buttonStyle, background: "#111111", color: "#FFFFFF" }}
              >
                Add Research
              </button>
            </div>
          </div>

          {researchError && (
            <div role="alert" style={{ marginBottom: 12, color: "#B91C1C", fontSize: 13 }}>
              {researchError}
            </div>
          )}
          {researchMessage && (
            <div role="status" style={{ marginBottom: 12, color: "#15803D", fontSize: 13 }}>
              {researchMessage}
            </div>
          )}
          {slackNotConnected && (
            <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(74,21,75,0.12)", background: "rgba(74,21,75,0.05)", color: "#6B6B6B", fontSize: 13 }}>
              Connect Slack in{" "}
              <Link href="/settings/integrations" style={{ color: "#E8561B", fontWeight: 700, textDecoration: "none" }}>
                Settings → Integrations
              </Link>{" "}
              to import messages.
            </div>
          )}
          {slackError && (
            <div role="alert" style={{ marginBottom: 12, color: "#EF4444", fontSize: 13 }}>
              {slackError}
            </div>
          )}
          {slackImportMsg && (
            <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(22,163,74,0.18)", background: "rgba(22,163,74,0.07)", color: "#15803D", fontSize: 13 }}>
              {slackImportMsg}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, alignItems: "start" }}>
            <div style={{ ...panelStyle, overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid #EFE8DE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>Reading list</h3>
                <span style={{ color: "#9B9189", fontSize: 12 }}>{researchLoading ? "Loading" : `${researchEntries.length} total`}</span>
              </div>
              <div style={{ maxHeight: 420, overflowY: "auto" }}>
                {researchEntries.length === 0 && !researchLoading ? (
                  <div style={{ padding: 18, color: "#6B6B6B", fontSize: 14 }}>
                    No research or articles added for this scope yet.
                  </div>
                ) : (
                  researchEntries.map((entry) => {
                    const active = entry.id === selectedResearchId;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => {
                          setSelectedResearchId(entry.id);
                          setConfirmResearchDeleteId(null);
                        }}
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
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                          <strong style={{ fontSize: 14, lineHeight: 1.35, overflowWrap: "anywhere" }}>{entry.title}</strong>
                          <TypeBadge type={entry.type} />
                        </div>
                        <p style={{ margin: "8px 0 0", color: "#6B6B6B", fontSize: 12.5, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {entry.content}
                        </p>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, color: "#9B9189", fontSize: 12 }}>
                          {entry.user && <span>{entry.user}</span>}
                          <span>{formatDate(entry.createdAt ?? entry.updatedAt)}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div style={{ ...panelStyle, minHeight: 420, overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid #EFE8DE", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>
                  {selectedResearch ? selectedResearch.title : "Research detail"}
                </h3>
                {selectedResearch && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button type="button" onClick={() => openEditResearch(selectedResearch)} style={{ ...buttonStyle, padding: "0.45rem 0.7rem", background: "#FFFFFF", color: "#3A3530", border: "1px solid #E4DDD4" }}>
                      Edit
                    </button>
                    {confirmResearchDeleteId === selectedResearch.id ? (
                      <>
                        <button type="button" onClick={() => void handleResearchDelete(selectedResearch.id)} disabled={deletingResearchId === selectedResearch.id} style={{ ...buttonStyle, padding: "0.45rem 0.7rem", background: "#FEF2F2", color: "#B91C1C", cursor: deletingResearchId === selectedResearch.id ? "not-allowed" : "pointer", opacity: deletingResearchId === selectedResearch.id ? 0.65 : 1 }}>
                          {deletingResearchId === selectedResearch.id ? "Deleting..." : "Confirm"}
                        </button>
                        <button type="button" onClick={() => setConfirmResearchDeleteId(null)} style={{ ...buttonStyle, padding: "0.45rem 0.7rem", background: "#F8F4EF", color: "#6B6B6B" }}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button type="button" aria-label={`Delete research ${selectedResearch.title}`} onClick={() => setConfirmResearchDeleteId(selectedResearch.id)} style={{ ...buttonStyle, padding: "0.45rem 0.7rem", background: "#FEF2F2", color: "#B91C1C" }}>
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!selectedResearch ? (
                <div style={{ padding: 18, color: "#6B6B6B", fontSize: 14 }}>
                  Select a research entry to inspect the key insight and source context.
                </div>
              ) : (
                <div style={{ padding: 18 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
                    <TypeBadge type={selectedResearch.type} />
                    <span style={{ color: "#9B9189", fontSize: 12 }}>
                      {formatDate(selectedResearch.createdAt ?? selectedResearch.updatedAt)}
                    </span>
                    {selectedResearch.tags.map((tag) => (
                      <span key={tag} style={{ borderRadius: 4, padding: "2px 7px", fontSize: 11, color: "#6B6B6B", background: "#F0EDE9" }}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  <SectionLabel>Key Insight</SectionLabel>
                  <p style={{ margin: 0, color: "#3A3530", fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                    {selectedResearch.content}
                  </p>

                  {(selectedResearch.user || selectedResearch.pain || selectedResearch.context) && (
                    <>
                      {selectedResearch.user && (
                        <>
                          <SectionLabel>Author / Source</SectionLabel>
                          <p style={{ margin: 0, color: "#3A3530", fontSize: 13, lineHeight: 1.55 }}>{selectedResearch.user}</p>
                        </>
                      )}
                      {selectedResearch.pain && (
                        <>
                          <SectionLabel>Pain Point</SectionLabel>
                          <p style={{ margin: 0, color: "#3A3530", fontSize: 13, lineHeight: 1.55 }}>{selectedResearch.pain}</p>
                        </>
                      )}
                      {selectedResearch.context && (
                        <>
                          <SectionLabel>Context / Link</SectionLabel>
                          <p style={{ margin: 0, color: "#3A3530", fontSize: 13, lineHeight: 1.55 }}>{selectedResearch.context}</p>
                        </>
                      )}
                    </>
                  )}

                  {selectedResearch.type === "Analytics" &&
                    (selectedResearch.metricName ||
                      selectedResearch.metricValue != null ||
                      selectedResearch.metricBaseline != null ||
                      selectedResearch.metricUnit ||
                      selectedResearch.timePeriod ||
                      selectedResearch.dataSource) && (
                      <>
                        <SectionLabel>Analytics Metric</SectionLabel>
                        <div style={{ display: "grid", gap: 6, color: "#3A3530", fontSize: 13 }}>
                          {selectedResearch.metricName && <span>Metric: {selectedResearch.metricName}</span>}
                          {(selectedResearch.metricValue != null || selectedResearch.metricBaseline != null) && (
                            <span>
                              Value:{" "}
                              {selectedResearch.metricValue != null
                                ? `${selectedResearch.metricValue}${selectedResearch.metricUnit ? ` ${selectedResearch.metricUnit}` : ""}`
                                : ""}
                              {selectedResearch.metricValue != null && selectedResearch.metricBaseline != null ? " | " : ""}
                              {selectedResearch.metricBaseline != null
                                ? `baseline ${selectedResearch.metricBaseline}${selectedResearch.metricUnit ? ` ${selectedResearch.metricUnit}` : ""}`
                                : ""}
                            </span>
                          )}
                          {selectedResearch.timePeriod && <span>Period: {selectedResearch.timePeriod}</span>}
                          {selectedResearch.dataSource && <span>Data source: {selectedResearch.dataSource}</span>}
                        </div>
                      </>
                    )}
                </div>
              )}
            </div>
          </div>
        </section>

        {showSlackModal && (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}
            onClick={(event) => {
              if (event.target === event.currentTarget) closeSlackModal();
            }}
          >
            <div style={{ background: "#FFFFFF", borderRadius: 12, width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto", padding: "24px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 17 }}>Import from Slack</h3>
                <button type="button" onClick={closeSlackModal} style={{ ...buttonStyle, padding: "0.35rem 0.55rem", background: "#F8F4EF", color: "#6B6B6B" }}>
                  Close
                </button>
              </div>
              {slackChannels.length === 0 ? (
                <p style={{ margin: 0, color: "#6B6B6B", fontSize: 13 }}>No channels found.</p>
              ) : (
                <>
                  <p style={{ margin: "0 0 14px", color: "#6B6B6B", fontSize: 13, lineHeight: 1.5 }}>
                    Select channels to import the latest messages as research entries.
                  </p>
                  <div style={{ display: "grid", gap: 4, marginBottom: 18 }}>
                    {slackChannels.slice(0, 20).map((channel) => {
                      const checked = slackSelectedIds.has(channel.id);
                      return (
                        <label key={channel.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: checked ? "1px solid rgba(232,86,27,0.18)" : "1px solid transparent", background: checked ? "rgba(232,86,27,0.05)" : "transparent", cursor: "pointer" }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleSlackChannel(channel.id)} style={{ accentColor: "#E8561B" }} />
                          <span style={{ fontSize: 13, color: "#0D0D0D" }}># {channel.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button type="button" onClick={closeSlackModal} style={{ ...buttonStyle, background: "#FFFFFF", color: "#6B6B6B", border: "1px solid #E4DDD4" }}>
                      Cancel
                    </button>
                    <button type="button" onClick={() => void handleSlackImport()} disabled={slackSelectedIds.size === 0 || slackImporting} style={{ ...buttonStyle, background: slackSelectedIds.size === 0 || slackImporting ? "#C8C2BB" : "#111111", color: "#FFFFFF", cursor: slackSelectedIds.size === 0 || slackImporting ? "not-allowed" : "pointer" }}>
                      {slackImporting ? "Importing..." : slackSelectedIds.size > 0 ? `Import Selected (${slackSelectedIds.size})` : "Import Selected"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {showResearchModal && (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}
            onClick={(event) => {
              if (event.target === event.currentTarget) closeResearchModal();
            }}
          >
            <div style={{ background: "#FFFFFF", borderRadius: 12, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", padding: "24px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 18 }}>
                <h3 style={{ margin: 0, fontSize: 17 }}>{editingResearchId ? "Edit Research" : "Add Research"}</h3>
                <button type="button" onClick={closeResearchModal} style={{ ...buttonStyle, padding: "0.35rem 0.55rem", background: "#F8F4EF", color: "#6B6B6B" }}>
                  Close
                </button>
              </div>

              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <FieldLabel>Type</FieldLabel>
                  <select value={researchForm.type} onChange={(event) => updateResearchForm("type", event.target.value as ResearchType)} style={inputStyle}>
                    {RESEARCH_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>
                    Title
                    {researchFormError && !researchForm.title.trim() && <span style={{ color: "#B91C1C", fontSize: 11 }}>required</span>}
                  </FieldLabel>
                  <input type="text" placeholder="e.g., User interview with Sarah K." value={researchForm.title} onChange={(event) => updateResearchForm("title", event.target.value)} style={{ ...inputStyle, borderColor: researchFormError && !researchForm.title.trim() ? "#B91C1C" : "#E4DDD4" }} />
                </div>
                <div>
                  <FieldLabel>
                    Key Insight
                    {researchFormError && !researchForm.content.trim() && <span style={{ color: "#B91C1C", fontSize: 11 }}>required</span>}
                  </FieldLabel>
                  <textarea placeholder="Summarize the research findings, observations, or data..." value={researchForm.content} onChange={(event) => updateResearchForm("content", event.target.value)} style={{ ...inputStyle, minHeight: 100, resize: "vertical", lineHeight: 1.6, borderColor: researchFormError && !researchForm.content.trim() ? "#B91C1C" : "#E4DDD4" }} />
                </div>

                {researchForm.type === "Analytics" && (
                  <div style={{ display: "grid", gap: 12, padding: 12, border: "1px solid #EFE8DE", borderRadius: 8, background: "#FBF8F4" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#D97706", letterSpacing: "0.08em", textTransform: "uppercase" }}>Analytics Metric</div>
                    <input type="text" aria-label="Metric Name" placeholder='Metric name, e.g. "30-day activation rate"' value={researchForm.metricName} onChange={(event) => updateResearchForm("metricName", event.target.value)} style={inputStyle} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <input type="number" aria-label="Current Value" placeholder="Current value" value={researchForm.metricValue} onChange={(event) => updateResearchForm("metricValue", event.target.value)} style={inputStyle} />
                      <input type="number" aria-label="Baseline Value" placeholder="Baseline value" value={researchForm.metricBaseline} onChange={(event) => updateResearchForm("metricBaseline", event.target.value)} style={inputStyle} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      <input type="text" aria-label="Unit" placeholder="Unit" value={researchForm.metricUnit} onChange={(event) => updateResearchForm("metricUnit", event.target.value)} style={inputStyle} />
                      <input type="text" aria-label="Time Period" placeholder="Time period" value={researchForm.timePeriod} onChange={(event) => updateResearchForm("timePeriod", event.target.value)} style={inputStyle} />
                      <input type="text" aria-label="Data Source" placeholder="Data source" value={researchForm.dataSource} onChange={(event) => updateResearchForm("dataSource", event.target.value)} style={inputStyle} />
                    </div>
                  </div>
                )}

                <div>
                  <FieldLabel optional>Author / Source</FieldLabel>
                  <input type="text" placeholder="e.g., Andrew Miklas" value={researchForm.user} onChange={(event) => updateResearchForm("user", event.target.value)} style={inputStyle} />
                </div>
                <div>
                  <FieldLabel optional>Pain Point</FieldLabel>
                  <input type="text" placeholder="e.g., Discovery context is scattered across tools" value={researchForm.pain} onChange={(event) => updateResearchForm("pain", event.target.value)} style={inputStyle} />
                </div>
                <div>
                  <FieldLabel optional>Context / Link</FieldLabel>
                  <textarea placeholder="e.g., Article URL or source context" value={researchForm.context} onChange={(event) => updateResearchForm("context", event.target.value)} style={{ ...inputStyle, minHeight: 64, resize: "vertical", lineHeight: 1.6 }} />
                </div>
                <div>
                  <FieldLabel optional>Tags</FieldLabel>
                  <input type="text" placeholder="e.g., pm, discovery, prd (comma-separated)" value={researchForm.tagsRaw} onChange={(event) => updateResearchForm("tagsRaw", event.target.value)} style={inputStyle} />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
                  <button type="button" onClick={closeResearchModal} style={{ ...buttonStyle, background: "#FFFFFF", color: "#6B6B6B", border: "1px solid #E4DDD4" }}>
                    Cancel
                  </button>
                  <button type="button" onClick={() => void handleResearchSave()} disabled={researchSaving} style={{ ...buttonStyle, background: researchSaving ? "#C8C2BB" : "#111111", color: "#FFFFFF", cursor: researchSaving ? "not-allowed" : "pointer" }}>
                    {researchSaving ? "Saving..." : editingResearchId ? "Save Changes" : "Add Entry"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
