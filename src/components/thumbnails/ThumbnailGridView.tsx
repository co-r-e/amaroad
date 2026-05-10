"use client";

import { useState, useEffect, memo } from "react";
import type { Deck } from "@/types/deck";
import { SLIDE_WIDTH, SLIDE_HEIGHT, resolveSlideBackground } from "@/lib/slide-utils";
import { SlideFrame } from "@/components/slide/SlideFrame";
import { useIntersectionVisibility } from "@/hooks/useIntersectionVisibility";

interface ThumbnailGridViewProps {
  deck: Deck;
}

const GridThumbnail = memo(function GridThumbnail({
  slide,
  config,
  deckName,
}: {
  slide: Deck["slides"][number];
  config: Deck["config"];
  deckName: string;
}) {
  const { ref: containerRef, visible } = useIntersectionVisibility("300px");
  const [scale, setScale] = useState(0.2);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / SLIDE_WIDTH);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const bg = resolveSlideBackground(slide.frontmatter, config);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-lg"
      style={{ aspectRatio: `${SLIDE_WIDTH}/${SLIDE_HEIGHT}`, position: "relative" }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          background: bg,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      >
        {visible && (
          <SlideFrame
            slide={slide}
            config={config}
            deckName={deckName}
            currentPage={slide.index}
          />
        )}
      </div>
    </div>
  );
});

export function ThumbnailGridView({ deck }: ThumbnailGridViewProps) {
  return (
    <div className="min-h-screen w-full bg-gray-100 dark:bg-gray-900 p-8 md:px-10">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
        {deck.config.title}
        <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-3">
          {deck.slides.length} slides
        </span>
      </h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        {deck.slides.map((slide) => (
          <GridThumbnail
            key={slide.index}
            slide={slide}
            config={deck.config}
            deckName={deck.name}
          />
        ))}
      </div>
    </div>
  );
}
