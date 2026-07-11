import { graphemeLength, STOPWORDS, stem, tokenize } from "@/lib/aso-lint/text";

export interface ExcludedTerm {
  term: string;
  reason: "duplicates-metadata" | "duplicate-stem" | "stopword-only" | "over-budget";
}

export interface PackResult {
  /** Final comma-joined field, no spaces, ≤ maxLen. */
  keywords: string;
  used: number;
  max: number;
  utilization: number;
  included: string[];
  excluded: ExcludedTerm[];
}

/**
 * Greedy-pack ranked keyword candidates into the iOS 100-char field.
 * Earlier candidates rank higher (the generator emits them ranked); value/cost
 * greedy keeps high-rank short terms when budget is tight.
 */
export function packKeywords(
  candidates: string[],
  metaTokens: string[],
  maxLen = 100,
): PackResult {
  const metaStems = new Set(metaTokens.map(stem));
  const seenStems = new Set<string>();
  const included: string[] = [];
  const excluded: ExcludedTerm[] = [];

  interface Scored {
    term: string;
    tokens: string[];
    value: number;
    cost: number;
  }

  const cleaned: Scored[] = [];
  const seenTerm = new Set<string>();
  candidates.forEach((raw, i) => {
    const term = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (!term || seenTerm.has(term)) return;
    seenTerm.add(term);
    const tokens = tokenize(term);
    const substantive = tokens.filter((t) => !STOPWORDS.has(t));
    if (substantive.length === 0) {
      excluded.push({ term, reason: "stopword-only" });
      return;
    }
    if (substantive.every((t) => metaStems.has(stem(t)))) {
      excluded.push({ term, reason: "duplicates-metadata" });
      return;
    }
    cleaned.push({
      term,
      tokens: substantive,
      value: candidates.length - i,
      cost: graphemeLength(term) + 1, // +1 for the joining comma
    });
  });

  cleaned.sort((a, b) => b.value / b.cost - a.value / a.cost);

  let used = 0;
  for (const c of cleaned) {
    const newStems = c.tokens.map(stem).filter((s) => !seenStems.has(s));
    if (newStems.length === 0) {
      excluded.push({ term: c.term, reason: "duplicate-stem" });
      continue;
    }
    const addition = included.length === 0 ? c.cost - 1 : c.cost;
    if (used + addition > maxLen) {
      excluded.push({ term: c.term, reason: "over-budget" });
      continue;
    }
    included.push(c.term);
    used += addition;
    for (const s of newStems) seenStems.add(s);
  }

  const keywords = included.join(",");
  return {
    keywords,
    used: graphemeLength(keywords),
    max: maxLen,
    utilization: maxLen === 0 ? 0 : graphemeLength(keywords) / maxLen,
    included,
    excluded,
  };
}

export interface CoverageResult {
  pct: number;
  covered: string[];
  missing: string[];
}

/**
 * What share of the category seed keywords does the listing's indexed metadata
 * (title + subtitle + keywords) cover? A seed counts as covered when every one
 * of its substantive tokens appears (stem-level) somewhere in the metadata.
 */
export function keywordCoverage(
  seeds: string[],
  fields: { title: string; subtitle?: string; keywords?: string },
): CoverageResult {
  const metaStems = new Set(
    [
      ...tokenize(fields.title),
      ...tokenize(fields.subtitle ?? ""),
      ...tokenize(fields.keywords ?? ""),
    ].map(stem),
  );

  const covered: string[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const raw of seeds) {
    const seed = raw.trim().toLowerCase();
    if (!seed || seen.has(seed)) continue;
    seen.add(seed);
    const tokens = tokenize(seed).filter((t) => !STOPWORDS.has(t));
    if (tokens.length === 0) continue;
    if (tokens.every((t) => metaStems.has(stem(t)))) covered.push(seed);
    else missing.push(seed);
  }

  const total = covered.length + missing.length;
  return {
    pct: total === 0 ? 0 : Math.round((covered.length / total) * 100),
    covered,
    missing,
  };
}
