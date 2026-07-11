import { test, expect } from "@playwright/test";

const sizes = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

test.describe("responsive layout", () => {
  for (const s of sizes) {
    test(`no horizontal overflow at ${s.name} (${s.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: s.width, height: s.height });
      await page.goto("/");
      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientW = await page.evaluate(() => document.documentElement.clientWidth);
      // Allow a 1px rounding tolerance.
      expect(scrollW).toBeLessThanOrEqual(clientW + 1);
    });
  }
});
