#!/usr/bin/env npx tsx
/**
 * Migration script: generate slide-order.ts manifests for all decks.
 *
 * For each deck:
 *  1. Read .mdx files in current numeric sort order
 *  2. Strip numeric prefix from filenames (keep if collision)
 *  3. Rename files on disk
 *  4. Write slide-order.ts with the new names
 *
 * Usage:
 *   npx tsx scripts/generate-slide-order.mts --dry-run          # preview all
 *   npx tsx scripts/generate-slide-order.mts --all              # migrate all
 *   npx tsx scripts/generate-slide-order.mts --force my-deck    # rerun on deck with manifest
 *   npx tsx scripts/generate-slide-order.mts my-deck            # single deck
 *   npx tsx scripts/generate-slide-order.mts my-deck --dry-run  # preview single
 */
import fs from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";

const DECKS_DIR = path.join(process.cwd(), "decks");
const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  moduleCache: false,
});

const { normalizeSlideOrderEntries } = (await jiti.import(
  path.join(process.cwd(), "src", "lib", "slide-order-utils.ts"),
)) as typeof import("../src/lib/slide-order-utils");

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const all = args.includes("--all");
const force = args.includes("--force");
const deckNames = args.filter((a) => !a.startsWith("--"));

if (!all && deckNames.length === 0) {
  console.log(
    "Usage: npx tsx scripts/generate-slide-order.mts [--dry-run] [--force] [--all | <deck-name> ...]",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Discover target decks
// ---------------------------------------------------------------------------
function getTargetDecks(): string[] {
  if (all) {
    return fs
      .readdirSync(DECKS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  }
  return deckNames;
}

// ---------------------------------------------------------------------------
// Strip numeric prefix: "01-cover" → "cover", "01a-speaker" → "speaker"
// ---------------------------------------------------------------------------
function stripPrefix(basename: string): string {
  return basename.replace(/^\d+[a-z]?-/i, "");
}

async function loadExistingOrder(deckDir: string, deckName: string): Promise<string[] | null> {
  const manifestPath = path.join(deckDir, "slide-order.ts");

  try {
    const mod: unknown = await jiti.import(manifestPath);
    const order = (mod as { default?: unknown }).default ?? mod;
    if (!Array.isArray(order)) {
      console.warn(`  ⚠ ${deckName}/slide-order.ts does not export an array; falling back to filename order`);
      return null;
    }
    return normalizeSlideOrderEntries(order, deckName);
  } catch (error) {
    console.warn(
      `  ⚠ Failed to load ${deckName}/slide-order.ts; falling back to filename order:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Core migration logic for one deck
// ---------------------------------------------------------------------------
async function migrateDeck(deckName: string): Promise<{
  renames: Array<{ from: string; to: string }>;
  order: string[];
  skipped: boolean;
}> {
  const deckDir = path.join(DECKS_DIR, deckName);
  const manifestPath = path.join(deckDir, "slide-order.ts");

  if (!fs.existsSync(deckDir)) {
    console.warn(`  ⚠ Deck directory not found: ${deckName}`);
    return { renames: [], order: [], skipped: true };
  }

  // Already migrated?
  if (!force && fs.existsSync(manifestPath)) {
    console.log(`  ✓ Already has slide-order.ts — skipping`);
    return { renames: [], order: [], skipped: true };
  }

  const mdxFilesOnDisk = fs
    .readdirSync(deckDir)
    .filter((f) => f.endsWith(".mdx"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (mdxFilesOnDisk.length === 0) {
    console.log(`  ✓ No .mdx files — skipping`);
    return { renames: [], order: [], skipped: true };
  }

  let mdxFiles = mdxFilesOnDisk;
  if (force && fs.existsSync(manifestPath)) {
    const existingOrder = await loadExistingOrder(deckDir, deckName);
    if (existingOrder) {
      const onDisk = new Set(mdxFilesOnDisk);
      const ordered = existingOrder.filter((file) => onDisk.has(file));
      const orderedSet = new Set(ordered);
      const extras = mdxFilesOnDisk.filter((file) => !orderedSet.has(file));

      if (extras.length > 0) {
        console.warn(
          `  ⚠ ${deckName}: appending ${extras.length} unlisted file(s) after existing manifest order`,
        );
      }

      mdxFiles = [...ordered, ...extras];
    }
  }

  // Determine stripped names and detect collisions
  const strippedMap = new Map<string, string[]>(); // stripped → [original, ...]
  for (const file of mdxFiles) {
    const base = file.replace(/\.mdx$/, "");
    const stripped = stripPrefix(base);
    const existing = strippedMap.get(stripped) || [];
    existing.push(file);
    strippedMap.set(stripped, existing);
  }

  const collisions = new Set<string>();
  for (const [stripped, originals] of strippedMap) {
    if (originals.length > 1) {
      collisions.add(stripped);
    }
  }

  // Build rename plan
  const renames: Array<{ from: string; to: string }> = [];
  const order: string[] = [];

  for (const file of mdxFiles) {
    const base = file.replace(/\.mdx$/, "");
    const stripped = stripPrefix(base);

    if (collisions.has(stripped)) {
      // Keep original filename
      order.push(base);
    } else if (stripped !== base) {
      // Rename: strip prefix
      renames.push({ from: file, to: `${stripped}.mdx` });
      order.push(stripped);
    } else {
      // No prefix to strip
      order.push(base);
    }
  }

  return { renames, order, skipped: false };
}

// ---------------------------------------------------------------------------
// Generate slide-order.ts content
// ---------------------------------------------------------------------------
function generateManifest(order: string[]): string {
  const entries = order.map((name) => `  "${name}",`).join("\n");
  return `export default [\n${entries}\n];\n`;
}

function executeRenames(
  deckDir: string,
  renames: Array<{ from: string; to: string }>,
): void {
  const staged = renames.map((rename, index) => ({
    ...rename,
    temp: `${rename.from}.__amaroad_tmp_${process.pid}_${index}`,
  }));

  for (const rename of staged) {
    fs.renameSync(path.join(deckDir, rename.from), path.join(deckDir, rename.temp));
  }

  for (const rename of staged) {
    fs.renameSync(path.join(deckDir, rename.temp), path.join(deckDir, rename.to));
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const decks = getTargetDecks();
let totalRenames = 0;
let totalDecks = 0;

console.log(dryRun ? "=== DRY RUN ===" : "=== MIGRATING ===");
console.log(`Target: ${decks.length} deck(s)\n`);

for (const deckName of decks) {
  console.log(`[${deckName}]`);
  const { renames, order, skipped } = await migrateDeck(deckName);

  if (skipped) continue;

  totalDecks++;
  totalRenames += renames.length;

  // Report renames
  if (renames.length > 0) {
    console.log(`  Renames: ${renames.length}`);
    for (const r of renames) {
      console.log(`    ${r.from} → ${r.to}`);
    }
  } else {
    console.log(`  Renames: 0 (all filenames kept)`);
  }
  console.log(`  Slides: ${order.length}`);

  if (dryRun) {
    console.log(`  slide-order.ts would contain ${order.length} entries`);
    continue;
  }

  const deckDir = path.join(DECKS_DIR, deckName);

  // Execute renames
  if (renames.length > 0) {
    executeRenames(deckDir, renames);
  }

  // Write slide-order.ts
  const manifest = generateManifest(order);
  fs.writeFileSync(path.join(deckDir, "slide-order.ts"), manifest);
  console.log(`  ✓ slide-order.ts written`);
}

console.log(`\n=== Summary ===`);
console.log(`Decks processed: ${totalDecks}`);
console.log(`Files renamed: ${totalRenames}`);
if (dryRun) {
  console.log(`(dry run — no changes made)`);
}
