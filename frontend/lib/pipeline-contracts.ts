export interface QualityGateItemResult {
  index: number;
  binary_checks: Record<string, boolean>;
  quality_issues: string[];
  quality_flag: "binary_fail" | null;
}

export interface QualityGateResult {
  score: number;
  passed: boolean;
  critical_issues?: string[];
  item_scores?: Array<Record<string, unknown>>;
  items?: QualityGateItemResult[];
}

export interface PipelineOutputs {
  [key: string]: unknown;
  product_context?: Record<string, unknown>;
  context?: Record<string, unknown>;
  research?: unknown[];
  ingest?: unknown[];
  problems?: unknown;
  problems_quality?: QualityGateResult;
  features?: unknown;
  features_quality?: QualityGateResult;
  decompositions?: unknown;
  decompositions_quality?: QualityGateResult;
  tasks?: unknown;
  tasks_quality?: QualityGateResult;
  prd?: unknown;
}

export interface ResearchEvidence {
  title: string;
  content: string;
  source: string;
}

export interface ProblemViewModel {
  id: string;
  title: string;
  summary: string;
  confidence: number | null;
  impact: "High" | "Medium" | "Low";
  frequency: number;
  tags: string[];
  signals: number;
  evidence: string[];
  rootCause: {
    primary: string;
    secondary?: string;
  };
  source_ids?: string[];
  citation_confidence?: string;
  researchEvidence?: ResearchEvidence[];
}

export interface FeatureViewModel {
  id: string;
  title: string;
  description: string;
  linkedProblemId: string;
  linkedProblemTitle: string;
  impact: "High" | "Medium" | "Low";
  effort: "Low" | "Medium" | "High";
  confidence: number;
  score: number;
  reasoning: string;
  successMetrics: string[];
  source_ids?: string[];
  citation_confidence?: string;
  researchEvidence?: ResearchEvidence[];
}

export interface UIComponentViewModel {
  id: string;
  name: string;
  type: "Screen" | "Modal" | "Component" | "Form" | "Navigation";
  description: string;
  elements: string[];
  researchEvidence?: ResearchEvidence[];
}

export interface DataFieldViewModel {
  name: string;
  type: string;
  required: boolean;
}

export interface DataEntityViewModel {
  id: string;
  name: string;
  fields: DataFieldViewModel[];
  researchEvidence?: ResearchEvidence[];
}

export interface WorkflowStepViewModel {
  step: number;
  title: string;
  description: string;
  actor: "User" | "System" | "API" | "Background";
  outputs: string[];
  researchEvidence?: ResearchEvidence[];
}

export interface DecompositionViewModel {
  featureTitle: string;
  linkedProblem: string;
  uiComponents: UIComponentViewModel[];
  dataEntities: DataEntityViewModel[];
  workflowSteps: WorkflowStepViewModel[];
  researchEvidence?: ResearchEvidence[];
}

export type TaskStatus = "todo" | "in-progress" | "done";
export type TaskType = "Frontend" | "Backend" | "API" | "Infrastructure";

export interface TaskStepViewModel {
  id: string;
  title: string;
  done: boolean;
}

export interface TaskViewModel {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: "High" | "Medium" | "Low";
  steps: TaskStepViewModel[];
  dependencies: string[];
  qualityFlag?: string;
  qualityIssues?: string[];
  source_ids?: string[];
  citation_confidence?: string;
  researchEvidence?: ResearchEvidence[];
}

type SessionStateLike = Record<string, unknown> | null | undefined;
type JsonRecord = Record<string, unknown>;

