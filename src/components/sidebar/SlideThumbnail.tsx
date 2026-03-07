"use client";

import { useRef, useState, useEffect, memo, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { SLIDE_WIDTH, SLIDE_HEIGHT, resolveSlideBackground } from "@/lib/slide-utils";
import type { SlideData, DeckConfig } from "@/types/deck";
import { SlideFrame } from "@/components/slide/SlideFrame";

interface SlideThumbnailProps {
  slide: SlideData;
  config: DeckConfig;
  deckName: string;
  active: boolean;
  onClick: () => void;
}

export const SlideThumbnail = memo(function SlideThumbnail({
  slide,
  config,
  deckName,
  active,
  onClick,
}: SlideThumbnailProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.12);
  const [visible, setVisible] = useState(false);

  // Defer MDX rendering until thumbnail enters viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / SLIDE_WIDTH);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (active && buttonRef.current) {
      buttonRef.current.scrollIntoView({ block: "nearest", behavior: "auto" });
    }
  }, [active]);

  const bg = resolveSlideBackground(slide.frontmatter, config);

  const onActivate = () => {
    onClick();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate();
    }
  };

  return (
    <div
      ref={buttonRef}
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={onKeyDown}
      aria-label={`Slide ${slide.index + 1}`}
      aria-current={active ? "true" : undefined}
      className={cn(
        "w-full rounded-lg overflow-hidden transition-all text-left focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900",
        "hover:ring-2 hover:ring-gray-300 dark:hover:ring-gray-600",
        active && "ring-2 ring-[#02001A] dark:ring-gray-100",
        "cursor-pointer",
      )}
    >
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
        <div className="absolute bottom-1 right-2 z-10 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
          {slide.index + 1}
        </div>
      </div>
    </div>
  );
});
