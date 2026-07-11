import { AppListing } from "@/lib/aso-lint/types";
import pocketplants from "../../data/fixtures/pocketplants.json";
import fitdash from "../../data/fixtures/fitdash.json";
import lumenhabit from "../../data/fixtures/lumenhabit.json";

export const FIXTURES: Record<string, AppListing> = {
  pocketplants: pocketplants as AppListing,
  fitdash: fitdash as AppListing,
  lumenhabit: lumenhabit as AppListing,
};

export const FIXTURE_META = [
  { id: "pocketplants", emoji: "🌱", label: "PocketPlants", blurb: "iOS · plant care · launched Friday, 6 downloads" },
  { id: "fitdash", emoji: "💪", label: "FitDash", blurb: "Android · workout log · keyword-stuffed" },
  { id: "lumenhabit", emoji: "✨", label: "Lumen Habit", blurb: "Both stores · habit tracker · already solid" },
] as const;