function isPlainObject(x: unknown): x is JsonRecord {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function coalesceOutput(
  data: Record<string, unknown>,
  sessionState: SessionStateLike,
  key: keyof PipelineOutputs
): unknown {
  const fromData = data[key as string];
  const fromNested = (data as { outputs?: PipelineOutputs }).outputs?.[key];
  const fromSession =
    sessionState &&
    typeof sessionState === "object" &&
    ((sessionState as { outputs?: PipelineOutputs }).outputs?.[key] ??
      (sessionState as PipelineOutputs)[key]);

  if (fromData !== undefined && fromData !== null) return fromData;
  if (fromNested !== undefined && fromNested !== null) return fromNested;
  if (fromSession !== undefined && fromSession !== null) return fromSession;
  return undefined;
}

function firstArray(...candidates: unknown[]): JsonRecord[] | null {
  for (const candidate of candidates) {
    if (
      Array.isArray(candidate) &&
      candidate.every((item) => typeof item === "object" && item !== null)
    ) {
      return candidate as JsonRecord[];
    }
  }
  return null;
}

function collectListsOfObjects(node: unknown, depth: number, acc: JsonRecord[][]): void {
  if (depth > 14) return;

  if (Array.isArray(node)) {
    if (
      node.length > 0 &&
      node.every((item) => isPlainObject(item)) &&
      !node.some((item) => "error" in item)
    ) {
      acc.push(node as JsonRecord[]);
    }

    for (const item of node) {
      if (isPlainObject(item) || Array.isArray(item)) {
        collectListsOfObjects(item, depth + 1, acc);
      }
    }
    return;
  }

  if (isPlainObject(node)) {
    if ("error" in node) return;
    for (const value of Object.values(node)) {
      collectListsOfObjects(value, depth + 1, acc);
    }
  }
}

function discoverLongestObjectList(root: unknown): JsonRecord[] {
  const buckets: JsonRecord[][] = [];
  collectListsOfObjects(root, 0, buckets);
  if (buckets.length === 0) return [];
  return buckets.reduce((best, current) =>
    current.length > best.length ? current : best
  );
}

function normalizeScore(value: unknown): number {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  if (numeric > 1 && numeric <= 10) return numeric / 10;
  if (numeric > 10) return numeric / 100;
  return numeric;
}

function toProblemImpact(value: unknown): ProblemViewModel["impact"] {
  if (!value) return "Medium";
  const normalized = String(value).toLowerCase();
  if (normalized === "high" || Number(value) >= 7) return "High";
  if (normalized === "low" || Number(value) <= 3) return "Low";
  return "Medium";
}

function numericToImpact(value: number): FeatureViewModel["impact"] {
  if (value >= 70) return "High";
  if (value >= 40) return "Medium";
  return "Low";
}

function numericToEffort(value: number): FeatureViewModel["effort"] {
  if (value >= 70) return "High";
  if (value >= 40) return "Medium";
  return "Low";
}

function normalizeLevel<T extends string>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  return `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}` as T;
}

function isLikelySingleProblemRecord(record: JsonRecord): boolean {
  if ("error" in record) return false;
  const title = record.title ?? record.name;
  if (typeof title !== "string" || !title.trim()) return false;
  return [
    "summary",
    "description",
    "time_cost",
    "error_risk",
    "user_frustration",
    "desired_outcome",
    "cluster",
    "sources",
    "attributes",
    "metadata",
  ].some((key) => key in record);
}

function unwrapProblemRows(raw: unknown, data: Record<string, unknown>): JsonRecord[] {
  if (typeof raw === "string") {
    try {
      return unwrapProblemRows(JSON.parse(raw), data);
    } catch {
      return [];
    }
  }

  if (Array.isArray(raw)) {
    if (raw.length > 0 && raw.every((item) => typeof item === "string")) {
      return raw.map((item) => ({
        title: (item || "").slice(0, 240),
        summary: item || "",
      }));
    }
    return raw.filter(isPlainObject);
  }

  if (isPlainObject(raw)) {
    if (isLikelySingleProblemRecord(raw)) return [raw];

    const nested = firstArray(
      raw.problems,
      raw.items,
      raw.identified_problems,
      raw.problem_list,
      raw.issues,
      raw.pain_points,
      raw.data,
      raw.results,
      raw.value
    );
    if (nested) return unwrapProblemRows(nested, data);

    if (isPlainObject(raw.data)) {
      const inner = firstArray(raw.data.items, raw.data.problems);
      if (inner) return unwrapProblemRows(inner, data);
    }

    const discovered = discoverLongestObjectList(raw);
    if (discovered.length > 0) return discovered;
  }

  const top = firstArray(
    (data as { items?: unknown[] }).items,
    (data as { identified_problems?: unknown[] }).identified_problems,
    (data as { problems?: unknown[] }).problems
  );

  return top ? unwrapProblemRows(top, data) : [];
}

