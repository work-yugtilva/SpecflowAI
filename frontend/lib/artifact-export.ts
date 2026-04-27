const PRD_SECTION_TITLES: Record<string, string> = {
  executive_summary: "Executive Summary",
  problem_statement: "Problem Statement",
  goals: "Goals",
  features: "Features",
  architecture: "Architecture",
  implementation_plan: "Implementation Plan",
  risks: "Risks",
  success_metrics: "Success Metrics",
};

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function csvEscapeField(value: unknown): string {
  const str = value == null ? "" : String(value).replace(/\n/g, " ");
  const needsQuotes = str.includes(",") || str.includes('"') || str.includes("\r");
  if (!needsQuotes) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

export function safeFilename(name: string): string {
  return name
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9\-_.]/g, "")
    .toLowerCase();
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = "text/plain"
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(content: string): Promise<void> {
  await navigator.clipboard.writeText(content);
}

export function toMarkdownArtifact(title: string, value: unknown): string {
  if (typeof value === "string") return `# ${title}\n\n${value}`;
  return `# ${title}\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

export function tasksToMarkdown(tasks: unknown[]): string {
  if (!tasks || tasks.length === 0) return "# Tasks\n\n_No tasks._";
  const lines: string[] = ["# Tasks\n"];
  for (const task of tasks) {
    if (!isRecord(task)) {
      lines.push(`- ${String(task)}\n`);
      continue;
    }
    lines.push(`## ${task.title ?? "Untitled"}`);
    const meta: string[] = [];
    if (task.type) meta.push(`Type: ${task.type}`);
    if (task.status) meta.push(`Status: ${task.status}`);
    if (task.priority) meta.push(`Priority: ${task.priority}`);
    if (meta.length > 0) lines.push(meta.join(" · "));
    if (task.description) lines.push(`\n${task.description}`);
    const steps = Array.isArray(task.steps) ? task.steps : [];
    if (steps.length > 0) {
      lines.push("\n**Steps:**");
      for (const step of steps) {
        if (isRecord(step)) {
          const done = step.done ? "[x]" : "[ ]";
          lines.push(`- ${done} ${step.title ?? ""}`);
        }
      }
    }
    const deps = Array.isArray(task.dependencies) ? task.dependencies : [];
    if (deps.length > 0) {
      lines.push(`\n**Dependencies:** ${deps.join(", ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function tasksToCsv(tasks: unknown[]): string {
  const header = ["id", "title", "type", "status", "priority", "description"];
  const rows: string[] = [header.join(",")];
  for (const task of tasks) {
    if (!isRecord(task)) continue;
    rows.push(
      [
        csvEscapeField(task.id),
        csvEscapeField(task.title),
        csvEscapeField(task.type),
        csvEscapeField(task.status),
        csvEscapeField(task.priority),
        csvEscapeField(task.description),
      ].join(",")
    );
  }
  return rows.join("\n");
}

function renderPrdValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return `- ${item}`;
        if (isRecord(item)) {
          return Object.entries(item)
            .filter(([, v]) => v != null && v !== "")
            .map(([k, v]) => `- **${k}**: ${v}`)
            .join("\n");
        }
        return `- ${String(item)}`;
      })
      .join("\n");
  }
  if (isRecord(value)) {
    return Object.entries(value)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => `**${k}**: ${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join("\n\n");
  }
  return String(value ?? "");
}

export function prdToMarkdown(prd: unknown): string {
  if (typeof prd === "string") return prd;
  if (!isRecord(prd)) return toMarkdownArtifact("PRD", prd);
  const lines: string[] = ["# Product Requirements Document\n"];
  for (const key of Object.keys(PRD_SECTION_TITLES)) {
    if (!(key in prd)) continue;
    const title = PRD_SECTION_TITLES[key];
    lines.push(`## ${title}\n`);
    lines.push(renderPrdValue(prd[key]));
    lines.push("");
  }
  return lines.join("\n");
}

export function handoffToMarkdown(handoff: unknown): string {
  if (typeof handoff === "string") return handoff;
  if (!isRecord(handoff)) return toMarkdownArtifact("Coding Agent Handoff", handoff);
  const lines: string[] = ["# Coding Agent Handoff\n"];
  if (handoff.project_brief) {
    lines.push("## Project Brief\n");
    lines.push(String(handoff.project_brief));
    lines.push("");
  }
  if (handoff.architecture_notes) {
    lines.push("## Architecture Notes\n");
    lines.push(String(handoff.architecture_notes));
    lines.push("");
  }
  const execOrder = Array.isArray(handoff.execution_order) ? handoff.execution_order : [];
  if (execOrder.length > 0) {
    lines.push("## Execution Order\n");
    execOrder.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
    lines.push("");
  }
  const tasks = Array.isArray(handoff.tasks) ? handoff.tasks : [];
  if (tasks.length > 0) {
    lines.push("## Tasks\n");
    for (const task of tasks) {
      if (!isRecord(task)) continue;
      lines.push(`### ${task.title ?? "Untitled"}${task.layer ? ` (${task.layer})` : ""}`);
      if (task.implementation_prompt) {
        lines.push(`\n**Implementation Prompt:** ${task.implementation_prompt}`);
      }
      if (task.acceptance_criteria) {
        lines.push(`\n**Acceptance Criteria:** ${task.acceptance_criteria}`);
      }
      const deps = Array.isArray(task.dependencies) ? task.dependencies : [];
      if (deps.length > 0) {
        lines.push(`\n**Dependencies:** ${deps.join(", ")}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}
