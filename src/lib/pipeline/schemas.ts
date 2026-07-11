import { z } from "zod";

// ── Profile ───────────────────────────────────────────────────────────
export const AppProfileSchema = z.object({
  personas: z
    .array(
      z.object({
        name: z.string().describe("short persona label, e.g. 'Maya, busy plant parent'"),
        need: z.string(),
        objection: z.string().describe("their main reason not to download"),
      }),
    )
    .describe("2-3 target personas"),
  valuePropsRanked: z.array(z.string()).describe("3-5 ranked value propositions, strongest first"),
  tone: z.string().describe("the voice to write marketing in, e.g. 'warm, encouraging, plain'"),
  categoryKeywordSeeds: z
    .array(z.string())
    .describe("12-20 real search terms users type to find an app like this"),
  competitorArchetypes: z.array(z.string()).describe("2-3 kinds of app this competes with"),
  oneLinePositioning: z.string(),
});
export type AppProfile = z.infer<typeof AppProfileSchema>;

// ── ASO rewrite (one variant) ─────────────────────────────────────────
export const AsoVariantSchema = z.object({
  approach: z.enum(["benefit-led", "keyword-led"]),
  title: z.string().describe("store title, aim ≤30 chars, brand + top keywords"),
  subtitle: z.string().describe("iOS subtitle, ≤30 chars, searched terms not a slogan"),
  shortDescription: z.string().describe("Android short description, ≤80 chars, leads with the benefit"),
  keywordCandidates: z
    .array(z.string())
    .describe("ranked iOS keyword phrases, strongest first — no brand/title words, no stopwords"),
  descriptionFirstFold: z.string().describe("first ~2 sentences: the hook + what it does"),
  descriptionFull: z.string().describe("full store description, short paragraphs, ends with a CTA"),
  rationale: z
    .array(z.object({ field: z.string(), why: z.string() }))
    .describe("per-field: which ASO problem this fixes"),
});
export type AsoVariant = z.infer<typeof AsoVariantSchema>;

// ── Product Hunt ──────────────────────────────────────────────────────
export const ProductHuntSchema = z.object({
  tagline: z.string().describe("≤60 chars, benefit-forward"),
  description: z.string(),
  makerFirstComment: z.string().describe("the maker's launch-day first comment"),
  topics: z.array(z.string()).describe("3-5 Product Hunt topics"),
  launchDayChecklist: z.array(z.string()),
});
export type ProductHuntKit = z.infer<typeof ProductHuntSchema>;

// ── Social calendar ───────────────────────────────────────────────────
export const SocialSchema = z.object({
  days: z
    .array(
      z.object({
        day: z.string().describe("e.g. 'Launch day', 'Day +1'"),
        theme: z.string(),
        post: z.string().describe("the post text, ≤280 chars"),
        hashtags: z.array(z.string()).describe("≤2 hashtags"),
      }),
    )
    .describe("exactly 7 days: teaser → launch thread → proof → feature → behind-the-scenes → milestone → CTA"),
});
export type SocialKit = z.infer<typeof SocialSchema>;

// ── Community posts (for the matched communities) ─────────────────────
export const CommunitySchema = z.object({
  items: z.array(
    z.object({
      communityId: z.string(),
      postTitle: z.string(),
      postBody: z.string(),
      whyThisCommunity: z.string(),
    }),
  ),
});
export type CommunityKit = z.infer<typeof CommunitySchema>;

// ── Press ─────────────────────────────────────────────────────────────
export const PressSchema = z.object({
  blurb50: z.string().describe("~50-word blurb"),
  blurb100: z.string().describe("~100-word blurb"),
  coldEmail: z.object({ subject: z.string(), body: z.string() }),
});
export type PressKit = z.infer<typeof PressSchema>;

// ── Persona panel critic ──────────────────────────────────────────────
export const PanelSchema = z.object({
  verdicts: z.array(
    z.object({
      artifactId: z
        .string()
        .describe("one of: aso, producthunt, social, community, press"),
      personaReactions: z.array(
        z.object({
          persona: z.string(),
          specificity: z.number().describe("1-10"),
          hookStrength: z.number().describe("1-10"),
          channelFit: z.number().describe("1-10"),
          reaction: z.string().describe("one sentence, in the persona's voice"),
        }),
      ),
    }),
  ),
  asoPick: z.object({
    approach: z.enum(["benefit-led", "keyword-led"]),
    reason: z.string(),
  }),
});
export type Panel = z.infer<typeof PanelSchema>;
