"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { DeckSummary } from "@/types/deck";
import { DeckGrid } from "@/components/deck-list/DeckGrid";
import { HomeSidebar } from "./HomeSidebar";

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
}

export function HomeShell({ decks }: HomeShellProps) {
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

    return [...decks].sort((a, b) => {
      if (a.name === "sample-deck") return 1;
      if (b.name === "sample-deck") return -1;
      const aPinned = pinnedNames.has(a.name);
      const bPinned = pinnedNames.has(b.name);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return collator.compare(a.title, b.title);
    });
  }, [decks, pinnedSnapshot]);

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <HomeSidebar decks={sidebarDecks} />
      <main className="flex-1 min-w-0 p-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Decks
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {decks.length} decks
          </p>
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
          <DeckGrid decks={decks} />
        )}
      </main>
    </div>
  );
}
