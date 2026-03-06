"use client";

import Link from "next/link";
import { ArrowLeft, Monitor } from "lucide-react";
import type { Deck } from "@/types/deck";
import { SlideThumbnail } from "./SlideThumbnail";
import { ShareButton } from "@/components/viewer/ShareButton";
import { ExportButton } from "@/components/deck-list/ExportButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useIsLocal } from "@/hooks/useIsLocal";

interface SidebarProps {
  deck: Deck;
  currentSlide: number;
  onSlideSelect: (index: number) => void;
  onPresenterMode: () => void;
}

export function Sidebar({
  deck,
  currentSlide,
  onSlideSelect,
  onPresenterMode,
}: SidebarProps) {
  const isLocal = useIsLocal();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="flex flex-col gap-3 border-b border-gray-200 dark:border-gray-700 p-4">
        <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
          {deck.config.title}
        </h1>
        <div className="flex gap-2">
          {isLocal && (
            <Link
              href="/"
              aria-label="Back to deck list"
              className="flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeft size={14} className="text-gray-600 dark:text-gray-400" />
            </Link>
          )}
          <button
            onClick={onPresenterMode}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#02001A] dark:bg-gray-100 px-3 py-2 text-xs font-medium text-white dark:text-gray-900 transition-opacity hover:opacity-80"
          >
            <Monitor size={14} />
            Presenter Mode
          </button>
        </div>
        <div className="flex gap-2">
          {isLocal && (
            <div className="flex-1 min-w-0">
              <ShareButton deckName={deck.name} />
            </div>
          )}
          <ExportButton deckName={deck.name} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-2">
          {deck.slides.map((slide) => (
            <SlideThumbnail
              key={slide.index}
              slide={slide}
              config={deck.config}
              deckName={deck.name}
              active={slide.index === currentSlide}
              onClick={() => onSlideSelect(slide.index)}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 p-3">
        <ThemeToggle />
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {currentSlide + 1} / {deck.slides.length}
        </span>
      </div>
    </aside>
  );
}
