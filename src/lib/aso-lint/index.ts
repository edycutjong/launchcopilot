import { ALL_RULES } from "./rules";
import {
  AppListing,
  FieldStat,
  Grade,
  LIMITS,
  LintFinding,
  LintReport,
  Rule,
  RuleContext,
} from "./types";
import {
  graphemeLength,
  normalize,
  splitSentences,
  STOPWORDS,
  tokenize,
} from "./text";

export * from "./types";
export { ALL_RULES } from "./rules";

function buildContext(listing: AppListing): RuleContext {
  const title = normalize(listing.title);
  const subtitle = normalize(listing.subtitle ?? "");
  const keywords = normalize(listing.keywords ?? "");
  const shortDesc = normalize(listing.shortDescription ?? "");
  return {
    listing,
    titleLen: graphemeLength(title),
    subtitleLen: graphemeLength(subtitle),
    keywordsLen: graphemeLength(keywords),
    shortDescLen: graphemeLength(shortDesc),
    brandTokens: new Set(tokenize(listing.appName)),
    titleTokens: tokenize(title),
    subtitleTokens: tokenize(subtitle),
    keywordItems: keywords.split(",").map((k) => k.trim()).filter(Boolean),
    keywordTokens: tokenize(keywords),
    descTokens: tokenize(listing.description),
    whatItDoesTokens: tokenize(listing.whatItDoes).filter(
      (t) => t.length > 2 && !STOPWORDS.has(t),
    ),
    sentences: splitSentences(listing.description),
  };
}

function applicable(rule: Rule, platform: AppListing["platform"]): boolean {
  if (rule.store === "both") return true;
  return platform === "both" || platform === rule.store;
}

export function gradeFor(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}

export function lint(listing: AppListing): LintReport {
  const ctx = buildContext(listing);
  const findings: LintFinding[] = [];

  for (const rule of ALL_RULES) {
    if (!applicable(rule, listing.platform)) continue;
    const hit = rule.check(ctx);
    if (hit) {
      findings.push({
        ruleId: rule.id,
        store: rule.store,
        field: rule.field,
        severity: rule.severity,
        weight: rule.weight,
        ...hit,
      });
    }
  }

  const penalty = findings.reduce((sum, f) => sum + f.weight, 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));

  const fieldStats: Record<string, FieldStat> = {};
  const isIos = listing.platform !== "android";
  const isAndroid = listing.platform !== "ios";
  if (isIos) {
    fieldStats.title = stat(ctx.titleLen, LIMITS.IOS_TITLE);
    fieldStats.subtitle = stat(ctx.subtitleLen, LIMITS.IOS_SUBTITLE);
    fieldStats.keywords = stat(ctx.keywordsLen, LIMITS.IOS_KEYWORDS);
  }
  if (isAndroid) {
    if (!isIos) fieldStats.title = stat(ctx.titleLen, LIMITS.ANDROID_TITLE);
    fieldStats.shortDescription = stat(ctx.shortDescLen, LIMITS.ANDROID_SHORT_DESC);
    fieldStats.description = stat(
      graphemeLength(listing.description),
      LIMITS.ANDROID_DESC,
    );
  }

  return { score, grade: gradeFor(score), findings, fieldStats };
}

function stat(used: number, max: number): FieldStat {
  return { used, max, wasted: Math.max(0, max - used) };
}
