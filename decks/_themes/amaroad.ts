import { definePreset } from "../../src/lib/deck-config";

/**
 * Amaroad house theme. Decks reuse it with:
 *
 *   import amaroad from "../_themes/amaroad";
 *   export default defineConfig({ extends: amaroad, title: "...", createdAt: "2026-09-07" });
 *
 * Any field a deck sets on its own config wins over the preset; theme colors,
 * fonts, logo, copyright and page-number sections merge one level deep so a
 * deck can override a single value (e.g. `theme: { colors: { accent: "#..." } }`).
 */
export default definePreset({
  logo: {
    src: "/amaroad-logo.svg",
    position: "top-right",
  },
  copyright: {
    text: "© 2026 Amaroad",
    position: "bottom-left",
  },
  pageNumber: {
    position: "bottom-right",
    hideOnCover: true,
  },
  theme: {
    colors: {
      primary: "#02001A",
      secondary: "#02001A",
      background: "#FFFFFF",
      text: "#1a1a1a",
    },
    fonts: {
      heading: "Inter, sans-serif",
      body: "Noto Sans JP, sans-serif",
    },
  },
  transition: "fade",
});
