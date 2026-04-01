import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EDITABLE_MEMORY_KEYS = new Set(["prd"]);

export async function POST(req: NextRequest) {
  let body: {
    session_id?: string;
    output_key?: string;
    updated_content?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { session_id, output_key, updated_content } = body;
  if (!session_id || !output_key || updated_content === undefined) {
    return NextResponse.json(
      {
        success: false,
        error: "session_id, output_key, and updated_content are required",
      },
      { status: 400 }
    );
  }
  if (!EDITABLE_MEMORY_KEYS.has(output_key)) {
    return NextResponse.json(
      { success: false, error: "Unsupported output_key" },
      { status: 400 }
    );
  }

  try {
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

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id")
      .eq("id", session_id)
      .maybeSingle();

    if (sessionError) {
      return NextResponse.json(
        { success: false, error: sessionError.message },
        { status: 500 }
      );
    }
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("memory_entries")
      .update({ content: updated_content })
      .eq("session_id", session_id)
      .eq("memory_key", output_key)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    if (!data) {
      return NextResponse.json(
        { success: false, error: "Editable content not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}
