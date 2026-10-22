"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { Deck } from "@/types/deck";
import type { DeckConfig, SlideData } from "@/types/deck";
import {
  resolveSlideBackground,
  buildScaledSlideStyle,
  SLIDE_WIDTH,
  SLIDE_HEIGHT,
} from "@/lib/slide-utils";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { SlideFrame } from "@/components/slide/SlideFrame";
import { ViewerLayout } from "./ViewerLayout";
import { useDeckNavigation } from "@/hooks/useDeckNavigation";
import { useIsMobile } from "@/hooks/useIsMobile";
import { KeyboardHelp } from "@/components/ui/KeyboardHelp";
import { useDevHotReload } from "@/hooks/useDevHotReload";
import { useIntersectionVisibility } from "@/hooks/useIntersectionVisibility";

interface SlideViewerProps {
  deck: Deck;
}

/* ---------- viewport width (reactive) ---------- */

function subscribeToResize(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}
function getViewportWidth() {
  return window.innerWidth;
}
function getServerViewportWidth() {
  return 390;
}

/* ---------- prefetch adjacent slide images ---------- */

const ASSET_PATH_RE = /(?:\(|["'])\/api\/decks\/[^/]+\/assets\/[^)"'\s]+/g;

function extractAssetUrls(rawContent: string, deckName: string): string[] {
  const apiBase = `/api/decks/${encodeURIComponent(deckName)}/assets/`;
  const urls: string[] = [];
  // Match relative asset refs before they're resolved, and resolved API paths
  const resolved = rawContent.replace(/\.\/assets\//g, apiBase);
  for (const m of resolved.matchAll(ASSET_PATH_RE)) {
    urls.push(m[0].replace(/^[("']/, ""));
  }
  return urls;
}

function usePrefetchAdjacentSlides(
  slides: SlideData[],
  currentSlide: number,
  deckName: string,
) {
  useEffect(() => {
    const indices = [currentSlide + 1, currentSlide + 2].filter(
      (i) => i < slides.length,
    );
    for (const i of indices) {
      const urls = extractAssetUrls(slides[i].rawContent, deckName);
      for (const url of urls) {
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.as = "image";
        link.href = url;
        document.head.appendChild(link);
        // Clean up to avoid accumulating link tags
        link.onload = link.onerror = () => link.remove();
      }
    }
  }, [slides, currentSlide, deckName]);
}

/* ---------- lazy slide (IntersectionObserver) ---------- */

/** Margin around the viewport for pre-loading slides */
const IO_ROOT_MARGIN = "200% 0px";

/** Number of slides to render immediately (skip lazy loading) */
const EAGER_COUNT = 3;

function LazySlide({
  slide,
  index,
  config,
  deckName,
  scale,
}: {
  slide: SlideData;
  index: number;
  config: DeckConfig;
  deckName: string;
  scale: number;
}): React.JSX.Element {
  const { ref, visible } = useIntersectionVisibility(IO_ROOT_MARGIN, index < EAGER_COUNT);

  const bg = resolveSlideBackground(slide.frontmatter, config);

  return (
    <div
      ref={ref}
      style={{
        width: "100vw",
        aspectRatio: `${SLIDE_WIDTH} / ${SLIDE_HEIGHT}`,
        overflow: "hidden",
        position: "relative",
        backgroundColor: bg,
      }}
    >
      {visible && (
        <div
          style={{
            width: SLIDE_WIDTH,
            height: SLIDE_HEIGHT,
            background: bg,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <SlideFrame
            slide={slide}
            config={config}
            deckName={deckName}
            currentPage={index}
          />
        </div>
      )}
    </div>
  );
}

/* ---------- mobile viewer ---------- */

function MobileViewer({ deck }: SlideViewerProps): React.JSX.Element {
  const vw = useSyncExternalStore(subscribeToResize, getViewportWidth, getServerViewportWidth);
  const mobileScale = vw / SLIDE_WIDTH;

  return (
    <div
      className="bg-ice-gray dark:bg-ice-gray-dark"
      style={{
        minHeight: "100dvh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <header
        className="sticky top-0 z-20 bg-ice-gray/92 dark:bg-ice-gray-dark/92 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-black/6 dark:border-white/10"
        style={{
          backdropFilter: "saturate(180%) blur(12px)",
          WebkitBackdropFilter: "saturate(180%) blur(12px)",
        }}
      >
        {deck.config.title}
      </header>

      {deck.slides.map((slide, i) => (
        <LazySlide
          key={slide.index}
          slide={slide}
          index={i}
          config={deck.config}
          deckName={deck.name}
          scale={mobileScale}
        />
      ))}
    </div>
  );
}

export function SlideViewer({ deck: initialDeck }: SlideViewerProps): React.JSX.Element | null {
  const [deck, setDeck] = useState(initialDeck);
  useDevHotReload({ deckName: deck.name, onUpdate: setDeck });

  const isMobile = useIsMobile();

  const [showHelp, setShowHelp] = useState(false);
  const handleShowHelp = useCallback(() => setShowHelp(true), []);

  const { currentSlide, handleNavigate } = useDeckNavigation({
    deckName: deck.name,
    totalSlides: deck.slides.length,
    role: "viewer",
    keyboard: {
      onHelp: handleShowHelp,
      enabled: !showHelp,
    },
  });

  usePrefetchAdjacentSlides(deck.slides, currentSlide, deck.name);

  const handlePresenterMode = useCallback(() => {
    window.open(`/${deck.name}/presenter`, "amaroad-presenter");
  }, [deck.name]);

  if (isMobile) {
    return <MobileViewer deck={deck} />;
  }

  const slide = deck.slides[currentSlide];
  if (!slide) return null;

  const bg = resolveSlideBackground(slide.frontmatter, deck.config);

  return (
    <>
      <ViewerLayout sidebar={<Sidebar
        deck={deck}
        currentSlide={currentSlide}
        onSlideSelect={handleNavigate}
        onPresenterMode={handlePresenterMode}
      />} notes={slide.notes} pageStatus={`${currentSlide + 1} / ${deck.slides.length}`}>
      {(scale) => (
        <div
          className="shadow-xl dark:shadow-2xl dark:shadow-black/60"
          style={buildScaledSlideStyle(scale, bg)}
        >
          <SlideFrame
            slide={slide}
            config={deck.config}
            deckName={deck.name}
            currentPage={currentSlide}
          />
        </div>

      )}
      </ViewerLayout>

      <KeyboardHelp open={showHelp} onClose={() => setShowHelp(false)} />
    </>
  );
}
