import { describe, expect, it } from "vitest";
import {
  tasksToCsv,
  tasksToMarkdown,
  prdToMarkdown,
  handoffToMarkdown,
  safeFilename,
} from "./artifact-export";

describe("tasksToCsv", () => {
  it("header row is id,title,type,status,priority,description", () => {
    const csv = tasksToCsv([]);
    const header = csv.split("\n")[0];
    expect(header).toBe("id,title,type,status,priority,description");
  });

  it("escapes commas in field values by wrapping in quotes", () => {
    const tasks = [
      { id: "t1", title: "Fix bug, fast", type: "Backend", status: "todo", priority: "High", description: "Do it" },
    ];
    const csv = tasksToCsv(tasks);
    const dataRow = csv.split("\n")[1];
    expect(dataRow).toContain('"Fix bug, fast"');
  });

  it("escapes double-quotes in field values by doubling them", () => {
    const tasks = [
      { id: "t1", title: 'He said "hello"', type: "Frontend", status: "todo", priority: "Low", description: "desc" },
    ];
    const csv = tasksToCsv(tasks);
    const dataRow = csv.split("\n")[1];
    expect(dataRow).toContain('"He said ""hello"""');
  });
});

describe("tasksToMarkdown", () => {
  it("includes task title and type in output", () => {
    const tasks = [
      { id: "t1", title: "Build login page", type: "Frontend", status: "todo", priority: "High", description: "Create auth UI" },
    ];
    const md = tasksToMarkdown(tasks);
    expect(md).toContain("Build login page");
    expect(md).toContain("Frontend");
  });
});

describe("prdToMarkdown", () => {
  it("handles an object with known PRD section keys and output must NOT contain [object Object]", () => {
    const prd = {
      executive_summary: "This is the summary",
      goals: ["Increase revenue", "Reduce churn"],
      features: [{ name: "Feature A", priority: "High" }],
    };
    const md = prdToMarkdown(prd);
    expect(md).not.toContain("[object Object]");
    expect(md).toContain("Executive Summary");
    expect(md).toContain("This is the summary");
  });
});

describe("handoffToMarkdown", () => {
  it("includes project_brief text and at least one task implementation_prompt", () => {
    const handoff = {
      project_brief: "Build a SaaS dashboard",
      tasks: [
        {
          title: "Setup auth",
          implementation_prompt: "Use NextAuth with Supabase provider",
          dependencies: [],
        },
      ],
    };
    const md = handoffToMarkdown(handoff);
    expect(md).toContain("Build a SaaS dashboard");
    expect(md).toContain("Use NextAuth with Supabase provider");
  });
});

describe("safeFilename", () => {
  it("replaces spaces with dashes and strips special chars", () => {
    expect(safeFilename("My PRD!")).toBe("my-prd");
  });
});
