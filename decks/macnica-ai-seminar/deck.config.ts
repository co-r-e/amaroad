import { defineConfig } from "../../src/lib/deck-config";

export default defineConfig({
  title: "エンジニア向け生成AI情報共有会",
  overlay: {
    textColor: "#7F748A",
  },
  logo: {
    src: "./assets/macnica-logo.png",
    position: "top-right",
  },
  copyright: {
    text: "@Macnica,Inc.",
    position: "bottom-left",
  },
  pageNumber: {
    position: "bottom-right",
    hideOnCover: true,
  },
  theme: {
    colors: {
      primary: "#8A219A",
      secondary: "#4B1D8B",
      background: "#FBFAFD",
      text: "#1D1628",
      textMuted: "#6E6477",
      textSubtle: "#7F748A",
      surface: "#F6F0F8",
      border: "#E7DCEC",
    },
    fonts: {
      heading: "'Noto Sans JP', sans-serif",
      body: "'Noto Sans JP', sans-serif",
      mono: "'JetBrains Mono', monospace",
    },
  },
  transition: "fade",
});
