import { test, expect } from "./fixtures/auth";

const hasCredentials = !!(
  process.env.PLAYWRIGHT_TEST_EMAIL && process.env.PLAYWRIGHT_TEST_PASSWORD
);

test.describe("Sign up → onboarding complete", () => {
  test("authenticated user can access onboarding page", async ({ page }) => {
    test.skip(!hasCredentials, "Requires PLAYWRIGHT_TEST_EMAIL + PASSWORD");
    await page.goto("/onboarding");
    expect(page.url()).toMatch(/\/(onboarding|dashboard)/);
  });

  test("onboarding form submits to product context, then routes to dashboard", async ({ page }) => {
    test.skip(!hasCredentials, "Requires PLAYWRIGHT_TEST_EMAIL + PASSWORD");
    await page.goto("/onboarding");
    if (!page.url().includes("/onboarding")) return; // already onboarded

    await page.getByPlaceholder("Yug").fill("Test");
    await page.getByPlaceholder("Sharma").fill("User");
    await page.getByPlaceholder("Product Manager").fill("PM");
    await page.getByPlaceholder("Acme Inc.").fill("Acme");
    await page.getByRole("button", { name: "Startup" }).click();
    await page.getByRole("button", { name: /continue|submit|next/i }).click();
    await page.waitForURL("**/context**", { timeout: 10_000 });
    expect(page.url()).toContain("/context");

    await page.getByPlaceholder("SpecFlow").fill("SpecFlow");
    await page
      .getByPlaceholder(/brief description/i)
      .fill("Turns product research into pipeline-ready product context.");
    await page.getByRole("button", { name: /save/i }).click();
    await page.waitForURL("**/dashboard", { timeout: 10_000 });
    expect(page.url()).toContain("/dashboard");
  });
});
