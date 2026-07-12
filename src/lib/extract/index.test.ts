import { afterEach, describe, expect, it, vi } from "vitest";
import { extractListing, ExtractError, assertAllowedUrl } from "./index";

// ---------------------------------------------------------------------------
// fetch mocking — extractListing hits itunes.apple.com (JSON), apps.apple.com
// (subtitle HTML) and play.google.com (HTML). We route by URL and never touch
// the network. No real requests, fully deterministic.
// ---------------------------------------------------------------------------
function response(body: string, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: async () => body,
    json: async () => JSON.parse(body),
  } as unknown as Response;
}

interface Routes {
  itunes?: string;
  itunesOk?: boolean;
  subtitle?: string;
  subtitleOk?: boolean;
  play?: string;
  playOk?: boolean;
}

function mockFetch(routes: Routes) {
  const fn = vi.fn(async (url: string | URL) => {
    const host = new URL(String(url)).hostname; // exact host, not substring
    if (host === "itunes.apple.com") return response(routes.itunes ?? '{"results":[]}', routes.itunesOk ?? true);
    if (host === "play.google.com") return response(routes.play ?? "", routes.playOk ?? true);
    return response(routes.subtitle ?? "", routes.subtitleOk ?? true); // apps.apple.com subtitle page
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ---- Apple fixtures --------------------------------------------------------
function itunes(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    resultCount: 1,
    results: [
      {
        trackName: "Flighty",
        primaryGenreName: "Travel",
        description:
          "The flight tracker your pilot uses. Track every flight worldwide with the fastest delay alerts available to any traveller today.",
        artworkUrl512: "https://is1.mzstatic.com/image/thumb/abc/512x512bb.jpg",
        screenshotUrls: ["https://s1.png", "https://s2.png"],
        ipadScreenshotUrls: ["https://ipad1.png"],
        averageUserRating: 4.8,
        userRatingCount: 139997,
        trackViewUrl: "https://apps.apple.com/us/app/flighty/id1358823008",
        ...overrides,
      },
    ],
  });
}

const appleSubtitleHtml = (name = "Flighty", subtitle = "World's Fastest Delay Alerts") =>
  `<html><body><script>{"title":"${name}","isIOSBinaryMacOSCompatible":false,"subtitle":"${subtitle}","tertiaryTitle":null}</script></body></html>`;

// ===========================================================================
describe("input detection", () => {
  it("rejects a non-store URL", async () => {
    mockFetch({});
    await expect(extractListing("https://example.com/foo")).rejects.toBeInstanceOf(ExtractError);
  });

  it("rejects gibberish", async () => {
    mockFetch({});
    await expect(extractListing("hello world")).rejects.toThrow(/App Store or Google Play/);
  });

  it("rejects an apple host with no id in the path or raw", async () => {
    mockFetch({});
    await expect(extractListing("https://apps.apple.com/us/app/foo")).rejects.toBeInstanceOf(ExtractError);
  });

  it("rejects a play host with no id param", async () => {
    mockFetch({});
    await expect(extractListing("https://play.google.com/store/apps/details?foo=bar")).rejects.toBeInstanceOf(ExtractError);
  });

  it("detects an apple id from the raw string when the path lacks it", async () => {
    mockFetch({ itunes: itunes(), subtitle: appleSubtitleHtml() });
    // hostname is apple.com but the id only appears in the query → raw.match fallback
    const r = await extractListing("https://apps.apple.com/app?ref=id1358823008");
    expect(r.patch.appName).toBe("Flighty");
  });

  it("detects a bare google package id via the ?id= form", async () => {
    mockFetch({ play: playMetaName });
    const r = await extractListing("foo?id=com.flightradar24.free");
    expect(r.patch.platform).toBe("android");
  });

  it("detects a bare google package id with no scheme and no query", async () => {
    mockFetch({ play: playAppCat });
    const r = await extractListing("com.foo.bar"); // new URL() throws → bare-package regex
    expect(r.patch.platform).toBe("android");
  });
});

// ===========================================================================
describe("Apple extraction", () => {
  it("extracts a full listing (subtitle, screenshots, rating, icon rewrite)", async () => {
    mockFetch({ itunes: itunes(), subtitle: appleSubtitleHtml() });
    const r = await extractListing("https://apps.apple.com/us/app/flighty/id1358823008");
    expect(r.patch.platform).toBe("ios");
    expect(r.patch.appName).toBe("Flighty");
    expect(r.patch.subtitle).toBe("World's Fastest Delay Alerts");
    expect(r.patch.category).toBe("Travel");
    expect(r.patch.screenshotCount).toBe(2);
    expect(r.preview.icon).toBe("https://is1.mzstatic.com/image/thumb/abc/256x256bb.png");
    expect(r.preview.rating).toBe(4.8);
    expect(r.warnings).toEqual([]);
    expect(r.summary).toContain("Flighty");
    expect(r.summary).toContain("4.8★");
    expect(r.summary).toContain("139,997 ratings");
    expect(r.patch.whatItDoes).toBe("World's Fastest Delay Alerts"); // subtitle >= 12 chars
  });

  it("falls back to iPad screenshots, handles missing rating and short description", async () => {
    mockFetch({
      itunes: itunes({
        screenshotUrls: [],
        averageUserRating: undefined,
        userRatingCount: undefined,
        description: "tiny",
      }),
      subtitle: "<html>no subtitle object here</html>",
    });
    const r = await extractListing("id1358823008"); // bare id → new URL throws → appleId fallback
    expect(r.patch.screenshotCount).toBe(1); // ipad fallback
    expect(r.preview.rating).toBeUndefined();
    expect(r.warnings.some((w) => /subtitle/i.test(w))).toBe(true);
    expect(r.summary).toContain("1 screenshot."); // singular, no rating stat
    expect(r.summary).not.toContain("★");
    expect(r.patch.whatItDoes).toBe("tiny"); // firstSentence with no sentence end → slice
  });

  it("uses artworkUrl100 when 512 is absent", async () => {
    mockFetch({
      itunes: itunes({ artworkUrl512: undefined, artworkUrl100: "https://is1.mzstatic.com/x/100x100bb.jpg" }),
      subtitle: appleSubtitleHtml(),
    });
    const r = await extractListing("id1358823008");
    expect(r.preview.icon).toBe("https://is1.mzstatic.com/x/256x256bb.png");
  });

  it("leaves a non-standard icon URL untouched and yields undefined when no artwork", async () => {
    mockFetch({ itunes: itunes({ artworkUrl512: "https://cdn/logo.png" }), subtitle: appleSubtitleHtml() });
    const withIcon = await extractListing("id1358823008");
    expect(withIcon.preview.icon).toBe("https://cdn/logo.png");

    mockFetch({ itunes: itunes({ artworkUrl512: undefined, artworkUrl100: undefined }), subtitle: appleSubtitleHtml() });
    const noIcon = await extractListing("id1358823008");
    expect(noIcon.preview.icon).toBeUndefined();
  });

  it("warns and yields an empty app name when the listing has no track name", async () => {
    mockFetch({ itunes: itunes({ trackName: undefined }), subtitle: appleSubtitleHtml() });
    const r = await extractListing("id1358823008");
    // trackName absent → findAppleSubtitle short-circuits on empty name → subtitle warning
    expect(r.patch.appName).toBe("");
    expect(r.warnings.some((w) => /subtitle/i.test(w))).toBe(true);
  });

  it("swallows a subtitle-fetch failure and still returns the listing", async () => {
    const fn = vi.fn(async (url: string | URL) => {
      if (new URL(String(url)).hostname === "itunes.apple.com") return response(itunes());
      throw new Error("network down"); // the apps.apple.com subtitle page fails
    });
    vi.stubGlobal("fetch", fn);
    const r = await extractListing("id123");
    expect(r.patch.appName).toBe("Flighty");
    expect(r.warnings.some((w) => /subtitle/i.test(w))).toBe(true);
  });

  it("throws when the lookup responds non-ok", async () => {
    mockFetch({ itunesOk: false });
    await expect(extractListing("id123")).rejects.toThrow(/App Store lookup failed/);
  });

  it("throws when results are empty", async () => {
    mockFetch({ itunes: '{"results":[]}' });
    await expect(extractListing("id123")).rejects.toThrow(/No App Store app found/);
  });

  it("throws when the results key is missing entirely", async () => {
    mockFetch({ itunes: "{}" });
    await expect(extractListing("id123")).rejects.toThrow(/No App Store app found/);
  });

  it("warns (not throws) when the subtitle page responds non-ok", async () => {
    mockFetch({ itunes: itunes(), subtitleOk: false });
    const r = await extractListing("id123");
    expect(r.warnings.some((w) => /subtitle/i.test(w))).toBe(true);
    expect(r.patch.subtitle).toBe("");
  });

  it("handles an app with no genre, description, or screenshots at all", async () => {
    mockFetch({
      itunes: itunes({
        primaryGenreName: undefined,
        description: undefined,
        screenshotUrls: undefined,
        ipadScreenshotUrls: undefined,
      }),
      subtitle: appleSubtitleHtml(),
    });
    const r = await extractListing("id123");
    expect(r.patch.category).toBe("");
    expect(r.patch.description).toBe("");
    expect(r.patch.screenshotCount).toBe(0);
    expect(r.summary).toContain("0 screenshots");
  });
});

// ===========================================================================
describe("SSRF allow-list (assertAllowedUrl)", () => {
  it("returns the URL for each allow-listed https host", () => {
    expect(assertAllowedUrl(new URL("https://itunes.apple.com/lookup?id=1")).hostname).toBe("itunes.apple.com");
    expect(assertAllowedUrl(new URL("https://apps.apple.com/us/app/id1")).hostname).toBe("apps.apple.com");
    expect(assertAllowedUrl(new URL("https://play.google.com/store/apps/details?id=a.b")).hostname).toBe("play.google.com");
  });

  it("rejects a disallowed host (including look-alikes)", () => {
    expect(() => assertAllowedUrl(new URL("https://apps.apple.com.evil.example.com/app"))).toThrow(ExtractError);
    expect(() => assertAllowedUrl(new URL("https://evil.example.com/app"))).toThrow(/App Store and Google Play/);
  });

  it("rejects a non-https scheme", () => {
    expect(() => assertAllowedUrl(new URL("http://apps.apple.com/app"))).toThrow(/App Store and Google Play/);
  });

  it("aborts a hung request once the timeout fires", async () => {
    vi.useFakeTimers();
    const fn = vi.fn(
      (_url: string, opts: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal.addEventListener("abort", () => reject(new Error("aborted")));
        })
    );
    vi.stubGlobal("fetch", fn);
    const p = extractListing("id123");
    const assertion = expect(p).rejects.toBeInstanceOf(Error);
    await vi.advanceTimersByTimeAsync(12001);
    await assertion;
  });
});

