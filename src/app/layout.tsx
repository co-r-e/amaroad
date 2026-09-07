import type { Metadata } from "next";
import { Inter, Noto_Sans_JP, Figtree, JetBrains_Mono, Fira_Code } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ExportJobProvider } from "@/contexts/ExportJobContext";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  display: "swap",
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

// Monospace faces referenced by deck themes (`theme.fonts.mono`) and the
// engine default ("Fira Code"). next/font registers them under their real
// family names, so a plain `font-family: "JetBrains Mono"` resolves.
//
// Bundled-font registry: keep BUNDLED_FONT_FAMILIES in src/lib/fonts.ts in
// sync with the loaders in this file.
const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Amaroad",
  description: "Amaroad — AI-driven slide authoring tool",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${notoSansJP.variable} ${figtree.variable} ${jetBrainsMono.variable} ${firaCode.variable} antialiased`}
      >
        <ThemeProvider>
          <ExportJobProvider>{children}</ExportJobProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
