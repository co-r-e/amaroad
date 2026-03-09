#!/usr/bin/env node
/**
 * Capture all slides from a deck as PNG screenshots using Playwright.
 * Usage: node scripts/capture-slides.mjs [deckName] [outputDir]
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const deckName = process.argv[2] || "sample-deck";
const outputDir =
  process.argv[3] ||
  path.join(
    process.env.HOME,
    "Downloads",
    `${deckName}-png-live`,
  );

const BASE_URL = "http://localhost:3000";
const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;

// Get sorted MDX file list (same logic as deck-loader)
const deckDir = path.join(process.cwd(), "decks", deckName);
const mdxFiles = fs
  .readdirSync(deckDir)
  .filter((f) => f.endsWith(".mdx"))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

console.log(`Found ${mdxFiles.length} slides in "${deckName}"`);
console.log(`Output: ${outputDir}`);

fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

// Load the first slide to warm up (longer timeout for initial compile)
const firstUrl = `${BASE_URL}/${deckName}`;
console.log("Warming up…");
await page.goto(firstUrl, { waitUntil: "load", timeout: 60000 });
await page.waitForSelector('[data-mdx-status="ready"]', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2000);
console.log("Ready.\n");

for (let i = 0; i < mdxFiles.length; i++) {
  const slideNum = i + 1; // 1-indexed for URL
  const baseName = mdxFiles[i].replace(/\.mdx$/, "");
  const pngPath = path.join(outputDir, `${baseName}.png`);

  const url =
    slideNum === 1
      ? `${BASE_URL}/${deckName}`
      : `${BASE_URL}/${deckName}?slide=${slideNum}`;

  await page.goto(url, { waitUntil: "load", timeout: 60000 });

  // Wait for MDX content to compile and render
  await page
    .waitForSelector('[data-mdx-status="ready"]', { timeout: 15000 })
    .catch(() => {});

  // Extra wait for fonts, images, charts
  await page.waitForTimeout(800);

  // Screenshot the slide frame element
  const slideEl = await page.$('[class*="frame"]');
  if (slideEl) {
    await slideEl.screenshot({ path: pngPath, type: "png" });
  } else {
    // Fallback: full page screenshot
    await page.screenshot({ path: pngPath, type: "png" });
  }

  const progress = `[${String(slideNum).padStart(3, " ")}/${mdxFiles.length}]`;
  console.log(`${progress} ${baseName}.png`);
}

await browser.close();
console.log(`\nDone! ${mdxFiles.length} slides captured to ${outputDir}`);