// ---- Google fixtures -------------------------------------------------------
const LONG_DESC =
  "FlightRadar24 is the flightradar app that tracks every flight worldwide in real time. " +
  "Get the fastest flight delay alerts for travellers, follow planes on a live map, and see arrival times. " +
  "Loved by millions of aviation fans everywhere every single day of the year.";

const GENERIC_PROSE =
  "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et " +
  "dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip.";

// G1: ld @type SoftwareApplication (preceded by invalid / null / non-matching
// blocks), meta property-first + content-first, installs pattern 1, screenshots.
const playFull =
  `<!doctype html><head>` +
  `<meta property="og:image" content="https://play-lh.googleusercontent.com/ICON=w480-h960">` +
  `<meta content="Fast flight delay alerts for travellers" property="og:description">` +
  `<script type="application/ld+json">not valid json {</script>` +
  `<script type="application/ld+json">null</script>` +
  `<script type="application/ld+json">{"@type":"Thing","name":"ignore me"}</script>` +
  `<script type="application/ld+json">{"@type":"SoftwareApplication","name":"FlightRadar24",` +
  `"applicationCategory":"TRAVEL_AND_LOCAL","image":"https://ld/icon.png",` +
  `"aggregateRating":{"ratingValue":"4.6","ratingCount":"1,234,567"}}</script></head><body>` +
  `<div>10,000,000+</div><div>Downloads</div>` +
  `<img src="https://play-lh.googleusercontent.com/SHOT1=w1000-h2000">` +
  `<img src="https://play-lh.googleusercontent.com/SHOT2=w1000-h2000">` +
  `<img src="https://play-lh.googleusercontent.com/SMALL=w320-h640">` +
  `<img src="https://play-lh.googleusercontent.com/ICON=w512-h1024">` +
  `<img src="https://play-lh.googleusercontent.com/SHOT1=w1200-h2400">` +
  `<img src="https://play-lh.googleusercontent.com/SHOT2=w800-h1600">` + // dup, smaller → best not updated
  `<div data-desc="${LONG_DESC}"></div>` +
  `<div data-generic="${GENERIC_PROSE}"></div>` +
  `</body>`;

