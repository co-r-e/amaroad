/**
 * Per-deck context shared by doctor checks: loaded config, slide manifest,
 * and the raw text of every slide, read once.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import type { DeckConfig } from "@/types/deck";
import { loadDeckConfig } from "@/lib/deck-config";
import { processSlideFile } from "@/lib/mdx-processor";
import type { SlideData } from "@/types/deck";
import { readSlideManifest, toRepoPath, type DeckEntry, type SlideManifest } from "../lib/decks";
import type { Finding } from "../lib/findings";

export interface DeckSlideSource {
  filename: string;
  absolutePath: string;
  repoPath: string;
  raw: string;
  data: SlideData | null;
}

export interface DeckContext {
  projectRoot: string;
  entry: DeckEntry;
  deckName: string;
  deckDir: string;
  /** Repo-relative path prefix, e.g. `decks/sample-deck`. */
  repoDir: string;
  config: DeckConfig | null;
  configError: string | null;
  manifest: SlideManifest;
  slides: DeckSlideSource[];
}

export async function buildDeckContext(projectRoot: string, entry: DeckEntry): Promise<DeckContext> {
  let config: DeckConfig | null = null;
  let configError: string | null = null;
  if (entry.hasConfig) {
    try {
      config = await loadDeckConfig(entry.dir);
    } catch (error) {
      configError = error instanceof Error ? error.message : String(error);
    }
  } else {
    configError = "deck.config.ts not found";
  }

  const manifest = await readSlideManifest(entry.dir, entry.name);
  const slides: DeckSlideSource[] = [];
  for (const [index, filename] of manifest.ordered.entries()) {
    const absolutePath = path.join(entry.dir, filename);
    const raw = fs.readFileSync(absolutePath, "utf-8");
    let data: SlideData | null = null;
    try {
      data = await processSlideFile(absolutePath, index, filename);
    } catch {
      data = null;
    }
    slides.push({ filename, absolutePath, repoPath: toRepoPath(projectRoot, absolutePath), raw, data });
  }

  return {
    projectRoot,
    entry,
    deckName: entry.name,
    deckDir: entry.dir,
    repoDir: toRepoPath(projectRoot, entry.dir),
    config,
    configError,
    manifest,
    slides,
  };
}

export type CheckName = "config" | "preflight" | "manifest" | "assets" | "fonts" | "overflow";

export const ALL_CHECKS: CheckName[] = ["config", "preflight", "manifest", "assets", "fonts", "overflow"];

export interface CheckRunOptions {
  baseUrl?: string;
  requireNotes: boolean;
}

export type DeckCheck = (ctx: DeckContext, options: CheckRunOptions) => Promise<Finding[]> | Finding[];
