"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { DeckSummary } from "@/types/deck";
import { DeckGrid } from "@/components/deck-list/DeckGrid";
import { RichDeckGrid } from "@/components/rich/RichDeckGrid";
import type { RichDeckSummary } from "@/types/rich-deck";
import type { DeckPublicationStatuses } from "@/types/deck-publication";
import { HomeSidebar } from "./HomeSidebar";
import { DeckPublicationLegend } from "./DeckPublicationIndicator";
import type { SlideMode } from "./SlideModeTabs";

const PINNED_STORAGE_KEY = "amaroad-pinned-decks";
const PINNED_CHANGE_EVENT = "amaroad:pinned-decks-change";
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function getSnapshot(): string {
  try {
    return localStorage.getItem(PINNED_STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function getServerSnapshot(): string {
  return "[]";
}

function subscribe(onStoreChange: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === PINNED_STORAGE_KEY) onStoreChange();
  };
  const handleChange = () => onStoreChange();
  window.addEventListener("storage", handleStorage);
  window.addEventListener(PINNED_CHANGE_EVENT, handleChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(PINNED_CHANGE_EVENT, handleChange);
  };
}

interface HomeShellProps {
  decks: DeckSummary[];
  richDecks: RichDeckSummary[];
  publicationStatuses: DeckPublicationStatuses;
  initialMode?: SlideMode;
}

export function HomeShell({ decks, richDecks, publicationStatuses, initialMode = "simple" }: HomeShellProps) {
  const [mode, setMode] = useState<SlideMode>(initialMode);
  const [simpleVisited, setSimpleVisited] = useState(initialMode === "simple");
  const pinnedSnapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const sidebarDecks = useMemo(() => {
    let pinnedNames: Set<string>;
    try {
      const parsed = JSON.parse(pinnedSnapshot) as unknown;
      pinnedNames = new Set(
        Array.isArray(parsed)
          ? parsed.filter((v): v is string => typeof v === "string")
          : [],
      );
    } catch {
      pinnedNames = new Set();
    }

    return [...(mode === "simple" ? decks : richDecks)].sort((a, b) => {
      const aSample = a.name === "sample-deck" || a.name === "sample-rich-deck";
      const bSample = b.name === "sample-deck" || b.name === "sample-rich-deck";
      if (aSample !== bSample) return aSample ? 1 : -1;
      const aPinned = pinnedNames.has(a.name);
      const bPinned = pinnedNames.has(b.name);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return collator.compare(a.title, b.title);
    });
  }, [decks, richDecks, mode, pinnedSnapshot]);

  const changeMode = (nextMode: SlideMode) => {
    setMode(nextMode);
    if (nextMode === "simple") setSimpleVisited(true);
    const url = new URL(window.location.href);
    if (nextMode === "rich") url.searchParams.set("mode", "rich");
    else url.searchParams.delete("mode");
    history.replaceState(null, "", url);
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <HomeSidebar decks={sidebarDecks} publicationStatuses={publicationStatuses} mode={mode} onModeChange={changeMode} />
      <main className="flex-1 min-w-0 p-8">
        <section
          id="simple-slides-panel"
          role="tabpanel"
          aria-labelledby="simple-slides-tab"
          hidden={mode !== "simple"}
          tabIndex={0}
        >
          <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                シンプルスライド
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {decks.length} decks
              </p>
            </div>
            <DeckPublicationLegend />
          </header>
          {decks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <p className="text-xl text-gray-500 dark:text-gray-400 mb-4">
                No decks found
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Add MDX files to the{" "}
                <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                  decks/
                </code>{" "}
                directory
              </p>
            </div>
          ) : (
            simpleVisited ? <DeckGrid decks={decks} publicationStatuses={publicationStatuses} /> : null
          )}
        </section>
        <section
          id="rich-slides-panel"
          role="tabpanel"
          aria-labelledby="rich-slides-tab"
          hidden={mode !== "rich"}
          tabIndex={0}
        >
          <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                リッチスライド
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {richDecks.length} decks · 自由なレイアウトとアニメーションで表現するスライド
              </p>
            </div>
            <DeckPublicationLegend />
          </header>
          <RichDeckGrid decks={richDecks} publicationStatuses={publicationStatuses} />
        </section>
      </main>
    </div>
  );
}
