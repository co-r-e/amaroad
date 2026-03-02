import { useEffect, useRef } from "react";
import type { Deck } from "@/types/deck";

interface UseDevHotReloadOptions {
  deckName: string;
  onUpdate: (deck: Deck) => void;
}

export function useDevHotReload({ deckName, onUpdate }: UseDevHotReloadOptions) {
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  });

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const es = new EventSource(`/api/decks/${deckName}/watch`);

    es.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== "change") return;

        const res = await fetch(`/api/decks/${deckName}/data`);
        if (!res.ok) return;

        const deck: Deck = await res.json();
        onUpdateRef.current(deck);
      } catch {
        // Ignore parse/fetch errors
      }
    };

    return () => es.close();
  }, [deckName]);
}
