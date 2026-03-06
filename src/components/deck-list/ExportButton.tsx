"use client";

import type { ReactNode } from "react";
import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Download, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { Deck } from "@/types/deck";
import { SLIDE_WIDTH, SLIDE_HEIGHT, resolveSlideBackground } from "@/lib/slide-utils";
import { SlideFrame } from "@/components/slide/SlideFrame";
import { ExportModeProvider } from "@/contexts/ExportContext";
import {
  captureSlide,
  savePdf,
  savePptx,
} from "@/lib/export";

type ExportFormat = "pdf" | "pptx-image";
type ExportPhase = "idle" | "menu" | "fetching" | "capturing" | "generating" | "error";

function createBlankSlideDataUrl(): string {
  const canvas = document.createElement("canvas");
  canvas.width = SLIDE_WIDTH;
  canvas.height = SLIDE_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);
  return canvas.toDataURL("image/jpeg", 0.92);
}

const FORMAT_LABELS: Record<ExportFormat, string> = {
  pdf: "PDF",
  "pptx-image": "PPTX",
};

const MENU_ITEM_CLASS =
  "flex w-full items-center px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors";

const OFFSCREEN_STYLE: React.CSSProperties = {
  position: "fixed",
  left: -9999,
  top: 0,
  pointerEvents: "none",
};

interface ExportButtonProps {
  deckName: string;
}