// G2: meta name= form, no ld+json (→ {}), og:title with the store suffix, rating
// via the "4.5 star" fallback, category via the /store/apps/category link, and
// neither a matchable description nor screenshots (both warn).
const playMetaName =
  `<!doctype html><head>` +
  `<meta name="og:title" content="Cool App - Apps on Google Play">` +
  `</head><body><span>4.5 star</span>` +
  `<a href="/store/apps/category/TRAVEL">Travel</a></body>`;

// G3: ld with applicationCategory but a non-SoftwareApplication @type (2nd operand).
const playAppCat =
  `<!doctype html><head>` +
  `<meta property="og:title" content="AppCat">` +
  `<script type="application/ld+json">{"@type":"WebSite","applicationCategory":"GAME","name":"AppCat"}</script>` +
  `</head><body>` +
  `<img src="https://play-lh.googleusercontent.com/A=w800-h1600">` +
  `<div data-x="${GENERIC_PROSE}"></div></body>`;

// G4: ld with only aggregateRating (3rd operand), installs via the generic-tag
// pattern, description candidate that does not match the name (score < 3 → warn).
const playAggOnly =
  `<!doctype html><head>` +
  `<meta property="og:title" content="Zed">` +
  `<meta property="og:description" content="A short blurb about zed the app">` +
  `<script type="application/ld+json">{"aggregateRating":{"ratingValue":"3.9","ratingCount":"55"}}</script>` +
  `</head><body>2,500+<span>Downloads</span>` +
  `<img src="https://play-lh.googleusercontent.com/Q=w800-h1600">` +
  `<div data-x="${GENERIC_PROSE}"></div></body>`;

