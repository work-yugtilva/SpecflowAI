import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  /* Full smoke (specflow-full-smoke.spec.ts) sets test.setTimeout(900_000) internally. */
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: "test-results/playwright-artifacts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    storageState: ".playwright/auth.json",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
