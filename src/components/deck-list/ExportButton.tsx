"use client";

import type { ReactNode } from "react";
import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Download, Loader2 } from "lucide-react";
import type { Deck } from "@/types/deck";
import { SLIDE_WIDTH, SLIDE_HEIGHT, resolveSlideBackground } from "@/lib/slide-utils";
import { SlideFrame } from "@/components/slide/SlideFrame";
import { ExportModeProvider } from "@/contexts/ExportContext";
import {
  captureSlide,
  extractSlideContent,
  savePdf,
  savePptx,
  saveNativePptx,
  type NativeSlideContent,
} from "@/lib/export";

type ExportFormat = "pdf" | "pptx-image" | "pptx-native";
type ExportPhase = "idle" | "menu" | "fetching" | "capturing" | "generating" | "error";

function createBlankSlideDataUrl(): string {
  const canvas = document.createElement("canvas");
  canvas.width = SLIDE_WIDTH;
  canvas.height = SLIDE_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);
  return canvas.toDataURL("image/png");
}

const FORMAT_LABELS: Record<ExportFormat, string> = {
  pdf: "PDF",
  "pptx-image": "PPTX",
  "pptx-native": "PPTX",
};

const MENU_ITEM_CLASS =
  "flex w-full items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors";

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
  const menuRef = useRef<HTMLDivElement>(null);
  const cancelledRef = useRef(false);
  const imagesRef = useRef<string[]>([]);
  const nativeSlidesRef = useRef<NativeSlideContent[]>([]);
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

  useEffect(() => {
    if (phase !== "menu") return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setPhase("idle");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [phase]);

  const resetExportState = useCallback(() => {
    imagesRef.current = [];
    nativeSlidesRef.current = [];
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
      nativeSlidesRef.current = [];

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

  // Sequential slide processing: capture image or extract native content.
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
        const slide = activeDeck.slides[currentSlideIndex];
        const bg = resolveSlideBackground(slide.frontmatter, activeDeck.config);

        if (format === "pptx-native") {
          const content = await extractSlideContent(
            container,
            bg,
            currentSlideIndex,
            slide.frontmatter.type,
          );
          nativeSlidesRef.current.push(content);
        } else {
          const dataUrl = await captureSlide(container);
          imagesRef.current.push(dataUrl);
        }
      } catch (err) {
        console.warn(`[nipry] Slide ${currentSlideIndex + 1} export failed:`, err);
        if (format !== "pptx-native") {
          imagesRef.current.push(createBlankSlideDataUrl());
        }
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
      await new Promise((r) => setTimeout(r, 50));

      try {
        switch (format) {
          case "pdf":
            savePdf(activeDeck.name, imagesRef.current);
            break;
          case "pptx-image":
            await savePptx(activeDeck.name, imagesRef.current);
            break;
          case "pptx-native":
            await saveNativePptx(activeDeck.name, nativeSlidesRef.current, activeDeck.config);
            break;
        }
      } catch (err) {
        console.error("[nipry] Export generation failed:", err);
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
      nativeSlidesRef.current = [];
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
      return <span className="text-red-300">Error</span>;
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
    <div ref={menuRef} className="relative">
      <button
        onClick={toggleMenu}
        disabled={isWorking}
        className="flex items-center gap-1.5 rounded-lg bg-[#02001A] px-3 py-1.5 text-sm text-white transition-colors hover:bg-[#1a1a3a] disabled:opacity-50 disabled:cursor-not-allowed"
        title={`Export ${deckName}`}
      >
        {renderButtonContent()}
      </button>

      {phase === "menu" && (
        <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg bg-white shadow-lg border border-gray-200 overflow-hidden">
          <button onClick={handleFormatSelect("pdf")} className={MENU_ITEM_CLASS}>
            PDF
          </button>
          <button onClick={handleFormatSelect("pptx-image")} className={MENU_ITEM_CLASS}>
            <span>PPTX<span className="ml-1.5 text-xs text-gray-400">Image</span></span>
          </button>
          <button onClick={handleFormatSelect("pptx-native")} className={MENU_ITEM_CLASS}>
            <span>PPTX<span className="ml-1.5 text-xs text-gray-400">Text</span></span>
          </button>
        </div>
      )}

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
