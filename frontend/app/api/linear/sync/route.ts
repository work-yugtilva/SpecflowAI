import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LINEAR_API = "https://api.linear.app/graphql";

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
  // Resolve API key: prefer OAuth token from user_integrations, fall back to env var
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let apiKey: string | undefined;
  if (user) {
    const { data: integration } = await supabase
      .from("user_integrations")
      .select("access_token")
      .eq("user_id", user.id)
      .eq("provider", "linear")
      .single();
    apiKey = integration?.access_token ?? undefined;
  }

  if (!apiKey) {
    apiKey = process.env.LINEAR_API_KEY;
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
