import { LIMITS, Rule } from "./types";
import {
  COMPETITOR_BRANDS,
  SUPERLATIVES,
  countTokens,
  graphemeLength,
  hasEmoji,
  nonStopword,
  stem,
  STOPWORDS,
} from "./text";

// ---------- iOS rules (12) ----------

const iosRules: Rule[] = [
  {
    id: "ios-title-length",
    store: "ios",
    field: "title",
    severity: "critical",
    weight: 12,
    check: ({ titleLen }) =>
      titleLen > LIMITS.IOS_TITLE
        ? {
            message: `Title is ${titleLen} characters — the App Store limit is ${LIMITS.IOS_TITLE}; it will be rejected or truncated.`,
            fix: `Cut the title to ${LIMITS.IOS_TITLE} characters or fewer.`,
          }
        : null,
  },
  {
    id: "ios-title-waste",
    store: "ios",
    field: "title",
    severity: "warn",
    weight: 8,
    check: ({ titleLen }) => {
      const unused = LIMITS.IOS_TITLE - titleLen;
      return titleLen <= LIMITS.IOS_TITLE && unused > LIMITS.TITLE_WASTE_THRESHOLD
        ? {
            message: `Title uses ${titleLen} of ${LIMITS.IOS_TITLE} characters — ${unused} wasted. The title is the strongest keyword slot in the store.`,
            fix: `Append your top keyword after the brand, e.g. "Brand: Category Keywords".`,
          }
        : null;
    },
  },
  {
    id: "ios-title-emoji",
    store: "ios",
    field: "title",
    severity: "critical",
    weight: 8,
    check: ({ listing }) =>
      hasEmoji(listing.title)
        ? {
            message: "Title contains emoji/special symbols — an App Store rejection risk.",
            fix: "Remove emoji from the title; keep plain text.",
          }
        : null,
  },
  {
    id: "ios-subtitle-length",
    store: "ios",
    field: "subtitle",
    severity: "critical",
    weight: 10,
    check: ({ subtitleLen }) =>
      subtitleLen > LIMITS.IOS_SUBTITLE
        ? {
            message: `Subtitle is ${subtitleLen} characters — the limit is ${LIMITS.IOS_SUBTITLE}.`,
            fix: `Cut the subtitle to ${LIMITS.IOS_SUBTITLE} characters or fewer.`,
          }
        : null,
  },
  {
    id: "ios-subtitle-generic",
    store: "ios",
    field: "subtitle",
    severity: "warn",
    weight: 6,
    check: ({ listing, subtitleTokens }) => {
      const sub = listing.subtitle ?? "";
      if (!sub) return null;
      const lower = sub.toLowerCase();
      const hasSuperlative = SUPERLATIVES.some((s) => lower.includes(s));
      const substantive = nonStopword(subtitleTokens);
      return hasSuperlative || substantive.length < 2
        ? {
            message: `Subtitle "${sub}" is a slogan, not a keyword slot — Apple indexes the subtitle for search.`,
            fix: "Replace superlatives with searched terms describing what the app does.",
          }
        : null;
    },
  },
  {
    id: "ios-kw-length",
    store: "ios",
    field: "keywords",
    severity: "critical",
    weight: 10,
    check: ({ keywordsLen }) =>
      keywordsLen > LIMITS.IOS_KEYWORDS
        ? {
            message: `Keyword field is ${keywordsLen} characters — only the first ${LIMITS.IOS_KEYWORDS} are read.`,
            fix: `Trim to ${LIMITS.IOS_KEYWORDS} characters; drop the weakest terms.`,
          }
        : null,
  },
  {
    id: "ios-kw-spaces",
    store: "ios",
    field: "keywords",
    severity: "warn",
    weight: 5,
    check: ({ listing }) => {
      const kw = listing.keywords ?? "";
      const wasted = (kw.match(/,\s+/g) ?? []).reduce(
        (n, m) => n + (m.length - 1),
        0,
      );
      return wasted > 0
        ? {
            message: `Keywords have spaces after commas — ${wasted} wasted character${wasted === 1 ? "" : "s"} of the 100-character budget.`,
            fix: `Write "a,b,c" with no spaces after commas.`,
          }
        : null;
    },
  },
  {
    id: "ios-kw-dup-meta",
    store: "ios",
    field: "keywords",
    severity: "warn",
    weight: 8,
    check: ({ keywordTokens, titleTokens, subtitleTokens }) => {
      const meta = new Set([...titleTokens, ...subtitleTokens].map(stem));
      const dups = [...new Set(keywordTokens.filter((t) => meta.has(stem(t))))];
      return dups.length > 0
        ? {
            message: `Keywords repeat words Apple already indexes from your title/subtitle: ${dups.join(", ")}.`,
            fix: "Delete them and spend the freed characters on new terms.",
          }
        : null;
    },
  },
  {
    id: "ios-kw-dup-stem",
    store: "ios",
    field: "keywords",
    severity: "warn",
    weight: 6,
    check: ({ keywordTokens }) => {
      const seen = new Map<string, string>();
      const dups: string[] = [];
      for (const t of keywordTokens) {
        const s = stem(t);
        const prev = seen.get(s);
        if (prev !== undefined && prev !== t) dups.push(`${prev}/${t}`);
        else seen.set(s, t);
      }
      return dups.length > 0
        ? {
            message: `Keywords duplicate singular/plural stems: ${[...new Set(dups)].join(", ")} — Apple matches these automatically.`,
            fix: "Keep one form per stem; free the characters.",
          }
        : null;
    },
  },
  {
    id: "ios-kw-stopwords",
    store: "ios",
    field: "keywords",
    severity: "warn",
    weight: 5,
    check: ({ keywordTokens }) => {
      const bad = [...new Set(keywordTokens.filter((t) => STOPWORDS.has(t)))];
      return bad.length > 0
        ? {
            message: `Keywords include terms Apple ignores or that never convert: ${bad.join(", ")}.`,
            fix: "Delete them; they only burn budget.",
          }
        : null;
    },
  },
  {
    id: "ios-kw-category",
    store: "ios",
    field: "keywords",
    severity: "info",
    weight: 3,
    check: ({ listing, keywordTokens }) => {
      const cat = listing.category.toLowerCase();
      const hit = keywordTokens.find((t) => cat.includes(t) && t.length > 3);
      return hit
        ? {
            message: `Keyword "${hit}" duplicates your category "${listing.category}" — the store already indexes the category.`,
            fix: "Replace it with a term users actually search.",
          }
        : null;
    },
  },
  {
    id: "ios-kw-utilization",
    store: "ios",
    field: "keywords",
    severity: "warn",
    weight: 6,
    check: ({ keywordsLen }) => {
      const utilization = keywordsLen / LIMITS.IOS_KEYWORDS;
      return keywordsLen <= LIMITS.IOS_KEYWORDS &&
        utilization < LIMITS.KW_UTILIZATION_MIN
        ? {
            message: `Keyword field uses ${keywordsLen} of ${LIMITS.IOS_KEYWORDS} characters (${Math.round(utilization * 100)}%). Unused budget is unranked search terms.`,
            fix: "Pack the field to ~100 characters with additional relevant terms.",
          }
        : null;
    },
  },
];

