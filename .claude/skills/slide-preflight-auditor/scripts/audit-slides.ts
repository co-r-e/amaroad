#!/usr/bin/env -S pnpm exec tsx
/**
 * Legacy preflight CLI. The rules now live in
 * `scripts/doctor/checks/preflight.ts` and are also run by
 * `pnpm amaroad doctor <deck>`; this wrapper keeps the original
 * `--deck / --format / --fail-on` contract for existing skill docs.
 *
 * Usage:
 *   pnpm exec tsx .claude/skills/slide-preflight-auditor/scripts/audit-slides.ts [options]
 *   (the .codex/skills copy is a symlink to the same script)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  auditSlideSource,
  compareIssue,
  type PreflightIssue,
} from "../../../../scripts/doctor/checks/preflight";
import {
  findProjectRoot,
  listDeckEntries,
  readSlideManifest,
  resolveDeckEntry,
  toRepoPath,
} from "../../../../scripts/lib/decks";

type OutputFormat = "md" | "json";

interface CliOptions {
  deck?: string;
  format: OutputFormat;
  failOn?: "error";
  requireNotes: boolean;
  help: boolean;
}

interface Summary {
  decksScanned: number;
  filesScanned: number;
  totalIssues: number;
  errorCount: number;
  warningCount: number;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const projectRoot = findProjectRoot(process.cwd());
  const entries = options.deck ? [resolveDeckEntry(projectRoot, options.deck)] : listDeckEntries(projectRoot);

  const issues: PreflightIssue[] = [];
  let scannedFiles = 0;
  const scannedDecks: string[] = [];

  for (const entry of entries) {
    scannedDecks.push(entry.name);
    const manifest = await readSlideManifest(entry.dir, entry.name);
    for (const filename of manifest.ordered) {
      const absolute = path.join(entry.dir, filename);
      const content = fs.readFileSync(absolute, "utf-8");
      scannedFiles += 1;
      issues.push(
        ...auditSlideSource(entry.name, toRepoPath(projectRoot, absolute), content, {
          requireNotes: options.requireNotes,
        }),
      );
    }
  }

  issues.sort(compareIssue);
  const summary: Summary = {
    decksScanned: scannedDecks.length,
    filesScanned: scannedFiles,
    totalIssues: issues.length,
    errorCount: issues.filter((i) => i.severity === "error").length,
    warningCount: issues.filter((i) => i.severity === "warning").length,
  };

  const output =
    options.format === "json"
      ? JSON.stringify({ summary, scannedDecks, issues }, null, 2)
      : renderMarkdown(summary, issues, scannedDecks);
  process.stdout.write(output + "\n");

  if (options.failOn === "error" && summary.errorCount > 0) {
    process.exitCode = 1;
  }
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { format: "md", requireNotes: true, help: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--deck") {
      const value = args[++i];
      if (!value) die("Missing value for --deck");
      options.deck = value;
      continue;
    }
    if (arg === "--format") {
      const value = args[++i];
      if (value !== "md" && value !== "json") die("--format must be one of: md, json");
      options.format = value;
      continue;
    }
    if (arg === "--fail-on") {
      const value = args[++i];
      if (value !== "error") die("--fail-on currently supports only: error");
      options.failOn = value;
      continue;
    }
    if (arg === "--no-notes") {
      options.requireNotes = false;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    die(`Unknown argument: ${arg}`);
  }

  return options;
}

function printUsage(): void {
  const usage = [
    "Usage:",
    "  pnpm exec tsx .claude/skills/slide-preflight-auditor/scripts/audit-slides.ts [options]",
    "",
    "Prefer: pnpm amaroad doctor <deck> (runs these rules plus manifest/assets/fonts/overflow checks)",
    "",
    "Options:",
    "  --deck <name>      Audit only one deck under decks/<name> (default: all decks)",
    "  --format md|json   Output format (default: md)",
    "  --fail-on error    Exit with code 1 when at least one error is found",
    "  --no-notes         Do not require speaker notes",
    "  --help, -h         Show help",
  ].join("\n");
  process.stdout.write(usage + "\n");
}

function die(message: string): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

function renderMarkdown(summary: Summary, issues: PreflightIssue[], scannedDecks: string[]): string {
  const lines: string[] = [];
  lines.push("# Slide Preflight Audit", "");
  lines.push(`- decks scanned: ${summary.decksScanned}`);
  lines.push(`- files scanned: ${summary.filesScanned}`);
  lines.push(`- total issues: ${summary.totalIssues}`);
  lines.push(`- errors: ${summary.errorCount}`);
  lines.push(`- warnings: ${summary.warningCount}`);
  lines.push(`- targets: ${scannedDecks.join(", ") || "(none)"}`, "");

  if (issues.length === 0) {
    lines.push("No issues found.");
    return lines.join("\n");
  }

  let currentFile = "";
  for (const issue of issues) {
    if (issue.file !== currentFile) {
      currentFile = issue.file;
      lines.push(`## ${issue.file}`);
    }
    lines.push(`- [${issue.severity}] L${issue.line}:C${issue.column} ${issue.rule} - ${issue.message}`);
    if (issue.snippet) lines.push(`  \`${issue.snippet.replace(/`/g, "'")}\``);
  }
  return lines.join("\n");
}

main().catch((error: unknown) => {
  die(error instanceof Error ? error.message : String(error));
});