export function describeProblemsEmptyState(
  data: Record<string, unknown>,
  sessionState?: SessionStateLike
): string {
  const coalesced = coalesceOutput(data, sessionState, "problems");
  const problems = coalesced !== undefined ? coalesced : data.problems;

  if (isPlainObject(problems) && "error" in problems) {
    const tail = problems.raw != null ? ` ${String(problems.raw).slice(0, 280)}` : "";
    return `The model did not return valid JSON (${String(problems.error)}).${tail}`;
  }
  if (Array.isArray(problems) && problems.length === 0) {
    return "The model returned an empty list. Add more context and research for this session, then try again.";
  }
  if (problems === undefined || problems === null) {
    return "No problems output was found in the API response. Confirm NEXT_PUBLIC_PIPELINE_URL matches the workflow API and check its logs.";
  }

  const keys = isPlainObject(problems)
    ? Object.keys(problems).slice(0, 12).join(", ")
    : "";

  return keys
    ? `Could not extract a list of problems from the model output (saw keys: ${keys}). Check pipeline logs or simplify the JSON shape.`
    : "Problems were returned in a shape we could not map to cards. Check pipeline logs.";
}

function extractResearchEvidence(raw: unknown): ResearchEvidence[] {
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return [];
    const sourceMatch = text.match(/^\[Source:\s*([^\]]+)\]\s*([\s\S]*)$/);
    if (sourceMatch) {
      return [
        {
          title: sourceMatch[1].trim(),
          content: sourceMatch[2].trim(),
          source: "Uploaded source",
        },
      ].filter((item) => item.title !== "" || item.content !== "");
    }
    return [{ title: "Research evidence", content: text, source: "Source" }];
  }
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .filter(isPlainObject)
    .map((item) => ({
      title: typeof item.title === "string" ? item.title : "",
      content: typeof item.content === "string" ? item.content : "",
      source: typeof item.source === "string" ? item.source : "",
    }))
    .filter((item) => item.title !== "" || item.content !== "");
}

export function adaptProblems(
  data: Record<string, unknown>,
  sessionState?: SessionStateLike
): ProblemViewModel[] {
  const rawProblems = coalesceOutput(data, sessionState, "problems");
  const merged = rawProblems !== undefined ? { ...data, problems: rawProblems } : data;
  let rows = unwrapProblemRows(merged.problems, merged);
  if (rows.length === 0) {
    rows = discoverLongestObjectList(merged.problems);
  }

  return rows.map((record, index) => {
    const attributes = isPlainObject(record.attributes) ? record.attributes : {};
    const rootCause = isPlainObject(record.rootCause) ? record.rootCause : {};
    const confidence = attributes.confidence ?? record.confidence;
    const frequency = attributes.frequency ?? record.frequency;
    const sourceIds = Array.isArray(record.source_ids)
      ? record.source_ids.map(String)
      : [];
    const sources = Array.isArray(record.sources)
      ? record.sources.map(String)
      : Array.isArray(record.evidence)
        ? record.evidence.map(String)
        : [];
    const evidence = sourceIds.length > 0 ? sourceIds : sources;

    return {
      id: typeof record.id === "string" ? record.id : `p${index}`,
      title:
        (typeof record.title === "string" && record.title) ||
        (typeof record.name === "string" && record.name) ||
        `Problem ${index + 1}`,
      summary:
        (typeof record.summary === "string" && record.summary) ||
        (typeof record.description === "string" && record.description) ||
        "",
      confidence:
        confidence != null ? Math.round(normalizeScore(confidence) * 100) : null,
      impact: toProblemImpact(attributes.impact ?? record.impact ?? record.severity),
      frequency: Math.round(normalizeScore(frequency) * 100),
      tags: Array.isArray(record.tags)
        ? record.tags.map(String)
        : typeof record.cluster === "string" && record.cluster
          ? [record.cluster]
          : [],
      signals: evidence.length,
      evidence,
      rootCause: {
        primary:
          (typeof rootCause.primary === "string" && rootCause.primary) ||
          (typeof record.primary === "string" && record.primary) ||
          (typeof record.summary === "string" && record.summary) ||
          "",
        secondary:
          (typeof rootCause.secondary === "string" && rootCause.secondary) ||
          (typeof record.secondary === "string" ? record.secondary : undefined),
      },
      source_ids: sourceIds.length > 0 ? sourceIds : undefined,
      citation_confidence: typeof record.citation_confidence === "string" ? record.citation_confidence : undefined,
      researchEvidence: extractResearchEvidence(record.research_evidence),
    };
  });
}