// G5: strings that exercise every isProse rejection branch plus one that passes.
const CODE_BLOB = "body { color: red; padding: 0px; } .cls { margin: 0; } function x(){ return 1; } ".repeat(3);
const SHORT_AFTER_STRIP = "<span></span>".repeat(30); // >200 raw, ~0 after stripTags
const HUGE = "word ".repeat(1300); // > 6000 chars
const LOW_LETTERS = "1234567890 ".repeat(30); // letters ratio < 0.6
const LOW_SPACES = "abcdefghijklmnopqrstuvwxyz".repeat(12); // spaces ratio < 0.08
const playProse =
  `<!doctype html><head>` +
  `<meta property="og:title" content="FlightRadar24">` +
  `<meta property="og:description" content="Track flights with FlightRadar24 fast">` +
  `</head><body>` +
  `<div data-a="${CODE_BLOB}"></div>` +
  `<div data-b="${SHORT_AFTER_STRIP}"></div>` +
  `<div data-c="${HUGE}"></div>` +
  `<div data-d="${LOW_LETTERS}"></div>` +
  `<div data-e="${LOW_SPACES}"></div>` +
  `<div data-f="${LONG_DESC}"></div>` +
  `<img src="https://play-lh.googleusercontent.com/S=w900-h1800">` +
  `</body>`;

