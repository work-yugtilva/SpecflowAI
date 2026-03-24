import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const USE_LOCAL = process.env.NEXT_PUBLIC_USE_LOCAL_PIPELINE === "true";

const ROLE = "senior product manager with 10 years of B2B SaaS experience";

const TASKS: Record<string, string> = {
  problems:
    "Identify between 3 and 7 specific, distinct user problems grounded in the research context above. Each problem must be something a real user encounters — not a feature request. Every problem must reference evidence from the research context.",
  features:
    "Generate between 4 and 8 product features that directly address the problems identified. Each feature must solve a specific user problem and be grounded in the research context. Every feature must reference evidence from the research.",
  decompose:
    "Decompose the product features into between 6 and 12 concrete technical components. Each component must map to a specific layer (ui, backend, or system) and directly address a user problem. Every component must reference evidence from the research.",
  tasks:
    "Generate between 8 and 15 implementation tasks derived from the decomposed components. Each task title must start with an imperative verb. Every task must reference evidence from the research and have verifiable acceptance criteria written in past tense.",
};

const SCHEMAS: Record<string, object[]> = {
  problems: [
    {
      id: "string",
      title: "string (max 10 words)",
      description: "string (2-3 sentences, specific and grounded in research)",
      user_problem_it_solves: "string",
      severity: "high | medium | low",
      acceptance_criteria: "string (measurable, not vague)",
      research_evidence: "string (direct reference from input research)",
    },
  ],
  features: [
    {
      id: "string",
      title: "string (max 10 words)",
      description: "string (2-3 sentences, specific and grounded in research)",
      user_problem_it_solves: "string",
      priority: "high | medium | low",
      acceptance_criteria: "string (measurable, not vague)",
      research_evidence: "string (direct reference from input research)",
    },
  ],
  decompose: [
    {
      id: "string",
      title: "string (max 10 words)",
      description: "string (2-3 sentences, specific and grounded in research)",
      layer: "ui | backend | system",
      user_problem_it_solves: "string",
      priority: "high | medium | low",
      acceptance_criteria: "string (measurable, not vague)",
      research_evidence: "string (direct reference from input research)",
    },
  ],
  tasks: [
    {
      id: "string",
      title: "string (imperative verb, max 10 words)",
      description: "string (2-3 sentences, specific and grounded in research)",
      layer: "frontend | backend | system",
      user_problem_it_solves: "string",
      priority: "high | medium | low",
      acceptance_criteria: "string (past tense, verifiable)",
      research_evidence: "string (direct reference from input research)",
    },
  ],
};

// Key names must match what pipeline.py uses (agent name as fallback key)
const OUTPUT_KEYS: Record<string, string> = {
  problems: "problems",
  features: "features",
  decompose: "decompose",   // was "decompositions" — fixed to match backend key
  tasks: "tasks",
};

export async function POST(req: NextRequest) {
  if (!USE_LOCAL) {
    return NextResponse.json(
      { error: "Backend service is offline. Please start the backend server." },
      { status: 503 }
    );
  }

  try {
    const { step, inputData } = (await req.json()) as {
      step: string;
      inputData: { context?: Record<string, unknown>; research?: unknown[]; ingest?: unknown[] };
    };

    const taskPrompt = TASKS[step];
    const schema = SCHEMAS[step];
    if (!taskPrompt || !schema) {
      return NextResponse.json({ error: `Unknown step: ${step}` }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });
    const contextStr = JSON.stringify(inputData?.context ?? {}, null, 2);
    const schemaStr = JSON.stringify(schema, null, 2);

    const prompt =
      `ROLE: You are a ${ROLE}.\n\n` +
      `CONTEXT:\n${contextStr}\n\n` +
      `TASK: ${taskPrompt}\n\n` +
      `OUTPUT FORMAT: Return ONLY a JSON array. No preamble. No markdown. No explanation.\n${schemaStr}`;

    const message = await client.messages.create({
      model: process.env.AI_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const raw =
      message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
    const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed: unknown[] = JSON.parse(cleaned);

    const outputKey = OUTPUT_KEYS[step] ?? step;
    return NextResponse.json({ outputs: { [outputKey]: parsed } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/pipeline/run] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