function isLikelySingleFeatureRecord(record: JsonRecord): boolean {
  if ("error" in record) return false;
  const title = record.title ?? record.name;
  if (typeof title !== "string" || !title.trim()) return false;
  return [
    "description",
    "summary",
    "linked_problems",
    "linked_items",
    "priority_tier",
    "success_metrics",
    "attributes",
    "reasoning",
    "metadata",
  ].some((key) => key in record);
}

function unwrapFeatureRows(raw: unknown, data: Record<string, unknown>): JsonRecord[] {
  if (typeof raw === "string") {
    try {
      return unwrapFeatureRows(JSON.parse(raw), data);
    } catch {
      return [];
    }
  }

  if (Array.isArray(raw)) {
    if (raw.length > 0 && raw.every((item) => typeof item === "string")) {
      return raw.map((item) => ({
        title: (item || "").slice(0, 240),
        description: item || "",
        linked_problems: [],
      }));
    }
    return raw.filter(isPlainObject);
  }

  if (isPlainObject(raw)) {
    if (isLikelySingleFeatureRecord(raw)) return [raw];
    const nested = firstArray(
      raw.features,
      raw.items,
      raw.capabilities,
      raw.results,
      raw.product_features,
      raw.data,
      raw.value
    );
    if (nested) return unwrapFeatureRows(nested, data);
    if (isPlainObject(raw.data)) {
      const inner = firstArray(raw.data.items, raw.data.features);
      if (inner) return unwrapFeatureRows(inner, data);
    }
    const discovered = discoverLongestObjectList(raw);
    if (discovered.length > 0) return discovered;
  }

  const top = firstArray(
    (data as { features?: unknown[] }).features,
    (data as { items?: unknown[] }).items
  );

  return top ? unwrapFeatureRows(top, data) : [];
}

export function describeFeaturesEmptyState(
  data: Record<string, unknown>,
  sessionState?: SessionStateLike
): string {
  const coalesced = coalesceOutput(data, sessionState, "features");
  const features = coalesced !== undefined ? coalesced : data.features;

  if (isPlainObject(features) && "error" in features) {
    const tail = features.raw != null ? ` ${String(features.raw).slice(0, 280)}` : "";
    return `The model did not return valid JSON (${String(features.error)}).${tail}`;
  }
  if (Array.isArray(features) && features.length === 0) {
    return "The model returned an empty feature list. Run Problems for this session first, then try Features again.";
  }
  if (features === undefined || features === null) {
    return "No features output was found in the API response. Confirm NEXT_PUBLIC_PIPELINE_URL matches the workflow API.";
  }

  const keys = isPlainObject(features)
    ? Object.keys(features).slice(0, 12).join(", ")
    : "";

  return keys
    ? `Could not extract a list of features from the model output (saw keys: ${keys}).`
    : "Could not map features from the pipeline response.";
}

