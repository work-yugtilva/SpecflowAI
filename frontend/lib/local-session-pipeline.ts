"use client";

import type {
  SessionCreated,
  SessionDetail,
  SessionEvent,
  SessionRunResponse,
  SessionStateSnapshot,
} from "@/lib/api/session";
import type { PipelineInput } from "@/lib/pipeline-types";

const LS_SESSIONS = "specflow_sessions";
const LS_SESSION_STATE_MAP = "specflow_session_state_map";
const LS_SESSION_EVENTS_MAP = "specflow_session_events_map";

type StoredSession = {
  session_id: string;
  session_name?: string;
  status: string;
  created_at: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown>;
};

type SessionSnapshotState = NonNullable<SessionStateSnapshot["state"]>;

const STEP_ORDER = ["problems", "features", "decompose", "tasks"] as const;
type LocalStep = (typeof STEP_ORDER)[number];

const OUTPUT_KEY_BY_STEP: Record<LocalStep, string> = {
  problems: "problems",
  features: "features",
  decompose: "decompositions",
  tasks: "tasks",
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore localStorage failures */
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function slugToLabel(value: string, fallback: string): string {
  const cleaned = value
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s]/g, " ")
    .trim();
  if (!cleaned) return fallback;
  return cleaned
    .split(/\s+/)
    .slice(0, 6)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyValue(item))
      .filter(Boolean)
      .join(" ");
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.values(record)
      .map((item) => stringifyValue(item))
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

/** Field names that carry no semantic meaning for problem generation. */
const INGEST_BLOCKED_KEYS = new Set([
  "id", "type", "createdAt", "updatedAt", "timestamp", "sessionId",
]);

/**
 * Extracts only human-readable text from an ingest item.
 * Reads `content` directly; reads `metadata` selectively (skips IDs / dates).
 */
function extractIngestText(item: unknown): string {
  if (!item || typeof item !== "object") return "";
  const obj = item as Record<string, unknown>;
  const parts: string[] = [];

  if (typeof obj.content === "string" && obj.content.trim()) {
    parts.push(obj.content.trim());
  }

  if (obj.metadata && typeof obj.metadata === "object") {
    const meta = obj.metadata as Record<string, unknown>;
    for (const [key, val] of Object.entries(meta)) {
      if (!INGEST_BLOCKED_KEYS.has(key) && typeof val === "string" && val.trim()) {
        parts.push(val.trim());
      }
    }
  }

  return parts.join(". ");
}

function collectContextSnippets(inputData: PipelineInput): string[] {
  const contextParts = Object.entries(inputData.context ?? {}).map(
    ([key, value]) => `${slugToLabel(key, key)} ${stringifyValue(value)}`
  );
  const researchParts = (inputData.research ?? []).map((item) => stringifyValue(item));
  const ingestParts = (inputData.ingest ?? []).map((item) => extractIngestText(item));
  const merged = [...contextParts, ...researchParts, ...ingestParts]
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return Array.from(new Set(merged));
}

function buildProblemSeeds(inputData: PipelineInput): string[] {
  const snippets = collectContextSnippets(inputData).filter(
    (s) => s.length > 20 && !/^[a-f0-9-]{8,}$/i.test(s)
  );
  if (snippets.length > 0) return snippets.slice(0, 4);
  return [
    "handoffs across the workflow feel fragmented and hard to follow",
    "teams rely on manual tracking instead of a reliable spec workflow",
    "important context gets lost between discovery and delivery",
  ];
}

function ensureProblems(
  inputData: PipelineInput,
  outputs: Record<string, unknown>
): Array<Record<string, unknown>> {
  if (Array.isArray(outputs.problems) && outputs.problems.length > 0) {
    return outputs.problems as Array<Record<string, unknown>>;
  }

  return buildProblemSeeds(inputData).map((seed, index) => ({
    id: `p${index + 1}`,
    title: slugToLabel(seed, `Problem ${index + 1}`),
    summary: `Teams are running into ${seed}.`,
    confidence: 0.82 - index * 0.08,
    impact: index === 0 ? "High" : index === 1 ? "Medium" : "Low",
    frequency: 0.76 - index * 0.07,
    tags: ["workflow", "specflow", index % 2 === 0 ? "delivery" : "discovery"],
    sources: [seed],
    rootCause: {
      primary: `The current process does not make ${seed} visible early enough.`,
      secondary: "Signals, context, and execution are not consistently connected.",
    },
  }));
}

