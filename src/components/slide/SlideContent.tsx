"use client";

import { useMemo } from "react";
import { MDXRenderer } from "@/lib/mdx-runtime";
import type { SlideData, SlideType, DeckConfig } from "@/types/deck";
import { slideComponents } from "@/components/mdx";
import styles from "./SlideContent.module.css";

/** Slide types that already handle their own vertical centering in SlideFrame. */
const SELF_CENTERED_TYPES: ReadonlySet<SlideType> = new Set([
  "cover",
  "ending",
  "quote",
  "image-full",
]);

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

function scaleCssLengthTokens(value: string, scaleVar: string): string {
  return value.replace(
    /(-?\d*\.?\d+)(rem|px)\b/g,
    (_, amount: string, unit: string) => `calc(${amount}${unit} * var(${scaleVar}))`,
  );
}

function normalizeMdxSizing(rawContent: string): string {
  const inlineFontSizePattern =
    /(fontSize\s*:\s*)(["'])(-?\d*\.?\d+)(rem|px)\2/g;
  const svgFontSizePattern =
    /(fontSize\s*=\s*)(["'])(-?\d*\.?\d+)(px|rem)?\2/g;
  const spacingPropertyPattern =
    /((?:margin|marginTop|marginBottom|marginLeft|marginRight|padding|paddingTop|paddingBottom|paddingLeft|paddingRight|gap|rowGap|columnGap)\s*:\s*)(["'])([^"']*?\d[^"']*)\2/g;
  const fencedCodePattern = /(```[\s\S]*?```)/g;

  const normalizeSegment = (segment: string): string =>
    segment
      .replace(
        inlineFontSizePattern,
        (_, prefix: string, quote: string, amount: string, unit: string) =>
          `${prefix}${quote}calc(${amount}${unit} * var(--slide-font-scale))${quote}`,
      )
      .replace(
        svgFontSizePattern,
        (_, prefix: string, quote: string, amount: string, unit?: string) =>
          `${prefix}${quote}calc(${amount}${unit ?? "px"} * var(--slide-font-scale))${quote}`,
      )
      .replace(
        spacingPropertyPattern,
        (_, prefix: string, quote: string, value: string) =>
          `${prefix}${quote}${scaleCssLengthTokens(value, "--slide-space-scale")}${quote}`,
      );

  return rawContent
    .split(fencedCodePattern)
    .map((segment) => (segment.startsWith("```") ? segment : normalizeSegment(segment)))
    .join("");
}

export function SlideContent({
  slide,
  deckName,
}: SlideContentProps): React.JSX.Element {
  const { type, verticalAlign } = slide.frontmatter;
  const shouldCenter =
    verticalAlign === "center" ||
    (verticalAlign !== "top" && !SELF_CENTERED_TYPES.has(type));

  const processedSource = useMemo(
    () => normalizeMdxSizing(resolveAssetPaths(slide.rawContent, deckName)),
    [slide.rawContent, deckName],
  );

  return (
    <div
      data-slide-content=""
      data-vertical-align={shouldCenter ? "center" : undefined}
      className={styles.content}
    >
      <MDXRenderer
        source={processedSource}
        components={slideComponents}
      />
    </div>
  );
}
