import { describe, expect, it } from "vitest";
import { lint } from "./index";
import { AppListing } from "./types";

/** A deliberately clean iOS listing that triggers nothing — each test breaks ONE thing. */
function clean(overrides: Partial<AppListing> = {}): AppListing {
  return {
    appName: "Lumen",
    platform: "ios",
    category: "Productivity",
    title: "Lumen: Daily Routine Planner", // 28 chars, ≤8 unused
    subtitle: "Plan tomorrow, wake up ready", // 28 chars, substantive, no keyword overlap
    keywords:
      "habit,streak,focus timer,morning ritual,self care,discipline,journal,goal setting,quiet mind", // 93 chars, no dups/stopwords/brands
    description:
      "Tired of abandoned routines? Lumen turns your mornings into streaks you can see grow.\n\n" +
      "Plan each day the night before, check off rituals as you go, and watch the chain build. " +
      "Trusted by 12,000 users who kept their streaks past day 30.\n\n" +
      "Download free and build your first streak today.",
    screenshotCount: 6,
    hasVideo: true,
    whatItDoes:
      "Plan daily routines, check off rituals and build visible streaks with gentle reminders.",
    ...overrides,
  };
}

function ruleIds(listing: AppListing): string[] {
  return lint(listing).findings.map((f) => f.ruleId);
}

describe("baseline", () => {
  it("clean listing triggers zero findings and scores 100/A", () => {
    const r = lint(clean());
    expect(r.findings).toEqual([]);
    expect(r.score).toBe(100);
    expect(r.grade).toBe("A");
  });
});

describe("ios-title-length", () => {
  it("fires when title exceeds 30 graphemes", () =>
    expect(
      ruleIds(clean({ title: "Lumen: The Complete Daily Routine Planner" })),
    ).toContain("ios-title-length"));
  it("passes at exactly 30", () =>
    expect(ruleIds(clean({ title: "x".repeat(30) }))).not.toContain(
      "ios-title-length",
    ));
});

describe("ios-title-waste", () => {
  it("fires when more than 8 chars unused", () =>
    expect(ruleIds(clean({ title: "Lumen" }))).toContain("ios-title-waste"));
  it("passes with ≤8 unused", () =>
    expect(ruleIds(clean())).not.toContain("ios-title-waste"));
  it("does not fire when title is over limit (length rule owns that)", () =>
    expect(ruleIds(clean({ title: "x".repeat(31) }))).not.toContain(
      "ios-title-waste",
    ));
});

describe("ios-title-emoji", () => {
  it("fires on emoji in title", () =>
    expect(ruleIds(clean({ title: "Lumen 🌟 Routine Planner" }))).toContain(
      "ios-title-emoji",
    ));
  it("passes plain title", () =>
    expect(ruleIds(clean())).not.toContain("ios-title-emoji"));
});

describe("ios-subtitle-length", () => {
  it("fires over 30", () =>
    expect(
      ruleIds(clean({ subtitle: "Build lasting streaks and daily routines" })),
    ).toContain("ios-subtitle-length"));
  it("passes at 30", () =>
    expect(ruleIds(clean({ subtitle: "y".repeat(30) }))).not.toContain(
      "ios-subtitle-length",
    ));
});

describe("ios-subtitle-generic", () => {
  it("fires on superlative slogans", () =>
    expect(ruleIds(clean({ subtitle: "The best app ever made" }))).toContain(
      "ios-subtitle-generic",
    ));
  it("fires when almost all stopwords", () =>
    expect(ruleIds(clean({ subtitle: "For you and your day" }))).toContain(
      "ios-subtitle-generic",
    ));
  it("passes substantive subtitle", () =>
    expect(ruleIds(clean())).not.toContain("ios-subtitle-generic"));
  it("skips when subtitle absent", () =>
    expect(ruleIds(clean({ subtitle: undefined }))).not.toContain(
      "ios-subtitle-generic",
    ));
});

describe("ios-kw-length", () => {
  it("fires over 100 chars", () =>
    expect(ruleIds(clean({ keywords: "k".repeat(101) }))).toContain(
      "ios-kw-length",
    ));
  it("passes at 100", () =>
    expect(ruleIds(clean({ keywords: "k".repeat(100) }))).not.toContain(
      "ios-kw-length",
    ));
});

describe("ios-kw-spaces", () => {
  it("fires on spaces after commas", () =>
    expect(
      ruleIds(clean({ keywords: "habit, streak, focus timer, morning ritual, self care, discipline, journal, goals" })),
    ).toContain("ios-kw-spaces"));
  it("passes tight commas", () =>
    expect(ruleIds(clean())).not.toContain("ios-kw-spaces"));
});

describe("ios-kw-dup-meta", () => {
  it("fires when a keyword repeats a title token", () =>
    expect(
      ruleIds(clean({ keywords: clean().keywords + ",planner" })),
    ).toContain("ios-kw-dup-meta"));
  it("fires on stem-level duplication (plural of title word)", () =>
    expect(
      ruleIds(clean({ keywords: clean().keywords + ",planners" })),
    ).toContain("ios-kw-dup-meta"));
  it("fires when a keyword repeats a subtitle token", () =>
    expect(
      ruleIds(clean({ keywords: clean().keywords + ",tomorrow" })),
    ).toContain("ios-kw-dup-meta"));
  it("passes disjoint keywords", () =>
    expect(ruleIds(clean())).not.toContain("ios-kw-dup-meta"));
});