function ensureFeatures(
  inputData: PipelineInput,
  outputs: Record<string, unknown>
): Array<Record<string, unknown>> {
  if (Array.isArray(outputs.features) && outputs.features.length > 0) {
    return outputs.features as Array<Record<string, unknown>>;
  }

  return ensureProblems(inputData, outputs).slice(0, 4).map((problem, index) => ({
    id: `f${index + 1}`,
    title: problem.title ?? `Feature ${index + 1}`,
    description: `Create a focused workflow to resolve ${String(
      problem.summary ?? problem.title ?? "the identified issue"
    ).toLowerCase()}.`,
    linked_problems: [String(problem.id ?? `p${index + 1}`)],
    linked_items: [String(problem.id ?? `p${index + 1}`)],
    attributes: {
      impact: index === 0 ? 84 : index === 1 ? 68 : 52,
      effort: index === 0 ? 46 : index === 1 ? 54 : 61,
      confidence: 78 - index * 4,
      score: 82 - index * 6,
    },
    reasoning: {
      why_it_matters: `This feature gives teams a concrete way to address ${String(
        problem.title ?? "the problem"
      ).toLowerCase()}.`,
      summary: `Directly tied to ${String(problem.title ?? "the problem")}.`,
    },
    success_metrics: [
      "Reduce manual follow-up across the workflow",
      "Improve visibility into decision-making",
      "Shorten time from signal to execution",
    ],
    priority_tier: index === 0 ? "core" : "nice-to-have",
  }));
}

function ensureDecompositions(
  inputData: PipelineInput,
  outputs: Record<string, unknown>
): Array<Record<string, unknown>> {
  if (Array.isArray(outputs.decompositions) && outputs.decompositions.length > 0) {
    return outputs.decompositions as Array<Record<string, unknown>>;
  }

  return ensureFeatures(inputData, outputs).slice(0, 3).map((feature, index) => {
    const label = `Feature ${index + 1}`;
    return {
      [`${label} Surface`]: {
        structure: {
          elements: [
            `${label} dashboard`,
            `${label} detail panel`,
            `${label} action controls`,
          ],
          relationships: [
            `${label} Surface reads from ${label} API`,
            `${label} Surface updates session-backed workflow state`,
          ],
          behaviors: [
            `Display the current ${label.toLowerCase()} state`,
            `Allow the user to review and confirm outputs`,
            `Persist updates back into the active session`,
          ],
        },
      },
      [`${label} API`]: {
        structure: {
          elements: [
            `${label} endpoint`,
            "session storage adapter",
            "validation layer",
          ],
          relationships: [
            `${label} API depends on session persistence`,
            `${label} API publishes structured outputs for the next step`,
          ],
          behaviors: [
            `Validate ${label.toLowerCase()} requests`,
            "Store outputs in session state",
            "Return normalized data to the UI",
          ],
        },
      },
      metadata: {
        feature_title: feature.title,
      },
    };
  });
}

