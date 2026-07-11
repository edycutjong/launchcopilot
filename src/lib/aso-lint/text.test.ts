import { describe, expect, it } from "vitest";
import {
  graphemeLength,
  hasEmoji,
  normalize,
  splitSentences,
  stem,
  tokenize,
} from "./text";

describe("graphemeLength", () => {
  it("counts plain ASCII", () => expect(graphemeLength("PocketPlants")).toBe(12));
  it("counts emoji as one grapheme", () => expect(graphemeLength("🌱")).toBe(1));
  it("counts composed emoji as one grapheme", () =>
    expect(graphemeLength("👨‍👩‍👧")).toBe(1));
  it("counts CJK characters", () => expect(graphemeLength("植物ケア")).toBe(4));
  it("handles empty string", () => expect(graphemeLength("")).toBe(0));
});

describe("tokenize", () => {
  it("lowercases and splits on punctuation", () =>
    expect(tokenize("Plant-Care, App!")).toEqual(["plant", "care", "app"]));
  it("keeps numbers", () => expect(tokenize("Top 10 apps")).toEqual(["top", "10", "apps"]));
  it("returns empty for whitespace", () => expect(tokenize("   ")).toEqual([]));
});

describe("stem", () => {
  it("strips simple plural", () => expect(stem("plants")).toBe("plant"));
  it("keeps -ss words", () => expect(stem("fitness")).toBe("fitness"));
  it("converts -ies to -y", () => expect(stem("berries")).toBe("berry"));
  it("keeps short words", () => expect(stem("gas")).toBe("gas"));
});

describe("hasEmoji", () => {
  it("detects emoji", () => expect(hasEmoji("Best App 🌟")).toBe(true));
  it("passes plain text", () => expect(hasEmoji("Plant Care Reminders")).toBe(false));
});

describe("splitSentences", () => {
  it("splits on terminators", () =>
    expect(splitSentences("One. Two! Three?")).toHaveLength(3));
  it("handles single sentence without terminator", () =>
    expect(splitSentences("just one line")).toHaveLength(1));
});

describe("normalize", () => {
  it("trims and NFC-normalizes", () => expect(normalize("  café  ")).toBe("café"));
});