describe("ios-kw-dup-stem", () => {
  it("fires on singular+plural in keywords", () =>
    expect(
      ruleIds(clean({ keywords: "habit,habits,focus timer,morning ritual,self care,discipline,goal" })),
    ).toContain("ios-kw-dup-stem"));
  it("passes unique stems", () =>
    expect(ruleIds(clean())).not.toContain("ios-kw-dup-stem"));
});

describe("ios-kw-stopwords", () => {
  it("fires on app/free/best in keywords", () =>
    expect(
      ruleIds(clean({ keywords: clean().keywords + ",best,free" })),
    ).toContain("ios-kw-stopwords"));
  it("passes without stopwords", () =>
    expect(ruleIds(clean())).not.toContain("ios-kw-stopwords"));
});

describe("ios-kw-category", () => {
  it("fires when category name sits in keywords", () =>
    expect(
      ruleIds(clean({ keywords: (clean().keywords ?? "").replace("quiet mind", "productivity") })),
    ).toContain("ios-kw-category"));
  it("passes otherwise", () =>
    expect(ruleIds(clean())).not.toContain("ios-kw-category"));
});

describe("ios-kw-utilization", () => {
  it("fires under 80% utilization", () =>
    expect(ruleIds(clean({ keywords: "habit,streak" }))).toContain(
      "ios-kw-utilization",
    ));
  it("treats missing keyword field as 0% (fires)", () =>
    expect(ruleIds(clean({ keywords: undefined }))).toContain(
      "ios-kw-utilization",
    ));
  it("passes at ≥80%", () =>
    expect(ruleIds(clean())).not.toContain("ios-kw-utilization"));
});

// ---------- Android ----------

function cleanAndroid(overrides: Partial<AppListing> = {}): AppListing {
  return clean({
    platform: "android",
    subtitle: undefined,
    keywords: undefined,
    shortDescription: "Plan routines, build visible streaks, get gentle reminders.",
    ...overrides,
  });
}

describe("and-title-length", () => {
  it("fires over 30", () =>
    expect(
      ruleIds(cleanAndroid({ title: "Lumen: The Complete Daily Routine Planner" })),
    ).toContain("and-title-length"));
  it("passes within limit", () =>
    expect(ruleIds(cleanAndroid())).not.toContain("and-title-length"));
});

describe("and-title-emoji", () => {
  it("fires on emoji", () =>
    expect(ruleIds(cleanAndroid({ title: "Lumen ✨ Planner" }))).toContain(
      "and-title-emoji",
    ));
  it("passes plain", () =>
    expect(ruleIds(cleanAndroid())).not.toContain("and-title-emoji"));
});

describe("and-short-desc-length", () => {
  it("fires over 80", () =>
    expect(
      ruleIds(cleanAndroid({ shortDescription: "z".repeat(81) })),
    ).toContain("and-short-desc-length"));
  it("passes at 80", () =>
    expect(
      ruleIds(cleanAndroid({ shortDescription: "z".repeat(80) })),
    ).not.toContain("and-short-desc-length"));
});

describe("and-short-desc-hook", () => {
  it("fires on pure slogan", () =>
    expect(
      ruleIds(cleanAndroid({ shortDescription: "Your life, reimagined." })),
    ).toContain("and-short-desc-hook"));
  it("passes when it says what the app does", () =>
    expect(ruleIds(cleanAndroid())).not.toContain("and-short-desc-hook"));
  it("skips when field absent", () =>
    expect(
      ruleIds(cleanAndroid({ shortDescription: undefined })),
    ).not.toContain("and-short-desc-hook"));
});

describe("and-desc-length", () => {
  it("fires over 4000 chars", () =>
    expect(
      ruleIds(cleanAndroid({ description: "w ".repeat(2100) })),
    ).toContain("and-desc-length"));
  it("passes normal length", () =>
    expect(ruleIds(cleanAndroid())).not.toContain("and-desc-length"));
});

describe("and-desc-kw-density", () => {
  it("fires on stuffed primary keyword", () => {
    const stuffed =
      "Workout plans and workout logs. Track every workout with workout timers. " +
      "Your workout history shows each workout trend so the next workout improves. " +
      "Smart workout suggestions adapt sets reps rest cadence tempo volume load speed power balance " +
      "strength endurance mobility recovery posture form technique breathing hydration nutrition sleep " +
      "energy motivation consistency progress charts records milestones badges friends coaches classes gyms equipment. " +
      "Download free today.";
    expect(ruleIds(cleanAndroid({ description: stuffed }))).toContain(
      "and-desc-kw-density",
    );
  });
  it("passes varied vocabulary", () =>
    expect(ruleIds(cleanAndroid())).not.toContain("and-desc-kw-density"));
});

// ---------- Cross-store ----------

