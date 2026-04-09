import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserIntegrationAccessToken } from "@/lib/server/user-integrations";

const LINEAR_API = "https://api.linear.app/graphql";
const ALLOWED_OPERATIONS = new Set([
  "IssueCreate",
  "IssueLabelCreate",
  "ProjectCreate",
]);

interface MutationObject {
  operation: string;
  mutation: string;
  variables: Record<string, unknown>;
}

interface LinearPayload {
  project: MutationObject;
  labels: MutationObject[];
  issues: MutationObject[];
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

    try {
      const res = await fetch(LINEAR_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query: mutation_obj.mutation,
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
