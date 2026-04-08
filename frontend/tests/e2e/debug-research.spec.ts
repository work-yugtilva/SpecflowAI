import { test } from "@playwright/test";

test("debug research API", async ({ page }) => {
  const log: string[] = [];

  page.on("request", req => {
    log.push(`REQ: ${req.method()} ${req.url().substring(0, 120)}`);
  });
  page.on("requestfailed", req => {
    log.push(`FAIL: ${req.url().substring(0, 120)} | ${req.failure()?.errorText}`);
  });
  page.on("console", msg => {
    if (msg.type() === "error") log.push(`CONSOLE_ERR: ${msg.text().substring(0, 200)}`);
  });

  await page.goto("http://localhost:3000/research", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  // Try to evaluate the withAuth behavior directly in the page context
  const sessionResult = await page.evaluate(async () => {
    try {
      const { createBrowserClient } = await import("@supabase/ssr");
      // @ts-ignore
      const url = window.__env?.NEXT_PUBLIC_SUPABASE_URL || "";
      // @ts-ignore
      const key = window.__env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
      return { url, key, note: "env from window" };
    } catch (e: unknown) {
      return { error: String(e) };
    }
  });

  console.log("Session result:", JSON.stringify(sessionResult));
  console.log("SyncError visible:", await page.getByText("Failed to fetch").count());
  console.log("Network requests:", log.filter(l => !l.includes("localhost:3000") || l.includes("FAIL") || l.includes("CONSOLE")).join("\n"));
});
