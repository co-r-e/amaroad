import type { DeckConfig } from "@/types/deck";
import path from "node:path";
import { jiti } from "./jiti";

export function defineConfig(config: DeckConfig): DeckConfig {
  return config;
}

export async function loadDeckConfig(deckDir: string): Promise<DeckConfig> {
  const configPath = path.join(deckDir, "deck.config.ts");

  let mod: unknown;
  try {
    mod = await jiti.import(configPath);
  } catch (e) {
    throw new Error(
      `Failed to load deck config: ${configPath}\n${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const config = (mod as { default?: unknown }).default ?? mod;

  if (!config || typeof config !== "object") {
    throw new Error(
      `Invalid deck config in ${configPath}: expected an object with defineConfig()`,
    );
  }

  const c = config as Record<string, unknown>;

  if (typeof c.title !== "string") {
    throw new Error(`Deck config in ${configPath} is missing required "title" field`);
  }

  if (!c.theme || typeof c.theme !== "object") {
    throw new Error(`Deck config in ${configPath} is missing required "theme" field`);
  }

  const theme = c.theme as Record<string, unknown>;
  if (!theme.colors || typeof theme.colors !== "object") {
    throw new Error(`Deck config in ${configPath} is missing required "theme.colors" field`);
  }

  const colors = theme.colors as Record<string, unknown>;
  if (typeof colors.primary !== "string") {
    throw new Error(`Deck config in ${configPath} is missing required "theme.colors.primary" field`);
  }

  // createdAt is required for "newest first" sorting, but we degrade gracefully:
  // a missing/invalid value only warns (the deck still loads and sorts to the end).
  if (typeof c.createdAt !== "string" || Number.isNaN(Date.parse(c.createdAt))) {
    console.warn(
      `[amaroad] Deck config in ${configPath} is missing a valid "createdAt" (ISO date string, e.g. "2026-06-02"); it will sort last in "newest first" order`,
    );
  }

  return config as DeckConfig;
}
