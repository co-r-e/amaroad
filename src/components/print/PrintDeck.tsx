"use client";

import { useEffect, useRef } from "react";
import type { Deck, SlideData } from "@/types/deck";
import { NativeSlideStage } from "@/components/slide/NativeSlideStage";
import { preparePrintDocument } from "@/lib/pdf/print-readiness";
import styles from "./PrintDeck.module.css";

interface PrintDeckProps {
  deck: Pick<Deck, "name" | "config">;
  slides: SlideData[];
  /** Oversampling for image re-encoding; `null` keeps the original files. */
  imageScale: number | null;
}

/**
 * Page size and margins for Chromium's print pipeline. `@page` cannot live in
 * a CSS module, and the html/body resets must beat the app's global styles.
 */
const PRINT_PAGE_CSS = `
@page { size: 1920px 1080px; margin: 0; }
html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
`;

/**
 * Every selected slide stacked at its native 1920x1080 size, one per printed
 * page. Rendering state is published on the root element for the headless
 * renderer (see `preparePrintDocument`); the attributes are written directly
 * so progress updates never re-render hundreds of slides.
 */
export function PrintDeck({ deck, slides, imageScale }: PrintDeckProps): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const controller = new AbortController();
    void preparePrintDocument(root, {
      expected: slides.length,
      imageScale,
      signal: controller.signal,
    });
    return () => controller.abort();
  }, [slides.length, imageScale]);

  return (
    <>
      <style>{PRINT_PAGE_CSS}</style>
      <div ref={rootRef} data-print-deck="" className={styles.deck}>
        {slides.map((slide) => (
          <div key={slide.index} data-print-page={slide.index + 1} className={styles.page}>
            <NativeSlideStage deck={deck} slide={slide} />
          </div>
        ))}
      </div>
    </>
  );
}
