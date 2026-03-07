import { defineConfig } from "../../src/lib/deck-config";

export default defineConfig({
  title: "Sample Company Deck",
  logo: {
    src: "/dexcode-logo.svg",
    position: "top-left",
  },
  copyright: {
    text: "© 2026 Sample Company",
    position: "bottom-right",
  },
  pageNumber: {
    position: "bottom-left",
    hideOnCover: true,
  },
  theme: {
    colors: {
      primary: "#FF6D00",
      secondary: "#FF9100",
      background: "#0a0a0a",
      text: "#FFFFFF",
    },
    fonts: {
      heading: "Inter, sans-serif",
      body: "Inter, sans-serif",
    },
  },
  transition: "fade",
});
