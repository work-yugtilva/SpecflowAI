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

  test("onboarding form submits and routes to dashboard", async ({ page }) => {
    test.skip(!hasCredentials, "Requires PLAYWRIGHT_TEST_EMAIL + PASSWORD");
    await page.goto("/onboarding");
    if (!page.url().includes("/onboarding")) return; // already onboarded

    await page.getByLabel(/first name/i).fill("Test");
    await page.getByLabel(/last name/i).fill("User");
    await page.getByLabel(/job title/i).fill("PM");
    await page.getByLabel(/company/i).first().fill("Acme");
    await page.getByRole("button", { name: /continue|submit|next/i }).click();
    await page.waitForURL("**/dashboard", { timeout: 10_000 });
    expect(page.url()).toContain("/dashboard");
  });
});
