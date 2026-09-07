import { findUnbundledFontFamilies, BUNDLED_FONT_FAMILIES } from "@/lib/fonts";
import type { Finding } from "../../lib/findings";
import type { DeckContext } from "../context";

export function checkFonts(ctx: DeckContext): Finding[] {
  if (!ctx.config) return [];
  const configFile = `${ctx.repoDir}/deck.config.ts`;
  return findUnbundledFontFamilies(ctx.config.theme).map((font) => ({
    deck: ctx.deckName,
    check: "fonts",
    rule: "font-not-bundled",
    severity: "warning" as const,
    message:
      `theme.fonts.${font.slot} references "${font.family}", which is not bundled; it renders only when the viewer's OS has it installed. ` +
      `Bundled: ${BUNDLED_FONT_FAMILIES.join(", ")}`,
    file: configFile,
    snippet: `${font.slot}: ${JSON.stringify(ctx.config?.theme.fonts?.[font.slot] ?? "")}`,
  }));
}
