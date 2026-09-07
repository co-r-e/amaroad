/**
 * `pnpm amaroad doctor`: one pass/fail verdict for a deck.
 */
import { die, getBoolean, getString, rejectUnknownFlags, type ParsedArgs } from "../lib/cli";
import { findProjectRoot, listDeckEntries, resolveDeckEntry, type DeckEntry } from "../lib/decks";
import { emitReport, renderJson, renderMarkdown, shouldFail, summarize, type Finding } from "../lib/findings";
import { ALL_CHECKS, buildDeckContext, type CheckName, type CheckRunOptions } from "./context";
import { checkAssets } from "./checks/assets";
import { checkConfig } from "./checks/config";
import { checkFonts } from "./checks/fonts";
import { checkManifest } from "./checks/manifest";
import { checkOverflow } from "./checks/overflow-check";
import { checkPreflight } from "./checks/preflight-check";

const USAGE = `Usage: pnpm amaroad doctor <deck> [options]
       pnpm amaroad doctor --all [options]

Runs every check for a deck and exits 1 when the threshold is hit:
  config     deck.config.ts loads, createdAt valid, slide types known
  preflight  font size floor, side borders, tailwind classes, hex colors, notes
  manifest   slide-order.ts vs files on disk
  assets     missing / unused / unservable assets (MDX + logo references)
  fonts      theme fonts that are not bundled by the app
  overflow   real-browser layout check (needs a running server: pnpm dev)

Options:
  --all                   Check every deck under decks/
  --format md|json        Output format (default: md)
  --fail-on error|warning|never
                          Exit code threshold (default: error)
  --skip a,b              Skip checks, e.g. --skip overflow,assets
  --only a,b              Run only these checks
  --no-notes              Do not require speaker notes (preflight notes-* rules)
  --base-url <url>        Server URL for overflow (default: $BASE_URL or http://127.0.0.1:3850)
  --output <file>         Write the report to a file instead of stdout
  --quiet                 No progress output on stderr
  --help                  Show help

Tip: pnpm prints install-check lines before run scripts; use
  pnpm --silent amaroad doctor <deck> --format json   or   --output report.json
when piping the result.`;

function parseCheckList(value: string | undefined): CheckName[] {
  if (!value) return [];
  const names = value.split(",").map((s) => s.trim()).filter(Boolean);
  for (const name of names) {
    if (!ALL_CHECKS.includes(name as CheckName)) die(`Unknown check "${name}". Known: ${ALL_CHECKS.join(", ")}`);
  }
  return names as CheckName[];
}

export async function runDoctorCommand(args: ParsedArgs): Promise<void> {
  if (getBoolean(args, "help") || getBoolean(args, "h")) {
    process.stdout.write(USAGE + "\n");
    return;
  }
  rejectUnknownFlags(args, ["all", "format", "fail-on", "skip", "only", "no-notes", "base-url", "quiet", "deck", "output"]);

  const format = getString(args, "format") ?? "md";
  if (format !== "md" && format !== "json") die("--format must be md or json");
  const failOn = (getString(args, "fail-on") ?? "error") as "error" | "warning" | "never";
  if (!["error", "warning", "never"].includes(failOn)) die("--fail-on must be error, warning, or never");
  const quiet = getBoolean(args, "quiet") || format === "json";

  const skip = new Set(parseCheckList(getString(args, "skip")));
  const only = parseCheckList(getString(args, "only"));
  const checks = (only.length > 0 ? only : ALL_CHECKS).filter((c) => !skip.has(c));
  if (checks.length === 0) die("No checks left to run");

  const projectRoot = findProjectRoot();
  let entries: DeckEntry[];
  if (getBoolean(args, "all")) {
    entries = listDeckEntries(projectRoot);
  } else {
    const name = args.positionals[0] ?? getString(args, "deck");
    if (!name) die(`A deck name (or --all) is required.\n\n${USAGE}`);
    entries = [resolveDeckEntry(projectRoot, name)];
  }
  if (entries.length === 0) die("No decks found under decks/");

  const options: CheckRunOptions = {
    baseUrl: getString(args, "base-url"),
    requireNotes: !getBoolean(args, "no-notes"),
  };

  const runners: Record<CheckName, (ctx: Awaited<ReturnType<typeof buildDeckContext>>, o: CheckRunOptions) => Promise<Finding[]> | Finding[]> = {
    config: checkConfig,
    preflight: checkPreflight,
    manifest: checkManifest,
    assets: checkAssets,
    fonts: checkFonts,
    overflow: checkOverflow,
  };

  const findings: Finding[] = [];
  for (const entry of entries) {
    if (!quiet) process.stderr.write(`Checking decks/${entry.name} ...\n`);
    const ctx = await buildDeckContext(projectRoot, entry);
    for (const check of checks) {
      if (!quiet && check === "overflow") process.stderr.write(`  overflow: rendering ${ctx.slides.length} slide(s) in a browser\n`);
      const result = await runners[check](ctx, options);
      findings.push(...result);
      if (!quiet) {
        const errors = result.filter((f) => f.severity === "error").length;
        const warnings = result.filter((f) => f.severity === "warning").length;
        process.stderr.write(`  ${check}: ${errors} error(s), ${warnings} warning(s)\n`);
      }
    }
  }

  const renderOptions = {
    title: "Amaroad Doctor",
    decks: entries.map((e) => e.name),
    checks,
    skipped: ALL_CHECKS.filter((c) => !checks.includes(c)),
  };
  emitReport(
    format === "json" ? renderJson(findings, renderOptions) : renderMarkdown(findings, renderOptions),
    getString(args, "output"),
  );

  if (shouldFail(summarize(findings), failOn)) process.exitCode = 1;
}
