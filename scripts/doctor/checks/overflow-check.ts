import type { Finding } from "../../lib/findings";
import { overflowReportToFindings, runOverflowCheck } from "../../lib/overflow";
import { ensureServer, resolveBaseUrl } from "../../lib/browser";
import type { CheckRunOptions, DeckContext } from "../context";

export async function checkOverflow(ctx: DeckContext, options: CheckRunOptions): Promise<Finding[]> {
  const baseUrl = resolveBaseUrl(options.baseUrl);
  try {
    await ensureServer(baseUrl);
  } catch (error) {
    return [
      {
        deck: ctx.deckName,
        check: "overflow",
        rule: "server-unavailable",
        severity: "warning",
        message: `${error instanceof Error ? error.message.split("\n")[0] : String(error)} (run pnpm dev, or pass --skip overflow)`,
      },
    ];
  }
  if (!ctx.config) return [];
  const report = await runOverflowCheck({ deck: ctx.deckName, baseUrl });
  return overflowReportToFindings(report);
}
