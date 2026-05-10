"use client";

import type { DeckConfig, LogoPosition, SlideType } from "@/types/deck";
import { cn } from "@/lib/utils";
import styles from "./SlideOverlay.module.css";

interface SlideOverlayProps {
  config: DeckConfig;
  currentPage: number;
  slideType: SlideType;
  deckName: string;
  darkBackground?: boolean;
}

const positionClasses: Record<LogoPosition, string> = {
  "top-left": styles.topLeft,
  "top-center": styles.topCenter,
  "top-right": styles.topRight,
  "bottom-left": styles.bottomLeft,
  "bottom-center": styles.bottomCenter,
  "bottom-right": styles.bottomRight,
};

function resolveAssetPath(src: string, deckName: string): string {
  if (src.startsWith("http") || src.startsWith("/")) return src;
  const encoded = encodeURIComponent(deckName);
  if (src.startsWith("./assets/")) {
    return `/api/decks/${encoded}/${src.slice(2)}`;
  }
  return `/api/decks/${encoded}/assets/${src}`;
}

export function SlideOverlay({
  config,
  currentPage,
  slideType,
  deckName,
  darkBackground,
}: SlideOverlayProps): React.JSX.Element {
  const { overlay, logo, copyright, pageNumber } = config;
  const isCover = slideType === "cover" || slideType === "ending";
  const showPageNumber =
    pageNumber && !(isCover && (pageNumber.hideOnCover ?? true));
  const overlayTextStyle =
    darkBackground && overlay?.textColorDark
      ? { color: overlay.textColorDark }
      : !darkBackground && overlay?.textColor
        ? { color: overlay.textColor }
        : undefined;

  return (
    <>
      {logo && (
        <div className={cn(styles.overlay, positionClasses[logo.position])}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveAssetPath(logo.src, deckName)}
            alt="Logo"
            className={styles.logoImage}
            style={darkBackground ? { filter: "brightness(0) invert(1)" } : undefined}
          />
        </div>
      )}

      {copyright && (
        <div
          className={cn(
            styles.overlay,
            styles.text,
            positionClasses[copyright.position]
          )}
          style={overlayTextStyle}
        >
          {copyright.text}
        </div>
      )}

      {showPageNumber && (
        <div
          className={cn(
            styles.overlay,
            styles.text,
            positionClasses[pageNumber.position]
          )}
          style={overlayTextStyle}
        >
          {currentPage + (pageNumber.startFrom ?? 1)}
        </div>
      )}
    </>
  );
}
