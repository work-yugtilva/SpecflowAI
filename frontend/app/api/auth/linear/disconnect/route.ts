import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteUserIntegration } from "@/lib/server/user-integrations";

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await deleteUserIntegration(user.id, "linear");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to disconnect Linear" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
