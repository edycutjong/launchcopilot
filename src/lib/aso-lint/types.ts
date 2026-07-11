export type Platform = "ios" | "android" | "both";
export type Severity = "critical" | "warn" | "info";

/** Which store a rule applies to; "both" = cross-store rule. */
export type RuleStore = "ios" | "android" | "both";

export interface AppListing {
  appName: string;
  platform: Platform;
  category: string;
  title: string;
  /** iOS subtitle (30 chars). */
  subtitle?: string;
  /** iOS keyword field (100 chars, comma-separated). */
  keywords?: string;
  /** Android short description (80 chars). */
  shortDescription?: string;
  description: string;
  screenshotCount?: number;
  hasVideo?: boolean;
  /** Dev's own 1-2 sentence plain answer to "what does your app do". */
  whatItDoes: string;
}

export interface LintFinding {
  ruleId: string;
  store: RuleStore;
  field: string;
  severity: Severity;
  weight: number;
  message: string;
  fix: string;
}

export interface FieldStat {
  used: number;
  max: number;
  wasted: number;
}

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface LintReport {
  score: number;
  grade: Grade;
  findings: LintFinding[];
  fieldStats: Record<string, FieldStat>;
}

export interface RuleContext {
  listing: AppListing;
  titleLen: number;
  subtitleLen: number;
  keywordsLen: number;
  shortDescLen: number;
  brandTokens: Set<string>;
  titleTokens: string[];
  subtitleTokens: string[];
  /** Comma-separated keyword entries, trimmed, original case preserved. */
  keywordItems: string[];
  keywordTokens: string[];
  descTokens: string[];
  whatItDoesTokens: string[];
  sentences: string[];
}

export interface Rule {
  id: string;
  store: RuleStore;
  field: string;
  severity: Severity;
  weight: number;
  check(ctx: RuleContext): { message: string; fix: string } | null;
}

export const LIMITS = {
  IOS_TITLE: 30,
  IOS_SUBTITLE: 30,
  IOS_KEYWORDS: 100,
  ANDROID_TITLE: 30,
  ANDROID_SHORT_DESC: 80,
  ANDROID_DESC: 4000,
  FIRST_FOLD_CHARS: 255,
  MIN_SCREENSHOTS: 4,
  TITLE_WASTE_THRESHOLD: 8,
  KW_UTILIZATION_MIN: 0.8,
  WALL_OF_TEXT_CHARS: 600,
  REPETITION_THRESHOLD: 6,
  DENSITY_MAX: 0.05,
  READABILITY_MAX_AVG_WORDS: 30,
} as const;
