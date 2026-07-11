import { describe, expect, it } from "vitest";
import { keywordCoverage, packKeywords } from "./index";

const META = ["lumen", "daily", "routine", "planner"]; // title tokens

describe("packKeywords — cleaning", () => {
  it("drops terms whose substantive tokens all duplicate metadata", () => {
    const r = packKeywords(["routine", "habit"], META);
    expect(r.included).toEqual(["habit"]);
    expect(r.excluded).toContainEqual({
      term: "routine",
      reason: "duplicates-metadata",
    });
  });

  it("catches metadata duplication at stem level (routines vs routine)", () => {
    const r = packKeywords(["routines"], META);
    expect(r.included).toEqual([]);
    expect(r.excluded[0].reason).toBe("duplicates-metadata");
  });

  it("drops stopword-only terms", () => {
    const r = packKeywords(["best free app", "habit"], META);
    expect(r.included).toEqual(["habit"]);
    expect(r.excluded).toContainEqual({
      term: "best free app",
      reason: "stopword-only",
    });
  });

  it("keeps mixed terms that add at least one new substantive token", () => {
    const r = packKeywords(["daily habit"], META); // "daily" dups meta, "habit" is new
    expect(r.included).toEqual(["daily habit"]);
  });

  it("dedups repeated candidates case-insensitively", () => {
    const r = packKeywords(["Habit", "habit", "HABIT"], META);
    expect(r.included).toEqual(["habit"]);
  });

  it("dedups later candidates whose stems are already included", () => {
    const r = packKeywords(["habit", "habits"], META);
    expect(r.included).toEqual(["habit"]);
    expect(r.excluded).toContainEqual({
      term: "habits",
      reason: "duplicate-stem",
    });
  });
});

describe("packKeywords — budget", () => {
  it("joins with commas and no spaces", () => {
    const r = packKeywords(["habit", "streak", "focus"], META);
    expect(r.keywords).toBe("habit,streak,focus");
  });

  it("never exceeds maxLen", () => {
    const many = Array.from({ length: 60 }, (_, i) => `keyword${i}`);
    const r = packKeywords(many, META);
    expect(r.used).toBeLessThanOrEqual(100);
    expect(r.keywords.length).toBeLessThanOrEqual(100);
  });

  it("marks non-fitting terms over-budget but keeps packing smaller ones", () => {
    const r = packKeywords(
      ["a-very-long-keyword-phrase-here", "tiny", "mini"],
      META,
      20,
    );
    expect(r.used).toBeLessThanOrEqual(20);
    expect(r.excluded.some((e) => e.reason === "over-budget")).toBe(true);
    expect(r.included.length).toBeGreaterThan(0);
  });

  it("fits exactly at the boundary", () => {
    // "abcde,fghij" = 11 chars
    const r = packKeywords(["abcde", "fghij"], [], 11);
    expect(r.keywords).toBe("abcde,fghij");
    expect(r.used).toBe(11);
    expect(r.utilization).toBe(1);
  });

  it("handles empty candidate list", () => {
    const r = packKeywords([], META);
    expect(r.keywords).toBe("");
    expect(r.used).toBe(0);
    expect(r.utilization).toBe(0);
  });

  it("prefers higher-ranked terms when budget forces a choice", () => {
    // rank 1 term and rank 2 term have equal length; only one fits
    const r = packKeywords(["alpha", "bravo"], [], 5);
    expect(r.included).toEqual(["alpha"]);
    expect(r.excluded).toContainEqual({ term: "bravo", reason: "over-budget" });
  });

  it("reports utilization as used/max", () => {
    const r = packKeywords(["abcd"], [], 10);
    expect(r.utilization).toBeCloseTo(0.4);
  });
});

describe("keywordCoverage", () => {
  const fields = {
    title: "Lumen: Daily Routine Planner",
    subtitle: "Plan tomorrow, wake up ready",
    keywords: "habit,streak,focus timer,self care",
  };

  it("counts a seed covered when all substantive tokens appear", () => {
    const r = keywordCoverage(["habit", "streak"], fields);
    expect(r.pct).toBe(100);
    expect(r.covered).toEqual(["habit", "streak"]);
  });

  it("matches at stem level (habits ≈ habit)", () => {
    const r = keywordCoverage(["habits"], fields);
    expect(r.covered).toEqual(["habits"]);
  });

  it("counts a multiword seed only when every token is covered", () => {
    const r = keywordCoverage(["habit tracker"], fields);
    expect(r.missing).toEqual(["habit tracker"]); // "tracker" absent
  });

  it("covers multiword seeds across different fields", () => {
    const r = keywordCoverage(["daily habit"], fields); // daily: title, habit: keywords
    expect(r.covered).toEqual(["daily habit"]);
  });

  it("computes a mixed percentage", () => {
    const r = keywordCoverage(["habit", "meditation", "sleep", "streak"], fields);
    expect(r.pct).toBe(50);
    expect(r.missing).toEqual(["meditation", "sleep"]);
  });

  it("ignores stopword-only and empty seeds", () => {
    const r = keywordCoverage(["the best", "", "habit"], fields);
    expect(r.covered).toEqual(["habit"]);
    expect(r.pct).toBe(100);
  });

  it("dedups repeated seeds", () => {
    const r = keywordCoverage(["habit", "Habit"], fields);
    expect(r.covered).toEqual(["habit"]);
    expect(r.pct).toBe(100);
  });

  it("returns 0 for empty seed list", () => {
    const r = keywordCoverage([], fields);
    expect(r.pct).toBe(0);
  });

  it("works without subtitle/keywords fields", () => {
    const r = keywordCoverage(["planner", "meditation"], {
      title: "Lumen: Daily Routine Planner",
    });
    expect(r.covered).toEqual(["planner"]);
    expect(r.pct).toBe(50);
  });
});
