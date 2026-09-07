import type { Finding } from "../../lib/findings";
import type { DeckContext } from "../context";

const VALID_SLIDE_TYPES = new Set([
  "cover",
  "section",
  "content",
  "comparison",
  "stats",
  "timeline",
  "image-left",
  "image-right",
  "image-full",
  "quote",
  "agenda",
  "ending",
]);

export function checkConfig(ctx: DeckContext): Finding[] {
  const findings: Finding[] = [];
  const configFile = `${ctx.repoDir}/deck.config.ts`;

  if (!ctx.config) {
    findings.push({
      deck: ctx.deckName,
      check: "config",
      rule: "config-invalid",
      severity: "error",
      message: ctx.configError ?? "deck.config.ts could not be loaded",
      file: configFile,
    });
    return findings;
  }

  const createdAt = ctx.config.createdAt;
  if (typeof createdAt !== "string" || Number.isNaN(Date.parse(createdAt))) {
    findings.push({
      deck: ctx.deckName,
      check: "config",
      rule: "created-at-invalid",
      severity: "warning",
      message: 'Missing or invalid "createdAt" (ISO date, e.g. "2026-06-02"); the deck sorts last on the home page',
      file: configFile,
    });
  }

  if (ctx.slides.length === 0) {
    findings.push({
      deck: ctx.deckName,
      check: "config",
      rule: "no-slides",
      severity: "error",
      message: "Deck has no .mdx slides",
      file: ctx.repoDir,
    });
  }

  for (const slide of ctx.slides) {
    const match = slide.raw.match(/^---\r?\n[\s\S]*?^type\s*:\s*["']?([^"'\r\n]+?)["']?\s*$/m);
    if (!match) continue;
    const declared = match[1].trim();
    if (!VALID_SLIDE_TYPES.has(declared)) {
      findings.push({
        deck: ctx.deckName,
        check: "config",
        rule: "slide-type-unknown",
        severity: "warning",
        message: `Unknown slide type "${declared}" falls back to "content"`,
        file: slide.repoPath,
        line: lineOfMatch(slide.raw, match.index ?? 0, match[0]),
        snippet: `type: ${declared}`,
      });
    }
  }

  return findings;
}

function lineOfMatch(raw: string, start: number, matched: string): number {
  const typeOffset = matched.lastIndexOf("type");
  const absolute = start + Math.max(0, typeOffset);
  return raw.slice(0, absolute).split("\n").length;
}
