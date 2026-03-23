import { test, expect } from "@playwright/test";

// Does NOT require auth — tests the callback route directly
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("GET /auth/callback", () => {
  test("redirects to /login when no code param is present", async ({ page }) => {
    await page.goto("/auth/callback");
    await page.waitForURL("**/login**");
    expect(page.url()).toContain("/login");
  });

  test("redirects to /login with error param when code is invalid", async ({ page }) => {
    await page.goto("/auth/callback?code=invalid-code-xyz");
    await page.waitForURL("**/login**");
    expect(page.url()).toContain("error=auth_callback_failed");
  });

  test("redirects to /login for bad code regardless of next param", async ({ page }) => {
    await page.goto("/auth/callback?code=bad&next=/onboarding");
    await page.waitForURL("**/login**");
    expect(page.url()).toContain("/login");
  });
});
