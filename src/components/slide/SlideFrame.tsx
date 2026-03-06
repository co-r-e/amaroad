"use client";

import type { SlideData, SlideType, DeckConfig } from "@/types/deck";
import { SlideOverlay } from "@/components/slide/SlideOverlay";
import { SlideContent } from "@/components/slide/SlideContent";
import { cn } from "@/lib/utils";
import { createThemeVariables } from "@/lib/theme";
import styles from "./SlideFrame.module.css";

interface SlideFrameProps {
  slide: SlideData;
  config: DeckConfig;
  deckName: string;
  currentPage: number;
}

interface TypeLayout {
  padding: string;
  className: string;
}

function getTypeLayout(type: SlideType): TypeLayout {
  switch (type) {
    case "cover":
    case "ending":
      return { padding: "96px 96px 80px", className: styles.layoutCover };
    case "section":
      return { padding: "96px 96px 80px calc(18% + 72px)", className: styles.layoutSection };
    case "quote":
      return { padding: "120px 140px 100px", className: styles.layoutQuote };
    case "image-full":
      return { padding: "0", className: styles.layoutImageFull };
    default:
      return { padding: "80px 72px 64px", className: styles.layoutDefault };
  }
}

/** Return true when the hex colour is perceptually dark (relative luminance < 0.4). */
function isDarkColor(hex: string): boolean {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum < 0.4;
}

/**
 * Shared layout for a single slide: overlay layer (logo, copyright, page number)
 * on top of content rendered inside the safe zone with type-aware padding.
 */
export function SlideFrame({
  slide,
  config,
  deckName,
  currentPage,
}: SlideFrameProps): React.JSX.Element {
  const { accentLine, theme } = config;
  const slideType = slide.frontmatter.type;
  const layout = getTypeLayout(slideType);

  const bgOverride = slide.frontmatter.background;
  const effectiveBg = bgOverride ?? theme.colors?.background ?? "#FFFFFF";
  const darkBackground = isDarkColor(effectiveBg);

  const themeVars = createThemeVariables(theme, bgOverride);

  const defaultGradient = accentLine
    ? `linear-gradient(to bottom, transparent, color-mix(in srgb, var(--slide-primary) 50%, transparent) 15%, var(--slide-primary) 50%, var(--slide-secondary) 85%, transparent)`
    : undefined;

  return (
    <div
      className={styles.frame}
      style={{
        ...themeVars,
        background: "var(--slide-bg)",
        color: "var(--slide-text)",
        fontFamily: "var(--slide-font-body)",
      }}
    >
      {/* Left accent band for section slides */}
      {slideType === "section" && <div className={styles.sectionDeco} />}

      {accentLine && (
        <div
          style={{
            position: "absolute",
            [accentLine.position === "right" ? "right" : "left"]: 0,
            top: 0,
            bottom: 0,
            width: accentLine.width ?? 6,
            background: accentLine.gradient ?? defaultGradient,
            zIndex: 20,
            pointerEvents: "none",
          }}
        />
      )}

      <div className={styles.overlayContainer}>
        <SlideOverlay
          config={config}
          currentPage={currentPage}
          slideType={slideType}
          deckName={deckName}
          darkBackground={darkBackground}
        />
      </div>

      <div
        className={cn(styles.contentContainer, layout.className)}
        style={{ padding: layout.padding }}
      >
        <SlideContent slide={slide} config={config} deckName={deckName} />
      </div>
    </div>
  );
}