export function adaptFeatures(
  data: Record<string, unknown>,
  sessionState?: SessionStateLike
): FeatureViewModel[] {
  const rawFeatures = coalesceOutput(data, sessionState, "features");
  const merged = rawFeatures !== undefined ? { ...data, features: rawFeatures } : data;
  let rows = unwrapFeatureRows(merged.features, merged);
  if (rows.length === 0) {
    rows = discoverLongestObjectList(merged.features);
  }

  const problemsRaw = coalesceOutput(merged, sessionState, "problems");
  const problems = Array.isArray(problemsRaw)
    ? problemsRaw.filter(isPlainObject)
    : Array.isArray(merged.problems)
      ? merged.problems.filter(isPlainObject)
      : [];

  return rows.map((item, index) => {
    const attrs = isPlainObject(item.attributes) ? item.attributes : item;
    const reasoning = isPlainObject(item.reasoning) ? item.reasoning : item.reasoning;
    const linkedItems = Array.isArray(item.linked_items)
      ? item.linked_items.map(String)
      : [];
    const linkedTitles = Array.isArray(item.linked_problems)
      ? item.linked_problems.map(String)
      : [];

    let linkedProblem: JsonRecord = {};
    if (linkedTitles.length > 0) {
      const match = problems.find((problem) =>
        linkedTitles.includes(String(problem.title ?? ""))
      );
      if (match) linkedProblem = match;
    }
    if (!linkedProblem.title && problems[index]) linkedProblem = problems[index];
    if (!linkedProblem.title && problems[0]) linkedProblem = problems[0];

    const impactRaw = attrs.impact ?? item.impact ?? item.priority ?? 50;
    const effortRaw = attrs.effort ?? item.effort ?? 50;
    const impact =
      typeof impactRaw === "string"
        ? normalizeLevel<FeatureViewModel["impact"]>(impactRaw, "Medium")
        : numericToImpact(Number(impactRaw));
    const effort =
      typeof effortRaw === "string"
        ? normalizeLevel<FeatureViewModel["effort"]>(effortRaw, "Medium")
        : numericToEffort(Number(effortRaw));

    const reasoningText =
      typeof reasoning === "string"
        ? reasoning
        : isPlainObject(reasoning)
          ? String(
              reasoning.why_it_matters ??
                reasoning.summary ??
                item.user_problem_it_solves ??
                item.reasoning ??
                ""
            )
          : String(item.reasoning ?? item.user_problem_it_solves ?? "");

    const successMetrics = Array.isArray(item.success_metrics)
      ? item.success_metrics.map(String)
      : isPlainObject(reasoning) && Array.isArray(reasoning.tradeoffs)
        ? reasoning.tradeoffs.map(String)
        : [];

    return {
      id: typeof item.id === "string" ? item.id : `f${index}`,
      title:
        (typeof item.title === "string" && item.title) ||
        (typeof item.name === "string" && item.name) ||
        `Feature ${index + 1}`,
      description:
        (typeof item.description === "string" && item.description) ||
        (typeof item.summary === "string" && item.summary) ||
        "",
      linkedProblemId:
        linkedProblem.id != null
          ? String(linkedProblem.id)
          : String(linkedItems[0] ?? `p${index}`),
      linkedProblemTitle: String(
        linkedProblem.title ??
          linkedProblem.summary ??
          linkedItems[0] ??
          linkedTitles[0] ??
          ""
      ),
      impact,
      effort,
      confidence: Number(attrs.confidence ?? item.confidence ?? 70),
      score: Number(attrs.score ?? item.score ?? 70),
      reasoning: reasoningText,
      successMetrics,
      source_ids: Array.isArray(item.source_ids) ? item.source_ids.map(String) : undefined,
      citation_confidence: typeof item.citation_confidence === "string" ? item.citation_confidence : undefined,
      researchEvidence: extractResearchEvidence(item.research_evidence),
    };
  });
}

