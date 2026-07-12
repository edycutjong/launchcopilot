import type { AppListing } from "@/lib/aso-lint";

/**
 * Pull a live App Store / Google Play listing and map it onto {@link AppListing}
 * so the grader form can be auto-filled. Apple uses the official iTunes Lookup
 * API; Google Play is scraped (HTML + JSON-LD). Best-effort — anything it can't
 * read comes back in `warnings`, never guessed. Also returns a visual `preview`
 * (icon, rating, screenshot thumbnails) for the auto-fill confirmation card.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

export class ExtractError extends Error {}

export interface ListingPreview {
  storeLabel: string;
  name: string;
  category: string;
  icon?: string;
  rating?: number;
  ratingCount?: number;
  installs?: string;
  screenshots: string[];
}

export interface ExtractResult {
  patch: Partial<AppListing>;
  warnings: string[];
  summary: string;
  preview: ListingPreview;
}

type Store = "apple" | "google";

interface Raw {
  store: Store;
  storeLabel: string;
  name: string;
  subtitle?: string;
  category: string;
  description: string;
  icon?: string;
  screenshots: string[];
  rating?: number;
  ratingCount?: number;
  installs?: string;
  warnings: string[];
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      cache: "no-store",
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", ...(init.headers || {}) },
    });
  } finally {
    clearTimeout(t);
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/\\u0026/gi, "&")
    .replace(/\\"/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function detectStore(input: string): { store: Store; id: string } | null {
  const raw = input.trim();
  try {
    const u = new URL(raw);
    if (u.hostname.includes("apple.com")) {
      const m = u.pathname.match(/id(\d+)/) || raw.match(/id(\d+)/);
      if (m) return { store: "apple", id: m[1] };
    }
    if (u.hostname.includes("play.google.com")) {
      const id = u.searchParams.get("id");
      if (id) return { store: "google", id };
    }
  } catch {
    /* not a full URL */
  }
  const appleId = raw.match(/id(\d+)/);
  if (appleId) return { store: "apple", id: appleId[1] };
  const gid = raw.match(/[?&]id=([\w.]+)/) || (/^[a-z][\w.]+\.[\w.]+$/i.test(raw) ? [null, raw] : null);
  if (gid && gid[1]) return { store: "google", id: gid[1] };
  return null;
}

// ---------------- APPLE ----------------

async function fetchAppleSubtitle(url: string): Promise<string | undefined> {
  const res = await fetchWithTimeout(url, {}, 8000);
  if (!res.ok) return undefined;
  const html = await res.text();
  const m = html.match(/"subtitle"\s*:\s*"([^"]{2,80})"/);
  return m ? decodeEntities(m[1]).trim() : undefined;
}

async function extractApple(id: string): Promise<Raw> {
  const warnings: string[] = [];
  const res = await fetchWithTimeout(`https://itunes.apple.com/lookup?id=${id}&country=us`);
  if (!res.ok) throw new ExtractError(`The App Store lookup failed (HTTP ${res.status}).`);
  const data = await res.json();
  if (!data.results || data.results.length === 0) throw new ExtractError("No App Store app found for that link.");
  const r = data.results[0];

  const shots: string[] = (r.screenshotUrls?.length ? r.screenshotUrls : r.ipadScreenshotUrls) || [];
  const icon = String(r.artworkUrl512 || r.artworkUrl100 || "").replace(/\/(\d+)x(\d+)bb\.jpg$/, "/256x256bb.png") || undefined;
  let subtitle: string | undefined;
  try {
    subtitle = await fetchAppleSubtitle(r.trackViewUrl || `https://apps.apple.com/us/app/id${id}`);
  } catch {
    /* best effort */
  }
  if (!subtitle) warnings.push("Apple blocks the subtitle from automated reads — fill it in manually.");

  return {
    store: "apple",
    storeLabel: "App Store",
    name: r.trackName || "",
    subtitle,
    category: r.primaryGenreName || "",
    description: r.description || "",
    icon: icon || undefined,
    screenshots: shots.slice(0, 8),
    rating: typeof r.averageUserRating === "number" ? r.averageUserRating : undefined,
    ratingCount: r.userRatingCount,
    warnings,
  };
}

