import { stem, tokenize } from "@/lib/aso-lint/text";
import communitiesRaw from "../../../data/communities.json";
import { Community, ScoredCommunity } from "./types";

export * from "./types";

export const COMMUNITIES: Community[] = communitiesRaw as Community[];

const CATEGORY_BOOST = 3;
const TAG_HIT = 2;

/**
 * Rank communities for an app by tag/keyword overlap. Hard-filters `banned`
 * communities — LaunchCopilot will never point a user at a place that bans
 * self-promotion. Deterministic and fully unit-testable.
 */
export function matchCommunities(
  seeds: string[],
  category: string,
  opts: { limit?: number; pool?: Community[] } = {},
): ScoredCommunity[] {
  const pool = opts.pool ?? COMMUNITIES;
  const limit = opts.limit ?? 5;

  const seedStems = new Set(seeds.flatMap((s) => tokenize(s).map(stem)));
  const catStems = new Set(tokenize(category).map(stem));

  const scored: ScoredCommunity[] = [];
  for (const c of pool) {
    if (c.selfPromoPolicy === "banned") continue;

    const matchedOn: string[] = [];
    let score = 0;
    for (const tag of c.tags) {
      const tagStems = tokenize(tag).map(stem);
      if (tagStems.some((t) => seedStems.has(t))) {
        score += TAG_HIT;
        matchedOn.push(tag);
      }
      if (tagStems.some((t) => catStems.has(t))) {
        score += CATEGORY_BOOST;
        if (!matchedOn.includes(tag)) matchedOn.push(tag);
      }
    }
    if (score > 0) scored.push({ ...c, score, matchedOn });
  }

  // Tie-break: higher score, then larger community, then stable id order.
  const tierRank = { L: 3, M: 2, S: 1 } as const;
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      tierRank[b.sizeTier] - tierRank[a.sizeTier] ||
      a.id.localeCompare(b.id),
  );

  return scored.slice(0, limit);
}
