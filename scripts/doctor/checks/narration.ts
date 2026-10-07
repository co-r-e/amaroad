import {
  computeNarrationStatus,
  resolveNarrationSettings,
  unknownNarrationConfigKeys,
  validateNarrationConfig,
} from "@/lib/narration";
import { findFrontmatterKeyLine, nonTextNarrationProblem } from "../../lib/frontmatter";
import type { Finding } from "../../lib/findings";
import type { DeckContext } from "../context";

/**
 * Narration audio lives outside git, so "never generated" is only info (every
 * fresh clone is in that state and generating it costs the user API quota).
 * Audio that no longer matches its script is a warning: auto-play would
 * silently skip it.
 */
export async function checkNarration(ctx: DeckContext): Promise<Finding[]> {
  const findings: Finding[] = [];
  const base = { deck: ctx.deckName, check: "narration" } as const;
  const regenerate = `pnpm amaroad narrate ${ctx.deckName}`;

  for (const problem of validateNarrationConfig(ctx.config)) {
    findings.push({
      ...base,
      rule: "narration-config-invalid",
      severity: "error",
      message: `deck.config.ts: ${problem}`,
      file: `${ctx.repoDir}/deck.config.ts`,
    });
  }

  for (const key of unknownNarrationConfigKeys(ctx.config)) {
    findings.push({
      ...base,
      rule: "narration-config-unknown-key",
      severity: "warning",
      message: `deck.config.ts: narration.${key} is not a known setting and is ignored (typo?)`,
      file: `${ctx.repoDir}/deck.config.ts`,
    });
  }

  for (const slide of ctx.slides) {
    const problem = nonTextNarrationProblem(slide.raw);
    if (!problem) continue;
    findings.push({
      ...base,
      rule: "narration-not-text",
      severity: "error",
      message: problem,
      file: slide.repoPath,
      line: findFrontmatterKeyLine(slide.raw, "narration"),
    });
  }

  const statuses = await computeNarrationStatus(
    ctx.deckDir,
    resolveNarrationSettings(ctx.config),
    ctx.slides.map((slide) => ({ filename: slide.filename, narration: slide.data?.frontmatter.narration })),
  );

  const missing: string[] = [];
  statuses.forEach((status, index) => {
    const slide = ctx.slides[index];
    if (status.state === "missing") missing.push(slide.filename);
    if (status.state !== "stale") return;
    findings.push({
      ...base,
      rule: "narration-audio-stale",
      severity: "warning",
      message: `Narration audio is out of date (script or voice settings changed), so auto-play skips it. Regenerate with: ${regenerate}`,
      file: slide.repoPath,
      line: findFrontmatterKeyLine(slide.raw, "narration"),
    });
  });

  if (missing.length > 0) {
    findings.push({
      ...base,
      rule: "narration-audio-missing",
      severity: "info",
      message: `${missing.length} slide(s) have narration but no audio yet (audio is not in git). Generate it with: ${regenerate}`,
      file: `${ctx.repoDir}/narration`,
      meta: { slides: missing },
    });
  }

  return findings;
}
