import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/** Core flow E2E: the public ASO grading API works end-to-end through the server. */
test.describe("/api/analyze", () => {
  test("grades the PocketPlants fixture as 27/F with findings", async ({ request }) => {
    const fixture = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "data/fixtures/pocketplants.json"), "utf8"),
    );
    const res = await request.post("/api/analyze", { data: fixture });
    expect(res.ok()).toBeTruthy();

    const report = await res.json();
    expect(report.score).toBe(27);
    expect(report.grade).toBe("F");
    expect(Array.isArray(report.findings)).toBeTruthy();
    expect(report.findings.length).toBeGreaterThan(10);
  });

  test("rejects a malformed listing with 400", async ({ request }) => {
    const res = await request.post("/api/analyze", { data: { nope: true } });
    expect(res.status()).toBe(400);
  });
});
