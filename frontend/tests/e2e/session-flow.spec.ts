import { test, expect } from "./fixtures/auth";

const hasCredentials = !!(
  process.env.PLAYWRIGHT_TEST_EMAIL && process.env.PLAYWRIGHT_TEST_PASSWORD
);

test.describe("Create session → reach context/problems page", () => {
  test("authenticated user can reach /sessions page", async ({ page }) => {
    test.skip(!hasCredentials, "Requires PLAYWRIGHT_TEST_EMAIL + PASSWORD");
    await page.goto("/sessions");
    expect(page.url()).toContain("/sessions");
  });

  test("create session modal is openable", async ({ page }) => {
    test.skip(!hasCredentials, "Requires PLAYWRIGHT_TEST_EMAIL + PASSWORD");
    await page.goto("/sessions");
    const createBtn = page.getByRole("button", { name: /new session|create session/i });
    await expect(createBtn).toBeVisible({ timeout: 8_000 });
    await createBtn.click();
    const nameInput = page.getByPlaceholder(/session name|name your session/i);
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
  });

  test("creating a session routes to context or problems page", async ({ page }) => {
    test.skip(!hasCredentials, "Requires PLAYWRIGHT_TEST_EMAIL + PASSWORD");
    await page.goto("/sessions");
    const createBtn = page.getByRole("button", { name: /new session|create session/i });
    await createBtn.click();
    const nameInput = page.getByPlaceholder(/session name|name your session/i);
    await nameInput.fill(`E2E Test ${Date.now()}`);
    await page.getByRole("button", { name: /start|create|go/i }).click();
    await page.waitForURL(/\/(context|problems)/, { timeout: 15_000 });
    expect(page.url()).toMatch(/\/(context|problems)/);
  });
});
