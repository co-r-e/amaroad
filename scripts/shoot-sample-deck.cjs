// Screenshot every slide of /sample-deck to screenshots/sample-deck/<NNN-name>.png
// Verified approach: load deck once, focus body, ArrowRight through slides,
// and capture the <main> SlideFrame (NOT the sidebar thumbnails).
const fs = require("fs");
const path = require("path");
const pw = require("playwright");

const DECK = "sample-deck";
const BASE = `http://localhost:3850/${DECK}`;
const OUT_DIR = path.join(__dirname, "..", "screenshots", DECK);
const ORDER_FILE = path.join(__dirname, "..", "decks", DECK, "slide-order.ts");

function readSlideOrder() {
  const src = fs.readFileSync(ORDER_FILE, "utf8");
  const body = src.slice(src.indexOf("["), src.lastIndexOf("]") + 1);
  return [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

const FRAME_SEL = 'main [class*="SlideFrame-module"][class*="__frame"]';

async function main() {
  const names = readSlideOrder();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Slides: ${names.length} -> ${OUT_DIR}`);

  const browser = await pw.chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1728, height: 1000 },
    deviceScaleFactor: 1.5,
  });

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(FRAME_SEL, { timeout: 60000 });
  await page.evaluate(() => document.body.focus());
  await page.waitForTimeout(1200); // hydration + fonts

  for (let i = 0; i < names.length; i++) {
    if (i > 0) {
      await page
        .waitForFunction(
          (expected) => {
            const p = new URLSearchParams(window.location.search).get("slide");
            return p === String(expected);
          },
          i + 1,
          { timeout: 15000 }
        )
        .catch(() => {});
    }
    await page.waitForTimeout(650); // charts/animations settle

    const frame = await page.$(FRAME_SEL);
    const num = String(i + 1).padStart(3, "0");
    const file = path.join(OUT_DIR, `${num}-${names[i]}.png`);
    if (frame) {
      await frame.screenshot({ path: file });
      console.log(`[${num}/${names.length}] ${names[i]}`);
    } else {
      console.log(`[${num}/${names.length}] ${names[i]} -- FRAME NOT FOUND`);
    }

    if (i < names.length - 1) {
      await page.evaluate(() => document.body.focus());
      await page.keyboard.press("ArrowRight");
    }
  }

  await browser.close();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