export function adaptDecomposition(
  data: Record<string, unknown>,
  sessionState?: SessionStateLike
): DecompositionViewModel | null {
  const rawDecompositions = coalesceOutput(data, sessionState, "decompositions");
  const rawProblems = coalesceOutput(data, sessionState, "problems");
  const rawFeatures = coalesceOutput(data, sessionState, "features");

  const problems = Array.isArray(rawProblems)
    ? rawProblems.filter(isPlainObject)
    : Array.isArray(data.problems)
      ? data.problems.filter(isPlainObject)
      : [];
  const features = Array.isArray(rawFeatures)
    ? rawFeatures.filter(isPlainObject)
    : Array.isArray(data.features)
      ? data.features.filter(isPlainObject)
      : [];

  const rawDecomps = Array.isArray(rawDecompositions)
    ? rawDecompositions
    : Array.isArray(data.decompositions)
      ? data.decompositions
      : [];
  const allDecomps = rawDecomps.flat().filter(isPlainObject);
  const firstDecomp = allDecomps[0] ?? {};

  if (allDecomps.length === 0) {
    return null;
  }

  const isFlat = "layer" in firstDecomp;

  if (isFlat) {
    const uiComponents: UIComponentViewModel[] = allDecomps
      .filter((component) => component.layer === "ui")
      .map((component, index) => ({
        id: String(component.id ?? `ui${index}`),
        name: String(component.title ?? `Component ${index + 1}`),
        type: "Component",
        description: String(component.description ?? ""),
        elements: [],
        researchEvidence: extractResearchEvidence(component.research_evidence),
      }));

    const dataEntities: DataEntityViewModel[] = allDecomps
      .filter((component) => component.layer === "system")
      .map((component, index) => ({
        id: String(component.id ?? `d${index}`),
        name: String(component.title ?? `Entity ${index + 1}`),
        fields: [],
        researchEvidence: extractResearchEvidence(component.research_evidence),
      }));

    const workflowSteps: WorkflowStepViewModel[] = allDecomps
      .filter((component) => component.layer === "backend")
      .map((component, index) => ({
        step: index + 1,
        title: String(component.title ?? `Step ${index + 1}`),
        description: String(component.description ?? ""),
        actor: "API",
        outputs: [],
        researchEvidence: extractResearchEvidence(component.research_evidence),
      }));

    return {
      featureTitle: String(
        features[0]?.title ?? features[0]?.name ?? "Generated Feature"
      ),
      linkedProblem: String(
        problems[0]?.title ?? problems[0]?.summary ?? ""
      ),
      uiComponents: uiComponents.slice(0, 8),
      dataEntities: dataEntities.slice(0, 6),
      workflowSteps,
      researchEvidence: extractResearchEvidence((allDecomps[0] as Record<string, unknown>)?.research_evidence),
    };
  }

  const componentKeys = Object.keys(firstDecomp).filter(
    (key) =>
      key !== "metadata" &&
      isPlainObject(firstDecomp[key])
  );

  const uiComponents: UIComponentViewModel[] = componentKeys.map((name, index) => {
    const inner = firstDecomp[name] as JsonRecord;
    const structure = isPlainObject(inner.structure)
      ? inner.structure
      : inner;
    const elements = Array.isArray(structure.elements)
      ? structure.elements.map(String)
      : [];
    return {
      id: `ui${index}`,
      name,
      type: "Component",
      description: elements.slice(0, 2).join(", "),
      elements,
      researchEvidence: extractResearchEvidence(inner.research_evidence),
    };
  });

  const dataEntities: DataEntityViewModel[] = componentKeys
    .map<DataEntityViewModel | null>((name, index) => {
      const inner = firstDecomp[name] as JsonRecord;
      const structure = isPlainObject(inner.structure)
        ? inner.structure
        : inner;
      const relationships = Array.isArray(structure.relationships)
        ? structure.relationships
        : [];
      if (relationships.length === 0) return null;
      const fields: DataFieldViewModel[] = relationships.map((relationship) => ({
        name:
          typeof relationship === "string"
            ? relationship.split(" ")[0]
            : String((relationship as JsonRecord).name ?? "relation"),
        type:
          typeof relationship === "string"
            ? relationship
            : String((relationship as JsonRecord).type ?? "relationship"),
        required: false,
      }));
      return {
        id: `d${index}`,
        name,
        fields,
        researchEvidence: extractResearchEvidence(inner.research_evidence),
      };
    })
    .filter((entity): entity is DataEntityViewModel => entity !== null);

  const workflowSteps: WorkflowStepViewModel[] = [];
  let step = 1;
  for (const name of componentKeys) {
    const inner = firstDecomp[name] as JsonRecord;
    const structure = isPlainObject(inner.structure)
      ? inner.structure
      : inner;
    const behaviors = Array.isArray(structure.behaviors)
      ? structure.behaviors
      : [];
    for (const behavior of behaviors) {
      workflowSteps.push({
        step,
        title:
          typeof behavior === "string"
            ? behavior
            : String((behavior as JsonRecord).title ?? `Step ${step}`),
        description:
          typeof behavior === "string"
            ? behavior
            : String((behavior as JsonRecord).description ?? ""),
        actor: "System",
        outputs: [],
        researchEvidence: extractResearchEvidence((inner as JsonRecord).research_evidence),
      });
      step += 1;
      if (workflowSteps.length >= 8) break;
    }
    if (workflowSteps.length >= 8) break;
  }

  return {
    featureTitle: String(
      features[0]?.title ??
        features[0]?.name ??
        componentKeys[0] ??
        "Generated Feature"
    ),
    linkedProblem: String(problems[0]?.title ?? problems[0]?.summary ?? ""),
    uiComponents: uiComponents.slice(0, 8),
    dataEntities: dataEntities.slice(0, 6),
    workflowSteps,
    researchEvidence: extractResearchEvidence((allDecomps[0] as Record<string, unknown>)?.research_evidence),
  };
}

