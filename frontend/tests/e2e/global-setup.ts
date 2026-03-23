import { chromium } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

export default async function globalSetup() {
  const email = process.env.PLAYWRIGHT_TEST_EMAIL;
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD;
  const authDir = path.join(process.cwd(), ".playwright");

  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  if (!email || !password) {
    fs.writeFileSync(
      path.join(authDir, "auth.json"),
      JSON.stringify({ cookies: [], origins: [] })
    );
    console.warn("[global-setup] No credentials — auth tests will skip");
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:3000/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await page.context().storageState({ path: path.join(authDir, "auth.json") });
  await browser.close();
}
