import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { jiti } from "./jiti";
import { normalizeSlideOrderEntries } from "./slide-order-utils";
import { loadDeckConfig } from "./deck-config";
import { processSlideFile } from "./mdx-processor";
import type { Deck, DeckSummary } from "@/types/deck";

const DECKS_DIR = path.join(process.cwd(), "decks");

/** Returns true if deckName contains path traversal characters. */
export function isUnsafeDeckName(deckName: string): boolean {
  return deckName.includes("/") || deckName.includes("\\") || deckName.includes("..");
}

export async function listDecks(): Promise<DeckSummary[]> {
  let entries;
  try {
    entries = await fs.readdir(DECKS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  const decks: DeckSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const deckDir = path.join(DECKS_DIR, entry.name);
    try {
      const config = await loadDeckConfig(deckDir);
      const mdxFiles = await getMdxFiles(deckDir);
      decks.push({
        name: entry.name,
        title: config.title,
        slideCount: mdxFiles.length,
      });
    } catch (e) {
      console.warn(`[dexcode] Skipping deck "${entry.name}":`, e instanceof Error ? e.message : e);
    }
  }

  return decks.sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadDeck(deckName: string): Promise<Deck> {
  // Prevent path traversal via deck name
  if (isUnsafeDeckName(deckName)) {
    throw new Error(`Invalid deck name: ${deckName}`);
  }

  const deckDir = path.join(DECKS_DIR, deckName);
  const config = await loadDeckConfig(deckDir);
  const mdxFiles = await getMdxFiles(deckDir);

  const slides = await Promise.all(
    mdxFiles.map((filename, index) =>
      processSlideFile(path.join(deckDir, filename), index, filename),
    ),
  );

  return { name: deckName, config, slides };
}

/** Per-request cached version of loadDeck — deduplicates calls within generateMetadata + page render. */
export const loadDeckCached = cache(loadDeck);

async function loadSlideOrder(deckDir: string): Promise<string[] | null> {
  const manifestPath = path.join(deckDir, "slide-order.ts");
  const deckName = path.basename(deckDir);

  let mod: unknown;
  try {
    mod = await jiti.import(manifestPath);
  } catch {
    return null;
  }

  const order = (mod as { default?: unknown }).default ?? mod;

  if (!Array.isArray(order)) {
    console.warn(
      `[dexcode] slide-order.ts in ${deckName}: expected default export to be an array`,
    );
    return null;
  }

  return normalizeSlideOrderEntries(order, deckName);
}

async function getMdxFiles(deckDir: string): Promise<string[]> {
  const order = await loadSlideOrder(deckDir);

  if (order) {
    const entries = new Set(await fs.readdir(deckDir));
    const deckName = path.basename(deckDir);

    for (const file of order) {
      if (!entries.has(file)) {
        console.warn(
          `[dexcode] ${deckName}/slide-order.ts references missing file: ${file}`,
        );
      }
    }

    const orderSet = new Set(order);
    for (const entry of entries) {
      if (entry.endsWith(".mdx") && !orderSet.has(entry)) {
        console.warn(
          `[dexcode] ${deckName}: ${entry} exists but is not listed in slide-order.ts`,
        );
      }
    }

    return order.filter((file) => entries.has(file));
  }

  // Fallback: sort by filename (legacy behavior)
  const entries = await fs.readdir(deckDir);
  return entries
    .filter((f) => f.endsWith(".mdx"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