// ---------- Android rules (6) ----------

const androidRules: Rule[] = [
  {
    id: "and-title-length",
    store: "android",
    field: "title",
    severity: "critical",
    weight: 12,
    check: ({ titleLen }) =>
      titleLen > LIMITS.ANDROID_TITLE
        ? {
            message: `Title is ${titleLen} characters — the Play Store limit is ${LIMITS.ANDROID_TITLE}.`,
            fix: `Cut the title to ${LIMITS.ANDROID_TITLE} characters or fewer.`,
          }
        : null,
  },
  {
    id: "and-title-emoji",
    store: "android",
    field: "title",
    severity: "critical",
    weight: 8,
    check: ({ listing }) =>
      hasEmoji(listing.title)
        ? {
            message: "Title contains emoji — Google Play policy prohibits it.",
            fix: "Remove emoji from the title.",
          }
        : null,
  },
  {
    id: "and-short-desc-length",
    store: "android",
    field: "shortDescription",
    severity: "critical",
    weight: 10,
    check: ({ shortDescLen }) =>
      shortDescLen > LIMITS.ANDROID_SHORT_DESC
        ? {
            message: `Short description is ${shortDescLen} characters — the limit is ${LIMITS.ANDROID_SHORT_DESC}.`,
            fix: `Cut to ${LIMITS.ANDROID_SHORT_DESC} characters.`,
          }
        : null,
  },
  {
    id: "and-short-desc-hook",
    store: "android",
    field: "shortDescription",
    severity: "warn",
    weight: 6,
    check: ({ listing, whatItDoesTokens, brandTokens }) => {
      const sd = listing.shortDescription ?? "";
      if (!sd) return null;
      const sdTokens = new Set(nonStopword(sd.toLowerCase().split(/[^\p{L}\p{N}]+/u)));
      const substance = whatItDoesTokens.filter(
        (t) => sdTokens.has(t) && !brandTokens.has(t),
      );
      return substance.length === 0
        ? {
            message: `Short description "${sd}" never says what the app does — it's the only text most Play users read.`,
            fix: "State the core benefit in plain searched terms.",
          }
        : null;
    },
  },
  {
    id: "and-desc-length",
    store: "android",
    field: "description",
    severity: "critical",
    weight: 8,
    check: ({ listing }) => {
      const len = graphemeLength(listing.description);
      return len > LIMITS.ANDROID_DESC
        ? {
            message: `Description is ${len} characters — the Play limit is ${LIMITS.ANDROID_DESC}.`,
            fix: `Trim to ${LIMITS.ANDROID_DESC} characters.`,
          }
        : null;
    },
  },
  {
    id: "and-desc-kw-density",
    store: "android",
    field: "description",
    severity: "warn",
    weight: 6,
    check: ({ descTokens, brandTokens }) => {
      const substantive = nonStopword(descTokens).filter((t) => !brandTokens.has(t));
      if (substantive.length < 40) return null;
      const counts = countTokens(substantive.map(stem));
      let top: [string, number] | null = null;
      for (const [t, n] of counts) if (!top || n > top[1]) top = [t, n];
      if (!top) return null;
      const density = top[1] / substantive.length;
      return density > LIMITS.DENSITY_MAX && top[1] >= 5
        ? {
            message: `"${top[0]}" is ${Math.round(density * 100)}% of your description — Google penalizes keyword stuffing above ~5%.`,
            fix: "Vary the vocabulary; target 1.5-3% for the primary keyword.",
          }
        : null;
    },
  },
];

