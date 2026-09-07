/**
 * Preflight rules (static, per-.mdx text analysis). This is the single
 * implementation behind `pnpm amaroad doctor` and the legacy
 * `.claude/skills/slide-preflight-auditor/scripts/audit-slides.ts` wrapper.
 *
 * Rules:
 * - low-font-size         fontSize below 1.8rem              (error)
 * - no-side-accent-border borderLeft / border-left            (error)
 * - tailwind-classname    className with tailwind-like tokens (error)
 * - hardcoded-hex-color   #RGB literals in slide source       (warning)
 * - notes-missing / notes-empty                               (warning)
 */
import type { Finding, Severity } from "../../lib/findings";

export const MIN_FONT_SIZE_REM = 1.8;

export type PreflightRule =
  | "low-font-size"
  | "no-side-accent-border"
  | "tailwind-classname"
  | "hardcoded-hex-color"
  | "notes-missing"
  | "notes-empty";

export interface PreflightIssue {
  deck: string;
  file: string;
  line: number;
  column: number;
  severity: Exclude<Severity, "info">;
  rule: PreflightRule;
  message: string;
  snippet: string;
}

export interface PreflightOptions {
  /** Skip the notes-* rules (speaker notes are optional for some teams). */
  requireNotes?: boolean;
}

export function auditSlideSource(
  deck: string,
  file: string,
  content: string,
  options: PreflightOptions = {},
): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const locator = createLocator(content);
  const lines = splitLines(content);

  detectLowFontSize(deck, file, content, locator, lines, issues);
  detectBorderLeft(deck, file, content, locator, lines, issues);
  detectTailwindClassName(deck, file, lines, issues);
  detectHardcodedHexColor(deck, file, content, locator, lines, issues);
  if (options.requireNotes !== false) {
    detectMissingNotes(deck, file, lines, issues);
  }

  return issues;
}

export function preflightIssueToFinding(issue: PreflightIssue): Finding {
  return {
    deck: issue.deck,
    check: "preflight",
    rule: issue.rule,
    severity: issue.severity,
    message: issue.message,
    file: issue.file,
    line: issue.line,
    column: issue.column,
    snippet: issue.snippet || undefined,
  };
}

export function compareIssue(a: PreflightIssue, b: PreflightIssue): number {
  const rank = (severity: Severity): number => (severity === "error" ? 0 : 1);
  if (rank(a.severity) !== rank(b.severity)) {
    return rank(a.severity) - rank(b.severity);
  }
  if (a.file !== b.file) return a.file.localeCompare(b.file);
  if (a.line !== b.line) return a.line - b.line;
  if (a.column !== b.column) return a.column - b.column;
  return a.rule.localeCompare(b.rule);
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

type Locator = (index: number) => { line: number; column: number };

function detectLowFontSize(
  deck: string,
  file: string,
  content: string,
  locator: Locator,
  lines: string[],
  issues: PreflightIssue[],
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
  locator: Locator,
  lines: string[],
  issues: PreflightIssue[],
): void {
  // Capture the value so CSS-triangle tricks (`borderLeft: "6px solid
  // transparent"`) are not mistaken for accent borders.
  const re = /\b(?:borderLeft|border-left)\s*:\s*(?:(["'`])([^"'`]*)\1)?/g;
  for (const match of content.matchAll(re)) {
    const value = (match[2] ?? "").toLowerCase();
    if (value.includes("transparent") || value === "none" || value === "0") continue;
    const index = match.index ?? 0;
    const { line, column } = locator(index);
    // A zero-size box whose only visible border is one side is the CSS
    // triangle idiom (arrow markers), not an accent border.
    const lineText = pickLine(lines, line);
    if (/\bwidth\s*:\s*["'`]?0(?:px)?["'`]?/.test(lineText) && /\bheight\s*:\s*["'`]?0(?:px)?["'`]?/.test(lineText)) continue;
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
  issues: PreflightIssue[],
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
  locator: Locator,
  lines: string[],
  issues: PreflightIssue[],
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
  issues: PreflightIssue[],
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

  if (trimmed === "|" || trimmed.startsWith("|") || trimmed === ">" || trimmed.startsWith(">")) {
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

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

export function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

export function createLocator(text: string): Locator {
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

export function pickLine(lines: string[], lineNumber: number): string {
  return (lines[lineNumber - 1] ?? "").trim();
}
