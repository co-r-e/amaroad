"use client";

import { useEffect } from "react";
import type { Deck } from "@/types/deck";
import { resolveSlideBackground, buildScaledSlideStyle } from "@/lib/slide-utils";
import { SlideFrame } from "@/components/slide/SlideFrame";
import { useDeckNavigation } from "@/hooks/useDeckNavigation";
import { useSlideScale } from "@/hooks/useSlideScale";

interface PresenterViewProps {
  deck: Deck;
}

function enterFullscreen(): void {
  document.documentElement.requestFullscreen().catch(() => {});
}

function exitFullscreen(): void {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  }
}

function toggleFullscreen(): void {
  if (document.fullscreenElement) {
    exitFullscreen();
  } else {
    enterFullscreen();
  }
}

const PRESENTER_KEYBOARD = {
  onEscape: exitFullscreen,
  onFullscreen: toggleFullscreen,
} as const;

export function PresenterView({ deck }: PresenterViewProps): React.JSX.Element | null {
  const { containerRef, scale } = useSlideScale();

  const { currentSlide } = useDeckNavigation({
    deckName: deck.name,
    totalSlides: deck.slides.length,
    role: "presenter",
    keyboard: PRESENTER_KEYBOARD,
  });

  useEffect(() => {
    enterFullscreen();
  }, []);

  const slide = deck.slides[currentSlide];
  if (!slide) return null;

  const bg = resolveSlideBackground(slide.frontmatter, deck.config);

  return (
    <div
      ref={containerRef}
      className="h-screen w-screen bg-black overflow-hidden cursor-none"
    >
      <div className="flex h-screen w-screen items-center justify-center">
        <div style={buildScaledSlideStyle(scale, bg)}>
          <SlideFrame
            slide={slide}
            config={deck.config}
            deckName={deck.name}
            currentPage={currentSlide}
          />
        </div>
      </div>
    </div>
  );
}
