#!/usr/bin/env npx tsx

import * as fs from "node:fs";
import * as path from "node:path";
import matter from "gray-matter";

type Severity = "error" | "warning";
type OutputFormat = "md" | "json";
type Rule = "claim-missing-citation" | "weak-citation-marker";

interface CliOptions {
  deck?: string;
  format: OutputFormat;
  window: number;
  failOn?: Severity;
  help: boolean;
}

interface Issue {
  deck: string;
  file: string;
  line: number;
  column: number;
  severity: Severity;
  rule: Rule;
  message: string;
  snippet: string;
}

interface AuditResult {
  issues: Issue[];
  scannedFiles: number;
  scannedDecks: string[];
}

interface Summary {
  decksScanned: number;
  filesScanned: number;
  totalIssues: number;
  errorCount: number;
  warningCount: number;
}

const CLAIM_REGEXES: RegExp[] = [
  /(?:^|[^0-9])\d+(?:\.\d+)?\s?%\b/,
  /[$¥€£]\s?\d[\d,]*(?:\.\d+)?\b/,
  /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/,
  /\b\d+(?:\.\d+)?\s?(?:k|m|b|mn|bn|thousand|million|billion|万|億|兆)\b/i,
  /\b\d+(?:\.\d+)?\s?(?:x|times?|points?|pts|users?|companies?|people|leads?|downloads?|sessions?|customers?|minutes?|hours?|days?|years?|months?)\b/i,
  /\b\d+(?:\.\d+)?\s?(?:倍|人|社|件|分|時間|日|か月|ヶ月|年|ポイント)\b/,
  /\b(?:cagr|yoy|mom|qoq|roi|ltv|cac)\b/i,
];

const STRONG_CITATION_REGEXES: RegExp[] = [
  /\[[^\]]+\]\((https?:\/\/[^)]+)\)/i,
  /https?:\/\/\S+/i,
  /\bdoi:\s*10\.\d{4,9}\//i,
];

const MARKER_CITATION_REGEXES: RegExp[] = [
  /\b(?:source|sources|citation|citations|reference|references|data source|according to|via)\b\s*[:：]/i,
  /(?:出典|参考|参照)\s*[:：]/,
  /\[\d{1,3}\]/,
];

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const projectRoot = findProjectRoot(process.cwd());
  const result = runAudit(projectRoot, options);
  const summary = buildSummary(result);
  const output =
    options.format === "json"
      ? renderJson(summary, result)
      : renderMarkdown(summary, result, options.window);

  process.stdout.write(output + "\n");

  if (shouldFail(options.failOn, summary)) {
    process.exitCode = 1;
  }
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    format: "md",
    window: 2,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--deck") {
      const value = args[++i];
      if (!value) {
        die("Missing value for --deck");
      }
      options.deck = value;
      continue;
    }

    if (arg === "--format") {
      const value = args[++i];
      if (value !== "md" && value !== "json") {
        die("--format must be one of: md, json");
      }
      options.format = value;
      continue;
    }

    if (arg === "--window") {
      const value = args[++i];
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
        die("--window must be a non-negative integer");
      }
      options.window = parsed;
      continue;
    }

    if (arg === "--fail-on") {
      const value = args[++i];
      if (value !== "error" && value !== "warning") {
        die("--fail-on must be one of: error, warning");
      }
      options.failOn = value;
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
    "  npx tsx .claude/skills/fact-citation-validator/scripts/validate-citations.ts [options]",
    "",
    "Options:",
    "  --deck <name>         Audit one deck under decks/<name> (default: all decks)",
    "  --format md|json      Output format (default: md)",
    "  --window <N>          Citation search radius in lines (default: 2)",
    "  --fail-on error|warning  Exit with code 1 on threshold",
    "  --help, -h            Show help",
  ].join("\n");

  process.stdout.write(usage + "\n");
}

function die(message: string): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

function shouldFail(failOn: Severity | undefined, summary: Summary): boolean {
  if (!failOn) {
    return false;
  }
  if (failOn === "warning") {
    return summary.totalIssues > 0;
  }
  return summary.errorCount > 0;
}

