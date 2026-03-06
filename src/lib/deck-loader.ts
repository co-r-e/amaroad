import fs from "node:fs/promises";
import path from "node:path";
import { loadDeckConfig } from "./deck-config";
import { processSlideFile } from "./mdx-processor";
import type { Deck, DeckSummary } from "@/types/deck";

const DECKS_DIR = path.join(process.cwd(), "decks");

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
  if (deckName.includes("/") || deckName.includes("\\") || deckName.includes("..")) {
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

async function getMdxFiles(deckDir: string): Promise<string[]> {
  const entries = await fs.readdir(deckDir);
  return entries
    .filter((f) => f.endsWith(".mdx"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
