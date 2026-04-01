"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useMemo, memo, useCallback, useSyncExternalStore } from "react";
import { Globe, Pin, Search } from "lucide-react";
import type { DeckSummary, Deck } from "@/types/deck";
import type { TunnelState } from "@/lib/tunnel-manager";
import { useIsLocal } from "@/hooks/useIsLocal";
import { SLIDE_WIDTH, SLIDE_HEIGHT, resolveSlideBackground } from "@/lib/slide-utils";
import { SlideFrame } from "@/components/slide/SlideFrame";

const PINNED_STORAGE_KEY = "dexcode-pinned-decks";
const PINNED_CHANGE_EVENT = "dexcode:pinned-decks-change";
const TUNNEL_ENABLED = process.env.NODE_ENV !== "production";

function parsePinnedDecks(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === "string"));
  } catch { /* ignore */ }
  return new Set();
}

function getPinnedDecksSnapshot(): string {
  try {
    return localStorage.getItem(PINNED_STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function getPinnedDecksServerSnapshot(): string {
  return "[]";
}

function subscribeToPinnedDecks(onStoreChange: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === PINNED_STORAGE_KEY) {
      onStoreChange();
    }
  };

  const handlePinnedChange = () => {
    onStoreChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(PINNED_CHANGE_EVENT, handlePinnedChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(PINNED_CHANGE_EVENT, handlePinnedChange);
  };
}

function savePinnedDecks(pinned: Set<string>) {
  try {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify([...pinned]));
    window.dispatchEvent(new Event(PINNED_CHANGE_EVENT));
  } catch { /* ignore */ }
}

interface DeckGridProps {
  decks: DeckSummary[];
}

type SortOption =
  | "title-asc"
  | "title-desc"
  | "slides-asc"
  | "slides-desc"
  | "name-asc";

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function DeckGrid({ decks }: DeckGridProps) {
  const isLocal = useIsLocal();
  const [sharingDeck, setSharingDeck] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>("title-asc");
  const [query, setQuery] = useState("");
  const pinnedSnapshot = useSyncExternalStore(
    subscribeToPinnedDecks,
    getPinnedDecksSnapshot,
    getPinnedDecksServerSnapshot,
  );
  const pinnedDecks = useMemo(
    () => parsePinnedDecks(pinnedSnapshot),
    [pinnedSnapshot],
  );

  const togglePin = useCallback((deckName: string) => {
    const next = new Set(pinnedDecks);
    if (next.has(deckName)) {
      next.delete(deckName);
    } else {
      next.add(deckName);
    }
    savePinnedDecks(next);
  }, [pinnedDecks]);

  useEffect(() => {
    if (!TUNNEL_ENABLED || !isLocal) return;
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
    const q = query.toLowerCase();
    const filtered = q
      ? decks.filter(
          (d) =>
            d.title.toLowerCase().includes(q) ||
            d.name.toLowerCase().includes(q),
        )
      : decks;

    const next = [...filtered];

    // Priority: pinned decks first, sample-deck last, then normal sort
    const compare = (a: DeckSummary, b: DeckSummary, cmp: () => number) => {
      // sample-deck always last
      if (a.name === "sample-deck") return 1;
      if (b.name === "sample-deck") return -1;
      // Pinned decks first
      const aPinned = pinnedDecks.has(a.name);
      const bPinned = pinnedDecks.has(b.name);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return cmp();
    };

    switch (sortOption) {
      case "title-asc":
        next.sort((a, b) => compare(a, b, () => collator.compare(a.title, b.title)));
        break;
      case "title-desc":
        next.sort((a, b) => compare(a, b, () => collator.compare(b.title, a.title)));
        break;
      case "slides-asc":
        next.sort((a, b) => compare(a, b, () => a.slideCount - b.slideCount || collator.compare(a.title, b.title)));
        break;
      case "slides-desc":
        next.sort((a, b) => compare(a, b, () => b.slideCount - a.slideCount || collator.compare(a.title, b.title)));
        break;
      case "name-asc":
        next.sort((a, b) => compare(a, b, () => collator.compare(a.name, b.name)));
        break;
    }

    return next;
  }, [decks, sortOption, query, pinnedDecks]);

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
            <DeckCard
              key={deck.name}
              deck={deck}
              isSharing={deck.name === sharingDeck}
              isPinned={pinnedDecks.has(deck.name)}
              onTogglePin={togglePin}
            />
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

const DeckCard = memo(function DeckCard({
  deck,
  isSharing,
  isPinned,
  onTogglePin,
}: {
  deck: DeckSummary;
  isSharing: boolean;
  isPinned: boolean;
  onTogglePin: (name: string) => void;
}) {
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

      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTogglePin(deck.name);
          }}
          aria-label={isPinned ? "Unpin deck" : "Pin deck"}
          className={`rounded-full p-1.5 transition-all ${
            isPinned
              ? "bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 opacity-100"
              : "bg-gray-200/80 dark:bg-gray-700/80 text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100"
          }`}
        >
          <Pin size={14} className={isPinned ? "rotate-[-45deg]" : ""} />
        </button>

        {isSharing && (
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/50 px-2.5 py-1 border border-emerald-200 dark:border-emerald-700">
            <Globe size={12} className="text-emerald-600" />
            <span className="text-[11px] font-medium text-emerald-600">Sharing</span>
          </div>
        )}
      </div>
    </div>
  );
});
