import type { DeckConfig, DeckConfigInput, DeckPreset } from "@/types/deck";
import path from "node:path";
import { jiti } from "./jiti";
import { findUnbundledFontFamilies, formatUnbundledFontWarning } from "./fonts";

const MAX_PRESET_DEPTH = 8;

/** Keys merged one level deep (object spread) instead of replaced wholesale. */
const MERGED_OBJECT_KEYS = [
  "logo",
  "copyright",
  "pageNumber",
  "overlay",
  "accentLine",
  "layoutPadding",
] as const;

type MergedObjectKey = (typeof MERGED_OBJECT_KEYS)[number];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeTheme(
  base: DeckConfig["theme"] | undefined,
  override: DeckConfig["theme"] | undefined,
): DeckConfig["theme"] | undefined {
  if (!base) return override;
  if (!override) return base;
  return {
    ...base,
    ...override,
    colors: { ...(base.colors ?? {}), ...(override.colors ?? {}) } as DeckConfig["theme"]["colors"],
    fonts: base.fonts || override.fonts ? { ...(base.fonts ?? {}), ...(override.fonts ?? {}) } : undefined,
    spacing:
      base.spacing || override.spacing ? { ...(base.spacing ?? {}), ...(override.spacing ?? {}) } : undefined,
  };
}

/**
 * Merge a deck config (or preset) over a base. Scalars in `override` win;
 * `theme.colors/fonts/spacing` and the well-known object sections are merged
 * one level deep so a deck can override a single color or logo offset.
 * `undefined` values in `override` never clear a base value.
 */
export function mergeDeckConfig<T extends Partial<DeckConfig>>(base: Partial<DeckConfig>, override: T): Partial<DeckConfig> & T {
  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (value === undefined || key === "extends") continue;
    if (key === "theme") {
      result.theme = mergeTheme(base.theme, value as DeckConfig["theme"]);
      continue;
    }
    if ((MERGED_OBJECT_KEYS as readonly string[]).includes(key) && isPlainObject(value) && isPlainObject(result[key])) {
      const baseSection = result[key] as Record<string, unknown>;
      const merged: Record<string, unknown> = { ...baseSection, ...value };
      if (key === "logo" && isPlainObject(baseSection.offset) && isPlainObject((value as Record<string, unknown>).offset)) {
        merged.offset = { ...(baseSection.offset as object), ...((value as Record<string, unknown>).offset as object) };
      }
      result[key as MergedObjectKey] = merged;
      continue;
    }
    result[key] = value;
  }

  return result as Partial<DeckConfig> & T;
}

/** Flatten a preset chain (deepest ancestor first) into one partial config. */
export function resolveDeckPreset(preset: DeckPreset | undefined): Partial<DeckConfig> {
  const chain: DeckPreset[] = [];
  const seen = new Set<DeckPreset>();
  let current: DeckPreset | undefined = preset;
  while (current) {
    if (seen.has(current)) {
      throw new Error("Deck preset chain is circular (a preset extends itself)");
    }
    if (chain.length >= MAX_PRESET_DEPTH) {
      throw new Error(`Deck preset chain is deeper than ${MAX_PRESET_DEPTH} levels`);
    }
    seen.add(current);
    chain.unshift(current);
    current = current.extends;
  }

  let resolved: Partial<DeckConfig> = {};
  for (const layer of chain) {
    resolved = mergeDeckConfig(resolved, layer);
  }
  return resolved;
}

/**
 * Declare a reusable theme/branding preset (typically `decks/_themes/*.ts`):
 *
 *   export default definePreset({ theme: {...}, logo: {...}, copyright: {...} });
 */
export function definePreset(preset: DeckPreset): DeckPreset {
  return preset;
}

/**
 * Declare a deck config. When `extends` is given, the preset chain is merged
 * synchronously so the module's default export is always a complete
 * `DeckConfig` (tools that import deck.config.ts directly keep working).
 *
 *   import amaroad from "../_themes/amaroad";
 *   export default defineConfig({ extends: amaroad, title: "...", createdAt: "2026-09-07" });
 */
export function defineConfig(config: DeckConfigInput): DeckConfig {
  const { extends: preset, ...own } = config;
  if (!preset) {
    return own as DeckConfig;
  }
  const base = resolveDeckPreset(preset);
  return mergeDeckConfig(base, own) as DeckConfig;
}

export async function loadDeckConfig(deckDir: string): Promise<DeckConfig> {
  const configPath = path.join(deckDir, "deck.config.ts");

  let mod: unknown;
  try {
    mod = await jiti.import(configPath);
  } catch (e) {
    throw new Error(
      `Failed to load deck config: ${configPath}\n${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const config = (mod as { default?: unknown }).default ?? mod;

  if (!config || typeof config !== "object") {
    throw new Error(
      `Invalid deck config in ${configPath}: expected an object with defineConfig()`,
    );
  }

  const c = config as Record<string, unknown>;

  if (typeof c.title !== "string") {
    throw new Error(`Deck config in ${configPath} is missing required "title" field`);
  }

  if (!c.theme || typeof c.theme !== "object") {
    throw new Error(
      `Deck config in ${configPath} is missing required "theme" field` +
        (c.extends ? " (a preset passed via extends must define theme)" : ""),
    );
  }

  const theme = c.theme as Record<string, unknown>;
  if (!theme.colors || typeof theme.colors !== "object") {
    throw new Error(`Deck config in ${configPath} is missing required "theme.colors" field`);
  }

  const colors = theme.colors as Record<string, unknown>;
  if (typeof colors.primary !== "string") {
    throw new Error(`Deck config in ${configPath} is missing required "theme.colors.primary" field`);
  }

  // createdAt is required for "newest first" sorting, but we degrade gracefully:
  // a missing/invalid value only warns (the deck still loads and sorts to the end).
  if (typeof c.createdAt !== "string" || Number.isNaN(Date.parse(c.createdAt))) {
    console.warn(
      `[amaroad] Deck config in ${configPath} is missing a valid "createdAt" (ISO date string, e.g. "2026-06-02"); it will sort last in "newest first" order`,
    );
  }

  const unbundled = findUnbundledFontFamilies((config as DeckConfig).theme);
  if (unbundled.length > 0) {
    console.warn(formatUnbundledFontWarning(`Deck config in ${configPath}`, unbundled));
  }

  return config as DeckConfig;
}
