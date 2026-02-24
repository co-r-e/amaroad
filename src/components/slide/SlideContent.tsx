"use client";

import { MDXRenderer } from "@/lib/mdx-runtime";
import type { SlideData, DeckConfig } from "@/types/deck";
import { slideComponents } from "@/components/mdx";

const DEFAULT_TEXT_COLOR = "#1a1a1a";
const DEFAULT_BG_COLOR = "#FFFFFF";
const DEFAULT_HEADING_FONT = "Inter, sans-serif";
const DEFAULT_BODY_FONT = "Noto Sans JP, sans-serif";

interface SlideContentProps {
  slide: SlideData;
  config: DeckConfig;
  deckName: string;
}

/** Replace relative `./assets/` references with the deck's API asset path. */
function resolveAssetPaths(rawContent: string, deckName: string): string {
  const apiBase = `/api/decks/${encodeURIComponent(deckName)}/assets/`;
  return rawContent
    .replace(/\(\.\/assets\//g, `(${apiBase}`)
    .replace(/"\.\/assets\//g, `"${apiBase}`)
    .replace(/'\.\/assets\//g, `'${apiBase}`);
}

function buildThemeStyle(
  slide: SlideData,
  config: DeckConfig,
): React.CSSProperties {
  const { colors, fonts } = config.theme;

  return {
    "--slide-primary": colors.primary,
    "--slide-secondary": colors.secondary ?? colors.primary,
    "--slide-bg":
      slide.frontmatter.background ?? colors.background ?? DEFAULT_BG_COLOR,
    "--slide-text": colors.text ?? DEFAULT_TEXT_COLOR,
    "--slide-font-heading": fonts?.heading ?? DEFAULT_HEADING_FONT,
    "--slide-font-body": fonts?.body ?? DEFAULT_BODY_FONT,
  } as React.CSSProperties;
}

export function SlideContent({
  slide,
  config,
  deckName,
}: SlideContentProps): React.JSX.Element {
  const themeStyle = buildThemeStyle(slide, config);

  return (
    <div
      className="w-full flex-1 min-h-0"
      style={{
        ...themeStyle,
        color: "var(--slide-text)",
        fontFamily: "var(--slide-font-body)",
      }}
    >
      <MDXRenderer
        source={resolveAssetPaths(slide.rawContent, deckName)}
        components={slideComponents}
      />
    </div>
  );
}
