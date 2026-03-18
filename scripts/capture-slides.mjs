#!/usr/bin/env node
/**
 * Capture all slides from a deck as high-quality PNG screenshots.
 *
 * Strategy:
 *  1. Load the deck page ONCE
 *  2. Hide sidebar/chrome via JS, remove scale transform on slide element
 *  3. Use ArrowRight to advance slides
 *  4. element.screenshot() at native 1920×1080
 *
 * Usage: node scripts/capture-slides.mjs [deckName] [outputDir]
 * Env:   BASE_URL (default: http://localhost:3001)
 */
import fs from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";
import { chromium } from "playwright";

const deckName = process.argv[2] || "sample-deck";
const outputDir =
  process.argv[3] ||
  path.join(process.env.HOME, "Downloads", `${deckName}-png-live`);

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";
const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  moduleCache: false,
});

// ---------------------------------------------------------------------------
// Get slide list (manifest-first, fallback to filename sort)
// ---------------------------------------------------------------------------
const deckDir = path.join(process.cwd(), "decks", deckName);
try {
  if (!fs.statSync(deckDir).isDirectory()) throw null;
} catch {
  console.error(`Deck not found: ${deckName}`);
  process.exit(1);
}

const { normalizeSlideOrderEntries } = await jiti.import(
  path.join(process.cwd(), "src", "lib", "slide-order-utils.ts"),
);

async function getSlideFiles() {
  const manifestPath = path.join(deckDir, "slide-order.ts");
  if (fs.existsSync(manifestPath)) {
    try {
      const mod = await jiti.import(manifestPath);
      const order = mod?.default ?? mod;
      if (Array.isArray(order)) {
        const files = normalizeSlideOrderEntries(order, deckName);
        const existing = new Set(fs.readdirSync(deckDir));

        for (const file of files) {
          if (!existing.has(file)) {
            console.warn(
              `[dexcode] ${deckName}/slide-order.ts references missing file: ${file}`,
            );
          }
        }

        const orderSet = new Set(files);
        for (const entry of existing) {
          if (entry.endsWith(".mdx") && !orderSet.has(entry)) {
            console.warn(
              `[dexcode] ${deckName}: ${entry} exists but is not listed in slide-order.ts`,
            );
          }
        }

        return files.filter((f) => existing.has(f));
      }

      console.warn(
        `[dexcode] ${deckName}/slide-order.ts did not export an array; falling back to filename sort`,
      );
    } catch (error) {
      console.warn(
        `[dexcode] Failed to load ${deckName}/slide-order.ts; falling back to filename sort:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return fs
    .readdirSync(deckDir)
    .filter((f) => f.endsWith(".mdx"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

const mdxFiles = await getSlideFiles();

const total = mdxFiles.length;
if (total === 0) {
  console.error(`No slides found in "${deckName}"`);
  process.exit(1);
}
console.log(`Found ${total} slides in "${deckName}"`);
console.log(`Output: ${outputDir}\n`);

fs.mkdirSync(outputDir, { recursive: true });

// ---------------------------------------------------------------------------
// Launch browser — viewport large enough to hold 1920×1080 without sidebar
// ---------------------------------------------------------------------------
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

// ---------------------------------------------------------------------------
// Load deck page (single navigation)
// ---------------------------------------------------------------------------
console.log("Loading deck…");
await page.goto(`${BASE_URL}/${deckName}`, {
  waitUntil: "load",
  timeout: 60000,
});
await page
  .waitForSelector('[data-mdx-status="ready"]', { timeout: 30000 })
  .catch(() => {});
await page.waitForTimeout(2000);

// ---------------------------------------------------------------------------
// Prepare: hide chrome, remove transform so slide is native 1920×1080
// ---------------------------------------------------------------------------
await page.evaluate(() => {
  // Find the sidebar (first child of .flex.h-screen) and hide it
  const root = document.querySelector(".flex.h-screen");
  if (root) {
    // Sidebar is the first child
    const sidebar = root.children[0];
    if (sidebar && sidebar.tagName !== "MAIN") {
      sidebar.style.display = "none";
    }
    // NotesPanel is last child (if not main)
    const last = root.children[root.children.length - 1];
    if (last && last.tagName !== "MAIN") {
      last.style.display = "none";
    }
  }

  // Make main fill viewport
  const main = document.querySelector("main");
  if (main) {
    main.style.position = "fixed";
    main.style.inset = "0";
    main.style.overflow = "visible";

    // Hide floating buttons/counter inside main
    main.querySelectorAll("button, .absolute").forEach((el) => {
      if (!el.closest('[data-mdx-status]') && !el.querySelector('[data-mdx-status]')) {
        el.style.display = "none";
      }
    });
  }
});

// Wait for layout to settle
await page.waitForTimeout(500);

console.log("Ready.\n");

// ---------------------------------------------------------------------------
// Capture loop
// ---------------------------------------------------------------------------
for (let i = 0; i < total; i++) {
  const baseName = mdxFiles[i].replace(/\.mdx$/, "");
  const pngPath = path.join(outputDir, `${baseName}.png`);

  // Wait for MDX ready
  await page
    .waitForSelector('[data-mdx-status="ready"]', { timeout: 10000 })
    .catch(() => {});
  await page.waitForTimeout(600);

  // Find slide container (direct child of main with 1920px width),
  // remove its transform, and screenshot it
  const slideHandle = await page.evaluateHandle(() => {
    const main = document.querySelector("main");
    if (!main) return null;
    for (const child of main.children) {
      if (
        child instanceof HTMLElement &&
        child.style.width === "1920px"
      ) {
        // Remove scale transform for native-size capture
        child.style.transform = "none";
        child.style.opacity = "1";
        child.style.boxShadow = "none";
        return child;
      }
    }
    return null;
  });

  const slideEl = slideHandle.asElement();

  if (slideEl) {
    await page.waitForTimeout(100);
    await slideEl.screenshot({ path: pngPath, type: "png" });
  } else {
    // Fallback: viewport screenshot
    console.warn(`  ⚠ Fallback for slide ${i + 1}`);
    await page.screenshot({ path: pngPath, type: "png" });
  }

  const progress = `[${String(i + 1).padStart(3, " ")}/${total}]`;
  console.log(`${progress} ${baseName}.png`);

  // Advance to next slide
  if (i < total - 1) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
  }
}

await browser.close();
console.log(`\nDone! ${total} slides captured to ${outputDir}`);
