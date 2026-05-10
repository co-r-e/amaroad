#!/usr/bin/env npx tsx
/**
 * normalize-theme.ts
 *
 * Normalize hard-coded HEX colors in decks/<deck>/*.mdx to slide CSS variables,
 * using decks/<deck>/deck.config.ts theme.colors as the source of truth.
 *
 * Usage:
 *   npx tsx .claude/skills/theme-normalizer/scripts/normalize-theme.ts --deck <deck>
 *   npx tsx .claude/skills/theme-normalizer/scripts/normalize-theme.ts --deck <deck> --write
 *   npx tsx .claude/skills/theme-normalizer/scripts/normalize-theme.ts --deck <deck> --files "03-*.mdx"
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

interface Args {
  deck: string;
  write: boolean;
  filesFilter?: string;
}

interface ThemeColors {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
  textMuted?: string;
  textSubtle?: string;
  surface?: string;
  surfaceAlt?: string;
  border?: string;
  borderLight?: string;
  [key: string]: unknown;
}

interface DeckConfig {
  theme?: {
    colors?: ThemeColors;
  };
  [key: string]: unknown;
}

interface FileReport {
  filePath: string;
  totalReplacements: number;
  byRule: Map<string, number>;
}

const COLOR_KEY_TO_VAR: Array<{ key: keyof ThemeColors; cssVar: string }> = [
  { key: "primary", cssVar: "var(--slide-primary)" },
  { key: "secondary", cssVar: "var(--slide-secondary)" },
  { key: "accent", cssVar: "var(--slide-accent)" },
  { key: "background", cssVar: "var(--slide-bg)" },
  { key: "text", cssVar: "var(--slide-text)" },
  { key: "textMuted", cssVar: "var(--slide-text-muted)" },
  { key: "textSubtle", cssVar: "var(--slide-text-subtle)" },
  { key: "surface", cssVar: "var(--slide-surface)" },
  { key: "surfaceAlt", cssVar: "var(--slide-surface-alt)" },
  { key: "border", cssVar: "var(--slide-border)" },
  { key: "borderLight", cssVar: "var(--slide-border-light)" },
];

function printUsage(): void {
  console.log(
    [
      "Usage:",
      "  npx tsx .claude/skills/theme-normalizer/scripts/normalize-theme.ts --deck <deck>",
      "  npx tsx .claude/skills/theme-normalizer/scripts/normalize-theme.ts --deck <deck> --write",
      "  npx tsx .claude/skills/theme-normalizer/scripts/normalize-theme.ts --deck <deck> --files \"03-*.mdx\"",
      "",
      "Options:",
      "  --deck <name>      Required. Deck name under decks/<name>",
      "  --write            Apply changes. Default is dry-run",
      "  --files <pattern>  Optional file filter (glob-like if contains * or ?; else substring)",
    ].join("\n"),
  );
}

function parseArgs(argv: string[]): Args {
  let deck = "";
  let write = false;
  let filesFilter: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--deck") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error("--deck requires a value");
      }
      deck = next;
      i++;
      continue;
    }

    if (arg === "--write") {
      write = true;
      continue;
    }

    if (arg === "--files") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error("--files requires a value");
      }
      filesFilter = next;
      i++;
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!deck) {
    throw new Error("--deck <deck-name> is required");
  }

  return { deck, write, filesFilter };
}

function findProjectRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  let dir = path.dirname(currentFile);

  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return process.cwd();
}

function normalizeHex(raw: string): string | null {
  const input = raw.trim();
  const match = input.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (!match) {
    return null;
  }

  const hex = match[1].toLowerCase();

  if (hex.length === 3 || hex.length === 4) {
    const expanded = hex
      .split("")
      .map((char) => char + char)
      .join("");
    return `#${expanded}`;
  }

  return `#${hex}`;
}

function loadThemeColors(configPath: string): Promise<ThemeColors> {
  const jiti = createJiti(import.meta.url, { interopDefault: true });

  return jiti
    .import(configPath)
    .then((mod: unknown) => {
      const config = ((mod as { default?: unknown }).default ?? mod) as DeckConfig;
      const colors = config?.theme?.colors;

      if (!colors || typeof colors !== "object") {
        throw new Error("invalid deck.config.ts: theme.colors is missing");
      }

      return colors;
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`failed to load deck config: ${message}`);
    });
}

function buildHexToVarMap(colors: ThemeColors): {
  hexToVar: Map<string, string>;
  duplicateWarnings: string[];
} {
  const hexToVar = new Map<string, string>();
  const duplicateWarnings: string[] = [];

  for (const rule of COLOR_KEY_TO_VAR) {
    const rawValue = colors[rule.key];
    if (typeof rawValue !== "string") {
      continue;
    }

    const normalized = normalizeHex(rawValue);
    if (!normalized) {
      continue;
    }

    const existing = hexToVar.get(normalized);
    if (existing && existing !== rule.cssVar) {
      duplicateWarnings.push(
        `${normalized}: prioritize ${existing} (skip ${rule.cssVar})`,
      );
      continue;
    }

    if (!existing) {
      hexToVar.set(normalized, rule.cssVar);
    }
  }

  return { hexToVar, duplicateWarnings };
}

function createFileMatcher(filter?: string): ((relativePath: string) => boolean) | null {
  if (!filter) {
    return null;
  }

  const hasWildcard = filter.includes("*") || filter.includes("?");

  if (!hasWildcard) {
    const needle = filter.toLowerCase();
    return (relativePath: string) => relativePath.toLowerCase().includes(needle);
  }

  const escaped = filter
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  const regex = new RegExp(`^${escaped}$`, "i");

  return (relativePath: string) => regex.test(relativePath);
}

function collectMdxFiles(deckDir: string, filesFilter?: string): string[] {
  const matcher = createFileMatcher(filesFilter);
  const entries = fs.readdirSync(deckDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
    .map((entry) => path.join(deckDir, entry.name))
    .filter((filePath) => {
      if (!matcher) {
        return true;
      }
      return matcher(path.basename(filePath));
    })
    .sort((a, b) => a.localeCompare(b));
}

function normalizeFileContent(content: string, hexToVar: Map<string, string>): {
  nextContent: string;
  totalReplacements: number;
  byRule: Map<string, number>;
} {
  const byRule = new Map<string, number>();
  let totalReplacements = 0;

  const nextContent = content.replace(/#[0-9a-fA-F]{3,8}\b/g, (matched) => {
    const normalized = normalizeHex(matched);
    if (!normalized) {
      return matched;
    }

    const replacement = hexToVar.get(normalized);
    if (!replacement) {
      return matched;
    }

    totalReplacements += 1;
    const key = `${normalized} -> ${replacement}`;
    byRule.set(key, (byRule.get(key) ?? 0) + 1);
    return replacement;
  });

  return { nextContent, totalReplacements, byRule };
}

function printHeader(args: Args): void {
  console.log(`Deck: ${args.deck}`);
  console.log(`Mode: ${args.write ? "write" : "dry-run"}`);
  if (args.filesFilter) {
    console.log(`Files filter: ${args.filesFilter}`);
  }
  console.log("");
}

function printReports(
  reports: FileReport[],
  write: boolean,
  totalReplacements: number,
): void {
  if (reports.length === 0) {
    console.log("No matching hard-coded theme HEX colors were found.");
    return;
  }

  for (const report of reports) {
    console.log(`${write ? "[changed]" : "[candidate]"} ${report.filePath}`);
    console.log(`  replacements: ${report.totalReplacements}`);

    for (const [rule, count] of report.byRule.entries()) {
      console.log(`  - ${rule} (${count})`);
    }

    console.log("");
  }

  console.log(
    `${write ? "Applied" : "Found"} ${totalReplacements} replacement(s) in ${reports.length} file(s).`,
  );

  if (!write) {
    console.log("Re-run with --write to apply these changes.");
  }
}

async function main(): Promise<void> {
  let args: Args;

  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    console.error("");
    printUsage();
    process.exit(1);
  }

  const projectRoot = findProjectRoot();
  const deckDir = path.join(projectRoot, "decks", args.deck);
  const configPath = path.join(deckDir, "deck.config.ts");

  if (!fs.existsSync(deckDir)) {
    console.error(`Error: deck directory not found: ${deckDir}`);
    process.exit(1);
  }
  if (!fs.existsSync(configPath)) {
    console.error(`Error: deck config not found: ${configPath}`);
    process.exit(1);
  }

  const colors = await loadThemeColors(configPath);
  const { hexToVar, duplicateWarnings } = buildHexToVarMap(colors);

  if (hexToVar.size === 0) {
    console.error("Error: no HEX values found in theme.colors for supported keys.");
    process.exit(1);
  }

  const targetFiles = collectMdxFiles(deckDir, args.filesFilter);
  if (targetFiles.length === 0) {
    console.error("Error: no target .mdx files matched.");
    process.exit(1);
  }

  printHeader(args);

  if (duplicateWarnings.length > 0) {
    console.log("[warn] Duplicate HEX mappings detected:");
    for (const warning of duplicateWarnings) {
      console.log(`  - ${warning}`);
    }
    console.log("");
  }

  const reports: FileReport[] = [];
  let totalReplacements = 0;

  for (const filePath of targetFiles) {
    const original = fs.readFileSync(filePath, "utf8");
    const { nextContent, totalReplacements: fileReplacements, byRule } = normalizeFileContent(
      original,
      hexToVar,
    );

    if (fileReplacements === 0) {
      continue;
    }

    if (args.write) {
      fs.writeFileSync(filePath, nextContent, "utf8");
    }

    totalReplacements += fileReplacements;
    reports.push({
      filePath: path.relative(projectRoot, filePath),
      totalReplacements: fileReplacements,
      byRule,
    });
  }

  printReports(reports, args.write, totalReplacements);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
});
