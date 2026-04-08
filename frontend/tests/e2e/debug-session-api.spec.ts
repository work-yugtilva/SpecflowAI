import { test, expect } from "@playwright/test";

test("debug session API auth", async ({ page, request }) => {
  // storageState from auth.json is pre-loaded — already authenticated
  await page.goto("/sessions");
  await page.waitForLoadState("networkidle");

  const sessionIdFromPage = await page.evaluate(() =>
    localStorage.getItem("specflow_active_session_id")
  );
  console.log("Active session ID:", sessionIdFromPage);

  if (!sessionIdFromPage) {
    console.log("No active session found");
    return;
  }

  // Try the API call
  const res = await request.get(`/api/sessions/${sessionIdFromPage}`);
  console.log("API status:", res.status());
  if (res.ok()) {
    const body = await res.json() as Record<string, unknown>;
    console.log("Body keys:", Object.keys(body));
    const state = body.state as Record<string, unknown> | null;
    console.log("State keys:", state ? Object.keys(state) : "null");
    const innerState = state?.state as Record<string, unknown> | null;
    console.log("Inner state keys:", innerState ? Object.keys(innerState) : "null");
    const outputs = innerState?.outputs as Record<string, unknown> | null;
    console.log("Outputs keys:", outputs ? Object.keys(outputs) : "null");
    if (outputs) {
      for (const [key, val] of Object.entries(outputs)) {
        const arr = val && typeof val === "object" && "data" in val ? (val as {data: unknown[]}).data : val;
        console.log(`  ${key}: ${Array.isArray(arr) ? arr.length + " items" : typeof arr}`);
      }
    }
  } else {
    const text = await res.text().catch(() => "");
    console.log("Error body:", text.substring(0, 200));
  }
});