// ---------------- GOOGLE PLAY ----------------

function meta(html: string, prop: string): string | undefined {
  const m =
    html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i")) ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${prop}["']`, "i")) ||
    html.match(new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i"));
  return m ? decodeEntities(m[1]) : undefined;
}

function parseJsonLd(html: string): Record<string, unknown> | undefined {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    try {
      const obj = JSON.parse(b[1].trim());
      if (obj && (obj["@type"] === "SoftwareApplication" || obj.applicationCategory || obj.aggregateRating)) return obj;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

function googleScreenshots(html: string, iconUrl?: string): string[] {
  const iconId = iconUrl?.match(/googleusercontent\.com\/([\w-]+)/)?.[1];
  const re = /https:\/\/play-lh\.googleusercontent\.com\/([\w-]+)=w(\d+)-h(\d+)/g;
  const order: string[] = [];
  const best: Record<string, [number, number]> = {};
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, iid, w, h] = m;
    if (parseInt(w) < 500 || iid === iconId) continue;
    if (!(iid in best)) order.push(iid);
    if (!(iid in best) || parseInt(w) > best[iid][0]) best[iid] = [parseInt(w), parseInt(h)];
  }
  return order.slice(0, 8).map((iid) => `https://play-lh.googleusercontent.com/${iid}=w${best[iid][0]}-h${best[iid][1]}`);
}

function isProse(s: string): boolean {
  if (s.length < 200 || s.length > 6000) return false;
  if (/[{}]|px[;}]|:\s*0[;}]|function\s*\(|=>|vertical-align|@media|\bvar\(|https?:\/\/\S+\.(?:js|css)/i.test(s)) return false;
  const letters = (s.match(/[a-zA-Z]/g) || []).length;
  const spaces = (s.match(/\s/g) || []).length;
  return letters / s.length >= 0.6 && spaces / s.length >= 0.08;
}

const GENERIC = new Set(
  "focus timer app apps free best game games photo photos editor maker music plan planner daily study your this that with from when will have more they make take into over only also just like work love plus pro premium".split(
    /\s+/
  )
);
function distinctiveTokens(s: string): string[] {
  return Array.from(new Set((s.toLowerCase().match(/[a-zà-ÿ]{4,}/g) || []).filter((w) => !GENERIC.has(w))));
}

/** Play pages embed rival apps' copy too — match the target by distinctive tokens. */
function googleFullDescription(html: string, name: string, shortDesc?: string): string | undefined {
  const candidates: string[] = [];
  const re = /"((?:[^"\\]|\\.){200,8000}?)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const s = stripTags(m[1]).replace(/^[\s>]+/, "").trim();
    if (isProse(s)) candidates.push(s);
  }
  if (candidates.length === 0) return undefined;

  const nameTokens = distinctiveTokens(name);
  const allTokens = Array.from(new Set([...nameTokens, ...distinctiveTokens(shortDesc || "")]));
  let best: string | undefined;
  let bestScore = 0;
  for (const c of candidates) {
    const lc = c.toLowerCase();
    const nameHits = nameTokens.filter((t) => lc.includes(t)).length;
    const anyHits = allTokens.filter((t) => lc.includes(t)).length;
    const score = nameHits * 3 + anyHits;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore >= 3 ? best : undefined;
}

