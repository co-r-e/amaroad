#!/usr/bin/env npx tsx
/**
 * localize-deck.ts
 *
 * Translate deck MDX files between Japanese and English with MDX structure safeguards.
 *
 * Usage:
 *   npx tsx .claude/skills/deck-localizer/scripts/localize-deck.ts --deck sample-deck --to en
 *   npx tsx .claude/skills/deck-localizer/scripts/localize-deck.ts --deck sample-deck --to ja --write
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
import * as path from "node:path";
import matter from "gray-matter";

type Language = "ja" | "en";
type FromLanguage = "auto" | Language;
type Scope = "all" | "body" | "notes";

interface CliArgs {
  deck: string;
  to: Language;
  from: FromLanguage;
  scope: Scope;
  filesFilter?: string;
  model: string;
  write: boolean;
}

interface FileReport {
  file: string;
  status: "changed" | "unchanged" | "skipped";
  bodyChanged: boolean;
  notesChanged: boolean;
  wrote: boolean;
  reason?: string;
}

interface ProtectedSegments {
  masked: string;
  segments: Array<{ token: string; value: string }>;
}

function printUsage(): void {
  const usage = [
    "Usage:",
    "  npx tsx .claude/skills/deck-localizer/scripts/localize-deck.ts --deck <deck-name> --to <ja|en> [options]",
    "",
    "Options:",
    "  --deck <name|path>     Required. Deck name under decks/ or direct directory path",
    "  --to <ja|en>           Required. Target language",
    "  --from <auto|ja|en>    Optional. Source language hint (default: auto)",
    "  --scope all|body|notes Optional. Translate scope (default: all)",
    "  --files <pattern>      Optional. Glob-like pattern (* ?) or substring filter",
    "  --model <name>         Optional. Gemini model (default: gemini-2.5-flash)",
    "  --write                Apply file changes (default is dry-run)",
    "  --help, -h             Show help",
  ].join("\n");

  process.stdout.write(usage + "\n");
}

function die(message: string): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

function parseArgs(argv: string[]): CliArgs {
  let deck = "";
  let to: Language | "" = "";
  let from: FromLanguage = "auto";
  let scope: Scope = "all";
  let filesFilter: string | undefined;
  let model = "gemini-2.5-flash";
  let write = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--write") {
      write = true;
      continue;
    }

    if (arg === "--deck") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        die("--deck requires a value");
      }
      deck = value;
      i++;
      continue;
    }

    if (arg === "--to") {
      const value = argv[i + 1];
      if (value !== "ja" && value !== "en") {
        die("--to must be one of: ja, en");
      }
      to = value;
      i++;
      continue;
    }

    if (arg === "--from") {
      const value = argv[i + 1];
      if (value !== "auto" && value !== "ja" && value !== "en") {
        die("--from must be one of: auto, ja, en");
      }
      from = value;
      i++;
      continue;
    }

    if (arg === "--scope") {
      const value = argv[i + 1];
      if (value !== "all" && value !== "body" && value !== "notes") {
        die("--scope must be one of: all, body, notes");
      }
      scope = value;
      i++;
      continue;
    }

    if (arg === "--files") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        die("--files requires a value");
      }
      filesFilter = value;
      i++;
      continue;
    }

    if (arg === "--model") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        die("--model requires a value");
      }
      model = value;
      i++;
      continue;
    }

    die(`Unknown argument: ${arg}`);
  }

  if (!deck) {
    die("--deck is required");
  }
  if (!to) {
    die("--to is required");
  }

  return {
    deck,
    to,
    from,
    scope,
    filesFilter,
    model,
    write,
  };
}

function loadEnvLocal(projectRoot: string): void {
  const envPath = path.join(projectRoot, ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf-8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function findProjectRoot(startDir: string): string {
  let current = path.resolve(startDir);

  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(current, "package.json"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return process.cwd();
}

function resolveDeckDir(projectRoot: string, deckArg: string): string {
  if (path.isAbsolute(deckArg)) {
    return deckArg;
  }

  const byDeckName = path.join(projectRoot, "decks", deckArg);
  if (fs.existsSync(byDeckName)) {
    return byDeckName;
  }

  const byRelativePath = path.resolve(process.cwd(), deckArg);
  if (fs.existsSync(byRelativePath)) {
    return byRelativePath;
  }

  return byDeckName;
}

function createMatcher(filter?: string): ((fileName: string) => boolean) | null {
  if (!filter) {
    return null;
  }

  const hasWildcard = filter.includes("*") || filter.includes("?");
  if (!hasWildcard) {
    const needle = filter.toLowerCase();
    return (fileName: string) => fileName.toLowerCase().includes(needle);
  }

  const escaped = filter
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  const regex = new RegExp(`^${escaped}$`, "i");

  return (fileName: string) => regex.test(fileName);
}

function collectMdxFiles(deckDir: string, filesFilter?: string): string[] {
  const matcher = createMatcher(filesFilter);

  const collator = new Intl.Collator("en", {
    numeric: true,
    sensitivity: "base",
  });

  const files = fs
    .readdirSync(deckDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
    .map((entry) => path.join(deckDir, entry.name))
    .filter((absPath) => {
      if (!matcher) {
        return true;
      }
      return matcher(path.basename(absPath));
    })
    .sort((a, b) => collator.compare(path.basename(a), path.basename(b)));

  return files;
}

function protectSegments(input: string): ProtectedSegments {
  let sequence = 0;
  const segments: Array<{ token: string; value: string }> = [];

  const place = (value: string): string => {
    sequence += 1;
    const token = `__AMAROAD_TOKEN_${String(sequence).padStart(4, "0")}__`;
    segments.push({ token, value });
    return token;
  };

  let masked = input;

  masked = masked.replace(/```[\s\S]*?```/g, (m) => place(m));
  masked = masked.replace(/`[^`\n]+`/g, (m) => place(m));
  masked = masked.replace(/https?:\/\/[^\s)"'>]+/g, (m) => place(m));
  masked = masked.replace(/\.\/assets\/[^\s)"'`]+/g, (m) => place(m));
  masked = masked.replace(/var\(--slide-[^)]+\)/g, (m) => place(m));

  return { masked, segments };
}

function restoreSegments(input: string, segments: Array<{ token: string; value: string }>): string {
  let restored = input;

  for (const segment of segments) {
    restored = restored.split(segment.token).join(segment.value);
  }

  return restored;
}

function languageName(lang: Language): string {
  return lang === "ja" ? "Japanese" : "English";
}

function fromLanguageName(lang: FromLanguage): string {
  if (lang === "auto") {
    return "auto-detect";
  }
  return languageName(lang);
}

function buildBodyPrompt(maskedBody: string, to: Language, from: FromLanguage): string {
  return [
    "You are a professional localization editor for Amaroad MDX slides.",
    `Translate human-readable prose into ${languageName(to)}.`,
    `Source language hint: ${fromLanguageName(from)}.`,
    "",
    "Strict rules:",
    "- Preserve MDX/Markdown/JSX syntax exactly.",
    "- Preserve all placeholders like __AMAROAD_TOKEN_0001__ exactly.",
    "- Do not change component names, prop keys, asset paths, URLs, or CSS variables.",
    "- Do not add or remove sections.",
    "- Keep heading and bullet structure.",
    "- Return only translated MDX body text. No commentary.",
    "",
    "MDX body:",
    "<<<BEGIN_MDX>>>",
    maskedBody,
    "<<<END_MDX>>>",
  ].join("\n");
}

function buildNotesPrompt(maskedNotes: string, to: Language, from: FromLanguage): string {
  return [
    "You are a professional localization editor for speaker notes.",
    `Translate into ${languageName(to)}.`,
    `Source language hint: ${fromLanguageName(from)}.`,
    "",
    "Strict rules:",
    "- Preserve line breaks and bullet structure.",
    "- Preserve placeholders like __AMAROAD_TOKEN_0001__ exactly.",
    "- Keep numbers and URLs unchanged.",
    "- Return only the translated notes text. No commentary.",
    "",
    "Notes:",
    "<<<BEGIN_NOTES>>>",
    maskedNotes,
    "<<<END_NOTES>>>",
  ].join("\n");
}

function stripCodeFenceWrapper(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```[\w-]*\n([\s\S]*?)\n```$/);
  if (!match) {
    return text;
  }
  return match[1];
}

function extractResponseText(response: unknown): string | null {
  const asText = (response as { text?: unknown }).text;
  if (typeof asText === "string" && asText.trim().length > 0) {
    return asText;
  }

  const candidates = (
    response as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    }
  ).candidates;

  if (!candidates || candidates.length === 0) {
    return null;
  }

  const parts = candidates[0].content?.parts;
  if (!parts || parts.length === 0) {
    return null;
  }

  const joined = parts
    .map((part) => part.text)
    .filter((text): text is string => typeof text === "string")
    .join("")
    .trim();

  return joined.length > 0 ? joined : null;
}

async function generateTranslation(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
): Promise<string> {
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0,
    },
  });

  const text = extractResponseText(response);
  if (!text) {
    throw new Error("No text content returned from Gemini API");
  }

  return stripCodeFenceWrapper(text);
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function countMatches(text: string, regex: RegExp): number {
  return [...text.matchAll(regex)].length;
}

function extractAssetPathSet(text: string): Set<string> {
  return new Set(text.match(/\.\/assets\/[^\s)"'`]+/g) ?? []);
}

function extractImportExportLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("import ") || line.startsWith("export "));
}

function setEquals(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const value of a) {
    if (!b.has(value)) {
      return false;
    }
  }
  return true;
}

function validateBodyStructure(original: string, translated: string): { valid: boolean; reason?: string } {
  const originalNormalized = normalizeLineEndings(original);
  const translatedNormalized = normalizeLineEndings(translated);

  const originalFences = countMatches(originalNormalized, /```/g);
  const translatedFences = countMatches(translatedNormalized, /```/g);
  if (originalFences !== translatedFences) {
    return {
      valid: false,
      reason: `Code fence count changed (${originalFences} -> ${translatedFences})`,
    };
  }

  const originalAssets = extractAssetPathSet(originalNormalized);
  const translatedAssets = extractAssetPathSet(translatedNormalized);
  if (!setEquals(originalAssets, translatedAssets)) {
    return {
      valid: false,
      reason: "Asset paths changed during translation",
    };
  }

  const originalVars = countMatches(originalNormalized, /var\(--slide-[^)]+\)/g);
  const translatedVars = countMatches(translatedNormalized, /var\(--slide-[^)]+\)/g);
  if (originalVars !== translatedVars) {
    return {
      valid: false,
      reason: `CSS variable usage changed (${originalVars} -> ${translatedVars})`,
    };
  }

  const originalImports = extractImportExportLines(originalNormalized);
  const translatedImports = extractImportExportLines(translatedNormalized);
  if (originalImports.length !== translatedImports.length) {
    return {
      valid: false,
      reason: "import/export line count changed",
    };
  }

  for (let i = 0; i < originalImports.length; i++) {
    if (originalImports[i] !== translatedImports[i]) {
      return {
        valid: false,
        reason: "import/export lines changed",
      };
    }
  }

  return { valid: true };
}

function ensureTrailingNewlineLikeOriginal(original: string, translated: string): string {
  const originalHasTrailingNewline = original.endsWith("\n");
  if (originalHasTrailingNewline && !translated.endsWith("\n")) {
    return `${translated}\n`;
  }
  if (!originalHasTrailingNewline && translated.endsWith("\n")) {
    return translated.replace(/\n+$/g, "");
  }
  return translated;
}

async function translateBody(
  ai: GoogleGenAI,
  model: string,
  from: FromLanguage,
  to: Language,
  input: string,
): Promise<{ translated: string } | { error: string }> {
  const protectedBody = protectSegments(input);
  const prompt = buildBodyPrompt(protectedBody.masked, to, from);

  const translatedMasked = await generateTranslation(ai, model, prompt);

  for (const segment of protectedBody.segments) {
    if (!translatedMasked.includes(segment.token)) {
      return {
        error: `Placeholder token missing after translation (${segment.token})`,
      };
    }
  }

  const restored = restoreSegments(translatedMasked, protectedBody.segments);
  const normalized = ensureTrailingNewlineLikeOriginal(input, restored);

  const validation = validateBodyStructure(input, normalized);
  if (!validation.valid) {
    return {
      error: validation.reason ?? "Body structure validation failed",
    };
  }

  return { translated: normalized };
}

async function translateNotes(
  ai: GoogleGenAI,
  model: string,
  from: FromLanguage,
  to: Language,
  input: string,
): Promise<string> {
  const protectedNotes = protectSegments(input);
  const prompt = buildNotesPrompt(protectedNotes.masked, to, from);
  const translatedMasked = await generateTranslation(ai, model, prompt);

  const restored = restoreSegments(translatedMasked, protectedNotes.segments);
  return ensureTrailingNewlineLikeOriginal(input, restored);
}

function relativePath(base: string, target: string): string {
  return target.split(path.sep).join("/").replace(base.split(path.sep).join("/"), "").replace(/^\//, "");
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = findProjectRoot(process.cwd());
  loadEnvLocal(projectRoot);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    die("GEMINI_API_KEY is not set. Add it to .env.local or environment variables.");
  }

  const deckDir = resolveDeckDir(projectRoot, args.deck);
  if (!fs.existsSync(deckDir) || !fs.statSync(deckDir).isDirectory()) {
    die(`Deck directory not found: ${deckDir}`);
  }

  const files = collectMdxFiles(deckDir, args.filesFilter);
  if (files.length === 0) {
    die("No .mdx files matched the given scope");
  }

  const ai = new GoogleGenAI({ apiKey });
  const reports: FileReport[] = [];

  for (const filePath of files) {
    const originalRaw = fs.readFileSync(filePath, "utf-8");
    const parsed = matter(originalRaw);

    const data = { ...(parsed.data as Record<string, unknown>) };
    let nextBody = parsed.content;

    let bodyChanged = false;
    let notesChanged = false;

    try {
      if (args.scope === "all" || args.scope === "body") {
        const bodyResult = await translateBody(
          ai,
          args.model,
          args.from,
          args.to,
          parsed.content,
        );

        if ("error" in bodyResult) {
          reports.push({
            file: relativePath(projectRoot, filePath),
            status: "skipped",
            bodyChanged: false,
            notesChanged: false,
            wrote: false,
            reason: bodyResult.error,
          });
          continue;
        }

        if (bodyResult.translated !== parsed.content) {
          nextBody = bodyResult.translated;
          bodyChanged = true;
        }
      }

      if (args.scope === "all" || args.scope === "notes") {
        const notes = data.notes;
        if (typeof notes === "string" && notes.trim().length > 0) {
          const translatedNotes = await translateNotes(
            ai,
            args.model,
            args.from,
            args.to,
            notes,
          );
          if (translatedNotes !== notes) {
            data.notes = translatedNotes;
            notesChanged = true;
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reports.push({
        file: relativePath(projectRoot, filePath),
        status: "skipped",
        bodyChanged: false,
        notesChanged: false,
        wrote: false,
        reason: message,
      });
      continue;
    }

    if (!bodyChanged && !notesChanged) {
      reports.push({
        file: relativePath(projectRoot, filePath),
        status: "unchanged",
        bodyChanged,
        notesChanged,
        wrote: false,
      });
      continue;
    }

    const nextRaw = matter.stringify(nextBody, data, {
      lineWidth: 0,
    });

    if (args.write) {
      fs.writeFileSync(filePath, nextRaw, "utf-8");
    }

    reports.push({
      file: relativePath(projectRoot, filePath),
      status: "changed",
      bodyChanged,
      notesChanged,
      wrote: args.write,
    });
  }

  const changedCount = reports.filter((report) => report.status === "changed").length;
  const unchangedCount = reports.filter((report) => report.status === "unchanged").length;
  const skippedCount = reports.filter((report) => report.status === "skipped").length;

  process.stdout.write(`Mode: ${args.write ? "write" : "dry-run"}\n`);
  process.stdout.write(`Deck: ${relativePath(projectRoot, deckDir)}\n`);
  process.stdout.write(`Target language: ${args.to}\n`);
  process.stdout.write(`Scope: ${args.scope}\n`);
  process.stdout.write(`Model: ${args.model}\n\n`);

  for (const report of reports) {
    if (report.status === "changed") {
      const parts = [
        report.bodyChanged ? "body" : null,
        report.notesChanged ? "notes" : null,
      ].filter((value): value is string => Boolean(value));

      process.stdout.write(
        `- CHANGED ${report.file} (${parts.join("+")})${report.wrote ? " [written]" : " [dry-run]"}\n`,
      );
      continue;
    }

    if (report.status === "unchanged") {
      process.stdout.write(`- UNCHANGED ${report.file}\n`);
      continue;
    }

    process.stdout.write(`- SKIPPED ${report.file}: ${report.reason ?? "unknown reason"}\n`);
  }

  process.stdout.write("\n");
  process.stdout.write(`Summary: changed=${changedCount}, unchanged=${unchangedCount}, skipped=${skippedCount}\n`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});
