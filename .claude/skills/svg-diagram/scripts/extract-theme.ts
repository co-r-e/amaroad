/**
 * extract-theme.ts
 *
 * Reads theme variables from a deck's deck.config.ts,
 * applies the same default resolution as buildThemeStyle(), and outputs as JSON.
 *
 * Usage:
 *   pnpm exec tsx .claude/skills/svg-diagram/scripts/extract-theme.ts --deck <deck-name>
 */

import * as path from "node:path";
import * as fs from "node:fs";
import { createJiti } from "jiti";

// ---------- Argument parsing ----------

function parseArgs(): { deck: string } {
  const args = process.argv.slice(2);
  let deck = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--deck" && args[i + 1]) {
      deck = args[i + 1];
      i++;
    }
  }

  if (!deck) {
    console.error("Error: --deck <deck-name> is required");
    process.exit(1);
  }

  return { deck };
}

// ---------- Find project root ----------

function findProjectRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

// ---------- Main ----------

interface ThemeColors {
  primary: string;
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
}

interface ThemeTypography {
  heading?: string;
  body?: string;
  mono?: string;
  headingWeight?: number;
  headingLetterSpacing?: string;
  bodyLineHeight?: number;
}

interface DeckTheme {
  colors: ThemeColors;
  fonts?: ThemeTypography;
  spacing?: { xs?: number; sm?: number; md?: number; lg?: number; xl?: number; xxl?: number };
  radius?: string;
}

interface DeckConfig {
  title: string;
  theme: DeckTheme;
  [key: string]: unknown;
}

async function main(): Promise<void> {
  const { deck } = parseArgs();
  const projectRoot = findProjectRoot();
  const deckDir = path.join(projectRoot, "decks", deck);

  if (!fs.existsSync(deckDir)) {
    console.error(`Error: deck directory not found: ${deckDir}`);
    process.exit(1);
  }

  const configPath = path.join(deckDir, "deck.config.ts");
  if (!fs.existsSync(configPath)) {
    console.error(`Error: deck.config.ts not found: ${configPath}`);
    process.exit(1);
  }

  // Load config using jiti (same pattern as src/lib/deck-config.ts)
  const jiti = createJiti(import.meta.url, { interopDefault: true });

  let mod: unknown;
  try {
    mod = await jiti.import(configPath);
  } catch (e) {
    console.error(
      `Error: failed to load deck config: ${configPath}\n${e instanceof Error ? e.message : String(e)}`,
    );
    process.exit(1);
  }

  const config = ((mod as { default?: unknown }).default ?? mod) as DeckConfig;

  if (!config?.theme?.colors?.primary) {
    console.error("Error: invalid deck config — missing theme.colors.primary");
    process.exit(1);
  }

  const { colors, fonts, radius } = config.theme;

  // Apply the same defaults as buildThemeStyle() in SlideContent.tsx
  const resolved = {
    primary: colors.primary,
    secondary: colors.secondary ?? colors.primary,
    accent: colors.accent ?? colors.primary,
    background: colors.background ?? "#FFFFFF",
    text: colors.text ?? "#1a1a1a",
    textMuted: colors.textMuted ?? "#6b7280",
    textSubtle: colors.textSubtle ?? "#9ca3af",
    surface: colors.surface ?? "#f8f9fa",
    surfaceAlt: colors.surfaceAlt ?? "#f0f2f5",
    border: colors.border ?? "#e5e7eb",
    borderLight: colors.borderLight ?? "#f3f4f6",
    fontHeading: fonts?.heading ?? "Inter, sans-serif",
    fontBody: fonts?.body ?? "Noto Sans JP, sans-serif",
    fontMono: fonts?.mono ?? "Fira Code, monospace",
    headingWeight: fonts?.headingWeight ?? 700,
    radius: radius ?? "1rem",
  };

  console.log(JSON.stringify(resolved, null, 2));
}

main();