function ensureTasks(
  inputData: PipelineInput,
  outputs: Record<string, unknown>
): Array<Record<string, unknown>> {
  if (Array.isArray(outputs.tasks) && outputs.tasks.length > 0) {
    return outputs.tasks as Array<Record<string, unknown>>;
  }

  return ensureFeatures(inputData, outputs).slice(0, 3).flatMap((feature, index) => {
    const featureId = String(feature.id ?? `f${index + 1}`);
    const title = feature.title ? String(feature.title) : `Feature ${index + 1}`;
    return [
      {
        id: `t${index + 1}-${featureId}-fe`,
        title: `Build ${title} UI`,
        description: `Implement the interface and interaction flow for ${title}.`,
        layer: "frontend",
        status: "todo",
        priority: "High",
        subtasks: [
          { id: `t${index + 1}-${featureId}-fe-1`, title: "Create layout and states", done: false },
          { id: `t${index + 1}-${featureId}-fe-2`, title: "Connect actions to session data", done: false },
        ],
        dependencies: [],
      },
      {
        id: `t${index + 1}-${featureId}-api`,
        title: `Implement ${title} API`,
        description: `Expose the data and mutation paths needed by ${title}.`,
        layer: "api",
        status: "todo",
        priority: "Medium",
        subtasks: [
          { id: `t${index + 1}-${featureId}-api-1`, title: "Add request validation", done: false },
          { id: `t${index + 1}-${featureId}-api-2`, title: "Return normalized payloads", done: false },
        ],
        dependencies: [`Build ${title} UI`],
      },
      {
        id: `t${index + 1}-${featureId}-be`,
        title: `Persist ${title} state`,
        description: `Store outputs and workflow history for ${title}.`,
        layer: "backend",
        status: "todo",
        priority: "Medium",
        subtasks: [
          { id: `t${index + 1}-${featureId}-be-1`, title: "Save output snapshot", done: false },
          { id: `t${index + 1}-${featureId}-be-2`, title: "Track completion event", done: false },
        ],
        dependencies: [`Implement ${title} API`],
      },
      {
        id: `t${index + 1}-${featureId}-ops`,
        title: `Add ${title} observability`,
        description: `Capture the signals needed to validate ${title} in production.`,
        layer: "infrastructure",
        status: "todo",
        priority: "Low",
        subtasks: [
          { id: `t${index + 1}-${featureId}-ops-1`, title: "Add telemetry hooks", done: false },
          { id: `t${index + 1}-${featureId}-ops-2`, title: "Document validation checks", done: false },
        ],
        dependencies: [`Persist ${title} state`],
      },
    ];
  });
}

function buildStepOutput(
  step: LocalStep,
  inputData: PipelineInput,
  outputs: Record<string, unknown>
): unknown {
  switch (step) {
    case "problems":
      return ensureProblems(inputData, outputs);
    case "features":
      return ensureFeatures(inputData, outputs);
    case "decompose":
      return ensureDecompositions(inputData, outputs);
    case "tasks":
      return ensureTasks(inputData, outputs);
    default:
      return [];
  }
}

function readSessions(): StoredSession[] {
  return readJson<StoredSession[]>(LS_SESSIONS, []);
}

function writeSessions(sessions: StoredSession[]): void {
  writeJson(LS_SESSIONS, sessions);
}

function readStateMap(): Record<string, SessionStateSnapshot> {
  return readJson<Record<string, SessionStateSnapshot>>(LS_SESSION_STATE_MAP, {});
}

function writeStateMap(stateMap: Record<string, SessionStateSnapshot>): void {
  writeJson(LS_SESSION_STATE_MAP, stateMap);
}

function readEventsMap(): Record<string, SessionEvent[]> {
  return readJson<Record<string, SessionEvent[]>>(LS_SESSION_EVENTS_MAP, {});
}

function writeEventsMap(eventsMap: Record<string, SessionEvent[]>): void {
  writeJson(LS_SESSION_EVENTS_MAP, eventsMap);
}

function pushEvent(
  eventsMap: Record<string, SessionEvent[]>,
  sessionId: string,
  type: string,
  payload: Record<string, unknown>
): void {
  const nextEvent: SessionEvent = {
    id: makeId("evt"),
    session_id: sessionId,
    type,
    payload,
    timestamp: nowIso(),
  };
  eventsMap[sessionId] = [...(eventsMap[sessionId] ?? []), nextEvent];
}

function ensureSessionRecord(
  sessions: StoredSession[],
  sessionId: string
): { sessions: StoredSession[]; session: StoredSession; index: number } {
  const existingIndex = sessions.findIndex((item) => item.session_id === sessionId);
  if (existingIndex >= 0) {
    return {
      sessions,
      session: sessions[existingIndex],
      index: existingIndex,
    };
  }

  const createdAt = nowIso();
  const fallbackSession: StoredSession = {
    session_id: sessionId,
    session_name: `Session ${sessionId.slice(0, 8)}`,
    status: "active",
    created_at: createdAt,
    updated_at: createdAt,
    metadata: {},
  };
  const nextSessions = [fallbackSession, ...sessions];
  writeSessions(nextSessions);
  return {
    sessions: nextSessions,
    session: fallbackSession,
    index: 0,
  };
}

