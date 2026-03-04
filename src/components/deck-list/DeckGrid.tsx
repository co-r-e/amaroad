"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useMemo } from "react";
import { Globe, Search } from "lucide-react";
import type { DeckSummary, Deck } from "@/types/deck";
import type { TunnelState } from "@/lib/tunnel-manager";
import { useIsLocal } from "@/hooks/useIsLocal";
import { SLIDE_WIDTH, SLIDE_HEIGHT, resolveSlideBackground } from "@/lib/slide-utils";
import { SlideFrame } from "@/components/slide/SlideFrame";

interface DeckGridProps {
  decks: DeckSummary[];
}

type SortOption =
  | "title-asc"
  | "title-desc"
  | "slides-asc"
  | "slides-desc"
  | "name-asc";

export function DeckGrid({ decks }: DeckGridProps) {
  const isLocal = useIsLocal();
  const [sharingDeck, setSharingDeck] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>("title-asc");
  const [query, setQuery] = useState("");

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

  const filteredAndSortedDecks = useMemo(() => {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    const q = query.toLowerCase();
    const filtered = q
      ? decks.filter(
          (d) =>
            d.title.toLowerCase().includes(q) ||
            d.name.toLowerCase().includes(q),
        )
      : decks;

    const next = [...filtered];

    switch (sortOption) {
      case "title-asc":
        next.sort((a, b) => collator.compare(a.title, b.title));
        break;
      case "title-desc":
        next.sort((a, b) => collator.compare(b.title, a.title));
        break;
      case "slides-asc":
        next.sort((a, b) => a.slideCount - b.slideCount || collator.compare(a.title, b.title));
        break;
      case "slides-desc":
        next.sort((a, b) => b.slideCount - a.slideCount || collator.compare(a.title, b.title));
        break;
      case "name-asc":
        next.sort((a, b) => collator.compare(a.name, b.name));
        break;
    }

    return next;
  }, [decks, sortOption, query]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search decks..."
            aria-label="Search decks"
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 shrink-0">
          Sort
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-700 dark:text-gray-200"
            aria-label="Sort decks"
          >
            <option value="title-asc">Title (A-Z)</option>
            <option value="title-desc">Title (Z-A)</option>
            <option value="slides-asc">Slides (Low-High)</option>
            <option value="slides-desc">Slides (High-Low)</option>
            <option value="name-asc">Folder Name (A-Z)</option>
          </select>
        </label>
      </div>

      {filteredAndSortedDecks.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedDecks.map((deck) => (
            <DeckCard key={deck.name} deck={deck} isSharing={deck.name === sharingDeck} />
          ))}
        </div>
      ) : (
        <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
          No decks found for &ldquo;{query}&rdquo;
        </p>
      )}
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
    <div className="group relative rounded-xl bg-white dark:bg-gray-900 border-2 border-transparent transition-colors hover:border-[#02001A] dark:hover:border-gray-400">
      <Link href={`/${deck.name}`} className="block p-6">
        <div
          ref={containerRef}
          className="mb-4 relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800"
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
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 dark:border-gray-600 border-t-gray-500 dark:border-t-gray-400" />
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
          /{deck.name}
        </p>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-[#02001A] dark:group-hover:text-white">
          {deck.title}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {deck.slideCount} slides
        </p>
      </Link>

      {isSharing && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/50 px-2.5 py-1 border border-emerald-200 dark:border-emerald-700">
          <Globe size={12} className="text-emerald-600" />
          <span className="text-[11px] font-medium text-emerald-600">Sharing</span>
        </div>
      )}
    </div>
  );
}
