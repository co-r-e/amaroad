#!/usr/bin/env npx tsx
/**
 * polish-notes.ts
 *
 * Update frontmatter `notes` in deck MDX files.
 * - Mode `fill`   : keep existing notes and add missing sections only.
 * - Mode `rewrite`: replace notes with regenerated structured notes.
 *
 * Usage:
 *   npx tsx .claude/skills/speaker-notes-polisher/scripts/polish-notes.ts --deck sample-deck
 *   npx tsx .claude/skills/speaker-notes-polisher/scripts/polish-notes.ts --deck sample-deck --mode rewrite --write
 */

import * as fs from "node:fs";
import * as path from "node:path";
import matter from "gray-matter";

type Mode = "fill" | "rewrite";

interface CliArgs {
  deck: string;
  mode: Mode;
  write: boolean;
}

interface SlideSignals {
  title: string | null;
  headings: string[];
  bullets: string[];
  paragraphs: string[];
  hasChart: boolean;
  hasTable: boolean;
  hasCode: boolean;
}

interface GeneratedNotes {
  purpose: string;
  talkingPoints: string[];
  durationSeconds: number;
}

interface ChangeItem {
  file: string;
  reason: string;
  added: number;
  removed: number;
}

function printHelp(): void {
  console.log(`Usage:
  npx tsx .claude/skills/speaker-notes-polisher/scripts/polish-notes.ts --deck <deck-name> [--mode fill|rewrite] [--write]

Options:
  --deck   Required. Deck name under decks/ (or direct deck directory path)
  --mode   Optional. fill|rewrite (default: fill)
  --write  Optional. Apply changes. Without this flag, runs dry-run only.
  --help   Show help
`);
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  let deck = "";
  let mode: Mode = "fill";
  let write = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--write") {
      write = true;
      continue;
    }

    if (arg === "--deck") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        console.error("Error: --deck requires a value");
        process.exit(1);
      }
      deck = value;
      i++;
      continue;
    }

    if (arg === "--mode") {
      const value = argv[i + 1];
      if (value !== "fill" && value !== "rewrite") {
        console.error("Error: --mode must be one of: fill, rewrite");
        process.exit(1);
      }
      mode = value;
      i++;
      continue;
    }

    console.error(`Error: unknown argument: ${arg}`);
    process.exit(1);
  }

  if (!deck) {
    console.error("Error: --deck is required");
    process.exit(1);
  }

  return { deck, mode, write };
}

function findProjectRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function resolveDeckDir(projectRoot: string, deckArg: string): string {
  if (path.isAbsolute(deckArg)) {
    return deckArg;
  }

  const candidateInDecks = path.join(projectRoot, "decks", deckArg);
  if (fs.existsSync(candidateInDecks)) {
    return candidateInDecks;
  }

  const candidateRelative = path.resolve(process.cwd(), deckArg);
  if (fs.existsSync(candidateRelative)) {
    return candidateRelative;
  }

  return candidateInDecks;
}