export async function createLocalSession(
  sessionName: string,
  metadata?: Record<string, unknown>
): Promise<SessionCreated> {
  const sessions = readSessions();
  const createdAt = nowIso();
  const sessionId = makeId("session");
  const nextSession: StoredSession = {
    session_id: sessionId,
    session_name: sessionName,
    status: "active",
    created_at: createdAt,
    updated_at: createdAt,
    metadata: metadata ?? {},
  };
  writeSessions([nextSession, ...sessions]);
  return {
    session_id: sessionId,
    session_name: sessionName,
    status: "active",
    created_at: createdAt,
  };
}

export async function getLocalSession(sessionId: string): Promise<SessionDetail> {
  const ensured = ensureSessionRecord(readSessions(), sessionId);
  const session = ensured.session;

  const stateMap = readStateMap();
  const snapshot = stateMap[sessionId];
  const eventsMap = readEventsMap();

  return {
    session: {
      id: session.session_id,
      session_name: session.session_name ?? `Session ${session.session_id.slice(0, 8)}`,
      status: session.status,
      metadata: session.metadata ?? {},
      created_at: session.created_at ?? nowIso(),
      updated_at: session.updated_at ?? session.created_at ?? nowIso(),
    },
    state: snapshot
      ? {
          session_id: sessionId,
          state: snapshot.state,
          step: snapshot.step,
        }
      : null,
    events: eventsMap[sessionId] ?? [],
  };
}

export async function runLocalSession(
  sessionId: string,
  inputData: Record<string, unknown>,
  requestedStep?: string
): Promise<SessionRunResponse> {
  const ensured = ensureSessionRecord(readSessions(), sessionId);
  const sessions = ensured.sessions;
  const sessionIndex = ensured.index;

  const step = (requestedStep ?? "problems") as LocalStep;
  const stepIndex = STEP_ORDER.indexOf(step);
  if (stepIndex === -1) {
    throw new Error(`Session API 400: Unknown pipeline step: ${requestedStep}`);
  }

  const pipelineInput = inputData as unknown as PipelineInput;
  const stateMap = readStateMap();
  const eventsMap = readEventsMap();
  const previousSnapshot = stateMap[sessionId]?.state ?? { outputs: {} };
  const outputs = clone((previousSnapshot.outputs ?? {}) as Record<string, unknown>);

  for (const downstreamStep of STEP_ORDER.slice(stepIndex)) {
    delete outputs[OUTPUT_KEY_BY_STEP[downstreamStep]];
  }

  if ((eventsMap[sessionId] ?? []).length === 0) {
    pushEvent(eventsMap, sessionId, "input", { input_data: pipelineInput });
  }

  const outputKey = OUTPUT_KEY_BY_STEP[step];
  const nextOutput = buildStepOutput(step, pipelineInput, outputs);
  outputs[outputKey] = nextOutput;

  const snapshotState: SessionSnapshotState = {
    last_completed_step: step,
    outputs,
  };
  stateMap[sessionId] = {
    session_id: sessionId,
    state: snapshotState,
    step,
  };

  pushEvent(eventsMap, sessionId, "agent_step", {
    agent: step,
    output_key: outputKey,
    status: "completed",
    data_keys:
      nextOutput && typeof nextOutput === "object" && !Array.isArray(nextOutput)
        ? Object.keys(nextOutput as Record<string, unknown>)
        : [],
  });

  const isComplete = step === "tasks";
  if (isComplete) {
    pushEvent(eventsMap, sessionId, "output", { keys: Object.keys(outputs) });
  }

  const updatedAt = nowIso();
  sessions[sessionIndex] = {
    ...sessions[sessionIndex],
    status: isComplete ? "completed" : "active",
    updated_at: updatedAt,
  };

  writeSessions(sessions);
  writeStateMap(stateMap);
  writeEventsMap(eventsMap);

  return {
    success: true,
    data: {
      ...pipelineInput,
      ...outputs,
    },
    session_state: snapshotState as Record<string, unknown>,
  };
}
