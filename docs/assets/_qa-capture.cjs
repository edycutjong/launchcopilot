const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const QA = process.argv[2] || "/tmp";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2 });

  // hero — capture a few beats of the 8s loop
  const hero = fs.readFileSync("readme-hero-animated.svg", "utf-8");
  await page.setViewportSize({ width: 1280, height: 320 });
  for (const [ms, tag] of [[1000, "12"], [2900, "36"], [4200, "52"], [5400, "67"], [6600, "82"]]) {
    await page.setContent(
      `<style>html,body{margin:0;background:#05070a}svg{display:block;width:1280px;height:320px}</style>${hero}`
    );
    await page.waitForTimeout(Number(ms));
    await page.screenshot({ path: path.join(QA, `qa-hero-${tag}.png`) });
  }

  // icon — 512, capture beats of the 6s loop
  const icon = fs.readFileSync("icon-animated.svg", "utf-8");
  await page.setViewportSize({ width: 512, height: 512 });
  for (const [ms, tag] of [[1600, "26"], [2900, "48"], [3900, "65"], [5200, "86"]]) {
    await page.setContent(
      `<style>html,body{margin:0;background:#05070a}svg{display:block;width:512px;height:512px}</style>${icon}`
    );
    await page.waitForTimeout(Number(ms));
    await page.screenshot({ path: path.join(QA, `qa-icon-${tag}.png`) });
  }

  // static icon at small sizes
  const sicon = fs.readFileSync("icon.svg", "utf-8");
  await page.setViewportSize({ width: 128, height: 128 });
  await page.setContent(`<style>html,body{margin:0;background:#05070a}svg{width:128px;height:128px}</style>${sicon}`);
  await page.screenshot({ path: path.join(QA, "qa-icon-static-128.png") });

  await browser.close();
  console.log("captured to", QA);
})();
