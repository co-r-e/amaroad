"use client";

import { useState, useEffect, memo } from "react";
import { SLIDE_WIDTH, SLIDE_HEIGHT, resolveSlideBackground } from "@/lib/slide-utils";
import type { SlideData, DeckConfig } from "@/types/deck";
import { SlideFrame } from "@/components/slide/SlideFrame";
import { useIntersectionVisibility } from "@/hooks/useIntersectionVisibility";
import { SlideNavigationItem } from "./SlideNavigationItem";

interface SlideThumbnailProps {
  slide: SlideData;
  config: DeckConfig;
  deckName: string;
  active: boolean;
  onSelect: (index: number) => void;
}

function SlidePreview({ slide, config, deckName }: Pick<SlideThumbnailProps, "slide" | "config" | "deckName">) {
  const { ref: containerRef, visible } = useIntersectionVisibility("200px");
  const [scale, setScale] = useState(0.12);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / SLIDE_WIDTH);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  const bg = resolveSlideBackground(slide.frontmatter, config);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      style={{ aspectRatio: "16/9" }}
    >
      <div
        className="absolute top-0 left-0 origin-top-left pointer-events-none"
        style={{
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          background: bg,
          transform: `scale(${scale})`,
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
}

export const SlideThumbnail = memo(function SlideThumbnail({ slide, config, deckName, active, onSelect }: SlideThumbnailProps) {
  return (
    <SlideNavigationItem index={slide.index} active={active} onSelect={onSelect}>
      <SlidePreview slide={slide} config={config} deckName={deckName} />
    </SlideNavigationItem>
  );
});
