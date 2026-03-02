"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PanelRight } from "lucide-react";
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
import { NotesPanel } from "@/components/viewer/NotesPanel";
import { useDeckNavigation } from "@/hooks/useDeckNavigation";
import { useSlideScale } from "@/hooks/useSlideScale";
import { useResizablePanel } from "@/hooks/useResizablePanel";
import { useIsMobile } from "@/hooks/useIsMobile";
import { KeyboardHelp } from "@/components/ui/KeyboardHelp";
import { useDevHotReload } from "@/hooks/useDevHotReload";

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
  const eager = index < EAGER_COUNT;
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager);

  useEffect(() => {
    if (eager) return;

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: IO_ROOT_MARGIN },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [eager]);

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
      style={{
        minHeight: "100dvh",
        backgroundColor: "#F0F2F5",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          backgroundColor: "rgba(240, 242, 245, 0.92)",
          backdropFilter: "saturate(180%) blur(12px)",
          WebkitBackdropFilter: "saturate(180%) blur(12px)",
          padding: "10px 16px",
          fontSize: "14px",
          fontWeight: 600,
          color: "#374151",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
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
  const { containerRef, scale } = useSlideScale({ padding: 64 });
  const { width, isOpen, toggle, resizeHandleProps } = useResizablePanel();

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

  const handlePresenterMode = useCallback(() => {
    window.open(`/${deck.name}/presenter`, "nipry-presenter");
  }, [deck.name]);

  if (isMobile) {
    return <MobileViewer deck={deck} />;
  }

  const slide = deck.slides[currentSlide];
  if (!slide) return null;

  const bg = resolveSlideBackground(slide.frontmatter, deck.config);

  return (
    <div className="flex h-screen">
      <Sidebar
        deck={deck}
        currentSlide={currentSlide}
        onSlideSelect={handleNavigate}
        onPresenterMode={handlePresenterMode}
      />

      <main
        ref={containerRef}
        className="relative flex flex-1 items-center justify-center bg-[#F0F2F5] overflow-hidden"
      >
        <div
          className="shadow-xl"
          style={buildScaledSlideStyle(scale, bg)}
        >
          <SlideFrame
            slide={slide}
            config={deck.config}
            deckName={deck.name}
            currentPage={currentSlide}
          />
        </div>

        {!isOpen && (
          <button
            onClick={toggle}
            className="absolute right-3 top-3 rounded bg-white/80 p-1.5 text-gray-400 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-gray-600"
            aria-label="Open notes panel"
          >
            <PanelRight size={18} />
          </button>
        )}

        {!isOpen && (
          <div className="absolute bottom-3 right-3 rounded bg-black/50 px-2 py-1 text-xs text-white tabular-nums backdrop-blur">
            {currentSlide + 1} / {deck.slides.length}
          </div>
        )}
      </main>

      <NotesPanel
        notes={slide.notes}
        isOpen={isOpen}
        width={width}
        onToggle={toggle}
        resizeHandleProps={resizeHandleProps}
      />

      <KeyboardHelp open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