describe("x-brand-competitor", () => {
  it("fires on competitor brand in keywords", () =>
    expect(
      ruleIds(clean({ keywords: clean().keywords + ",notion" })),
    ).toContain("x-brand-competitor"));
  it("fires on competitor brand in title", () =>
    expect(
      ruleIds(clean({ title: "Lumen: Strava for Habits" })),
    ).toContain("x-brand-competitor"));
  it("passes clean metadata", () =>
    expect(ruleIds(clean())).not.toContain("x-brand-competitor"));
});

describe("x-desc-first-fold", () => {
  it("fires when the first 255 chars never say what the app does", () => {
    const fluff =
      "Welcome to a whole new chapter. We spent years dreaming about this moment and we are so proud to finally share it with the world. " +
      "Our team poured heart and soul into every corner of this experience, and we believe you will feel that love in every detail. " +
      "Plan daily routines and build streaks with reminders.\n\nDownload free today.";
    expect(ruleIds(clean({ description: fluff }))).toContain("x-desc-first-fold");
  });
  it("passes when the fold contains the core benefit", () =>
    expect(ruleIds(clean())).not.toContain("x-desc-first-fold"));
});

describe("x-desc-first-line-generic", () => {
  it('fires on "X is an app…" openers', () =>
    expect(
      ruleIds(
        clean({
          description:
            "Lumen is an app for routines. Plan rituals and build streaks daily.\n\nDownload free today.",
        }),
      ),
    ).toContain("x-desc-first-line-generic"));
  it("passes benefit-first openers", () =>
    expect(ruleIds(clean())).not.toContain("x-desc-first-line-generic"));
});

describe("x-desc-repetition", () => {
  it("fires when one stem appears 6+ times", () => {
    const spam =
      "Lumen makes streaks fun. Streaks grow daily and streaks keep you honest. " +
      "Long streaks unlock badges, short streaks rebuild fast, and streaks sync everywhere. " +
      "Plan rituals each morning and check them off.\n\nDownload free and start your streak today.";
    expect(ruleIds(clean({ description: spam }))).toContain("x-desc-repetition");
  });
  it("passes varied text", () =>
    expect(ruleIds(clean())).not.toContain("x-desc-repetition"));
});

describe("x-desc-wall-of-text", () => {
  it("fires on a 600+ char paragraph", () => {
    const wall =
      "Plan rituals and build streaks. " +
      "This paragraph keeps going without a single break because the author pasted their entire pitch in one block which is exhausting to read on a phone screen and users simply scroll past it without absorbing anything at all. ".repeat(
        3,
      ) +
      "Download free today.";
    expect(ruleIds(clean({ description: wall }))).toContain("x-desc-wall-of-text");
  });
  it("passes short paragraphs", () =>
    expect(ruleIds(clean())).not.toContain("x-desc-wall-of-text"));
});

describe("x-desc-no-social-proof", () => {
  it("fires when no numbers/press present", () =>
    expect(
      ruleIds(
        clean({
          description:
            "Plan rituals and build streaks with reminders.\n\nDownload free today.",
        }),
      ),
    ).toContain("x-desc-no-social-proof"));
  it("passes with user counts", () =>
    expect(ruleIds(clean())).not.toContain("x-desc-no-social-proof"));
});

describe("x-desc-no-cta", () => {
  it("fires when the ending never asks to act", () =>
    expect(
      ruleIds(
        clean({
          description:
            "Plan rituals and build streaks with reminders. Trusted by 12,000 users. We hope you enjoy the experience of a calmer morning routine.",
        }),
      ),
    ).toContain("x-desc-no-cta"));
  it("passes with a closing CTA", () =>
    expect(ruleIds(clean())).not.toContain("x-desc-no-cta"));
});

describe("x-readability", () => {
  it("fires on 30+ word average sentences", () => {
    const run =
      "Plan rituals and build streaks with reminders while the app quietly learns which time of day you are most likely to follow through and adapts every nudge to the exact moment your motivation typically peaks across the week. " +
      "Download free today so the long journey toward a calmer and more intentional morning can finally begin with a single tap on the install button right now.";
    expect(ruleIds(clean({ description: run }))).toContain("x-readability");
  });
  it("passes scannable sentences", () =>
    expect(ruleIds(clean())).not.toContain("x-readability"));
});

describe("x-screenshot-count", () => {
  it("fires under 4 screenshots", () =>
    expect(ruleIds(clean({ screenshotCount: 2 }))).toContain(
      "x-screenshot-count",
    ));
  it("passes at 4+", () =>
    expect(ruleIds(clean())).not.toContain("x-screenshot-count"));
  it("skips when unknown", () =>
    expect(ruleIds(clean({ screenshotCount: undefined }))).not.toContain(
      "x-screenshot-count",
    ));
});

describe("x-no-video", () => {
  it("fires when hasVideo is false", () =>
    expect(ruleIds(clean({ hasVideo: false }))).toContain("x-no-video"));
  it("passes with video", () =>
    expect(ruleIds(clean())).not.toContain("x-no-video"));
  it("skips when unknown", () =>
    expect(ruleIds(clean({ hasVideo: undefined }))).not.toContain("x-no-video"));
});
