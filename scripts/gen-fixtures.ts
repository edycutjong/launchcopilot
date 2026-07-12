/**
 * Generates the "…or try an example" gallery: ~40 fictional-but-plausible app
 * listings whose *quality* is dialled per tier so the batch spans grades F→A.
 * Every field stays within its store limit, so every example is gradeable.
 * Run: npx tsx scripts/gen-fixtures.ts   → writes data/fixtures/gallery.json
 */
import fs from "fs";
import path from "path";
import { lint, gradeFor, type AppListing } from "../src/lib/aso-lint";

type Tier = "poor" | "weak" | "ok" | "good" | "great";
type Plat = "ios" | "android" | "both";
// [id, emoji, name, platform, category, tier, subtitle(≤30), benefit, terms, competitor?]
type C = [string, string, string, Plat, string, Tier, string, string, string, string?];

const CONCEPTS: C[] = [
  ["sleepwave", "😴", "SleepWave", "ios", "Health & Fitness", "great", "Sleep sounds & smart alarm", "Fall asleep faster with mixable soundscapes and a gentle wake-up alarm.", "sleep sounds noise rain relax alarm bedtime calm night ocean thunder fan"],
  ["budgetbloom", "🌸", "BudgetBloom", "both", "Finance", "good", "Budget & expense tracker", "See where your money goes and hit a savings goal every month.", "budget expense money savings spending bills income cash debt goals"],
  ["taskforge", "⚒️", "TaskForge", "both", "Productivity", "great", "To-do lists that plan you", "Turn a messy to-do list into a plan that schedules itself.", "todo tasks planner reminders checklist projects deadlines subtasks agenda"],
  ["runtrail", "🏃", "RunTrail", "ios", "Health & Fitness", "ok", "Run tracker with maps", "Track every run with live pace, distance and a route map.", "running pace distance route marathon cadence splits intervals"],
  ["snapedit", "📸", "SnapEdit", "android", "Photo & Video", "weak", "Edit photos", "Edit photos with filters, crop and one-tap fixes.", "photo editor filters crop retouch collage presets blur"],
  ["recipenest", "🍳", "RecipeNest", "both", "Food & Drink", "good", "Recipes & meal planner", "Plan the week's dinners and build a grocery list in one tap.", "recipes cooking meals grocery dinner ideas pantry chef baking"],
  ["parkpal", "🅿️", "ParkPal", "android", "Travel", "poor", "The best parking app", "Find parking near you.", "parking spot garage meter street find cheap reserve", "spothero"],
  ["lingualoop", "🗣️", "LinguaLoop", "both", "Education", "great", "Learn a language daily", "Learn a new language in five-minute daily lessons that stick.", "language spanish french vocabulary lessons speak fluent grammar phrases"],
  ["moodjar", "🫙", "MoodJar", "ios", "Health & Fitness", "ok", "Mood & journal tracker", "Log your mood in seconds and spot what lifts it.", "mood journal diary wellbeing feelings emotions triggers reflect"],
  ["pixeldash", "🕹️", "PixelDash", "both", "Games", "weak", "Fun arcade game", "Dash through neon levels in this fast arcade runner.", "arcade runner retro pixel levels endless jump dodge"],
  ["cryptocalm", "📉", "CoinTide", "android", "Finance", "poor", "Best crypto tracker app", "Track crypto prices.", "crypto bitcoin prices portfolio coins wallet alerts", "coinbase"],
  ["chorechamp", "🧹", "ChoreChamp", "both", "Productivity", "good", "Family chore chart", "Share chores with the family and make them actually get done.", "chores family household kids rewards chart routine tidy"],
  ["focusfern", "🌿", "FocusFern", "ios", "Productivity", "great", "Focus timer that grows", "Beat distraction with focus sessions that grow a garden.", "focus pomodoro concentration study deep work distraction timer sessions"],
  ["trailmix", "🎧", "TrailMix", "both", "Music", "ok", "Playlists for every mood", "Build the perfect playlist for any moment in seconds.", "playlist songs mix mood discover queue radio genres"],
  ["vaultkey", "🔐", "VaultKey", "both", "Utilities", "good", "Password manager & vault", "Keep every password safe and autofill them anywhere.", "password manager vault secure autofill login passkey encrypt"],
  ["scanswift", "📄", "ScanSwift", "android", "Business", "weak", "Scan documents", "Scan any document to a clean PDF from your phone.", "scanner document scan receipts sign export folders"],
  ["petpal", "🐾", "PetPal", "both", "Lifestyle", "ok", "Pet care reminders", "Never miss a walk, feeding or vet visit for your pet.", "dog cat care reminders vet feeding walk grooming"],
  ["mealmap", "🥗", "MealMap", "ios", "Food & Drink", "good", "Meal prep & macros", "Plan meals that hit your macros without the spreadsheet.", "meal prep macros nutrition diet calories healthy protein"],
  ["glowup", "✨", "SkinGlow", "android", "Health & Fitness", "poor", "Best skincare app ever", "Skincare routine.", "skincare routine beauty face glow serum spf", "sephora"],
  ["codecanvas", "💻", "CodeCanvas", "both", "Developer Tools", "great", "Code snippets on the go", "Save, search and run code snippets from anywhere.", "code snippets programming developer editor syntax gist terminal regex"],
  ["driftmap", "🗺️", "DriftMap", "both", "Navigation", "ok", "Offline maps & trails", "Navigate offline with maps that work with no signal.", "maps offline navigation trails directions gps compass waypoints"],
  ["tidytide", "🧼", "TidyTide", "ios", "Lifestyle", "weak", "Cleaning schedule", "Keep the house clean with a rolling cleaning schedule.", "cleaning schedule chores tidy routine rooms declutter"],
  ["stargaze", "🔭", "StarGaze", "both", "Education", "good", "Stargazing & planets", "Point your phone at the sky and name every star.", "astronomy stars planets sky telescope constellations moon nebula"],
  ["calmcove", "🧘", "StillMind", "both", "Health & Fitness", "great", "Meditation & sleep stories", "Guided meditations and sleep stories that quiet a busy mind.", "meditation sleep anxiety mindfulness breathing stress relax unwind serenity"],
  ["flashcardly", "🃏", "FlashCardly", "both", "Education", "ok", "Flashcards that stick", "Memorise anything with spaced-repetition flashcards.", "flashcards study memory spaced repetition exam revise quiz"],
  ["greenthumb", "🪴", "GreenThumb", "ios", "Lifestyle", "good", "Plant care & watering", "Keep every houseplant alive with watering reminders.", "plants garden watering houseplant reminders soil light fertilize"],
  ["notenest", "📝", "NoteNest", "both", "Productivity", "great", "Notes that link ideas", "Capture notes fast and link ideas into a second brain.", "notes notebook writing ideas markdown organize search backlinks tags"],
  ["fitfuel", "🍎", "FitFuel", "android", "Health & Fitness", "weak", "Track your food", "Log meals and count calories easily.", "nutrition calories food diet macros meals hydration"],
  ["datedeck", "❤️", "DateDeck", "both", "Social Networking", "poor", "Best dating app around", "Meet people.", "dating match singles chat meet love profiles nearby", "tinder"],
  ["weatherwisp", "⛅", "WeatherWisp", "both", "Weather", "ok", "Hyperlocal forecast", "Know exactly when rain starts on your street.", "weather forecast rain radar temperature hourly storm humidity"],
  ["inkflow", "🖋️", "InkFlow", "ios", "Productivity", "good", "Daily journal & prompts", "Build a journaling habit with a prompt every morning.", "journal diary writing prompts gratitude reflection habit mood"],
  ["brewbar", "☕", "BrewBar", "both", "Food & Drink", "ok", "Coffee brew guides", "Brew better coffee with dialled-in recipes and timers.", "coffee brew espresso pourover recipes timer beans grind"],
  ["mindmaze", "🧩", "MindMaze", "both", "Games", "good", "Daily logic puzzles", "Sharpen your brain with a fresh logic puzzle each day.", "puzzle brain logic riddle mind train sudoku crossword"],
  ["safestep", "🦺", "SafeStep", "android", "Medical", "weak", "Safety for seniors", "Send an alert to family with one tap in an emergency.", "safety seniors emergency alert family fall medical location"],
  ["tunetutor", "🎸", "TuneTutor", "both", "Education", "great", "Learn guitar by ear", "Learn real songs on guitar with step-by-step lessons.", "guitar lessons chords music songs practice tabs strumming fretboard"],
  ["swiftsaver", "🐷", "SwiftSaver", "ios", "Finance", "ok", "Round-up savings", "Save spare change automatically on every purchase.", "savings roundup goals bank automatic save vault interest"],
  ["trailblaze", "🥾", "TrailBlaze", "both", "Health & Fitness", "good", "Hiking routes & tracker", "Find hikes near you and track every summit.", "hiking trails outdoors routes mountains gps elevation summit"],
  ["storystream", "🎧", "StoryStream", "both", "Entertainment", "great", "Audiobooks & stories", "Listen to bestselling audiobooks and original stories.", "audiobooks stories fiction narration books listen chapters sleep"],
  ["quickquote", "🧾", "QuickQuote", "android", "Business", "weak", "Invoices & quotes", "Send professional invoices and quotes from your phone.", "invoice quotes billing freelance payments clients estimates"],
  ["zenzone", "🌬️", "ZenZone", "both", "Health & Fitness", "ok", "Breathing exercises", "Calm anxiety in two minutes with guided breathing.", "breathing anxiety relax stress mindfulness focus exhale grounding"],
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const STOP = new Set(
  "the a an and or for with you your app apps to of in on is it best free new get that this all any every from into more our".split(" ")
);
const BIG_BRANDS = ["Instagram", "TikTok", "Spotify", "Netflix"]; // in the competitor-brand list → tanks a poor listing
const words = (s: string) => (s.toLowerCase().match(/[a-z]{3,}/g) || []).filter((w) => !STOP.has(w));

function packTitle(name: string, pool: string[]) {
  let title = name;
  let sep = ": ";
  const used = new Set<string>();
  for (const w of pool) {
    const cand = `${title}${sep}${cap(w)}`;
    if (cand.length <= 30) {
      title = cand;
      sep = " ";
      used.add(w);
    }
  }
  return { title, used };
}

function buildKeywords(pool: string[], exclude: Set<string>, budget: number) {
  const seen = new Set(exclude);
  const out: string[] = [];
  let len = 0;
  for (const w of pool) {
    if (seen.has(w) || w.length < 3) continue;
    seen.add(w);
    const add = (out.length ? 1 : 0) + w.length;
    if (len + add > budget) continue;
    out.push(w);
    len += add;
  }
  return out.join(",");
}

function goodDescription(name: string, benefit: string, terms: string[], q: number): string {
  const feats = terms.slice(0, 6).join(", ");
  const base =
    `${cap(benefit)} ${name} keeps it simple: ${feats}. ` +
    `Built for people who want results without the busywork, it works in seconds and stays out of your way. ` +
    `Every screen is fast, private and designed to help you actually follow through.`;
  if (q < 3) return base; // "ok" tier: solid, but no social proof or CTA → lands in C
  const proof = [
    "Loved by over 40,000 people",
    "Trusted by more than 120,000 users",
    "Rated 4.8 by 25,000 reviewers",
    "Featured on the App Store",
  ][q % 4];
  return `${base} ${proof}. Download ${name} today and feel the difference this week.`;
}

function poorDescription(c: C): string {
  const [, , name, , category, , , , termStr, competitor] = c;
  const t = termStr.split(" ").slice(0, 4).join(" ");
  return (
    `${name} is the best ${category} app. ${name} is better than ${competitor}. ` +
    `Download ${name} today. ${name} ${name} ${name} is amazing and ${name} is great. ` +
    `${t} ${t}. The ${name} app has ${t}. ${name} is the number one ${category} app and ${name} works with ${name}.`
  );
}

function build(c: C): AppListing {
  const [, , name, platform, category, tier, subtitle, benefit, termStr, competitor] = c;
  const rawTerms = termStr.split(" ");
  const q = { poor: 0, weak: 1, ok: 2, good: 3, great: 4 }[tier];
  // Poorly-optimised apps are graded on "both" stores so the full rule set
  // applies (an android-only listing skips the iOS title/subtitle/keyword rules
  // and floats up to C, flattening the low end of the range).
  const plat: Plat = q <= 1 ? "both" : platform;
  const ios = plat !== "android";
  const android = plat !== "ios";
  const pool = Array.from(new Set([...rawTerms, ...words(benefit)]));

  let title = name;
  let titleWords = new Set<string>();
  if (q >= 3) {
    const p = packTitle(name, pool);
    title = p.title;
    titleWords = p.used;
  }

  const generic = ["Simple and easy", "Fast and powerful", "Your new favourite"][q % 3];
  let sub = q >= 2 ? subtitle : q === 0 ? `Like ${BIG_BRANDS[name.length % 4]}, but better` : generic;
  sub = sub.slice(0, 30);

  const exclude = new Set<string>([...titleWords, ...words(sub), ...words(name)]);
  const kwBudget = [0, 0, 45, 80, 96][q];
  const keywords = kwBudget ? buildKeywords(pool, exclude, kwBudget) : "";
  const desc = q >= 2 ? goodDescription(name, benefit, rawTerms, q) : poorDescription(c);
  void competitor;

  const listing: AppListing = {
    appName: name,
    platform: plat,
    category,
    title,
    description: desc,
    screenshotCount: [0, 2, 5, 6, 8][q],
    hasVideo: q >= 3,
    whatItDoes: benefit,
  };
  if (ios) {
    listing.subtitle = sub;
    listing.keywords = keywords;
  }
  if (android) listing.shortDescription = (q >= 2 ? benefit : `${generic}. ${name} for all.`).slice(0, 80);
  return listing;
}

const out = CONCEPTS.map((c) => {
  const listing = build(c);
  const report = lint(listing);
  return { id: c[0], emoji: c[1], label: c[2], grade: gradeFor(report.score), score: report.score, listing };
});

const byGrade: Record<string, number> = {};
for (const o of out) byGrade[o.grade] = (byGrade[o.grade] ?? 0) + 1;
const scores = out.map((o) => o.score).sort((a, b) => a - b);
console.log("count:", out.length, "| grades:", byGrade, "| range:", scores[0], "→", scores[scores.length - 1]);

const dest = path.join(__dirname, "..", "data", "fixtures", "gallery.json");
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");
console.log("wrote", dest);
