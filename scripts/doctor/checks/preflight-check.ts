import type { Finding } from "../../lib/findings";
import type { CheckRunOptions, DeckContext } from "../context";
import { auditSlideSource, preflightIssueToFinding } from "./preflight";

export function checkPreflight(ctx: DeckContext, options: CheckRunOptions): Finding[] {
  const findings: Finding[] = [];
  for (const slide of ctx.slides) {
    const issues = auditSlideSource(ctx.deckName, slide.repoPath, slide.raw, { requireNotes: options.requireNotes });
    findings.push(...issues.map(preflightIssueToFinding));
  }
  return findings;
}
