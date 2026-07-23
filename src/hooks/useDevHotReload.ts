import { useEffect, useRef } from "react";
import type { Deck } from "@/types/deck";

interface UseDevHotReloadOptions {
  deckName: string;
  onUpdate: (deck: Deck) => void;
}

const REFRESH_DEBOUNCE_MS = 250;

export function useDevHotReload({ deckName, onUpdate }: UseDevHotReloadOptions) {
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  });

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const es = new EventSource(`/api/decks/${deckName}/watch`);
    let disposed = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let refreshInFlight = false;
    let refreshPending = false;

    function scheduleRefresh(): void {
      if (disposed) return;
      refreshPending = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        void refreshDeck();
      }, REFRESH_DEBOUNCE_MS);
    }

    async function refreshDeck(): Promise<void> {
      if (disposed || refreshInFlight || !refreshPending) return;
      refreshPending = false;
      refreshInFlight = true;
      let nextDeck: Deck | null = null;

      try {
        const res = await fetch(`/api/decks/${deckName}/data`);
        if (!res.ok) return;

        nextDeck = await res.json();
      } catch {
        // Ignore parse/fetch errors
      } finally {
        refreshInFlight = false;
        if (!disposed && refreshPending) scheduleRefresh();
      }

      if (!disposed && nextDeck) onUpdateRef.current(nextDeck);
    }

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "change") scheduleRefresh();
      } catch {
        // Ignore parse errors
      }
    };

    return () => {
      disposed = true;
      es.close();
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [deckName]);
}
