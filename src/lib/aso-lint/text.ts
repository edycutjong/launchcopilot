const graphemeSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

/** Store character limits count what the user sees — graphemes, not UTF-16 units. */
export function graphemeLength(s: string): number {
  let n = 0;
  for (const _ of graphemeSegmenter.segment(s)) n++;
  return n;
}

export function normalize(s: string): string {
  return s.normalize("NFC").trim();
}

export function tokenize(s: string): string[] {
  return normalize(s)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Light plural stemmer — enough to catch plant/plants duplication without false merges. */
export function stem(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) return token.slice(0, -3) + "y";
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

/** Words Apple/Google ignore or that waste keyword-field budget. */
export const STOPWORDS = new Set([
  "app", "apps", "free", "best", "top", "new", "the", "a", "an", "for",
  "your", "of", "and", "with", "to", "my", "in", "on", "it", "is", "you",
]);

export const SUPERLATIVES = [
  "best", "#1", "no. 1", "number one", "greatest", "amazing", "awesome",
  "ultimate", "revolutionary", "world's", "worlds",
];

/** Competitor brand names in metadata are an App Store rejection risk. */
export const COMPETITOR_BRANDS = new Set([
  "instagram", "tiktok", "whatsapp", "facebook", "spotify", "netflix",
  "duolingo", "headspace", "calm", "notion", "strava", "myfitnesspal",
  "youtube", "snapchat", "pinterest", "telegram", "discord", "twitter",
]);

export function hasEmoji(s: string): boolean {
  return /\p{Extended_Pictographic}/u.test(s);
}

export function splitSentences(s: string): string[] {
  return s
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function countTokens(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

export function nonStopword(tokens: string[]): string[] {
  return tokens.filter((t) => !STOPWORDS.has(t));
}
