"use client";

import { useCallback } from "react";
import { PanelRight } from "lucide-react";
import type { Deck } from "@/types/deck";
import { resolveSlideBackground, buildScaledSlideStyle } from "@/lib/slide-utils";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { SlideFrame } from "@/components/slide/SlideFrame";
import { NotesPanel } from "@/components/viewer/NotesPanel";
import { useDeckNavigation } from "@/hooks/useDeckNavigation";
import { useSlideScale } from "@/hooks/useSlideScale";
import { useResizablePanel } from "@/hooks/useResizablePanel";

interface SlideViewerProps {
  deck: Deck;
}

export function SlideViewer({ deck }: SlideViewerProps): React.JSX.Element | null {
  const { containerRef, scale } = useSlideScale({ padding: 64 });
  const { width, isOpen, toggle, resizeHandleProps } = useResizablePanel();

  const { currentSlide, handleNavigate } = useDeckNavigation({
    deckName: deck.name,
    totalSlides: deck.slides.length,
    role: "viewer",
  });

  const handlePresenterMode = useCallback(() => {
    window.open(`/${deck.name}/presenter`, "nipry-presenter");
  }, [deck.name]);

  const slide = deck.slides[currentSlide];
  if (!slide) return null;

  const bg = resolveSlideBackground(slide.frontmatter, deck.config);

  return (
    <div className="flex h-screen">
      <Sidebar
        deck={deck}
        currentSlide={currentSlide}
        onSlideSelect={handleNavigate}
        onPresenterMode={handlePresenterMode}
      />

      <main
        ref={containerRef}
        className="relative flex flex-1 items-center justify-center bg-[#F0F2F5] overflow-hidden"
      >
        <div
          className="shadow-xl"
          style={buildScaledSlideStyle(scale, bg)}
        >
          <SlideFrame
            slide={slide}
            config={deck.config}
            deckName={deck.name}
            currentPage={currentSlide}
          />
        </div>

        {!isOpen && (
          <button
            onClick={toggle}
            className="absolute right-3 top-3 rounded bg-white/80 p-1.5 text-gray-400 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-gray-600"
            aria-label="Open notes panel"
          >
            <PanelRight size={18} />
          </button>
        )}
      </main>

      <NotesPanel
        notes={slide.notes}
        isOpen={isOpen}
        width={width}
        onToggle={toggle}
        resizeHandleProps={resizeHandleProps}
      />
    </div>
  );
}
