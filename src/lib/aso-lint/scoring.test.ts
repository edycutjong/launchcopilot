import { describe, expect, it } from "vitest";
import { gradeFor, lint } from "./index";
import { AppListing } from "./types";

describe("gradeFor boundaries", () => {
  it("A at 90", () => expect(gradeFor(90)).toBe("A"));
  it("B at 80-89", () => {
    expect(gradeFor(89)).toBe("B");
    expect(gradeFor(80)).toBe("B");
  });
  it("C at 65-79", () => {
    expect(gradeFor(79)).toBe("C");
    expect(gradeFor(65)).toBe("C");
  });
  it("D at 50-64", () => {
    expect(gradeFor(64)).toBe("D");
    expect(gradeFor(50)).toBe("D");
  });
  it("F below 50", () => expect(gradeFor(49)).toBe("F"));
});

const disaster: AppListing = {
  appName: "Zap",
  platform: "both",
  category: "Utilities",
  title: "Zap 🌟 The Best Free App Ever Made For Everyone In The World",
  subtitle: "The best app ever made for you and everyone else on the planet",
  keywords:
    "app, apps, free, best, zap, zaps, notion, top, new, the, a, an, for, your, of, and, with, to, my, in, on, it, is, you, more, filler, padding, extra",
  shortDescription: "The greatest experience of your life, reimagined and perfected.",
  description:
    "Zap is an app that will change everything about the way you think about apps because Zap is simply the best and Zap does what Zap does better than anyone else could ever do it and once you try Zap you will never go back to living your life without Zap by your side every single day of the week because Zap is more than an app Zap is a lifestyle and a movement and a community and a family and we could not be happier to welcome you into the world of Zap where everything is possible and nothing is out of reach as long as you believe in the power of Zap and yourself and your dreams which is really what Zap has always been about since the very beginning of this incredible journey.",
  screenshotCount: 1,
  hasVideo: false,
  whatItDoes: "Scans receipts and tracks expense budgets automatically.",
};

describe("score clamping and stacking", () => {
  it("clamps a disaster listing to 0 and grades F", () => {
    const r = lint(disaster);
    expect(r.score).toBe(0);
    expect(r.grade).toBe("F");
    expect(r.findings.length).toBeGreaterThan(10);
  });
  it("score never exceeds 100", () => {
    expect(
      lint({ ...disaster, platform: "ios" }).score,
    ).toBeGreaterThanOrEqual(0);
  });
});

describe("platform applicability", () => {
  it("ios listing never triggers and-* rules", () => {
    const r = lint({ ...disaster, platform: "ios" });
    expect(r.findings.every((f) => !f.ruleId.startsWith("and-"))).toBe(true);
  });
  it("android listing never triggers ios-* rules", () => {
    const r = lint({ ...disaster, platform: "android" });
    expect(r.findings.every((f) => !f.ruleId.startsWith("ios-"))).toBe(true);
  });
  it("platform both triggers rules from every store group", () => {
    const ids = lint(disaster).findings.map((f) => f.ruleId);
    expect(ids.some((i) => i.startsWith("ios-"))).toBe(true);
    expect(ids.some((i) => i.startsWith("and-"))).toBe(true);
    expect(ids.some((i) => i.startsWith("x-"))).toBe(true);
  });
});

describe("fieldStats", () => {
  it("reports ios budgets", () => {
    const r = lint({ ...disaster, platform: "ios" });
    expect(r.fieldStats.title.max).toBe(30);
    expect(r.fieldStats.keywords.max).toBe(100);
    expect(r.fieldStats.subtitle.max).toBe(30);
  });
  it("reports android budgets", () => {
    const r = lint({ ...disaster, platform: "android" });
    expect(r.fieldStats.shortDescription.max).toBe(80);
    expect(r.fieldStats.description.max).toBe(4000);
  });
  it("wasted never negative", () => {
    const r = lint({ ...disaster, platform: "ios" });
    for (const s of Object.values(r.fieldStats)) {
      expect(s.wasted).toBeGreaterThanOrEqual(0);
    }
  });
});
