"use client";

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Deck } from "@/types/deck";
import { SLIDE_WIDTH, SLIDE_HEIGHT, resolveSlideBackground } from "@/lib/slide-utils";
import { SlideFrame } from "@/components/slide/SlideFrame";
import { ExportModeProvider } from "@/contexts/ExportContext";
import { captureSlide, savePdf, savePptx } from "@/lib/export";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportFormat = "pdf" | "pptx-image";
export type ExportPhase =
  | "idle"
  | "fetching"
  | "capturing"
  | "generating"
  | "error";

export interface ExportProgress {
  current: number;
  total: number;
}

interface ExportJob {
  phase: ExportPhase;
  format: ExportFormat;
  deckName: string;
  progress: ExportProgress;
}

interface ExportJobContextValue {
  job: ExportJob;
  startExport: (deckName: string, format: ExportFormat) => void;
  cancelExport: () => void;
}

const ExportJobContext = createContext<ExportJobContextValue | null>(null);

export function useExportJob(): ExportJobContextValue {
  const ctx = useContext(ExportJobContext);
  if (!ctx) throw new Error("useExportJob must be used inside ExportJobProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const FORMAT_LABELS: Record<ExportFormat, string> = {
  pdf: "PDF",
  "pptx-image": "PPTX",
};

function createBlankSlideDataUrl(): string {
  const canvas = document.createElement("canvas");
  canvas.width = SLIDE_WIDTH;
  canvas.height = SLIDE_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);
  return canvas.toDataURL("image/jpeg", 0.92);
}

const OFFSCREEN_STYLE: React.CSSProperties = {
  position: "fixed",
  left: -9999,
  top: 0,
  pointerEvents: "none",
};

let nextJobId = 0;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ExportJobProvider({ children }: { children: ReactNode }): ReactNode {
  const [phase, setPhase] = useState<ExportPhase>("idle");
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [deckName, setDeckName] = useState("");
  const [progress, setProgress] = useState<ExportProgress>({ current: 0, total: 0 });
  const [deck, setDeck] = useState<Deck | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<string[]>([]);
  const phaseRef = useRef<ExportPhase>("idle");
  const jobIdRef = useRef(0);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Keep phaseRef in sync so callbacks can read current phase without stale closures
  phaseRef.current = phase;

  const resetExportState = useCallback(() => {
    imagesRef.current = [];
    setDeck(null);
    setProgress({ current: 0, total: 0 });
  }, []);

  const clearTimers = useCallback(() => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
  }, []);

  const cancelExport = useCallback(() => {
    jobIdRef.current = ++nextJobId;
    abortRef.current?.abort();
    clearTimers();
    resetExportState();
    setPhase("idle");
  }, [resetExportState, clearTimers]);

  const startExport = useCallback(
    async (name: string, selectedFormat: ExportFormat) => {
      if (phaseRef.current !== "idle" && phaseRef.current !== "error") return;

      const myJobId = ++nextJobId;
      jobIdRef.current = myJobId;
      clearTimers();

      setDeckName(name);
      setFormat(selectedFormat);
      setPhase("fetching");
      imagesRef.current = [];

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        fetchTimeoutRef.current = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(
          `/api/decks/${encodeURIComponent(name)}/data`,
          { signal: controller.signal },
        );
        clearTimeout(fetchTimeoutRef.current);

        if (!res.ok) throw new Error("Failed to load deck data");
        const deckData: Deck = await res.json();

        if (jobIdRef.current !== myJobId) {
          resetExportState();
          return;
        }

        if (deckData.slides.length === 0) throw new Error("Deck has no slides");

        setDeck(deckData);
        setProgress({ current: 0, total: deckData.slides.length });
        setCurrentSlideIndex(0);
        setPhase("capturing");
      } catch {
        if (jobIdRef.current === myJobId) {
          setPhase("error");
          errorTimerRef.current = setTimeout(() => {
            if (jobIdRef.current === myJobId) {
              setPhase("idle");
            }
          }, 3000);
        }
        resetExportState();
      }
    },
    [resetExportState, clearTimers],
  );

  // Sequential slide capture with job-scoped guard
  useEffect(() => {
    if (phase !== "capturing" || !deck) return;

    const activeDeck = deck;
    const captureJobId = jobIdRef.current;
    let cancelled = false;

    function isStale(): boolean {
      return cancelled || jobIdRef.current !== captureJobId;
    }

    async function processCurrentSlide(): Promise<void> {
      if (isStale() || !containerRef.current) return;

      try {
        const dataUrl = await captureSlide(containerRef.current);
        if (isStale()) return;
        imagesRef.current.push(dataUrl);
      } catch (err) {
        if (isStale()) return;
        console.warn(`[dexcode] Slide ${currentSlideIndex + 1} export failed:`, err);
        imagesRef.current.push(createBlankSlideDataUrl());
      }

      if (isStale()) return;

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

      if (isStale()) return;

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

      if (!isStale()) {
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      jobIdRef.current = ++nextJobId;
      abortRef.current?.abort();
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      imagesRef.current = [];
    };
  }, []);

  const slide = deck?.slides[currentSlideIndex];
  const isWorking = phase === "fetching" || phase === "capturing" || phase === "generating";
  const canCancel = phase === "fetching" || phase === "capturing";

  const job = useMemo<ExportJob>(
    () => ({ phase, format, deckName, progress }),
    [phase, format, deckName, progress],
  );

  const value = useMemo(
    () => ({ job, startExport, cancelExport }),
    [job, startExport, cancelExport],
  );

  return (
    <ExportJobContext.Provider value={value}>
      {children}

      {/* Floating progress indicator */}
      {isWorking && (
        <div
          className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg bg-white dark:bg-gray-800 px-4 py-3 shadow-lg border border-gray-200 dark:border-gray-700"
          role="status"
          aria-live="polite"
        >
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 dark:border-gray-600 border-t-gray-900 dark:border-t-gray-100" />
          <div className="text-sm text-gray-700 dark:text-gray-200">
            <span className="font-medium">{deckName}</span>
            {" "}
            {phase === "fetching" && "Loading..."}
            {phase === "capturing" &&
              `${FORMAT_LABELS[format]} ${progress.current}/${progress.total}`}
            {phase === "generating" && "Finishing..."}
          </div>
          {canCancel && (
            <button
              onClick={cancelExport}
              className="ml-1 rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Cancel export"
              aria-label={`Cancel export of ${deckName}`}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {phase === "error" && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/30 px-4 py-3 shadow-lg border border-red-200 dark:border-red-800">
          <span className="text-sm text-red-600 dark:text-red-400">
            Export failed: {deckName}
          </span>
        </div>
      )}

      {/* Offscreen slide renderer */}
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
    </ExportJobContext.Provider>
  );
}