async function extractGoogle(id: string): Promise<Raw> {
  const warnings: string[] = [];
  const res = await fetchWithTimeout(`https://play.google.com/store/apps/details?id=${id}&gl=US&hl=en`);
  if (!res.ok) throw new ExtractError(`Google Play returned HTTP ${res.status} for that app.`);
  const html = await res.text();
  if (/We're sorry, the requested URL was not found/.test(html)) throw new ExtractError("No Google Play app found for that link.");

  const ld = parseJsonLd(html) || {};
  const icon = meta(html, "og:image") || (ld.image as string | undefined);
  const shortDesc = meta(html, "og:description");
  const name =
    (ld.name as string) || (meta(html, "og:title") || "").replace(/\s+[-–]\s+Apps on Google Play\s*$/i, "").trim();

  const agg = ld.aggregateRating as { ratingValue?: string; ratingCount?: string } | undefined;
  let rating: number | undefined;
  if (agg?.ratingValue) rating = parseFloat(agg.ratingValue);
  if (rating === undefined) {
    const rm = html.match(/(\d\.\d)\s*star/i);
    if (rm) rating = parseFloat(rm[1]);
  }
  const ratingCount = agg?.ratingCount ? parseInt(String(agg.ratingCount).replace(/\D/g, "")) : undefined;

  const installsMatch =
    html.match(/([0-9][\d.,]*[KMB]?\+)\s*<\/div>\s*<div[^>]*>\s*Downloads/i) ||
    html.match(/>([0-9][\d.,]*[KMB]?\+)<\/div><div[^>]*>Downloads/i) ||
    html.match(/([0-9][\d.,]*[KMB]?\+)[^<]{0,4}<[^>]*>\s*Downloads/i);
  const installs = installsMatch ? installsMatch[1] : undefined;

  const appCat = ld.applicationCategory as string | undefined;
  const category = appCat
    ? appCat.replace(/_/g, " ").replace(/\bAND\b/g, "&")
    : html.match(/\/store\/apps\/category\/[A-Z_]+["'][^>]*>([^<]{2,30})</)?.[1] || "";

  const fullDesc = googleFullDescription(html, name, shortDesc);
  if (!fullDesc) warnings.push("Couldn’t match the full Play description to this app — using the short description.");

  const screenshots = googleScreenshots(html, icon);
  if (screenshots.length === 0) warnings.push("Couldn’t read screenshots from the Play page.");

  return {
    store: "google",
    storeLabel: "Google Play",
    name,
    subtitle: shortDesc,
    category,
    description: fullDesc || shortDesc || "",
    icon,
    screenshots,
    rating,
    ratingCount,
    installs,
    warnings,
  };
}

// ---------------- MAP → AppListing ----------------

function clampStr(s: string | undefined, n: number): string {
  return (s || "").slice(0, n).trim();
}

function firstSentence(text: string): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  const m = t.match(/^.{20,200}?[.!?](\s|$)/);
  return (m ? m[0] : t.slice(0, 200)).trim();
}

function toResult(raw: Raw): ExtractResult {
  const count = raw.screenshots.length;
  const whatItDoes = clampStr(raw.subtitle && raw.subtitle.length >= 12 ? raw.subtitle : firstSentence(raw.description), 400);
  const patch: Partial<AppListing> = {
    appName: clampStr(raw.name, 60),
    platform: raw.store === "apple" ? "ios" : "android",
    category: clampStr(raw.category, 60),
    title: clampStr(raw.name, 120),
    description: clampStr(raw.description, 6000),
    screenshotCount: count,
    whatItDoes,
  };
  if (raw.store === "apple") patch.subtitle = clampStr(raw.subtitle, 120);
  else patch.shortDescription = clampStr(raw.subtitle, 300);

  const stat =
    raw.rating !== undefined
      ? ` · ${raw.rating.toFixed(1)}★${raw.installs ? ` · ${raw.installs}` : raw.ratingCount ? ` · ${raw.ratingCount.toLocaleString()} ratings` : ""}`
      : "";
  const summary = `Pulled “${raw.name}” from the ${raw.storeLabel}${stat} · ${count} screenshot${count === 1 ? "" : "s"}. Review the fields, then grade.`;

  const preview: ListingPreview = {
    storeLabel: raw.storeLabel,
    name: raw.name,
    category: raw.category,
    icon: raw.icon,
    rating: raw.rating,
    ratingCount: raw.ratingCount,
    installs: raw.installs,
    screenshots: raw.screenshots.slice(0, 6),
  };

  return { patch, warnings: raw.warnings, summary, preview };
}

export async function extractListing(input: string): Promise<ExtractResult> {
  const det = detectStore(input);
  if (!det)
    throw new ExtractError(
      "That doesn’t look like an App Store or Google Play link. Paste a full apps.apple.com or play.google.com URL."
    );
  const raw = det.store === "apple" ? await extractApple(det.id) : await extractGoogle(det.id);
  return toResult(raw);
}
