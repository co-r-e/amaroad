import { die, getBoolean, getNumber, getString, rejectUnknownFlags, type ParsedArgs } from "../lib/cli";
import { emitReport, renderJson, renderMarkdown, shouldFail, summarize } from "../lib/findings";
import { overflowReportToFindings, runOverflowCheck } from "../lib/overflow";

const USAGE = `Usage: pnpm amaroad overflow <deck> [options]

Measures every slide in a real browser and reports elements that leave the
inviolable content area, are clipped, or collide with overlays.
Requires a running Amaroad server (pnpm dev).

Options:
  --slide <n>            Check a single 0-based slide index
  --format md|json       Output format (default: md)
  --fail-on error|warning|never
                         Exit code 1 threshold (default: error)
  --tolerance <px>       Allowed overshoot in px before reporting (default: 1)
  --base-url <url>       Server URL (default: $BASE_URL or http://127.0.0.1:3850)
  --output <file>        Write the report to a file instead of stdout
  --quiet                Do not print per-slide progress to stderr
  --help                 Show help`;

export async function runOverflowCommand(args: ParsedArgs): Promise<void> {
  if (getBoolean(args, "help") || getBoolean(args, "h")) {
    process.stdout.write(USAGE + "\n");
    return;
  }
  rejectUnknownFlags(args, ["slide", "format", "fail-on", "tolerance", "base-url", "quiet", "deck", "output"]);

  const deck = args.positionals[0] ?? getString(args, "deck");
  if (!deck) die(`A deck name is required.\n\n${USAGE}`);

  const format = getString(args, "format") ?? "md";
  if (format !== "md" && format !== "json") die("--format must be md or json");
  const failOn = (getString(args, "fail-on") ?? "error") as "error" | "warning" | "never";
  if (!["error", "warning", "never"].includes(failOn)) die("--fail-on must be error, warning, or never");

  const slide = getNumber(args, "slide");
  const tolerance = getNumber(args, "tolerance") ?? 1;
  const quiet = getBoolean(args, "quiet");

  const report = await runOverflowCheck({
    deck,
    baseUrl: getString(args, "base-url"),
    indexes: slide !== undefined ? [slide] : undefined,
    tolerancePx: tolerance,
    onProgress: (info) => {
      if (quiet || format === "json") return;
      const marker = info.findings > 0 ? `${info.findings} finding(s)` : "ok";
      process.stderr.write(`  [${info.index + 1}/${info.total}] ${info.file}: ${marker}\n`);
    },
  });

  const findings = overflowReportToFindings(report);
  const renderOptions = { title: "Slide Overflow Report", decks: [deck], checks: ["overflow"] };
  emitReport(
    format === "json" ? renderJson(findings, renderOptions) : renderMarkdown(findings, renderOptions),
    getString(args, "output"),
  );

  if (shouldFail(summarize(findings), failOn)) process.exitCode = 1;
}
