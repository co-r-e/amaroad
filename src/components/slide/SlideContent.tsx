"use client";

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

export function SlideContent({
  slide,
  deckName,
}: SlideContentProps): React.JSX.Element {
  const { type, verticalAlign } = slide.frontmatter;
  const shouldCenter =
    verticalAlign === "center" ||
    (verticalAlign !== "top" && !SELF_CENTERED_TYPES.has(type));

  return (
    <div
      data-slide-content=""
      data-vertical-align={shouldCenter ? "center" : undefined}
      className={styles.content}
    >
      <MDXRenderer
        source={resolveAssetPaths(slide.rawContent, deckName)}
        components={slideComponents}
      />
    </div>
  );
}
