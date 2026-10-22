import path from "node:path";
import fs from "./runtime-fs";
import { readDeckConfig } from "./deck-config";
import { isUnsafeDeckName } from "./deck-paths";
import type { RichDeck, RichDeckConfig, RichDeckSummary } from "@/types/rich-deck";

const DECKS_DIR = path.join(process.cwd(), "decks");

export function defineRichConfig(config: RichDeckConfig): RichDeckConfig {
  return config;
}

export function validateRichConfig(config: Record<string, unknown>): RichDeckConfig {
  if (config.format !== "html") throw new Error("Expected format: html");
  if (typeof config.title !== "string" || !config.title.trim()) throw new Error("HTML deck title is required");
  if (typeof config.createdAt !== "string" || Number.isNaN(Date.parse(config.createdAt))) {
    throw new Error("HTML deck createdAt must be an ISO date");
  }
  if (config.standalone !== undefined && typeof config.standalone !== "boolean") {
    throw new Error("standalone must be a boolean");
  }
  return {
    format: "html", title: config.title, createdAt: config.createdAt,
    standalone: config.standalone as boolean | undefined,
  };
}

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export async function resolveRichDeckDirectory(name: string): Promise<string> {
  if (isUnsafeDeckName(name)) throw new Error("Invalid deck name");
  const root = await fs.realpath(DECKS_DIR);
  const directory = await fs.realpath(path.join(root, name));
  if (!isWithin(root, directory) || !(await fs.stat(directory)).isDirectory()) throw new Error("Invalid deck directory");
  // Configs are executable, so their symlinks must stay inside this deck too.
  const configPath = await fs.realpath(path.join(directory, "deck.config.ts"));
  if (!isWithin(directory, configPath)) throw new Error("Invalid deck config path");
  return directory;
}

export async function resolveRichDeckFile(directory: string, segments: string[]): Promise<string> {
  if (!segments.length || segments.some((part) => !part || part.startsWith(".") || part.includes("\0") ||
    part.includes("/") || part.includes("\\"))) throw new Error("Invalid asset path");
  const resolved = await fs.realpath(path.join(directory, ...segments));
  if (!isWithin(directory, resolved) || !(await fs.stat(resolved)).isFile()) throw new Error("Invalid asset path");
  return resolved;
}

export async function loadRichDeck(name: string): Promise<RichDeck> {
  const directory = await resolveRichDeckDirectory(name);
  const config = validateRichConfig(await readDeckConfig(directory));
  await resolveRichDeckFile(directory, ["index.html"]);
  return { name, config };
}

export async function listRichDecks(): Promise<RichDeckSummary[]> {
  const entries = await fs.readdir(DECKS_DIR, { withFileTypes: true }).catch(() => []);
  const decks: RichDeckSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || isUnsafeDeckName(entry.name)) continue;
    try {
      const directory = await resolveRichDeckDirectory(entry.name);
      const raw = await readDeckConfig(directory);
      if (raw.format !== "html") continue;
      const deck = await loadRichDeck(entry.name);
      decks.push({ name: deck.name, title: deck.config.title, createdAt: deck.config.createdAt, format: "html" });
    } catch (error) {
      console.warn(`[amaroad] Cannot read rich deck "${entry.name}":`, error instanceof Error ? error.message : error);
    }
  }
  return decks.sort((a, b) => {
    const aSample = a.name === "sample-rich-deck";
    const bSample = b.name === "sample-rich-deck";
    if (aSample !== bSample) return aSample ? 1 : -1;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.title.localeCompare(b.title);
  });
}
