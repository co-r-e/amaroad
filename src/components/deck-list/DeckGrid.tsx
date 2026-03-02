"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";
import type { DeckSummary, Deck } from "@/types/deck";
import type { TunnelState } from "@/lib/tunnel-manager";
import { useIsLocal } from "@/hooks/useIsLocal";
import { SLIDE_WIDTH, SLIDE_HEIGHT, resolveSlideBackground } from "@/lib/slide-utils";
import { SlideFrame } from "@/components/slide/SlideFrame";

interface DeckGridProps {
  decks: DeckSummary[];
}

export function DeckGrid({ decks }: DeckGridProps) {
  const isLocal = useIsLocal();
  const [sharingDeck, setSharingDeck] = useState<string | null>(null);

  useEffect(() => {
    if (!isLocal) return;
    fetch("/api/tunnel")
      .then((res) => res.json())
      .then((data: TunnelState) => {
        if (data.status === "active" && data.deckName) {
          setSharingDeck(data.deckName);
        }
      })
      .catch((err) => console.warn("[dexcode] Failed to fetch tunnel state:", err));
  }, [isLocal]);

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {decks.map((deck) => (
        <DeckCard key={deck.name} deck={deck} isSharing={deck.name === sharingDeck} />
      ))}
    </div>
  );
}

function DeckCard({ deck, isSharing }: { deck: DeckSummary; isSharing: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [deckData, setDeckData] = useState<Deck | null>(null);

  // Fetch deck data for cover slide rendering
  useEffect(() => {
    fetch(`/api/decks/${encodeURIComponent(deck.name)}/data`)
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then((data: Deck) => setDeckData(data))
      .catch((err) => console.warn("[dexcode] Failed to fetch deck data:", err));
  }, [deck.name]);

  // Calculate scale based on container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / SLIDE_WIDTH);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const coverSlide = deckData?.slides[0];
  const bg = coverSlide && deckData
    ? resolveSlideBackground(coverSlide.frontmatter, deckData.config)
    : "#f3f4f6";

  return (
    <div className="group relative rounded-xl bg-white border-2 border-transparent transition-colors hover:border-[#02001A]">
      <Link href={`/${deck.name}`} className="block p-6">
        <div
          ref={containerRef}
          className="mb-4 relative overflow-hidden rounded-lg bg-gray-100"
          style={{ aspectRatio: "16/9" }}
        >
          {coverSlide && deckData && scale != null ? (
            <div
              className="absolute top-0 left-0 origin-top-left pointer-events-none"
              style={{
                width: SLIDE_WIDTH,
                height: SLIDE_HEIGHT,
                background: bg,
                transform: `scale(${scale})`,
              }}
            >
              <SlideFrame
                slide={coverSlide}
                config={deckData.config}
                deckName={deck.name}
                currentPage={0}
              />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-500" />
            </div>
          )}
        </div>
        <h2 className="text-lg font-semibold text-gray-900 group-hover:text-[#02001A]">
          {deck.title}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {deck.slideCount} slides
        </p>
      </Link>

      {isSharing && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 border border-emerald-200">
          <Globe size={12} className="text-emerald-600" />
          <span className="text-[11px] font-medium text-emerald-600">Sharing</span>
        </div>
      )}
    </div>
  );
}
