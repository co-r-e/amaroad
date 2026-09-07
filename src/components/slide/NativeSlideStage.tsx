"use client";

import { forwardRef } from "react";
import type { Deck, SlideData } from "@/types/deck";
import { SLIDE_WIDTH, SLIDE_HEIGHT, resolveSlideBackground } from "@/lib/slide-utils";
import { SlideFrame } from "@/components/slide/SlideFrame";
import { ExportModeProvider } from "@/contexts/ExportContext";

interface NativeSlideStageProps {
  deck: Pick<Deck, "name" | "config">;
  slide: SlideData;
  /** 0-based page index passed to the overlay. Defaults to `slide.index`. */
  currentPage?: number;
  /**
   * Optional CSS scale applied around the 1920x1080 stage. The outer box
   * shrinks to `SLIDE_WIDTH * scale` so callers can screenshot a smaller
   * raster without changing layout.
   */
  scale?: number;
  /** Stamp `data-mdx-line` on rendered MDX elements (tooling only). */
  sourceLines?: boolean;
  className?: string;
}

/**
 * Deterministic 1:1 slide renderer shared by PDF/PPTX export and the
 * `/[deck]/slide/[index]` tooling route: no viewer chrome, no fit-to-screen
 * transform, animations and transitions disabled via `.export-capture`.
 */
export const NativeSlideStage = forwardRef<HTMLDivElement, NativeSlideStageProps>(
  function NativeSlideStage(
    { deck, slide, currentPage, scale = 1, sourceLines = false, className },
    ref,
  ) {
    const background = resolveSlideBackground(slide.frontmatter, deck.config);
    const stage = (
      <div
        ref={ref}
        data-native-slide-stage=""
        className={`export-capture${className ? ` ${className}` : ""}`}
        style={{
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          background,
          overflow: "hidden",
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: "top left",
        }}
      >
        <SlideFrame
          slide={slide}
          config={deck.config}
          deckName={deck.name}
          currentPage={currentPage ?? slide.index}
          sourceLines={sourceLines}
        />
      </div>
    );

    return (
      <ExportModeProvider isExporting>
        {scale !== 1 ? (
          <div
            style={{
              width: Math.round(SLIDE_WIDTH * scale),
              height: Math.round(SLIDE_HEIGHT * scale),
              overflow: "hidden",
            }}
          >
            {stage}
          </div>
        ) : (
          stage
        )}
      </ExportModeProvider>
    );
  },
);