function findProjectRoot(startDir: string): string {
  let current = path.resolve(startDir);
  for (let i = 0; i < 12; i++) {
    const decksDir = path.join(current, "decks");
    if (fs.existsSync(decksDir) && fs.statSync(decksDir).isDirectory()) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  die("Could not locate project root containing decks/");
}

function runAudit(projectRoot: string, options: CliOptions): AuditResult {
  const decksRoot = path.join(projectRoot, "decks");
  const decks = resolveDecks(decksRoot, options.deck);

  const issues: Issue[] = [];
  let scannedFiles = 0;

  for (const deck of decks) {
    const deckDir = path.join(decksRoot, deck);
    const files = collectMdxFiles(deckDir);
    for (const filePath of files) {
      scannedFiles += 1;
      const raw = fs.readFileSync(filePath, "utf-8");
      const relative = normalizePath(path.relative(projectRoot, filePath));
      issues.push(...auditFile(deck, relative, raw, options.window));
    }
  }

  issues.sort(compareIssue);
  return { issues, scannedFiles, scannedDecks: decks };
}

function resolveDecks(decksRoot: string, onlyDeck?: string): string[] {
  if (!fs.existsSync(decksRoot) || !fs.statSync(decksRoot).isDirectory()) {
    die(`Deck root not found: ${decksRoot}`);
  }

  if (onlyDeck) {
    const deckDir = path.join(decksRoot, onlyDeck);
    if (!fs.existsSync(deckDir) || !fs.statSync(deckDir).isDirectory()) {
      die(`Deck not found: ${onlyDeck}`);
    }
    return [onlyDeck];
  }

  return fs
    .readdirSync(decksRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function collectMdxFiles(deckDir: string): string[] {
  const out: string[] = [];
  const stack = [deckDir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    const entries = fs
      .readdirSync(current, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".mdx")) {
        out.push(fullPath);
      }
    }
  }

  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function auditFile(deck: string, file: string, raw: string, window: number): Issue[] {
  const parsed = matter(raw);
  const body = parsed.content;
  const bodyStartIndex = raw.indexOf(body);
  const bodyStartLine = bodyStartIndex >= 0 ? toLineNumber(raw.slice(0, bodyStartIndex)) : 1;

  const lines = splitLines(body);
  const issues: Issue[] = [];

  let inCodeFence = false;

  for (let i = 0; i < lines.length; i++) {
    const original = lines[i];
    const trimmed = original.trim();

    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) {
      continue;
    }

    const normalized = normalizeLineForClaimDetection(original);
    if (!shouldInspectLine(trimmed, normalized)) {
      continue;
    }

    if (!containsClaim(normalized)) {
      continue;
    }

    const nearby = findNearbyCitation(lines, i, window);
    if (nearby === "strong") {
      continue;
    }

    const lineNumber = bodyStartLine + i;

    if (nearby === "marker") {
      issues.push({
        deck,
        file,
        line: lineNumber,
        column: 1,
        severity: "warning",
        rule: "weak-citation-marker",
        message:
          "Claim has only weak citation markers nearby. Add a verifiable URL or markdown link.",
        snippet: trimmed,
      });
      continue;
    }

    issues.push({
      deck,
      file,
      line: lineNumber,
      column: 1,
      severity: "error",
      rule: "claim-missing-citation",
      message: "Numeric/factual claim has no citation within nearby lines.",
      snippet: trimmed,
    });
  }

  return issues;
}

function toLineNumber(content: string): number {
  return content.length === 0 ? 1 : content.split(/\r?\n/).length;
}

function splitLines(content: string): string[] {
  return content.split(/\r?\n/);
}

function normalizeLineForClaimDetection(line: string): string {
  return line
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1")
    .replace(/`[^`]*`/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\{[^{}]*}/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldInspectLine(trimmedOriginal: string, normalized: string): boolean {
  if (!trimmedOriginal || !normalized) {
    return false;
  }

  if (
    trimmedOriginal.startsWith("import ") ||
    trimmedOriginal.startsWith("export ") ||
    trimmedOriginal.startsWith("<") && !/[A-Za-z]/.test(normalized)
  ) {
    return false;
  }

  if (/^(---|\*\*\*|___)\s*$/.test(trimmedOriginal)) {
    return false;
  }

  if (
    /(?:fontSize|lineHeight|margin|padding|width|height|viewBox|strokeWidth|fillOpacity|opacity|startFrom|zIndex)\s*[:=]/.test(
      trimmedOriginal,
    )
  ) {
    return false;
  }

  return normalized.length >= 4;
}

function containsClaim(line: string): boolean {
  if (!/\d/.test(line) && !/(?:cagr|yoy|mom|qoq|roi|ltv|cac)/i.test(line)) {
    return false;
  }

  if (/^\d{4}$/.test(line.trim())) {
    return false;
  }

  for (const regex of CLAIM_REGEXES) {
    if (regex.test(line)) {
      return true;
    }
  }

  return false;
}

function findNearbyCitation(lines: string[], lineIndex: number, window: number): "none" | "marker" | "strong" {
  let markerDetected = false;

  const start = Math.max(0, lineIndex - window);
  const end = Math.min(lines.length - 1, lineIndex + window);

  for (let i = start; i <= end; i++) {
    const line = lines[i];

    if (hasStrongCitation(line)) {
      return "strong";
    }

    if (hasMarkerCitation(line)) {
      markerDetected = true;
    }
  }

  return markerDetected ? "marker" : "none";
}

function hasStrongCitation(line: string): boolean {
  return STRONG_CITATION_REGEXES.some((regex) => regex.test(line));
}

function hasMarkerCitation(line: string): boolean {
  if (hasStrongCitation(line)) {
    return true;
  }
  return MARKER_CITATION_REGEXES.some((regex) => regex.test(line));
}

function buildSummary(result: AuditResult): Summary {
  let errorCount = 0;
  let warningCount = 0;

  for (const issue of result.issues) {
    if (issue.severity === "error") {
      errorCount += 1;
    } else {
      warningCount += 1;
    }
  }

  return {
    decksScanned: result.scannedDecks.length,
    filesScanned: result.scannedFiles,
    totalIssues: result.issues.length,
    errorCount,
    warningCount,
  };
}

function renderMarkdown(summary: Summary, result: AuditResult, window: number): string {
  const lines: string[] = [];

  lines.push("# Citation Audit Report");
  lines.push("");
  lines.push(`- Decks scanned: ${summary.decksScanned}`);
  lines.push(`- Files scanned: ${summary.filesScanned}`);
  lines.push(`- Total issues: ${summary.totalIssues}`);
  lines.push(`- Errors: ${summary.errorCount}`);
  lines.push(`- Warnings: ${summary.warningCount}`);
  lines.push(`- Citation window: ±${window} lines`);
  lines.push("");

  if (result.scannedDecks.length > 0) {
    lines.push(`Decks: ${result.scannedDecks.join(", ")}`);
    lines.push("");
  }

  if (result.issues.length === 0) {
    lines.push("No citation issues found.");
    return lines.join("\n");
  }

  for (const issue of result.issues) {
    lines.push(
      `- [${issue.severity}] ${issue.file}:${issue.line}:${issue.column} ${issue.rule} - ${issue.message}`,
    );
    lines.push(`  > ${issue.snippet || "(empty line)"}`);
  }

  return lines.join("\n");
}

function renderJson(summary: Summary, result: AuditResult): string {
  return JSON.stringify(
    {
      summary,
      scannedDecks: result.scannedDecks,
      issues: result.issues,
    },
    null,
    2,
  );
}

function compareIssue(a: Issue, b: Issue): number {
  const severityRank = (severity: Severity): number => (severity === "error" ? 0 : 1);

  if (severityRank(a.severity) !== severityRank(b.severity)) {
    return severityRank(a.severity) - severityRank(b.severity);
  }

  if (a.file !== b.file) {
    return a.file.localeCompare(b.file);
  }

  if (a.line !== b.line) {
    return a.line - b.line;
  }

  if (a.column !== b.column) {
    return a.column - b.column;
  }

  return a.rule.localeCompare(b.rule);
}

function normalizePath(p: string): string {
  return p.split(path.sep).join("/");
}

main();
