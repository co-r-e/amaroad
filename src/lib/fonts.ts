import type { DeckTheme } from "@/types/deck";

/**
 * Font families that Amaroad self-hosts through `next/font/google` in
 * `src/app/layout.tsx`. A deck theme may reference any family, but only these
 * are guaranteed to render identically everywhere (viewer, export, CI).
 *
 * Keep this list in sync with the `next/font/google` imports in layout.tsx.
 */
export const BUNDLED_FONT_FAMILIES: readonly string[] = [
  "Inter",
  "Noto Sans JP",
  "Figtree",
  "JetBrains Mono",
  "Fira Code",
];

/** CSS generic families and keywords that never need loading. */
export const GENERIC_FONT_FAMILIES: readonly string[] = [
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "emoji",
  "math",
  "fangsong",
  "inherit",
  "initial",
  "unset",
];

const BUNDLED_LOWER = new Set(BUNDLED_FONT_FAMILIES.map((f) => f.toLowerCase()));
const GENERIC_LOWER = new Set(GENERIC_FONT_FAMILIES.map((f) => f.toLowerCase()));

/** Split a CSS `font-family` list into trimmed, unquoted family names. */
export function parseFontFamilies(value: string | undefined): string[] {
  if (!value) return [];
  const families: string[] = [];
  for (const token of value.split(",")) {
    const family = token.trim().replace(/^["']|["']$/g, "").trim();
    if (family && !families.includes(family)) families.push(family);
  }
  return families;
}

export function isBundledFontFamily(family: string): boolean {
  return BUNDLED_LOWER.has(family.trim().toLowerCase());
}

export function isGenericFontFamily(family: string): boolean {
  const lower = family.trim().toLowerCase();
  return GENERIC_LOWER.has(lower) || lower.startsWith("var(");
}

export interface UnbundledFont {
  /** Which theme slot referenced it: heading | body | mono. */
  slot: "heading" | "body" | "mono";
  family: string;
}

/**
 * Families referenced by the theme that are neither bundled nor generic.
 * Such fonts only render when the viewer's OS happens to have them installed.
 */
export function findUnbundledFontFamilies(theme: DeckTheme | undefined): UnbundledFont[] {
  const fonts = theme?.fonts;
  if (!fonts) return [];
  const result: UnbundledFont[] = [];
  const slots: Array<["heading" | "body" | "mono", string | undefined]> = [
    ["heading", fonts.heading],
    ["body", fonts.body],
    ["mono", fonts.mono],
  ];
  for (const [slot, value] of slots) {
    for (const family of parseFontFamilies(value)) {
      if (isBundledFontFamily(family) || isGenericFontFamily(family)) continue;
      result.push({ slot, family });
    }
  }
  return result;
}

export function formatUnbundledFontWarning(deckLabel: string, fonts: UnbundledFont[]): string {
  const list = fonts.map((f) => `"${f.family}" (${f.slot})`).join(", ");
  return (
    `[amaroad] ${deckLabel} references font families that are not bundled: ${list}. ` +
    `They render only if the viewer's OS has them installed. Bundled families: ${BUNDLED_FONT_FAMILIES.join(", ")}.`
  );
}
