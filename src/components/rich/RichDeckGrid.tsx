"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { RichDeckSummary } from "@/types/rich-deck";
import { RichDeckPreview } from "./RichDeckPreview";
import { DeckPublicationIndicator } from "@/components/home/DeckPublicationIndicator";
import type { DeckPublicationStatuses } from "@/types/deck-publication";

export function RichDeckGrid({ decks, publicationStatuses }: { decks: RichDeckSummary[]; publicationStatuses: DeckPublicationStatuses }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const search = query.toLowerCase();
    return decks.filter((deck) => deck.title.toLowerCase().includes(search) || deck.name.toLowerCase().includes(search));
  }, [decks, query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          aria-label="リッチスライドを検索"
          placeholder="リッチスライドを検索..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        />
      </div>
      {filtered.length ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((deck) => (
            <Link
              key={deck.name}
              href={`/${encodeURIComponent(deck.name)}`}
              className="group rounded-xl border-2 border-transparent bg-white p-6 transition-colors hover:border-[#02001A] focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-gray-900 dark:hover:border-gray-400"
            >
              <div className="mb-5 overflow-hidden rounded-lg">
                <RichDeckPreview deckName={deck.name} title={`${deck.title} の表紙`} />
              </div>
              <div className="mb-1 flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-xs text-gray-400 dark:text-gray-500">/{deck.name}</p>
                <DeckPublicationIndicator status={publicationStatuses[deck.name]} />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{deck.title}</h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">HTMLプレゼンテーション</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
          {query ? "一致するリッチスライドがありません。" : "リッチスライドはまだありません。"}
        </p>
      )}
    </div>
  );
}
