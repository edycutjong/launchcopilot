import { AppListing } from "@/lib/aso-lint/types";
import pocketplants from "../../data/fixtures/pocketplants.json";
import fitdash from "../../data/fixtures/fitdash.json";
import lumenhabit from "../../data/fixtures/lumenhabit.json";
import gallery from "../../data/fixtures/gallery.json";

interface GalleryEntry {
  id: string;
  emoji: string;
  label: string;
  grade: string;
  score: number;
  listing: AppListing;
}
const GALLERY = gallery as unknown as GalleryEntry[];

export const FIXTURES: Record<string, AppListing> = {
  pocketplants: pocketplants as AppListing,
  fitdash: fitdash as AppListing,
  lumenhabit: lumenhabit as AppListing,
  ...Object.fromEntries(GALLERY.map((g) => [g.id, g.listing])),
};

export interface ExampleMeta {
  id: string;
  emoji: string;
  label: string;
  blurb: string;
}

/** Curated example listings that fill the form directly, spanning grades A→F. */
export const FIXTURE_META: ExampleMeta[] = [
  { id: "pocketplants", emoji: "🌱", label: "PocketPlants", blurb: "iOS · plant care · launched Friday, 6 downloads" },
  { id: "fitdash", emoji: "💪", label: "FitDash", blurb: "Android · workout log · keyword-stuffed" },
  { id: "lumenhabit", emoji: "✨", label: "Lumen Habit", blurb: "Both stores · habit tracker · already solid" },
  ...GALLERY.map((g) => ({
    id: g.id,
    emoji: g.emoji,
    label: g.label,
    blurb: `${g.listing.platform} · ${g.listing.category} · grades ${g.grade} (${g.score}/100)`,
  })),
];

export interface LinkExample {
  url: string;
  emoji: string;
  label: string;
}

/** Real, live store listings — clicking these runs the actual paste-a-link extraction. */
export const LINK_EXAMPLES: LinkExample[] = [
  { url: "https://apps.apple.com/us/app/tiimo-ai-planner-to-do/id1480220328", emoji: "🧠", label: "Tiimo" },
  { url: "https://apps.apple.com/us/app/bandlab-music-maker-beats/id968585775", emoji: "🎛️", label: "BandLab" },
  { url: "https://apps.apple.com/us/app/ladder-strength-training-plans/id1502936453", emoji: "🪜", label: "LADDER" },
  { url: "https://play.google.com/store/apps/details?id=com.underthing.focus.friend", emoji: "🫘", label: "Focus Friend" },
  { url: "https://play.google.com/store/apps/details?id=com.skylum.luminar", emoji: "🌄", label: "Luminar" },
  { url: "https://play.google.com/store/apps/details?id=jp.pokemon.pokemontcgp", emoji: "🃏", label: "Pokémon TCG" },
];
