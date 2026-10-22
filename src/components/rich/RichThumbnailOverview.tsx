"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRichDeckFrame } from "@/hooks/useRichDeckFrame";
import type { RichDeck } from "@/types/rich-deck";
import { RichDeckFrame } from "./RichDeckFrame";
import { RichSlideThumbnail } from "./RichSlideThumbnail";

export function RichThumbnailOverview({ deck }: { deck: RichDeck }) {
  const connection = useRichDeckFrame({ deckName: deck.name, preview: true });
  const router = useRouter();
  const navigate = useCallback((index: number) => {
    router.push(`/${encodeURIComponent(deck.name)}?slide=${index + 1}`);
  }, [deck.name, router]);
  return (
    <div className="min-h-screen w-full bg-gray-100 p-8 dark:bg-gray-900 md:px-10">
      <div aria-hidden="true" className="pointer-events-none fixed -left-[10000px] top-0 h-[1080px] w-[1920px]">
        <RichDeckFrame {...connection} title={deck.config.title} preview />
      </div>
      <h1 className="mb-6 text-lg font-semibold text-gray-900 dark:text-gray-100">{deck.config.title}
        <span className="ml-3 text-sm font-normal text-gray-500 dark:text-gray-400">{connection.slides.length} slides</span>
      </h1>
      {connection.error && <p role="alert" className="text-sm text-red-600">{connection.error}</p>}
      {!connection.ready && <p role="status" className="text-sm text-gray-500">スライドを読み込んでいます...</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {connection.slides.map((slide, index) => <RichSlideThumbnail key={index} deckName={deck.name} index={index} title={slide.title}
          active={false} onSelect={navigate} disabled={!connection.capabilities.goTo} />)}
      </div>
    </div>
  );
}
