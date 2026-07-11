import { describe, expect, it } from "vitest";
import { COMMUNITIES, matchCommunities } from "./index";
import { SelfPromoPolicy } from "./types";

describe("communities dataset integrity", () => {
  it("has a substantial curated set", () => {
    expect(COMMUNITIES.length).toBeGreaterThanOrEqual(50);
  });

  it("every entry has the required fields and valid enums", () => {
    const policies: SelfPromoPolicy[] = ["open", "restricted", "scheduled", "banned"];
    for (const c of COMMUNITIES) {
      expect(c.id, c.name).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.url).toMatch(/^https?:\/\//);
      expect(Array.isArray(c.tags) && c.tags.length > 0, c.id).toBe(true);
      expect(["S", "M", "L"]).toContain(c.sizeTier);
      expect(policies).toContain(c.selfPromoPolicy);
      expect(c.rulesSummary.length).toBeGreaterThan(10);
    }
  });

  it("ids are unique", () => {
    const ids = COMMUNITIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every scheduled community names the day it allows self-promo", () => {
    for (const c of COMMUNITIES.filter((c) => c.selfPromoPolicy === "scheduled")) {
      expect(c.bestDay, c.id).toBeTruthy();
    }
  });

  it("includes both banned and scheduled examples (so filtering is demoable)", () => {
    expect(COMMUNITIES.filter((c) => c.selfPromoPolicy === "banned").length).toBeGreaterThanOrEqual(2);
    expect(COMMUNITIES.filter((c) => c.selfPromoPolicy === "scheduled").length).toBeGreaterThanOrEqual(2);
  });
});

describe("matchCommunities — the #1 safety guarantee", () => {
  it("NEVER returns a banned community", () => {
    const seeds = ["plant care", "workout", "productivity", "habits", "fitness", "app"];
    const res = matchCommunities(seeds, "Lifestyle", { limit: 60 });
    expect(res.every((c) => c.selfPromoPolicy !== "banned")).toBe(true);
  });

  it("excludes r/plantclinic (banned) even for a perfect plant match", () => {
    const res = matchCommunities(["plants", "plant care", "houseplants"], "Lifestyle", { limit: 60 });
    expect(res.map((c) => c.id)).not.toContain("r-plantclinic");
  });
});

describe("matchCommunities — relevance per fixture", () => {
  it("pocketplants (plants/lifestyle) surfaces plant + indie communities", () => {
    const res = matchCommunities(
      ["plant care", "houseplants", "watering reminders", "gardening"],
      "Lifestyle",
      { limit: 6 },
    );
    const ids = res.map((c) => c.id);
    expect(ids.some((i) => ["r-houseplants", "r-indoorgarden", "r-gardening"].includes(i))).toBe(true);
    expect(res.length).toBeGreaterThan(0);
    expect(res.length).toBeLessThanOrEqual(6);
  });

  it("fitdash (fitness) surfaces fitness communities and drops r/Fitness (banned)", () => {
    const res = matchCommunities(
      ["workout", "fitness", "gym", "exercise tracking", "training"],
      "Health & Fitness",
      { limit: 8 },
    );
    const ids = res.map((c) => c.id);
    expect(ids).not.toContain("r-fitness");
    expect(ids.some((i) => ["r-workout", "r-bodyweightfitness", "r-running"].includes(i))).toBe(true);
  });

  it("lumenhabit (productivity) surfaces productivity communities and drops banned motivation subs", () => {
    const res = matchCommunities(
      ["habits", "productivity", "focus", "routine", "self-improvement"],
      "Productivity",
      { limit: 8 },
    );
    const ids = res.map((c) => c.id);
    expect(ids).not.toContain("r-getmotivated");
    expect(ids).not.toContain("r-adhd");
    expect(ids.some((i) => ["r-productivity", "r-getdisciplined", "r-habits"].includes(i))).toBe(true);
  });

  it("always finds platform-agnostic launch venues (no category returns nothing)", () => {
    const res = matchCommunities(["launch", "app", "startup"], "Anything", { limit: 5 });
    expect(res.length).toBeGreaterThanOrEqual(3);
  });
});

describe("matchCommunities — mechanics", () => {
  it("is deterministic", () => {
    const a = matchCommunities(["habits", "productivity"], "Productivity", { limit: 6 });
    const b = matchCommunities(["habits", "productivity"], "Productivity", { limit: 6 });
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it("respects the limit", () => {
    expect(matchCommunities(["app", "launch"], "Productivity", { limit: 3 }).length).toBeLessThanOrEqual(3);
  });

  it("annotates each match with what it matched on and a score", () => {
    const [top] = matchCommunities(["habits"], "Productivity", { limit: 1 });
    expect(top.score).toBeGreaterThan(0);
    expect(top.matchedOn.length).toBeGreaterThan(0);
  });

  it("returns nothing for zero-overlap seeds", () => {
    expect(matchCommunities(["quantum", "astrophysics"], "Science", { pool: COMMUNITIES }).length).toBe(0);
  });
});
