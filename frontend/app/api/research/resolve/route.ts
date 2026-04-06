import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLUMNS =
  "id, title, content, type, metric_name, metric_value, metric_baseline, metric_unit, time_period, data_source";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("ids") ?? "";
  if (!raw.trim()) {
    return NextResponse.json({ entries: [] });
  }
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length > 20) {
    return NextResponse.json(
      { error: "Too many ids — max 20 per request" },
      { status: 400 }
    );
  }
  const validIds = parts.filter((id) => UUID_RE.test(id));
  if (!validIds.length) {
    return NextResponse.json({ entries: [] });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // RLS on research_entries restricts rows to user_id = auth.uid().
  // getUser() above provides an extra early-exit when there is no session.
  const { data, error } = await supabase
    .from("research_entries")
    .select(COLUMNS)
    .in("id", validIds);

  if (error) {
    console.error("[research/resolve] Supabase error:", error.message);
    return NextResponse.json({ entries: [] });
  }
  return NextResponse.json({ entries: data ?? [] });
}
