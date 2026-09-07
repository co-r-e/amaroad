"use client";

import { useMemo } from "react";
import { MDXRenderer } from "@/lib/mdx-runtime";
import { hashSlideSource, processSlideSource } from "@/lib/mdx-slide-source";
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
  /** Request `data-mdx-line` stamps from the MDX compiler (tooling only). */
  sourceLines?: boolean;
}

export function SlideContent({
  slide,
  deckName,
  sourceLines = false,
}: SlideContentProps): React.JSX.Element {
  const { type, verticalAlign } = slide.frontmatter;
  const shouldCenter =
    verticalAlign === "center" ||
    (verticalAlign !== "top" && !SELF_CENTERED_TYPES.has(type));

  const processedSource = useMemo(
    () => processSlideSource(slide.rawContent, deckName),
    [slide.rawContent, deckName],
  );
  const sourceHash = useMemo(
    () => hashSlideSource(processedSource),
    [processedSource],
  );
  const moduleUrl = useMemo(
    () =>
      `/api/mdx/${encodeURIComponent(deckName)}/${slide.index}?v=${encodeURIComponent(sourceHash)}${
        sourceLines ? "&lines=1" : ""
      }`,
    [deckName, slide.index, sourceHash, sourceLines],
  );

  return (
    <div
      data-slide-content=""
      data-vertical-align={shouldCenter ? "center" : undefined}
      className={styles.content}
    >
      <MDXRenderer
        moduleUrl={moduleUrl}
        components={slideComponents}
      />
    </div>
  );
}
