import { defineConfig } from "../../src/lib/deck-config";

export default defineConfig({
  title: "Amaroad Sample Deck",
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
