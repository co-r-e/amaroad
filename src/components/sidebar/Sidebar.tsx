"use client";

import type { Deck } from "@/types/deck";
import { SlideThumbnail } from "./SlideThumbnail";
import { DeckSidebar } from "./DeckSidebar";
import { ExportButton } from "@/components/deck-list/ExportButton";

interface SidebarProps {
  deck: Deck;
  currentSlide: number;
  onSlideSelect: (index: number) => void;
  onPresenterMode: () => void;
}

export function Sidebar({ deck, currentSlide, onSlideSelect, onPresenterMode }: SidebarProps) {
  return (
    <DeckSidebar deckName={deck.name} title={deck.config.title} onPresenterMode={onPresenterMode}
      onOverview={() => window.open(`/${encodeURIComponent(deck.name)}/thumbnails`, "_blank")}
      exportAction={<ExportButton deckName={deck.name} />} pageStatus={`${currentSlide + 1} / ${deck.slides.length}`}>
      {deck.slides.map((slide) => <SlideThumbnail key={slide.index} slide={slide} config={deck.config}
        deckName={deck.name} active={slide.index === currentSlide} onSelect={onSlideSelect} />)}
    </DeckSidebar>
  );
}
