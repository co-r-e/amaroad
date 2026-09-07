import type { Finding } from "../../lib/findings";
import type { DeckContext } from "../context";

export function checkManifest(ctx: DeckContext): Finding[] {
  const findings: Finding[] = [];
  const manifestFile = `${ctx.repoDir}/slide-order.ts`;

  if (!ctx.manifest.hasManifest) {
    findings.push({
      deck: ctx.deckName,
      check: "manifest",
      rule: "manifest-missing",
      severity: "info",
      message: "No slide-order.ts; slides are ordered by filename. Generate one with: pnpm exec tsx scripts/generate-slide-order.mts " + ctx.deckName,
      file: manifestFile,
    });
    return findings;
  }

  for (const missing of ctx.manifest.missing) {
    findings.push({
      deck: ctx.deckName,
      check: "manifest",
      rule: "manifest-missing-file",
      severity: "error",
      message: `slide-order.ts lists "${missing.replace(/\.mdx$/, "")}" but decks/${ctx.deckName}/${missing} does not exist`,
      file: manifestFile,
      snippet: missing.replace(/\.mdx$/, ""),
    });
  }

  for (const unlisted of ctx.manifest.unlisted) {
    findings.push({
      deck: ctx.deckName,
      check: "manifest",
      rule: "manifest-unlisted-file",
      severity: "warning",
      message: `${unlisted} exists but is not listed in slide-order.ts, so it is never shown`,
      file: `${ctx.repoDir}/${unlisted}`,
    });
  }

  return findings;
}