const TASK_TYPE_MAP: Record<string, TaskType> = {
  frontend: "Frontend",
  ui: "Frontend",
  component: "Frontend",
  backend: "Backend",
  service: "Backend",
  logic: "Backend",
  api: "API",
  endpoint: "API",
  route: "API",
  infrastructure: "Infrastructure",
  infra: "Infrastructure",
  devops: "Infrastructure",
};

function toTaskType(value: unknown): TaskType {
  if (!value) return "Backend";
  const normalized = String(value).toLowerCase();
  for (const [key, type] of Object.entries(TASK_TYPE_MAP)) {
    if (normalized.includes(key)) return type;
  }
  return "Backend";
}

function toTaskPriority(value: unknown): TaskViewModel["priority"] {
  if (value == null || value === "") return "Medium";
  if (typeof value === "number") {
    if (value >= 7) return "High";
    if (value <= 3) return "Low";
    return "Medium";
  }
  const normalized = String(value).toLowerCase();
  if (normalized === "high" || normalized === "critical") return "High";
  if (normalized === "low") return "Low";
  return "Medium";
}

function extractFromGroupMap(map: JsonRecord): JsonRecord[] {
  const output: JsonRecord[] = [];
  for (const value of Object.values(map)) {
    if (isPlainObject(value)) {
      if (Array.isArray(value.tasks)) {
        output.push(...value.tasks.filter(isPlainObject));
        continue;
      }
    }
    if (Array.isArray(value)) {
      output.push(...value.filter(isPlainObject));
    }
  }
  return output;
}

