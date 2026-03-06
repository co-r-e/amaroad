import fs from "node:fs/promises";
import path from "node:path";
import { loadDeckConfig } from "./deck-config";
import { processSlideFile } from "./mdx-processor";
import { paginateLogicalSlide } from "./slide-paginate";
import { createStrictServerMeasurer } from "./strict-server-measure";
import type { Deck, DeckSummary, SlideData, DeckConfig } from "@/types/deck";

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
      const slides = await loadSlides(deckDir, config);
      decks.push({
        name: entry.name,
        title: config.title,
        slideCount: slides.length,
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
  const slides = await loadSlides(deckDir, config);

  return { name: deckName, config, slides };
}

async function getMdxFiles(deckDir: string): Promise<string[]> {
  const entries = await fs.readdir(deckDir);
  return entries
    .filter((f) => f.endsWith(".mdx"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function loadSlides(deckDir: string, config: DeckConfig): Promise<SlideData[]> {
  const mdxFiles = await getMdxFiles(deckDir);
  const logicalSlides = await Promise.all(
    mdxFiles.map((filename, index) =>
      processSlideFile(
        path.join(deckDir, filename),
        index,
        filename,
        config.authoringMode ?? "free",
      ),
    ),
  );

  const slides: SlideData[] = [];

  for (const logicalSlide of logicalSlides) {
    if (!logicalSlide.strictInput) {
      slides.push({
        ...logicalSlide,
        index: slides.length,
      });
      continue;
    }

    const strictMeasurer = await createStrictServerMeasurer(config, logicalSlide);
    let pagination;
    try {
      pagination = await paginateLogicalSlide(logicalSlide.strictInput, {
        measure: strictMeasurer.measure,
      });
    } finally {
      await strictMeasurer.close();
    }

    const hardValidationIssues = pagination.validationIssues.filter(
      (issue) => issue.code !== "too-many-items" && issue.code !== "too-many-characters",
    );

    if (hardValidationIssues.length > 0 || pagination.errors.length > 0) {
      throw new Error(
        [
          `Failed to paginate strict slide "${logicalSlide.filename}"`,
          ...hardValidationIssues.map((issue) => `- ${issue.path}: ${issue.message}`),
          ...pagination.errors.map((error) => `- ${error.message}`),
        ].join("\n"),
      );
    }

    for (const page of pagination.pages) {
      slides.push({
        ...logicalSlide,
        index: slides.length,
        filename:
          page.continuationIndex === 0
            ? logicalSlide.filename
            : `${logicalSlide.filename}#${page.continuationIndex + 1}`,
        rawContent: "",
        frontmatter: {
          ...logicalSlide.frontmatter,
          fit: "strict",
          layout: page.layout,
          variantId: page.variantId,
        },
        strictInput: {
          layout: page.layout,
          variantId: page.variantId,
          sourceId: page.sourceId,
          slots: page.slots,
        },
      });
    }
  }

  return slides;
}