export function ExportButton({ deckName }: ExportButtonProps): ReactNode {
  const [phase, setPhase] = useState<ExportPhase>("idle");
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [deck, setDeck] = useState<Deck | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const cancelledRef = useRef(false);
  const imagesRef = useRef<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const exportingRef = useRef(false);

  const toggleMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPhase((prev) => {
      if (prev === "idle") return "menu";
      if (prev === "menu") return "idle";
      return prev;
    });
  }, []);

  const closeMenu = useCallback(() => setPhase("idle"), []);

  const resetExportState = useCallback(() => {
    imagesRef.current = [];
    setDeck(null);
    setProgress({ current: 0, total: 0 });
    exportingRef.current = false;
  }, []);

  const startExport = useCallback(
    async (selectedFormat: ExportFormat) => {
      if (exportingRef.current) return;
      exportingRef.current = true;

      setFormat(selectedFormat);
      setPhase("fetching");
      cancelledRef.current = false;
      imagesRef.current = [];

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const timeout = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(
          `/api/decks/${encodeURIComponent(deckName)}/data`,
          { signal: controller.signal },
        );
        clearTimeout(timeout);

        if (!res.ok) throw new Error("Failed to load deck data");
        const deckData: Deck = await res.json();

        if (cancelledRef.current) {
          resetExportState();
          return;
        }

        if (deckData.slides.length === 0) throw new Error("Deck has no slides");

        setDeck(deckData);
        setProgress({ current: 0, total: deckData.slides.length });
        setCurrentSlideIndex(0);
        setPhase("capturing");
      } catch {
        if (!cancelledRef.current) {
          setPhase("error");
          setTimeout(() => setPhase("idle"), 3000);
        }
        resetExportState();
      }
    },
    [deckName, resetExportState],
  );

  // Sequential slide capture: one slide at a time, advancing on completion.
  // Double rAF ensures React has flushed all state updates (including
  // MDXRenderer's setContent(null)) before we start waiting for "ready".
  useEffect(() => {
    if (phase !== "capturing" || !deck) return;

    // Local binding narrows away null for closures below
    const activeDeck = deck;
    let cancelled = false;

    async function processCurrentSlide(): Promise<void> {
      if (cancelled || cancelledRef.current || !containerRef.current) return;

      const container = containerRef.current;

      try {
        const dataUrl = await captureSlide(container);
        imagesRef.current.push(dataUrl);
      } catch (err) {
        console.warn(`[dexcode] Slide ${currentSlideIndex + 1} export failed:`, err);
        imagesRef.current.push(createBlankSlideDataUrl());
      }

      if (cancelled || cancelledRef.current) return;

      const nextIndex = currentSlideIndex + 1;
      setProgress({ current: nextIndex, total: activeDeck.slides.length });

      if (nextIndex < activeDeck.slides.length) {
        setCurrentSlideIndex(nextIndex);
      } else {
        await generateOutput();
      }
    }

    async function generateOutput(): Promise<void> {
      setPhase("generating");
      // Yield to let React render the "Generating..." UI before the heavy work
      await new Promise((r) => setTimeout(r, 50));

      try {
        switch (format) {
          case "pdf":
            savePdf(activeDeck.name, imagesRef.current);
            break;
          case "pptx-image":
            await savePptx(activeDeck.name, imagesRef.current);
            break;
        }
      } catch (err) {
        console.error("[dexcode] Export generation failed:", err);
      }

      if (!cancelledRef.current) {
        resetExportState();
        setPhase("idle");
      }
    }

    const outerFrame = requestAnimationFrame(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        processCurrentSlide();
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(outerFrame);
    };
  }, [phase, deck, currentSlideIndex, format, resetExportState]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      abortRef.current?.abort();
      imagesRef.current = [];
    };
  }, []);

  const slide = deck?.slides[currentSlideIndex];

  const isWorking = phase === "fetching" || phase === "capturing" || phase === "generating";

  function resolveButtonLabel(): string {
    switch (phase) {
      case "idle":
      case "menu":
        return "Export";
      case "fetching":
        return "Loading...";
      case "capturing":
        return `${FORMAT_LABELS[format]} ${progress.current}/${progress.total}`;
      case "generating":
        return "Generating...";
      case "error":
        return "Error";
    }
  }

  function renderButtonContent(): ReactNode {
    if (phase === "error") {
      return <span className="text-red-300 dark:text-red-500">Error</span>;
    }

    const icon = isWorking
      ? <Loader2 className="h-4 w-4 animate-spin" />
      : <Download className="h-4 w-4" />;

    return (
      <>
        {icon}
        <span>{resolveButtonLabel()}</span>
      </>
    );
  }

  function handleFormatSelect(selectedFormat: ExportFormat): (e: React.MouseEvent) => void {
    return (e) => {
      e.preventDefault();
      e.stopPropagation();
      startExport(selectedFormat);
    };
  }

  return (
    <div className="relative">
      <button
        onClick={toggleMenu}
        disabled={isWorking}
        className="flex items-center gap-1.5 rounded-lg bg-[#02001A] dark:bg-gray-100 px-3 py-1.5 text-sm text-white dark:text-gray-900 transition-colors hover:bg-[#1a1a3a] dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        title={`Export ${deckName}`}
      >
        {renderButtonContent()}
      </button>

      <Modal open={phase === "menu"} onClose={closeMenu}>
        <div className="w-44 overflow-hidden">
          <button onClick={handleFormatSelect("pdf")} className={MENU_ITEM_CLASS}>
            PDF
          </button>
          <button onClick={handleFormatSelect("pptx-image")} className={MENU_ITEM_CLASS}>
            PPTX
          </button>
        </div>
      </Modal>

      {phase === "capturing" && deck && slide &&
        createPortal(
          <ExportModeProvider isExporting>
            <div aria-hidden style={OFFSCREEN_STYLE}>
              <div
                ref={containerRef}
                className={`export-capture ${document.body.className}`}
                style={{
                  width: SLIDE_WIDTH,
                  height: SLIDE_HEIGHT,
                  background: resolveSlideBackground(slide.frontmatter, deck.config),
                  overflow: "hidden",
                }}
              >
                <SlideFrame
                  slide={slide}
                  config={deck.config}
                  deckName={deck.name}
                  currentPage={currentSlideIndex}
                />
              </div>
            </div>
          </ExportModeProvider>,
          document.body,
        )}
    </div>
  );
}
