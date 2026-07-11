import { test, expect } from "@playwright/test";

/** Smoke test: the app boots in demo mode (no API keys) and is judge-ready. */
test.describe("demo mode", () => {
  test("home page loads without API keys and has correct metadata", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });

    const response = await page.goto("/");
    expect(response?.ok()).toBeTruthy();

    await expect(page).toHaveTitle(/LaunchCopilot/i);
    await expect(page.locator("body")).toBeVisible();

    // No unexpected console errors on first paint.
    expect(consoleErrors, consoleErrors.join("\n")).toHaveLength(0);
  });
});
