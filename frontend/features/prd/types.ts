export interface PRDGoal {
  goal?: string;
  metric: string;
  target: string;
  timeline?: string;
  baseline?: string;
}

export interface PRDFeature {
  title: string;
  name?: string;
  description: string;
  priority?: string;
  [key: string]: unknown;
}

export interface PRDTask {
  title: string;
  type?: string;
  priority?: string;
  description?: string;
  [key: string]: unknown;
}

export interface PRDMetric {
  metric: string;
  baseline?: string;
  target: string;
  measurement?: string;
}

export interface PRDArchitecture {
  frontend?: string | string[];
  backend?: string | string[];
  data?: string | string[];
}

export interface PRDExportData {
  product_name?: string;
  executive_summary?: string;
  problem_statement?: string;
  goals?: PRDGoal[] | string;
  architecture?: PRDArchitecture;
  features?: PRDFeature[];
  implementation_plan?: unknown;
  risks?: unknown;
  tasks?: PRDTask[];
  success_metrics?: PRDMetric[] | string;
  [key: string]: unknown;
}

export function castToPRDExportData(val: unknown): PRDExportData | null {
  if (typeof val !== "object" || val === null || Array.isArray(val)) return null;
  const record = val as Record<string, unknown>;
  const unwrapped =
    "data" in record &&
    typeof record.data === "object" &&
    record.data !== null &&
    !Array.isArray(record.data)
      ? record.data
      : val;
  return typeof unwrapped === "object" && unwrapped !== null && !Array.isArray(unwrapped)
    ? (unwrapped as PRDExportData)
    : null;
}
