import { describe, expect, it } from "vitest";
import { lint } from "@/lib/aso-lint";
import { AppListingSchema } from "@/lib/schemas/listing";
import { FIXTURES } from "./fixtures";

/**
 * Demo fixtures are load-bearing: the video and DEMO.md quote these exact
 * numbers. If a rule change shifts them, update the docs with the tests.
 */

describe("fixture: pocketplants (the hero demo)", () => {
  const r = lint(FIXTURES.pocketplants);

  it("scores 27 / F", () => {
    expect(r.score).toBe(27);
    expect(r.grade).toBe("F");
  });

  it("triggers the 13 expected rules", () => {
    expect(r.findings.map((f) => f.ruleId).sort()).toEqual(
      [
        "ios-kw-dup-meta",
        "ios-kw-dup-stem",
        "ios-kw-spaces",
        "ios-kw-stopwords",
        "ios-kw-utilization",
        "ios-subtitle-generic",
        "ios-title-waste",
        "x-desc-first-fold",
        "x-desc-first-line-generic",
        "x-desc-no-social-proof",
        "x-desc-repetition",
        "x-no-video",
        "x-screenshot-count",
      ].sort(),
    );
  });

  it("reports 18 wasted title characters", () => {
    expect(r.fieldStats.title).toEqual({ used: 12, max: 30, wasted: 18 });
  });
});

describe("fixture: fitdash (android, mid-grade)", () => {
  const r = lint(FIXTURES.fitdash);

  it("scores 55 / D", () => {
    expect(r.score).toBe(55);
    expect(r.grade).toBe("D");
  });

  it("catches keyword stuffing and the slogan short description", () => {
    const ids = r.findings.map((f) => f.ruleId);
    expect(ids).toContain("and-desc-kw-density");
    expect(ids).toContain("and-short-desc-hook");
    expect(ids).toContain("x-desc-wall-of-text");
  });

  it("never triggers ios rules", () => {
    expect(r.findings.every((f) => !f.ruleId.startsWith("ios-"))).toBe(true);
  });
});

describe("fixture: lumenhabit (proves the grader is proportionate)", () => {
  const r = lint(FIXTURES.lumenhabit);

  it("scores 97 / A", () => {
    expect(r.score).toBe(97);
    expect(r.grade).toBe("A");
  });

  it("flags only the category-in-keywords info nit", () => {
    expect(r.findings.map((f) => f.ruleId)).toEqual(["ios-kw-category"]);
  });
});

describe("fixtures validate against the API schema", () => {
  for (const [name, listing] of Object.entries(FIXTURES)) {
    it(`${name} parses`, () => {
      expect(() => AppListingSchema.parse(listing)).not.toThrow();
    });
  }
});
