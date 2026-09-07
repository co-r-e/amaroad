/**
 * Filesystem helpers for deck enumeration shared by tooling. Mirrors the
 * rules in `src/lib/deck-loader.ts` (top-level .mdx only, slide-order.ts
 * first) so tooling and the renderer agree on what a deck contains.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { normalizeSlideOrderEntries } from "@/lib/slide-order-utils";
import { jiti } from "@/lib/jiti";

export const DECKS_DIR_NAME = "decks";

export function findProjectRoot(startDir = process.cwd()): string {
  let current = path.resolve(startDir);
  for (let i = 0; i < 12; i++) {
    const marker = path.join(current, DECKS_DIR_NAME);
    const pkg = path.join(current, "package.json");
    if (fs.existsSync(marker) && fs.statSync(marker).isDirectory() && fs.existsSync(pkg)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`Could not locate project root containing '${DECKS_DIR_NAME}/'`);
}

/** Directories under decks/ that are never decks (presets, dotfiles). */
export function isDeckDirectoryName(name: string): boolean {
  return !name.startsWith("_") && !name.startsWith(".");
}

export interface DeckEntry {
  name: string;
  dir: string;
  hasConfig: boolean;
}

export function listDeckEntries(projectRoot: string): DeckEntry[] {
  const decksRoot = path.join(projectRoot, DECKS_DIR_NAME);
  if (!fs.existsSync(decksRoot)) return [];
  return fs
    .readdirSync(decksRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isDeckDirectoryName(entry.name))
    .map((entry) => {
      const dir = path.join(decksRoot, entry.name);
      return { name: entry.name, dir, hasConfig: fs.existsSync(path.join(dir, "deck.config.ts")) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function resolveDeckEntry(projectRoot: string, name: string): DeckEntry {
  if (name.includes("/") || name.includes("\\") || name.includes("..")) {
    throw new Error(`Invalid deck name: ${name}`);
  }
  const dir = path.join(projectRoot, DECKS_DIR_NAME, name);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`Deck not found: decks/${name}`);
  }
  return { name, dir, hasConfig: fs.existsSync(path.join(dir, "deck.config.ts")) };
}

export interface SlideManifest {
  /** Filenames in presentation order (what the renderer will show). */
  ordered: string[];
  /** Whether slide-order.ts exists and exported an array. */
  hasManifest: boolean;
  /** Manifest entries whose file does not exist. */
  missing: string[];
  /** .mdx files on disk that the manifest omits. */
  unlisted: string[];
  /** Every top-level .mdx file on disk. */
  onDisk: string[];
}

function numericCollator(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export async function readSlideManifest(deckDir: string, deckName: string): Promise<SlideManifest> {
  const onDisk = fs
    .readdirSync(deckDir)
    .filter((f) => f.endsWith(".mdx") && fs.statSync(path.join(deckDir, f)).isFile())
    .sort(numericCollator);

  const manifestPath = path.join(deckDir, "slide-order.ts");
  if (!fs.existsSync(manifestPath)) {
    return { ordered: onDisk, hasManifest: false, missing: [], unlisted: [], onDisk };
  }

  let entries: unknown[] | null = null;
  try {
    const mod = (await jiti.import(manifestPath)) as { default?: unknown };
    const value = mod.default ?? mod;
    if (Array.isArray(value)) entries = value;
  } catch {
    entries = null;
  }
  if (!entries) {
    return { ordered: onDisk, hasManifest: false, missing: [], unlisted: [], onDisk };
  }

  const order = normalizeSlideOrderEntries(entries, deckName);
  const onDiskSet = new Set(onDisk);
  const orderSet = new Set(order);
  const missing = order.filter((file) => !onDiskSet.has(file));
  const unlisted = onDisk.filter((file) => !orderSet.has(file));
  return {
    ordered: order.filter((file) => onDiskSet.has(file)),
    hasManifest: true,
    missing,
    unlisted,
    onDisk,
  };
}

export function toRepoPath(projectRoot: string, absolute: string): string {
  return path.relative(projectRoot, absolute).split(path.sep).join("/");
}