function listMdxFiles(deckDir: string): string[] {
  const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
  return fs
    .readdirSync(deckDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
    .map((entry) => path.join(deckDir, entry.name))
    .sort((a, b) => collator.compare(path.basename(a), path.basename(b)));
}

function normalizeText(text: string): string {
  return text
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\{[^}]*\}/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_{1,2}([^_]+)_{1,2}/g, "$1")
    .replace(/~{1,2}([^~]+)~{1,2}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function uniq(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function extractSignals(content: string): SlideSignals {
  const headings: string[] = [];
  const bullets: string[] = [];
  const paragraphs: string[] = [];
  let inCodeFence = false;

  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith("```")) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;

    const headingMatch = rawLine.match(/^\s*#{1,6}\s+(.+)$/);
    if (headingMatch) {
      const cleaned = normalizeText(headingMatch[1]);
      if (cleaned) headings.push(cleaned);
      continue;
    }

    const bulletMatch = rawLine.match(/^\s*(?:[-*+]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      const cleaned = normalizeText(bulletMatch[1]);
      if (cleaned) bullets.push(cleaned);
      continue;
    }

    if (
      !line ||
      line.startsWith("<") ||
      line.startsWith("import ") ||
      line.startsWith("export ") ||
      line.startsWith("{") ||
      line.startsWith("}") ||
      line.startsWith("|") ||
      line.startsWith("---")
    ) {
      continue;
    }

    const cleaned = normalizeText(line);
    if (!cleaned) continue;
    if (cleaned.length < 4) continue;
    paragraphs.push(cleaned);
  }

  const liMatches = content.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g);
  for (const m of liMatches) {
    const cleaned = normalizeText(m[1] ?? "");
    if (cleaned) bullets.push(cleaned);
  }

  const normalizedHeadings = uniq(headings).slice(0, 6);
  const normalizedBullets = uniq(bullets).slice(0, 10);
  const normalizedParagraphs = uniq(paragraphs).slice(0, 8);
  const title = normalizedHeadings[0] ?? normalizedParagraphs[0] ?? null;

  return {
    title,
    headings: normalizedHeadings,
    bullets: normalizedBullets,
    paragraphs: normalizedParagraphs,
    hasChart: /<Chart\b/.test(content),
    hasTable: /<table\b|^\s*\|.+\|\s*$/m.test(content),
    hasCode: /```/.test(content),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundToFive(value: number): number {
  return Math.round(value / 5) * 5;
}

function estimateDurationSeconds(type: string | undefined, signals: SlideSignals): number {
  if (type === "cover") return 30;
  if (type === "ending") return 30;
  if (type === "section") return 25;

  let score = 30;
  score += Math.min(signals.headings.length, 4) * 5;
  score += Math.min(signals.bullets.length, 8) * 6;
  score += Math.min(signals.paragraphs.length, 6) * 3;
  if (signals.hasChart) score += 15;
  if (signals.hasTable) score += 20;
  if (signals.hasCode) score += 20;

  return clamp(roundToFive(score), 30, 120);
}

function buildPurpose(type: string | undefined, title: string | null): string {
  if (type === "cover") {
    return "Share the theme and goal quickly so the audience aligns on context.";
  }
  if (type === "section") {
    return "Clarify what this section covers and connect to the next part.";
  }
  if (type === "ending") {
    return "Close with clear conclusions and concrete next actions.";
  }
  if (title) {
    return `Help the audience understand the value of "${title}" within one minute.`;
  }
  return "Deliver the key point concisely and bridge to the next topic.";
}

function buildTalkingPoints(signals: SlideSignals): string[] {
  const candidates = uniq([
    ...signals.bullets,
    ...signals.headings.slice(1),
    ...signals.paragraphs,
  ]);

  const normalized = candidates
    .map((point) => point.replace(/[.]+$/g, "").trim())
    .filter((point) => point.length > 0)
    .map((point) => {
      if (point.length > 80) {
        return `${point.slice(0, 80)}...`;
      }
      return point;
    });

  const picked = normalized.slice(0, 4);
  if (picked.length > 0) {
    return picked;
  }

  if (signals.title) {
    return [
      `Background behind ${signals.title}`,
      `Key points to retain about ${signals.title}`,
      "Transition to the next slide",
    ];
  }

  return ["Background", "Key points", "Next actions"];
}

function generateNotes(type: string | undefined, signals: SlideSignals): GeneratedNotes {
  return {
    purpose: buildPurpose(type, signals.title),
    talkingPoints: buildTalkingPoints(signals),
    durationSeconds: estimateDurationSeconds(type, signals),
  };
}

function renderSectionPurpose(purpose: string): string {
  return ["Purpose:", `- ${purpose}`].join("\n");
}

function renderSectionTalkingPoints(points: string[]): string {
  return ["Talking Points:", ...points.map((point) => `- ${point}`)].join("\n");
}

function renderSectionDuration(seconds: number): string {
  return ["Estimated Time:", `- ${seconds} seconds`].join("\n");
}

function renderNotesText(notes: GeneratedNotes): string {
  return [
    renderSectionPurpose(notes.purpose),
    "",
    renderSectionTalkingPoints(notes.talkingPoints),
    "",
    renderSectionDuration(notes.durationSeconds),
  ].join("\n");
}

function hasPurposeSection(text: string): boolean {
  return /(^|\n)\s*Purpose\s*:/m.test(text);
}

function hasTalkingPointsSection(text: string): boolean {
  return /(^|\n)\s*Talking Points\s*:/m.test(text);
}

function hasDurationSection(text: string): boolean {
  return /(^|\n)\s*Estimated Time\s*:/m.test(text);
}

function splitLines(text: string): string[] {
  if (!text.trim()) return [];
  return text.split(/\r?\n/);
}

function diffLineCounts(before: string, after: string): { added: number; removed: number } {
  const a = splitLines(before);
  const b = splitLines(after);
  const n = a.length;
  const m = b.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const lcs = dp[n][m];
  return {
    added: m - lcs,
    removed: n - lcs,
  };
}

function toNoteString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  return "";
}

function main(): void {
  const args = parseArgs();
  const projectRoot = findProjectRoot();
  const deckDir = resolveDeckDir(projectRoot, args.deck);

  if (!fs.existsSync(deckDir) || !fs.statSync(deckDir).isDirectory()) {
    console.error(`Error: deck directory not found: ${deckDir}`);
    process.exit(1);
  }

  const mdxFiles = listMdxFiles(deckDir);
  if (mdxFiles.length === 0) {
    console.error(`Error: no .mdx files found in ${deckDir}`);
    process.exit(1);
  }

  const changes: ChangeItem[] = [];
  const skippedNoFrontmatter: string[] = [];
  let unchanged = 0;

  for (const filePath of mdxFiles) {
    const raw = fs.readFileSync(filePath, "utf-8");

    if (!matter.test(raw)) {
      skippedNoFrontmatter.push(path.relative(projectRoot, filePath));
      continue;
    }

    const parsed = matter(raw);
    const data = parsed.data as Record<string, unknown>;
    const type = typeof data.type === "string" ? data.type : undefined;
    const beforeNotes = toNoteString(data.notes);

    const signals = extractSignals(parsed.content);
    const generated = generateNotes(type, signals);
    const generatedText = renderNotesText(generated);

    let afterNotes = beforeNotes;
    let reason = "";

    if (args.mode === "rewrite") {
      afterNotes = generatedText;
      reason = beforeNotes ? "full notes rewrite (rewrite)" : "new notes generated";
    } else if (!beforeNotes) {
      afterNotes = generatedText;
      reason = "new notes generated";
    } else {
      const missingSections: string[] = [];
      const additions: string[] = [];

      if (!hasPurposeSection(beforeNotes)) {
        missingSections.push("Purpose");
        additions.push(renderSectionPurpose(generated.purpose));
      }
      if (!hasTalkingPointsSection(beforeNotes)) {
        missingSections.push("Talking Points");
        additions.push(renderSectionTalkingPoints(generated.talkingPoints));
      }
      if (!hasDurationSection(beforeNotes)) {
        missingSections.push("Estimated Time");
        additions.push(renderSectionDuration(generated.durationSeconds));
      }

      if (additions.length > 0) {
        afterNotes = `${beforeNotes.trimEnd()}\n\n${additions.join("\n\n")}`;
        reason = `filled missing sections (fill): ${missingSections.join(", ")}`;
      }
    }

    if (afterNotes === beforeNotes) {
      unchanged++;
      continue;
    }

    const updatedData = { ...data };
    updatedData.notes = afterNotes;

    const nextContent = matter.stringify(parsed.content, updatedData);
    const rel = path.relative(projectRoot, filePath);
    const { added, removed } = diffLineCounts(beforeNotes, afterNotes);

    if (args.write) {
      fs.writeFileSync(filePath, nextContent, "utf-8");
    }

    changes.push({
      file: rel,
      reason,
      added,
      removed,
    });
  }

  const modeLabel = args.write ? "WRITE" : "DRY-RUN";
  console.log(`[${modeLabel}] deck: ${path.relative(projectRoot, deckDir)}`);
  console.log(`[${modeLabel}] mode: ${args.mode}`);
  console.log(`[${modeLabel}] changed: ${changes.length}, unchanged: ${unchanged}`);

  if (skippedNoFrontmatter.length > 0) {
    console.log(`[${modeLabel}] skipped(no frontmatter): ${skippedNoFrontmatter.length}`);
    for (const file of skippedNoFrontmatter) {
      console.log(`  - ${file}`);
    }
  }

  if (changes.length === 0) {
    console.log(`[${modeLabel}] no updates needed`);
    return;
  }

  console.log(`[${modeLabel}] diff summary:`);
  for (const item of changes) {
    console.log(
      `  - ${item.file} | ${item.reason} | notes +${item.added} / -${item.removed}`,
    );
  }
}

main();
