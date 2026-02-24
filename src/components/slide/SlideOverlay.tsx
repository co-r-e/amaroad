"use client";

import type { DeckConfig, LogoPosition, FooterPosition, SlideType } from "@/types/deck";
import { cn } from "@/lib/utils";

interface SlideOverlayProps {
  config: DeckConfig;
  currentPage: number;
  slideType: SlideType;
  deckName: string;
}

const positionClasses: Record<LogoPosition | FooterPosition, string> =
  {
    "top-left": "top-[24px] left-[40px]",
    "top-center": "top-[24px] left-1/2 -translate-x-1/2",
    "top-right": "top-[24px] right-[40px]",
    "bottom-left": "bottom-[24px] left-[40px]",
    "bottom-center": "bottom-[24px] left-1/2 -translate-x-1/2",
    "bottom-right": "bottom-[24px] right-[40px]",
  };

export function SlideOverlay({
  config,
  currentPage,
  slideType,
  deckName,
}: SlideOverlayProps): React.JSX.Element {
  const { logo, copyright, pageNumber } = config;
  const isCover = slideType === "cover";
  const showPageNumber =
    pageNumber && !(isCover && (pageNumber.hideOnCover ?? true));

  return (
    <>
      {logo && (
        <div
          className={cn("absolute z-10", positionClasses[logo.position])}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveAssetPath(logo.src, deckName)}
            alt="Logo"
            className="h-12 w-auto"
          />
        </div>
      )}

      {copyright && (
        <div
          className={cn(
            "absolute z-10 text-xl text-gray-400",
            positionClasses[copyright.position],
          )}
        >
          {copyright.text}
        </div>
      )}

      {showPageNumber && (
        <div
          className={cn(
            "absolute z-10 text-xl text-gray-400",
            positionClasses[pageNumber.position],
          )}
        >
          {currentPage + (pageNumber.startFrom ?? 1)}
        </div>
      )}
    </>
  );
}

function resolveAssetPath(src: string, deckName: string): string {
  if (src.startsWith("http") || src.startsWith("/")) return src;
  const encoded = encodeURIComponent(deckName);
  if (src.startsWith("./assets/")) {
    return `/api/decks/${encoded}/${src.slice(2)}`;
  }
  return `/api/decks/${encoded}/assets/${src}`;
}
