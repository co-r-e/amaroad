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
import {
  captureSlide,
  savePdf,
  savePptx,
  yieldToMain,
  type ExportedSlideImage,
} from "@/lib/export";

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

const EXPORT_CANCEL_REASON = "export-cancelled";
const FETCH_TIMEOUT_REASON = "export-fetch-timeout";

function createBlankSlideImage(): Promise<ExportedSlideImage> {
  const canvas = document.createElement("canvas");
  canvas.width = SLIDE_WIDTH;
  canvas.height = SLIDE_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  canvas.width = 0;
  canvas.height = 0;

  const [prefix, base64] = dataUrl.split(",", 2);
  const mimeMatch = prefix.match(/^data:(.*?);base64$/);
  const mimeType = mimeMatch?.[1] ?? "image/jpeg";
  const binary = atob(base64 ?? "");
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return Promise.resolve(new Blob([bytes], { type: mimeType }));
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
  const imagesRef = useRef<ExportedSlideImage[]>([]);
  const phaseRef = useRef<ExportPhase>("idle");
  const deckNameRef = useRef("");
  const formatRef = useRef<ExportFormat>("pdf");
  const jobIdRef = useRef(0);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Keep refs in sync so async callbacks can read current values without stale closures
  phaseRef.current = phase;
  deckNameRef.current = deckName;
  formatRef.current = format;

  const resetExportState = useCallback(() => {
    imagesRef.current = [];
    setDeck(null);
    setCurrentSlideIndex(0);
    setProgress({ current: 0, total: 0 });
  }, []);

  const clearTimers = useCallback(() => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }
  }, []);

  const cancelExport = useCallback(() => {
    jobIdRef.current = ++nextJobId;
    abortRef.current?.abort(EXPORT_CANCEL_REASON);
    abortRef.current = null;
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
        fetchTimeoutRef.current = setTimeout(() => controller.abort(FETCH_TIMEOUT_REASON), 15000);

        const res = await fetch(
          `/api/decks/${encodeURIComponent(name)}/data`,
          { signal: controller.signal },
        );
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
          fetchTimeoutRef.current = null;
        }

        if (!res.ok) throw new Error("Failed to load deck data");
        const deckData: Deck = await res.json();

        if (jobIdRef.current !== myJobId) {
          return;
        }

        if (deckData.slides.length === 0) throw new Error("Deck has no slides");

        setDeck(deckData);
        setProgress({ current: 0, total: deckData.slides.length });
        setCurrentSlideIndex(0);
        setPhase("capturing");
      } catch {
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
          fetchTimeoutRef.current = null;
        }

        if (jobIdRef.current === myJobId) {
          abortRef.current = null;

          if (controller.signal.aborted && controller.signal.reason === EXPORT_CANCEL_REASON) {
            resetExportState();
            setPhase("idle");
            return;
          }

          setPhase("error");
          errorTimerRef.current = setTimeout(() => {
            if (jobIdRef.current === myJobId) {
              setPhase("idle");
            }
          }, 3000);
          resetExportState();
        }
      }
    },
    [resetExportState, clearTimers],
  );

  // Sequential slide capture — only runs during "capturing" phase
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
        imagesRef.current.push(await createBlankSlideImage());
      }

      if (isStale()) return;

      const nextIndex = currentSlideIndex + 1;
      setProgress({ current: nextIndex, total: activeDeck.slides.length });

      if (nextIndex < activeDeck.slides.length) {
        setCurrentSlideIndex(nextIndex);
      } else {
        // Transition to generating phase — handled by a separate useEffect
        setPhase("generating");
        setProgress({ current: 0, total: activeDeck.slides.length });
      }
    }

    // Use MessageChannel instead of requestAnimationFrame so capture
    // continues even when the browser tab is in the background.
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      if (!cancelled) processCurrentSlide();
    };
    channel.port2.postMessage(undefined);

    return () => {
      cancelled = true;
      channel.port1.onmessage = null;
      channel.port1.close();
      channel.port2.close();
    };
  }, [phase, deck, currentSlideIndex, format, resetExportState]);

  // PDF/PPTX generation — runs when phase transitions to "generating"
  useEffect(() => {
    if (phase !== "generating") return;

    const genJobId = jobIdRef.current;
    let cancelled = false;

    function isStale(): boolean {
      return cancelled || jobIdRef.current !== genJobId;
    }

    async function run(): Promise<void> {
      const signal = abortRef.current?.signal;
      const deckName = deckNameRef.current;
      const genFormat = formatRef.current;

      await yieldToMain();
      if (isStale()) return;

      const onProgress = (current: number, total: number) => {
        if (!isStale()) setProgress({ current, total });
      };

      try {
        switch (genFormat) {
          case "pdf":
            await savePdf(deckName, imagesRef.current, onProgress, { signal });
            break;
          case "pptx-image":
            await savePptx(deckName, imagesRef.current, onProgress, { signal });
            break;
        }
      } catch (err) {
        if (isStale() || (err instanceof Error && err.name === "AbortError")) {
          return;
        }

        console.error("[dexcode] Export generation failed:", err);
        if (!isStale()) {
          abortRef.current = null;
          setPhase("error");
          errorTimerRef.current = setTimeout(() => {
            if (jobIdRef.current === genJobId) setPhase("idle");
          }, 3000);
          resetExportState();
          return;
        }
      }

      if (!isStale()) {
        abortRef.current = null;
        resetExportState();
        setPhase("idle");
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [phase, resetExportState]);

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
  const canCancel = phase === "fetching" || phase === "capturing" || phase === "generating";

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
            {phase === "generating" &&
              (progress.total > 0
                ? `Generating ${progress.current}/${progress.total}`
                : "Finishing...")}
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