// ---------- Cross-store rules (10) ----------

const crossRules: Rule[] = [
  {
    id: "x-brand-competitor",
    store: "both",
    field: "metadata",
    severity: "critical",
    weight: 8,
    check: ({ titleTokens, subtitleTokens, keywordTokens }) => {
      const meta = [...titleTokens, ...subtitleTokens, ...keywordTokens];
      const hits = [...new Set(meta.filter((t) => COMPETITOR_BRANDS.has(t)))];
      return hits.length > 0
        ? {
            message: `Metadata contains competitor brand names (${hits.join(", ")}) — a store rejection risk.`,
            fix: "Remove competitor names from title/subtitle/keywords.",
          }
        : null;
    },
  },
  {
    id: "x-desc-first-fold",
    store: "both",
    field: "description",
    severity: "warn",
    weight: 8,
    check: ({ listing, whatItDoesTokens, brandTokens }) => {
      const fold = listing.description.slice(0, LIMITS.FIRST_FOLD_CHARS).toLowerCase();
      const foldTokens = new Set(fold.split(/[^\p{L}\p{N}]+/u));
      const substance = whatItDoesTokens.filter(
        (t) => foldTokens.has(t) && !brandTokens.has(t),
      );
      return substance.length === 0
        ? {
            message: `The first ${LIMITS.FIRST_FOLD_CHARS} characters — all most users ever see — never say what the app actually does.`,
            fix: `Open with the core benefit in the first sentence, using the words from "${listing.whatItDoes.slice(0, 60)}…".`,
          }
        : null;
    },
  },
  {
    id: "x-desc-first-line-generic",
    store: "both",
    field: "description",
    severity: "warn",
    weight: 6,
    check: ({ listing }) =>
      /^\s*\S+ is (an?|the) (app|application|tool)\b/i.test(listing.description)
        ? {
            message: `Description opens with "AppName is an app…" — the weakest possible first line.`,
            fix: "Open with the user's problem or the concrete benefit instead.",
          }
        : null,
  },
  {
    id: "x-desc-repetition",
    store: "both",
    field: "description",
    severity: "warn",
    weight: 6,
    check: ({ descTokens }) => {
      const counts = countTokens(nonStopword(descTokens).map(stem));
      const worst = [...counts.entries()]
        .filter(([, n]) => n >= LIMITS.REPETITION_THRESHOLD)
        .sort((a, b) => b[1] - a[1])[0];
      return worst
        ? {
            message: `"${worst[0]}" appears ${worst[1]} times in the description — it reads as spam to users and stores alike.`,
            fix: "Cut repetitions; each mention after the second adds nothing.",
          }
        : null;
    },
  },
  {
    id: "x-desc-wall-of-text",
    store: "both",
    field: "description",
    severity: "warn",
    weight: 4,
    check: ({ listing }) => {
      const wall = listing.description
        .split(/\n+/)
        .some((p) => graphemeLength(p.trim()) > LIMITS.WALL_OF_TEXT_CHARS);
      return wall
        ? {
            message: `Description has a paragraph longer than ${LIMITS.WALL_OF_TEXT_CHARS} characters — a wall of text nobody reads on a phone.`,
            fix: "Break it into short paragraphs and bulleted feature lines.",
          }
        : null;
    },
  },
  {
    id: "x-desc-no-social-proof",
    store: "both",
    field: "description",
    severity: "info",
    weight: 3,
    check: ({ listing }) =>
      /\d[\d,.]*\s*\+?\s*(?:\w+\s+){0,2}(users|downloads|reviews|ratings|stars)|rated\s+\d|featured (in|on|by)|award|app of the day/i.test(
        listing.description,
      )
        ? null
        : {
            message: "Description has no social proof (user counts, ratings, press, awards).",
            fix: "Add one credible number or mention once you have it — even beta-tester counts help.",
          },
  },
  {
    id: "x-desc-no-cta",
    store: "both",
    field: "description",
    severity: "warn",
    weight: 4,
    check: ({ listing }) => {
      const tail = listing.description.slice(
        Math.floor(listing.description.length * 0.8),
      );
      return /(download|install|get|try|start|join)\b/i.test(tail)
        ? null
        : {
            message: "Description never asks the reader to act.",
            fix: `End with a direct call to action ("Download free and …").`,
          };
    },
  },
  {
    id: "x-readability",
    store: "both",
    field: "description",
    severity: "warn",
    weight: 4,
    check: ({ sentences }) => {
      if (sentences.length === 0) return null;
      const words = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
      const avg = words.reduce((a, b) => a + b, 0) / sentences.length;
      return avg > LIMITS.READABILITY_MAX_AVG_WORDS
        ? {
            message: `Sentences average ${Math.round(avg)} words — hard to scan on a phone screen.`,
            fix: "Split long sentences; aim under ~20 words.",
          }
        : null;
    },
  },
  {
    id: "x-screenshot-count",
    store: "both",
    field: "screenshots",
    severity: "warn",
    weight: 4,
    check: ({ listing }) => {
      const n = listing.screenshotCount;
      return n !== undefined && n < LIMITS.MIN_SCREENSHOTS
        ? {
            message: `Only ${n} screenshot${n === 1 ? "" : "s"} — listings convert best with ${LIMITS.MIN_SCREENSHOTS}+ that tell a story.`,
            fix: `Add screenshots up to at least ${LIMITS.MIN_SCREENSHOTS}, captioned with benefits.`,
          }
        : null;
    },
  },
  {
    id: "x-no-video",
    store: "both",
    field: "video",
    severity: "info",
    weight: 2,
    check: ({ listing }) =>
      listing.hasVideo === false
        ? {
            message: "No preview video — video listings convert measurably better.",
            fix: "Add a 15-30s screen-capture preview when you can.",
          }
        : null,
  },
];

export const ALL_RULES: Rule[] = [...iosRules, ...androidRules, ...crossRules];
