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

/**
 * SSRF hardening (CWE-918 / CodeQL `js/request-forgery`). Every request URL is
 * built from a *literal-constant host* with the user-derived id confined to the
 * query/path (via `URL` + `searchParams`), so the request target host is fixed
 * at author time and can't be influenced by input. {@link assertAllowedUrl} is a
 * belt-and-braces check that the host is one we expect before anything leaves.
 */
const ALLOWED_HOSTS = ["itunes.apple.com", "apps.apple.com", "play.google.com"];

export function assertAllowedUrl(u: URL): URL {
  if (u.protocol !== "https:" || !ALLOWED_HOSTS.includes(u.hostname)) {
    throw new ExtractError("Only App Store and Google Play links can be fetched.");
  }
  return u;
}

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

async function fetchWithTimeout(target: URL, ms = 12000) {
  assertAllowedUrl(target);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(target, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    });
  } finally {
    clearTimeout(t);
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/\\"/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    // Ampersand producers go LAST — after every &xxx; decode — so we never
    // double-unescape (e.g. "&amp;lt;" → "&lt;", never "<").
    .replace(/&amp;/g, "&")
    .replace(/\\u0026/gi, "&");
}

function stripTags(html: string): string {
  let text = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n");
  // Strip tags repeatedly until stable, so overlapping constructs like
  // "<scr<script>ipt>" can't survive a single pass (CodeQL incomplete-sanitization).
  let previous = "";
  while (text !== previous) {
    previous = text;
    text = text.replace(/<[^>]*>/g, "");
  }
  return decodeEntities(text)
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function detectStore(input: string): { store: Store; id: string } | null {
  const raw = input.trim();
  try {
    const u = new URL(raw);
    if (u.hostname.endsWith(".apple.com")) {
      const m = u.pathname.match(/id(\d+)/) || raw.match(/id(\d+)/);
      if (m) return { store: "apple", id: m[1] };
    }
    if (u.hostname === "play.google.com") {
      const id = u.searchParams.get("id");
      if (id) return { store: "google", id };
    }
  } catch {
    /* not a full URL */
  }
  const appleId = raw.match(/id(\d+)/);
  if (appleId) return { store: "apple", id: appleId[1] };
  // Reverse-domain package id (dot-separated word segments). The pattern is
  // linear — no overlapping quantifiers — to avoid polynomial ReDoS on the
  // user-supplied string (CodeQL js/polynomial-redos).
  const gid = raw.match(/[?&]id=([\w.]+)/) || (/^[a-z]\w*(?:\.\w+)+$/i.test(raw) ? [null, raw] : null);
  if (gid && gid[1]) return { store: "google", id: gid[1] };
  return null;
}

// ---------------- APPLE ----------------

/**
 * Apple's product page embeds many *other* apps' subtitles — in-app event
 * promos ("Rep your team…") and "you might also like" recommendations — so any
 * loose match grabs the wrong string. The app's own subtitle is the one inside
 * the product object whose `"title"` equals the app name (its `"subtitle"` sits
 * a few keys later, before the next `}`). If that exact anchor isn't found we
 * return nothing and warn — never a guessed subtitle from a neighbouring app.
 */
function findAppleSubtitle(html: string, appName: string): string | undefined {
  if (!appName) return undefined;
  const esc = appName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = html.match(new RegExp(`"title":"${esc}"[^}]*?"subtitle":"((?:[^"\\\\]|\\\\.){2,90})"`));
  return m ? decodeEntities(m[1]).trim() : undefined;
}

async function fetchAppleSubtitle(url: URL, appName: string): Promise<string | undefined> {
  const res = await fetchWithTimeout(url, 8000);
  if (!res.ok) return undefined;
  return findAppleSubtitle(await res.text(), appName);
}

async function extractApple(id: string): Promise<Raw> {
  const warnings: string[] = [];
  const appId = id.replace(/\D/g, ""); // digits only
  const lookup = new URL("https://itunes.apple.com/lookup"); // literal host; id goes in the query
  lookup.searchParams.set("id", appId);
  lookup.searchParams.set("country", "us");
  const res = await fetchWithTimeout(lookup);
  if (!res.ok) throw new ExtractError(`The App Store lookup failed (HTTP ${res.status}).`);
  const data = await res.json();
  if (!data.results || data.results.length === 0) throw new ExtractError("No App Store app found for that link.");
  const r = data.results[0];

  const shots: string[] = (r.screenshotUrls?.length ? r.screenshotUrls : r.ipadScreenshotUrls) || [];
  const icon = String(r.artworkUrl512 || r.artworkUrl100 || "").replace(/\/(\d+)x(\d+)bb\.jpg$/, "/256x256bb.png") || undefined;
  let subtitle: string | undefined;
  try {
    const subtitleUrl = new URL("https://apps.apple.com"); // literal host; id goes in the path
    subtitleUrl.pathname = `/us/app/id${appId}`;
    subtitle = await fetchAppleSubtitle(subtitleUrl, r.trackName || "");
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
  const pkg = id.replace(/[^a-zA-Z0-9._]/g, ""); // package-id charset only
  const details = new URL("https://play.google.com/store/apps/details"); // literal host; id in the query
  details.searchParams.set("id", pkg);
  details.searchParams.set("gl", "US");
  details.searchParams.set("hl", "en");
  const res = await fetchWithTimeout(details);
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
