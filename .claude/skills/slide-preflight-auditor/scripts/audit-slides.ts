#!/usr/bin/env npx tsx

import * as fs from "node:fs";
import * as path from "node:path";

type Severity = "error" | "warning";
type OutputFormat = "md" | "json";

interface CliOptions {
  deck?: string;
  format: OutputFormat;
  failOn?: "error";
  help: boolean;
}

interface Issue {
  deck: string;
  file: string;
  line: number;
  column: number;
  severity: Severity;
  rule:
    | "low-font-size"
    | "no-side-accent-border"
    | "tailwind-classname"
    | "hardcoded-hex-color"
    | "notes-missing"
    | "notes-empty";
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

const MIN_FONT_SIZE_REM = 1.8;
const ROOT_MARKER_DIR = "decks";

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const projectRoot = findProjectRoot(process.cwd());
  const auditResult = runAudit(projectRoot, options);
  const summary = buildSummary(auditResult.issues, auditResult);
  const output =
    options.format === "json"
      ? renderJson(summary, auditResult.issues, auditResult.scannedDecks)
      : renderMarkdown(summary, auditResult.issues, auditResult.scannedDecks);

  process.stdout.write(output + "\n");

  if (options.failOn === "error" && summary.errorCount > 0) {
    process.exitCode = 1;
  }
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { format: "md", help: false };

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
    if (arg === "--fail-on") {
      const value = args[++i];
      if (value !== "error") {
        die("--fail-on currently supports only: error");
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
    "  npx tsx .claude/skills/slide-preflight-auditor/scripts/audit-slides.ts [options]",
    "",
    "Options:",
    "  --deck <name>      Audit only one deck under decks/<name> (default: all decks)",
    "  --format md|json   Output format (default: md)",
    "  --fail-on error    Exit with code 1 when at least one error is found",
    "  --help, -h         Show help",
  ].join("\n");
  process.stdout.write(usage + "\n");
}

function die(message: string): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

function findProjectRoot(startDir: string): string {
  let current = path.resolve(startDir);
  for (let i = 0; i < 12; i++) {
    const marker = path.join(current, ROOT_MARKER_DIR);
    if (fs.existsSync(marker) && fs.statSync(marker).isDirectory()) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  die(`Could not locate project root containing '${ROOT_MARKER_DIR}/'`);
}

function runAudit(projectRoot: string, options: CliOptions): AuditResult {
  const decksRoot = path.join(projectRoot, "decks");
  const deckNames = resolveDeckNames(decksRoot, options.deck);

  const issues: Issue[] = [];
  let scannedFiles = 0;
  const scannedDecks: string[] = [];

  for (const deck of deckNames) {
    const deckDir = path.join(decksRoot, deck);
    const mdxFiles = collectMdxFiles(deckDir);
    scannedDecks.push(deck);

    for (const absoluteFile of mdxFiles) {
      scannedFiles += 1;
      const content = fs.readFileSync(absoluteFile, "utf-8");
      const relativeFile = normalizePath(path.relative(projectRoot, absoluteFile));
      const detected = auditSingleFile(deck, relativeFile, content);
      issues.push(...detected);
    }
  }

  issues.sort(compareIssue);
  return { issues, scannedFiles, scannedDecks };
}

function resolveDeckNames(decksRoot: string, onlyDeck?: string): string[] {
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

function collectMdxFiles(dir: string): string[] {
  const files: string[] = [];
  const stack = [dir];

  while (stack.length > 0) {
    const current = stack.pop()!;
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
        files.push(fullPath);
      }
    }
  }

  files.sort((a, b) => a.localeCompare(b));
  return files;
}

function auditSingleFile(deck: string, file: string, content: string): Issue[] {
  const issues: Issue[] = [];
  const locator = createLocator(content);
  const lines = splitLines(content);

  detectLowFontSize(deck, file, content, locator, lines, issues);
  detectBorderLeft(deck, file, content, locator, lines, issues);
  detectTailwindClassName(deck, file, lines, issues);
  detectHardcodedHexColor(deck, file, content, locator, lines, issues);
  detectMissingNotes(deck, file, lines, issues);

  return issues;
}

function detectLowFontSize(
  deck: string,
  file: string,
  content: string,
  locator: (index: number) => { line: number; column: number },
  lines: string[],
  issues: Issue[],
): void {
  const re = /fontSize\s*:\s*(?:(["'`])([^"'`]+)\1|([0-9]*\.?[0-9]+))/g;
  for (const match of content.matchAll(re)) {
    const quoted = match[2]?.trim();
    const numeric = match[3];
    const parsed = parseFontSizeToRem(quoted, numeric);
    if (parsed === null) continue;
    if (parsed >= MIN_FONT_SIZE_REM) continue;

    const index = match.index ?? 0;
    const { line, column } = locator(index);
    const displayValue = quoted ?? `${numeric}px`;
    issues.push({
      deck,
      file,
      line,
      column,
      severity: "error",
      rule: "low-font-size",
      message: `fontSize ${displayValue} is below ${MIN_FONT_SIZE_REM}rem`,
      snippet: pickLine(lines, line),
    });
  }
}

function parseFontSizeToRem(
  quotedValue: string | undefined,
  numericValue: string | undefined,
): number | null {
  if (quotedValue) {
    const remMatch = quotedValue.match(/^(-?\d*\.?\d+)\s*rem$/i);
    if (remMatch) return Number(remMatch[1]);

    const pxMatch = quotedValue.match(/^(-?\d*\.?\d+)\s*px$/i);
    if (pxMatch) return Number(pxMatch[1]) / 16;

    const bareNumber = quotedValue.match(/^-?\d*\.?\d+$/);
    if (bareNumber) return Number(bareNumber[0]) / 16;

    return null;
  }

  if (numericValue) {
    return Number(numericValue) / 16;
  }

  return null;
}

function detectBorderLeft(
  deck: string,
  file: string,
  content: string,
  locator: (index: number) => { line: number; column: number },
  lines: string[],
  issues: Issue[],
): void {
  const re = /\bborderLeft\s*:|\bborder-left\s*:/g;
  for (const match of content.matchAll(re)) {
    const index = match.index ?? 0;
    const { line, column } = locator(index);
    issues.push({
      deck,
      file,
      line,
      column,
      severity: "error",
      rule: "no-side-accent-border",
      message:
        "One-sided accent borders are disallowed (timeline-axis exceptions require manual review)",
      snippet: pickLine(lines, line),
    });
  }
}

function detectTailwindClassName(
  deck: string,
  file: string,
  lines: string[],
  issues: Issue[],
): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/\bclassName\s*=/.test(line)) continue;

    for (const literal of line.matchAll(/["'`]([^"'`]+)["'`]/g)) {
      const value = literal[1].trim();
      if (!value) continue;
      const tailwindToken = firstTailwindLikeToken(value);
      if (!tailwindToken) continue;

      issues.push({
        deck,
        file,
        line: i + 1,
        column: (literal.index ?? 0) + 1,
        severity: "error",
        rule: "tailwind-classname",
        message: `Detected tailwind-like className token: '${tailwindToken}'`,
        snippet: line.trim(),
      });
    }
  }
}

function firstTailwindLikeToken(classNameValue: string): string | null {
  const tokens = classNameValue.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (TAILWIND_TOKEN_RE.test(token)) {
      return token;
    }
  }
  return null;
}

const TAILWIND_TOKEN_RE =
  /^(?:container|flex|inline-flex|grid|inline-grid|block|inline-block|hidden|items-(?:start|end|center|baseline|stretch)|justify-(?:start|end|center|between|around|evenly)|content-(?:start|end|center|between|around|evenly)|self-(?:auto|start|end|center|stretch)|place-(?:content|items|self)-[a-z-]+|gap(?:-[xy])?-(?:\d+|\[[^\]]+\])|p[trblxy]?-(?:\d+|\[[^\]]+\])|m[trblxy]?-(?:\d+|\[[^\]]+\])|w-(?:\d+|full|screen|min|max|\[[^\]]+\])|h-(?:\d+|full|screen|min|max|\[[^\]]+\])|min-w-[^\s]+|max-w-[^\s]+|min-h-[^\s]+|max-h-[^\s]+|text-(?:xs|sm|base|lg|xl|[2-9]xl|white|black|[a-z]+-\d{2,3}|\[[^\]]+\])|bg-[^\s]+|border(?:-[trblxy])?(?:-\d+)?|rounded(?:-[trbl]{1,2})?(?:-[a-z0-9]+)?|font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)|leading-[^\s]+|tracking-[^\s]+|space-[xy]-[^\s]+|col-span-\d+|row-span-\d+|mx-auto|my-auto)$/i;

function detectHardcodedHexColor(
  deck: string,
  file: string,
  content: string,
  locator: (index: number) => { line: number; column: number },
  lines: string[],
  issues: Issue[],
): void {
  const re = /#[0-9a-fA-F]{3,8}\b/g;
  for (const match of content.matchAll(re)) {
    const index = match.index ?? 0;
    const { line, column } = locator(index);
    issues.push({
      deck,
      file,
      line,
      column,
      severity: "warning",
      rule: "hardcoded-hex-color",
      message: `Detected HEX color ${match[0]} (consider replacing with var(--slide-*))`,
      snippet: pickLine(lines, line),
    });
  }
}

function detectMissingNotes(
  deck: string,
  file: string,
  lines: string[],
  issues: Issue[],
): void {
  if (lines.length === 0) {
    issues.push({
      deck,
      file,
      line: 1,
      column: 1,
      severity: "warning",
      rule: "notes-missing",
      message: "File is empty. Add frontmatter notes.",
      snippet: "",
    });
    return;
  }

  const firstLine = lines[0].replace(/^\uFEFF/, "").trim();
  if (firstLine !== "---") {
    issues.push({
      deck,
      file,
      line: 1,
      column: 1,
      severity: "warning",
      rule: "notes-missing",
      message: "Frontmatter is missing (add notes).",
      snippet: pickLine(lines, 1),
    });
    return;
  }

  const frontmatterEnd = findFrontmatterEnd(lines);
  if (frontmatterEnd === -1) {
    issues.push({
      deck,
      file,
      line: 1,
      column: 1,
      severity: "warning",
      rule: "notes-missing",
      message: "Missing frontmatter terminator '---'.",
      snippet: pickLine(lines, 1),
    });
    return;
  }

  const frontmatter = lines.slice(1, frontmatterEnd);
  const notesIndex = frontmatter.findIndex((line) => /^\s*notes\s*:/.test(line));
  if (notesIndex === -1) {
    issues.push({
      deck,
      file,
      line: 1,
      column: 1,
      severity: "warning",
      rule: "notes-missing",
      message: "Frontmatter notes is not set.",
      snippet: pickLine(lines, 1),
    });
    return;
  }

  const fullLineNumber = notesIndex + 2;
  const notesLine = frontmatter[notesIndex];
  const value = notesLine.replace(/^\s*notes\s*:\s*/, "");

  if (!isNotesValuePresent(frontmatter, notesIndex, value)) {
    issues.push({
      deck,
      file,
      line: fullLineNumber,
      column: 1,
      severity: "warning",
      rule: "notes-empty",
      message: "Frontmatter notes is empty.",
      snippet: pickLine(lines, fullLineNumber),
    });
  }
}

function findFrontmatterEnd(lines: string[]): number {
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") return i;
  }
  return -1;
}

function isNotesValuePresent(
  frontmatter: string[],
  notesIndex: number,
  valueAfterColon: string,
): boolean {
  const trimmed = valueAfterColon.trim();

  if (trimmed === "|" || trimmed.startsWith("|")) {
    for (let i = notesIndex + 1; i < frontmatter.length; i++) {
      const line = frontmatter[i];
      if (/^[A-Za-z0-9_-]+\s*:/.test(line.trim()) && !/^\s+/.test(line)) {
        break;
      }
      if (line.trim().length > 0) return true;
    }
    return false;
  }

  if (trimmed === ">" || trimmed.startsWith(">")) {
    for (let i = notesIndex + 1; i < frontmatter.length; i++) {
      const line = frontmatter[i];
      if (/^[A-Za-z0-9_-]+\s*:/.test(line.trim()) && !/^\s+/.test(line)) {
        break;
      }
      if (line.trim().length > 0) return true;
    }
    return false;
  }

  if (trimmed.length === 0) return false;
  if (trimmed === '""' || trimmed === "''") return false;
  return true;
}

function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

function createLocator(
  text: string,
): (index: number) => { line: number; column: number } {
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") lineStarts.push(i + 1);
  }

  return (index: number) => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lineStarts[mid] <= index) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    const lineIndex = Math.max(0, high);
    return {
      line: lineIndex + 1,
      column: index - lineStarts[lineIndex] + 1,
    };
  };
}

function pickLine(lines: string[], lineNumber: number): string {
  return (lines[lineNumber - 1] ?? "").trim();
}

function normalizePath(p: string): string {
  return p.split(path.sep).join("/");
}

function compareIssue(a: Issue, b: Issue): number {
  const rank = (severity: Severity): number => (severity === "error" ? 0 : 1);
  if (rank(a.severity) !== rank(b.severity)) {
    return rank(a.severity) - rank(b.severity);
  }
  if (a.file !== b.file) return a.file.localeCompare(b.file);
  if (a.line !== b.line) return a.line - b.line;
  if (a.column !== b.column) return a.column - b.column;
  return a.rule.localeCompare(b.rule);
}

function buildSummary(issues: Issue[], result: AuditResult): Summary {
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter(
    (issue) => issue.severity === "warning",
  ).length;
  return {
    decksScanned: result.scannedDecks.length,
    filesScanned: result.scannedFiles,
    totalIssues: issues.length,
    errorCount,
    warningCount,
  };
}

function renderMarkdown(
  summary: Summary,
  issues: Issue[],
  scannedDecks: string[],
): string {
  const lines: string[] = [];
  lines.push("# Slide Preflight Audit");
  lines.push("");
  lines.push(`- decks scanned: ${summary.decksScanned}`);
  lines.push(`- files scanned: ${summary.filesScanned}`);
  lines.push(`- total issues: ${summary.totalIssues}`);
  lines.push(`- errors: ${summary.errorCount}`);
  lines.push(`- warnings: ${summary.warningCount}`);
  lines.push(`- targets: ${scannedDecks.join(", ") || "(none)"}`);
  lines.push("");

  if (issues.length === 0) {
    lines.push("No issues found.");
    return lines.join("\n");
  }

  let currentFile = "";
  for (const issue of issues) {
    if (issue.file !== currentFile) {
      currentFile = issue.file;
      lines.push(`## ${currentFile}`);
    }
    lines.push(
      `- [${issue.severity}] L${issue.line}:C${issue.column} ${issue.rule} - ${issue.message}`,
    );
    if (issue.snippet.length > 0) {
      lines.push(`  \`${issue.snippet}\``);
    }
  }

  return lines.join("\n");
}

function renderJson(
  summary: Summary,
  issues: Issue[],
  scannedDecks: string[],
): string {
  return JSON.stringify(
    {
      summary,
      scannedDecks,
      issues,
    },
    null,
    2,
  );
}

main();
