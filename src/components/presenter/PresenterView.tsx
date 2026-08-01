"use client";

import { useCallback, useEffect, useState } from "react";
import type { Deck } from "@/types/deck";
import { resolveSlideBackground, buildScaledSlideStyle } from "@/lib/slide-utils";
import { SlideFrame } from "@/components/slide/SlideFrame";
import { PresenterPointer } from "@/components/presenter/PresenterPointer";
import { PresenterTextPopup } from "@/components/presenter/PresenterTextPopup";
import { useDeckNavigation } from "@/hooks/useDeckNavigation";
import { usePresenterZoom } from "@/hooks/usePresenterZoom";
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

export function PresenterView({ deck }: PresenterViewProps): React.JSX.Element | null {
  const { containerRef, scale } = useSlideScale();
  const { zoomRef, toggleZoom, resetZoom } = usePresenterZoom();
  const [spotlightText, setSpotlightText] = useState<string | null>(null);

  // Escape unwinds one layer at a time: text popup, then zoom, then fullscreen.
  const handleEscape = useCallback(() => {
    if (spotlightText !== null) {
      setSpotlightText(null);
      return;
    }
    if (!resetZoom()) exitFullscreen();
  }, [spotlightText, resetZoom]);

  const handleShowSelection = useCallback(() => {
    if (spotlightText !== null) {
      setSpotlightText(null);
      return;
    }
    const text = window.getSelection()?.toString().trim();
    if (text) setSpotlightText(text);
  }, [spotlightText]);

  const { currentSlide } = useDeckNavigation({
    deckName: deck.name,
    totalSlides: deck.slides.length,
    role: "presenter",
    keyboard: {
      onEscape: handleEscape,
      onFullscreen: toggleFullscreen,
      onZoom: toggleZoom,
      onShowSelection: handleShowSelection,
    },
  });

  useEffect(() => {
    enterFullscreen();
  }, []);

  // Zoom and text spotlight are per-slide; navigating away discards them.
  // (Render-phase adjustment per react.dev "Adjusting state when a prop changes".)
  const [spotlightSlide, setSpotlightSlide] = useState(currentSlide);
  if (spotlightSlide !== currentSlide) {
    setSpotlightSlide(currentSlide);
    setSpotlightText(null);
  }

  useEffect(() => {
    resetZoom();
  }, [currentSlide, resetZoom]);

  const slide = deck.slides[currentSlide];
  if (!slide) return null;

  const bg = resolveSlideBackground(slide.frontmatter, deck.config);
  // Deliberately the deck's own colors, not --slide-accent: the theme default
  // merge would resolve a missing accent to #000000 (hueless glow) instead of
  // the deck's primary.
  const pointerColor =
    deck.config.theme.colors.accent ?? deck.config.theme.colors.primary;

  return (
    <div
      ref={containerRef}
      className="h-screen w-screen bg-black overflow-hidden"
    >
      <div
        ref={zoomRef}
        className="h-screen w-screen origin-top-left transition-transform duration-200 ease-out"
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
      {spotlightText !== null && <PresenterTextPopup text={spotlightText} />}
      <PresenterPointer color={pointerColor} />
    </div>
  );
}