describe("Google Play extraction", () => {
  it("extracts a full listing from JSON-LD + meta + screenshots + installs", async () => {
    mockFetch({ play: playFull });
    const r = await extractListing("https://play.google.com/store/apps/details?id=com.flightradar24.free");
    expect(r.patch.platform).toBe("android");
    expect(r.patch.appName).toBe("FlightRadar24"); // ld.name
    expect(r.patch.category).toBe("TRAVEL & LOCAL"); // _ → space, AND → &
    expect(r.patch.shortDescription).toBe("Fast flight delay alerts for travellers");
    expect(r.patch.description).toContain("flightradar app"); // matched long description
    expect(r.patch.screenshotCount).toBe(2); // small + icon skipped, SHOT1 deduped
    expect(r.preview.rating).toBe(4.6);
    expect(r.preview.ratingCount).toBe(1234567);
    expect(r.preview.installs).toBe("10,000,000+");
    expect(r.summary).toContain("10,000,000+"); // installs branch of the stat
    expect(r.warnings).toEqual([]);
  });

  it("handles name-meta, no JSON-LD, star fallback, category link, and warns on missing desc/screens", async () => {
    mockFetch({ play: playMetaName });
    const r = await extractListing("https://play.google.com/store/apps/details?id=com.cool.app");
    expect(r.patch.appName).toBe("Cool App"); // og:title minus the store suffix
    expect(r.preview.rating).toBe(4.5); // "4.5 star" fallback
    expect(r.patch.category).toBe("Travel"); // category link fallback
    expect(r.warnings.some((w) => /description/i.test(w))).toBe(true);
    expect(r.warnings.some((w) => /screenshots/i.test(w))).toBe(true);
  });

  it("reads category & rating from an applicationCategory-only JSON-LD block", async () => {
    mockFetch({ play: playAppCat });
    const r = await extractListing("https://play.google.com/store/apps/details?id=com.app.cat");
    expect(r.patch.category).toBe("GAME");
    expect(r.preview.rating).toBeUndefined(); // no aggregateRating, no star text
    expect(r.patch.screenshotCount).toBe(1);
  });

  it("reads rating from an aggregateRating-only block and installs from a generic tag", async () => {
    mockFetch({ play: playAggOnly });
    const r = await extractListing("https://play.google.com/store/apps/details?id=com.zed.app");
    expect(r.preview.rating).toBe(3.9);
    expect(r.preview.ratingCount).toBe(55);
    expect(r.preview.installs).toBe("2,500+"); // generic-tag installs pattern
    // description candidate doesn't match the name → falls back to the short blurb
    expect(r.warnings.some((w) => /description/i.test(w))).toBe(true);
    expect(r.patch.description).toBe("A short blurb about zed the app");
  });

  it("rejects every non-prose candidate and keeps only the real description", async () => {
    mockFetch({ play: playProse });
    const r = await extractListing("https://play.google.com/store/apps/details?id=com.fr24");
    expect(r.patch.description).toContain("flightradar app");
    expect(r.warnings).toEqual([]);
  });

  it("throws when Play responds non-ok", async () => {
    mockFetch({ playOk: false });
    await expect(extractListing("https://play.google.com/store/apps/details?id=com.x.y")).rejects.toThrow(/Google Play returned/);
  });

  it("throws on a Play 404 page", async () => {
    mockFetch({ play: "<html>We're sorry, the requested URL was not found on this server.</html>" });
    await expect(extractListing("https://play.google.com/store/apps/details?id=com.missing.app")).rejects.toThrow(/No Google Play app/);
  });

  it("yields an empty name when neither JSON-LD name nor og:title is present", async () => {
    const html =
      `<head><meta property="og:description" content="Some app blurb here"></head>` +
      `<body><img src="https://play-lh.googleusercontent.com/N=w800-h1600"></body>`;
    mockFetch({ play: html });
    const r = await extractListing("https://play.google.com/store/apps/details?id=com.no.name");
    expect(r.patch.appName).toBe("");
    expect(r.patch.shortDescription).toBe("Some app blurb here");
  });
});
