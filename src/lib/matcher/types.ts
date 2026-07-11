export type CommunityPlatform =
  | "reddit"
  | "hackernews"
  | "producthunt"
  | "indiehackers"
  | "discord"
  | "forum"
  | "facebook";

export type SizeTier = "S" | "M" | "L";

/** How the community treats self-promotion — drives the matcher's filtering. */
export type SelfPromoPolicy = "open" | "restricted" | "scheduled" | "banned";

export interface Community {
  id: string;
  name: string;
  platform: CommunityPlatform;
  url: string;
  tags: string[];
  sizeTier: SizeTier;
  selfPromoPolicy: SelfPromoPolicy;
  rulesSummary: string;
  /** For scheduled policies: the day self-promo is allowed (e.g. "Saturday"). */
  bestDay?: string;
  /** Title convention the community expects, if any. */
  titleFormat?: string;
}

export interface ScoredCommunity extends Community {
  score: number;
  /** Which of the app's seed keywords / category matched. */
  matchedOn: string[];
}
