"use client";

import type { SlideData, DeckConfig } from "@/types/deck";
import { SlideOverlay } from "@/components/slide/SlideOverlay";
import { SlideContent } from "@/components/slide/SlideContent";

interface SlideFrameProps {
  slide: SlideData;
  config: DeckConfig;
  deckName: string;
  currentPage: number;
}

/**
 * Shared layout for a single slide: overlay layer (logo, copyright, page number)
 * on top of content rendered inside the safe zone (80px top, 72px sides, 64px bottom).
 */
export function SlideFrame({
  slide,
  config,
  deckName,
  currentPage,
}: SlideFrameProps): React.JSX.Element {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0 z-10 pointer-events-none">
        <SlideOverlay
          config={config}
          currentPage={currentPage}
          slideType={slide.frontmatter.type}
          deckName={deckName}
        />
      </div>
      <div
        className="flex h-full w-full flex-col"
        style={{ padding: "80px 72px 64px" }}
      >
        <SlideContent slide={slide} config={config} deckName={deckName} />
      </div>
    </div>
  );
}