function extractTaskRows(rawTasks: unknown): JsonRecord[] {
  if (rawTasks == null) return [];

  if (isPlainObject(rawTasks)) {
    if (Array.isArray(rawTasks.tasks)) {
      return rawTasks.tasks.filter(isPlainObject);
    }
    if (Array.isArray(rawTasks.items)) {
      return rawTasks.items.filter(isPlainObject);
    }
    if (isPlainObject(rawTasks.groups)) {
      return extractFromGroupMap(rawTasks.groups);
    }
    const fromMap = extractFromGroupMap(rawTasks);
    if (fromMap.length > 0) return fromMap;

    const titled =
      (typeof rawTasks.title === "string" && rawTasks.title.trim() !== "") ||
      (typeof rawTasks.name === "string" && rawTasks.name.trim() !== "") ||
      (typeof rawTasks.description === "string" &&
        rawTasks.description.trim() !== "");
    return titled ? [rawTasks] : [];
  }

  if (!Array.isArray(rawTasks)) return [];

  const output: JsonRecord[] = [];
  for (const item of rawTasks) {
    if (!isPlainObject(item)) continue;

    const titled =
      (typeof item.title === "string" && item.title.trim() !== "") ||
      (typeof item.name === "string" && item.name.trim() !== "");
    const summaryOnly =
      (typeof item.description === "string" && item.description.trim() !== "") ||
      (typeof item.summary === "string" && item.summary.trim() !== "");

    if (titled || (summaryOnly && Array.isArray(item.subtasks || item.steps))) {
      output.push(item);
      continue;
    }

    if (isPlainObject(item.groups)) {
      output.push(...extractFromGroupMap(item.groups));
      continue;
    }

    const fromValues = extractFromGroupMap(item);
    if (fromValues.length > 0) {
      output.push(...fromValues);
      continue;
    }

    if (Array.isArray(item.tasks)) {
      output.push(...item.tasks.filter(isPlainObject));
    }
  }

  return output;
}

export function adaptTasks(
  data: Record<string, unknown>,
  sessionState?: SessionStateLike
): TaskViewModel[] {
  const rawTasks = coalesceOutput(data, sessionState, "tasks");
  const rows = extractTaskRows(rawTasks ?? data.tasks);

  return rows.map((item, index) => {
    const attrs = isPlainObject(item.attributes) ? item.attributes : undefined;
    const stepSource = Array.isArray(item.subtasks)
      ? item.subtasks
      : Array.isArray(item.steps)
        ? item.steps
        : attrs && Array.isArray(attrs.subtasks)
          ? attrs.subtasks
          : attrs && Array.isArray(attrs.steps)
            ? attrs.steps
            : Array.isArray(item.action_items)
              ? item.action_items
              : [];

    const steps = stepSource.map((step, stepIndex) => {
      const record = isPlainObject(step) ? step : {};
      return {
        id: String(record.id ?? `${index}-s${stepIndex}`),
        title: String(
          record.title ?? record.name ?? record.description ?? `Step ${stepIndex + 1}`
        ),
        done: Boolean(record.done ?? record.completed ?? false),
      };
    });

    return {
      id: String(item.id ?? `t${index}`),
      title: String(item.title ?? item.name ?? `Task ${index + 1}`),
      description: String(
        item.description ??
          item.summary ??
          (typeof attrs?.description === "string" ? attrs.description : "") ??
          ""
      ),
      type: toTaskType(
        item.type ?? item.layer ?? item.category ?? attrs?.layer ?? attrs?.category
      ),
      status: (["todo", "in-progress", "done"].includes(String(item.status))
        ? String(item.status)
        : "todo") as TaskStatus,
      priority: toTaskPriority(
        item.priority ?? attrs?.priority ?? attrs?.complexity
      ),
      steps,
      dependencies: Array.isArray(item.dependencies)
        ? item.dependencies.map(String)
        : Array.isArray(attrs?.dependencies)
          ? attrs.dependencies.map(String)
          : [],
      qualityFlag: typeof item.quality_flag === "string" ? item.quality_flag : undefined,
      qualityIssues: Array.isArray(item.quality_issues)
        ? (item.quality_issues as unknown[]).map(String)
        : undefined,
      source_ids: Array.isArray(item.source_ids) ? item.source_ids.map(String) : undefined,
      citation_confidence: typeof item.citation_confidence === "string" ? item.citation_confidence : undefined,
      researchEvidence: extractResearchEvidence(item.research_evidence),
    };
  });
}
