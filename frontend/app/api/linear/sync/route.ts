import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserIntegrationAccessToken } from "@/lib/server/user-integrations";

const LINEAR_API = "https://api.linear.app/graphql";
const ALLOWED_OPERATIONS = new Set([
  "IssueCreate",
  "IssueLabelCreate",
  "ProjectCreate",
]);

const MUTATION_TEMPLATES: Record<string, string> = {
  IssueCreate: `mutation IssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier title } } }`,
  IssueLabelCreate: `mutation IssueLabelCreate($input: IssueLabelCreateInput!) { issueLabelCreate(input: $input) { success issueLabel { id name color } } }`,
  ProjectCreate: `mutation ProjectCreate($input: ProjectCreateInput!) { projectCreate(input: $input) { success project { id name } } }`,
};

const EXPECTED_VARIABLE_KEYS: Record<string, Set<string>> = {
  IssueCreate: new Set(["input"]),
  IssueLabelCreate: new Set(["input"]),
  ProjectCreate: new Set(["input"]),
};

interface MutationObject {
  operation: string;
  variables: Record<string, unknown>;
}

interface LinearPayload {
  project: MutationObject;
  labels: MutationObject[];
  issues: MutationObject[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateVariables(
  operation: string,
  variables: unknown
): string[] | null {
  if (!isRecord(variables)) {
    return ["Invalid variables"];
  }

  const expectedKeys = EXPECTED_VARIABLE_KEYS[operation];
  if (!expectedKeys) {
    return ["Operation template not found"];
  }

  const unexpectedKeys = Object.keys(variables).filter(
    (key) => !expectedKeys.has(key)
  );
  if (unexpectedKeys.length > 0) {
    return [`Unexpected variables: ${unexpectedKeys.join(", ")}`];
  }

  return null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  let apiKey: string | null;
  try {
    apiKey = await getUserIntegrationAccessToken(user.id, "linear");
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load Linear integration",
      },
      { status: 500 }
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        code: "linear_not_connected",
        error: "No Linear token found. Connect your Linear account in Settings → Integrations.",
      },
      { status: 401 }
    );
  }

  let body: { linear_payload?: LinearPayload };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { linear_payload } = body;
  if (!linear_payload) {
    return NextResponse.json(
      { success: false, error: "linear_payload is required" },
      { status: 400 }
    );
  }

  const mutations: MutationObject[] = [
    linear_payload.project,
    ...linear_payload.labels,
    ...linear_payload.issues,
  ].filter(Boolean);

  const results: Array<{
    operation: string;
    success: boolean;
    errors: unknown[] | null;
  }> = [];

  for (const mutation_obj of mutations) {
    if (!ALLOWED_OPERATIONS.has(mutation_obj.operation)) {
      results.push({
        operation: mutation_obj.operation,
        success: false,
        errors: ["Operation not allowed"],
      });
      continue;
    }

    const mutationTemplate = MUTATION_TEMPLATES[mutation_obj.operation];
    if (!mutationTemplate) {
      results.push({
        operation: mutation_obj.operation,
        success: false,
        errors: ["Operation template not found"],
      });
      continue;
    }

    const variableErrors = validateVariables(
      mutation_obj.operation,
      mutation_obj.variables
    );
    if (variableErrors) {
      results.push({
        operation: mutation_obj.operation,
        success: false,
        errors: variableErrors,
      });
      continue;
    }

    try {
      const res = await fetch(LINEAR_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query: mutationTemplate,
          variables: mutation_obj.variables,
        }),
      });

      const json = (await res.json()) as { errors?: unknown[] };
      results.push({
        operation: mutation_obj.operation,
        success: !json.errors,
        errors: json.errors ?? null,
      });
    } catch (err) {
      results.push({
        operation: mutation_obj.operation,
        success: false,
        errors: [{ message: err instanceof Error ? err.message : "Network error" }],
      });
    }
  }

  const allPassed = results.every((r) => r.success);
  return NextResponse.json({ success: allPassed, results });
}
