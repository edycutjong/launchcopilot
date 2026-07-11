/* Export static PNGs @2x. Animated SVGs are the deliverable and are NOT
   rasterized here except a single deterministic still for socials/README. */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const HTML = [
  { file: "generate-og-image.html", out: "og-image.png", w: 1200, h: 630 },
  { file: "generate-youtube-thumbnail.html", out: "youtube-thumbnail.png", w: 1280, h: 720 },
  { file: "generate-cover.html", out: "devpost-gallery.png", w: 1200, h: 800 },
  { file: "generate-cover.html", out: "devpost-thumbnail.png", w: 1200, h: 800 },
];

// A still frame of an animated SVG (animations paused via reduced-motion + a wait)
const STILL = [
  { svg: "readme-hero-animated.svg", out: "readme-hero.png", w: 1280, h: 320, wait: 5400 },
];
const ICONS = [
  { svg: "icon.svg", out: "icon-512.png", size: 512 },
  { svg: "icon.svg", out: "icon-1024.png", size: 1024 },
];

(async () => {
  const dir = __dirname;
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2 });

  for (const g of HTML) {
    await page.setViewportSize({ width: g.w, height: g.h });
    await page.goto("file://" + path.join(dir, g.file));
    try { await page.evaluate(() => document.fonts && document.fonts.ready); } catch {}
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(dir, g.out), clip: { x: 0, y: 0, width: g.w, height: g.h } });
    console.log("  ✓", g.out);
  }

  for (const s of STILL) {
    const svg = fs.readFileSync(path.join(dir, s.svg), "utf-8");
    await page.setViewportSize({ width: s.w, height: s.h });
    await page.setContent(`<style>html,body{margin:0;background:#0d0221}svg{display:block;width:${s.w}px;height:${s.h}px}</style>${svg}`);
    await page.waitForTimeout(s.wait);
    await page.screenshot({ path: path.join(dir, s.out) });
    console.log("  ✓", s.out);
  }

  for (const i of ICONS) {
    const svg = fs.readFileSync(path.join(dir, i.svg), "utf-8");
    await page.setViewportSize({ width: i.size, height: i.size });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${i.size}px;height:${i.size}px}</style>${svg}`);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(dir, i.out), omitBackground: true });
    console.log("  ✓", i.out);
  }

  await browser.close();
  console.log("export complete");
})();
