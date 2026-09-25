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
import { SLIDE_WIDTH, SLIDE_HEIGHT } from "@/lib/slide-utils";
import { NativeSlideStage } from "@/components/slide/NativeSlideStage";
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

/**
 * - `pdf-vector`: rendered by headless Chromium on the server (selectable
 *   text, vector graphics); see /api/export/pdf
 * - `pdf` / `pptx-image`: every slide captured in the browser as a JPEG
 */
export type ExportFormat = "pdf-vector" | "pdf" | "pptx-image";
export type ExportPhase =
  | "idle"
  | "fetching"
  | "capturing"
  | "optimizing"
  | "generating"
  | "error";

/** Phases during which an export is running and can be cancelled. */
export const ACTIVE_EXPORT_PHASES: ReadonlySet<ExportPhase> = new Set([
  "fetching",
  "capturing",
  "optimizing",
  "generating",
]);

export interface ExportProgress {
  current: number;
  total: number;
}

interface ExportJob {
  phase: ExportPhase;
  format: ExportFormat;
  deckName: string;
  progress: ExportProgress;
  /** Server-provided reason when a vector PDF export fails. */
  errorMessage: string | null;
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

const FORMAT_LABELS: Record<ExportFormat, string> = {
  "pdf-vector": "PDF",
  pdf: "PDF",
  "pptx-image": "PPTX",
};

const EXPORT_CANCEL_REASON = "export-cancelled";
const FETCH_TIMEOUT_REASON = "export-fetch-timeout";
const ERROR_DISPLAY_MS = 3000;
const ERROR_WITH_MESSAGE_DISPLAY_MS = 8000;
const NOTICE_DISPLAY_MS = 10000;

export function formatExportLabel(
  phase: ExportPhase,
  format: ExportFormat,
  progress: ExportProgress,
): string {
  if (phase === "fetching") return "Loading...";
  if (phase === "capturing")
    return `${FORMAT_LABELS[format]} ${progress.current}/${progress.total}`;
  if (phase === "optimizing")
    return progress.total > 0 ? `Images ${progress.current}/${progress.total}` : "Images...";
  if (phase === "generating")
    return progress.total > 0
      ? `Generating ${progress.current}/${progress.total}`
      : "Finishing...";
  return "";
}

function createBlankSlideImage(): Promise<ExportedSlideImage> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = SLIDE_WIDTH;
    canvas.height = SLIDE_HEIGHT;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);

    canvas.toBlob(
      (blob) => {
        canvas.width = 0;
        canvas.height = 0;
        if (blob) resolve(blob);
        else reject(new Error("Failed to create blank slide image"));
      },
      "image/jpeg",
      0.92,
    );
  });
}

// ---------------------------------------------------------------------------
// Vector PDF (server-rendered) helpers
// ---------------------------------------------------------------------------

type VectorPdfEvent =
  | {
      type: "progress";
      phase: "launching" | "loading" | "rendering" | "optimizing" | "printing";
      current: number;
      total: number;
    }
  | { type: "done"; url: string; filename: string; warnings?: string[] }
  | { type: "error"; message: string };

/** Parse a newline-delimited JSON response body as it streams in. */
async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<VectorPdfEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) yield JSON.parse(line) as VectorPdfEvent;
        newline = buffer.indexOf("\n");
      }
      if (done) break;
    }
    if (buffer.trim()) yield JSON.parse(buffer) as VectorPdfEvent;
  } finally {
    reader.releaseLock();
  }
}

/** Let the browser download a same-origin URL served as an attachment. */
function triggerDownload(url: string, filename: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function readErrorMessage(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof data?.error === "string" ? data.error : `HTTP ${res.status}`;
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** Non-fatal notes from a finished export (e.g. viewer compatibility). */
  const [notice, setNotice] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<ExportedSlideImage[]>([]);
  const phaseRef = useRef<ExportPhase>("idle");
  const deckNameRef = useRef("");
  const formatRef = useRef<ExportFormat>("pdf");
  const jobIdRef = useRef(0);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Keep refs in sync so async callbacks can read current values without stale closures.
  // Written in an effect (not during render) so the React Compiler / react-hooks/refs
  // rule accept it; this effect is declared before every effect that reads these refs.
  useEffect(() => {
    phaseRef.current = phase;
    deckNameRef.current = deckName;
    formatRef.current = format;
  }, [phase, deckName, format]);

  const resetExportState = useCallback(() => {
    imagesRef.current = [];
    setDeck(null);
    setCurrentSlideIndex(0);
    setProgress({ current: 0, total: 0 });
  }, []);

  const clearTimers = useCallback(() => {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
    setNotice(null);
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
    setErrorMessage(null);
    setPhase("idle");
  }, [resetExportState, clearTimers]);

  const failJob = useCallback(
    (jobId: number, message: string | null) => {
      abortRef.current = null;
      setErrorMessage(message);
      setPhase("error");
      errorTimerRef.current = setTimeout(
        () => {
          if (jobIdRef.current === jobId) setPhase("idle");
        },
        message ? ERROR_WITH_MESSAGE_DISPLAY_MS : ERROR_DISPLAY_MS,
      );
      resetExportState();
    },
    [resetExportState],
  );

  /** Server-side vector PDF: stream progress, then download the result. */
  const runVectorPdfExport = useCallback(
    async (name: string, controller: AbortController, jobId: number) => {
      const isStale = () => jobIdRef.current !== jobId;
      try {
        const res = await fetch("/api/export/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deck: name }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(await readErrorMessage(res));

        let result: { url: string; filename: string; warnings?: string[] } | null = null;
        for await (const event of readNdjson(res.body)) {
          if (isStale()) return;
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "done") {
            result = event;
            for (const warning of event.warnings ?? []) console.warn(`[amaroad] PDF: ${warning}`);
            continue;
          }
          switch (event.phase) {
            case "launching":
            case "loading":
              setPhase("fetching");
              break;
            case "rendering":
              setPhase("capturing");
              setProgress({ current: event.current, total: event.total });
              break;
            case "optimizing":
              setPhase("optimizing");
              setProgress({ current: event.current, total: event.total });
              break;
            case "printing":
              setPhase("generating");
              setProgress({ current: 0, total: 0 });
              break;
          }
        }

        if (isStale()) return;
        if (!result) throw new Error("The export ended without a file");
        triggerDownload(result.url, result.filename);
        if (result.warnings && result.warnings.length > 0) {
          setNotice(result.warnings.join("\n"));
          noticeTimerRef.current = setTimeout(() => {
            if (jobIdRef.current === jobId) setNotice(null);
          }, NOTICE_DISPLAY_MS);
        }
        abortRef.current = null;
        resetExportState();
        setPhase("idle");
      } catch (err) {
        // cancelExport() already bumped the job id and reset the UI.
        if (isStale()) return;
        const message = err instanceof Error ? err.message : String(err);
        console.error("[amaroad] Vector PDF export failed:", message);
        failJob(jobId, message);
      }
    },
    [resetExportState, failJob],
  );

  const startExport = useCallback(
    async (name: string, selectedFormat: ExportFormat) => {
      if (phaseRef.current !== "idle" && phaseRef.current !== "error") return;
      // Claim the slot now: the effect that mirrors `phase` into the ref runs
      // after render, and a second click could otherwise slip in before it.
      phaseRef.current = "fetching";

      const myJobId = ++nextJobId;
      jobIdRef.current = myJobId;
      clearTimers();

      setDeckName(name);
      setFormat(selectedFormat);
      setPhase("fetching");
      imagesRef.current = [];

      const controller = new AbortController();
      abortRef.current = controller;
      setErrorMessage(null);

      if (selectedFormat === "pdf-vector") {
        await runVectorPdfExport(name, controller, myJobId);
        return;
      }

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
    [resetExportState, clearTimers, runVectorPdfExport],
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
        console.warn(`[amaroad] Slide ${currentSlideIndex + 1} export failed:`, err);
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
  }, [phase, deck, currentSlideIndex, resetExportState]);

  // PDF/PPTX generation — runs when phase transitions to "generating".
  // Vector PDFs are generated on the server (runVectorPdfExport).
  useEffect(() => {
    if (phase !== "generating" || format === "pdf-vector") return;

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
        const saveOptions = { onProgress, signal };
        switch (genFormat) {
          case "pdf":
            await savePdf(deckName, imagesRef.current, saveOptions);
            break;
          case "pptx-image":
            await savePptx(deckName, imagesRef.current, saveOptions);
            break;
        }
      } catch (err) {
        if (isStale() || (err instanceof Error && err.name === "AbortError")) {
          return;
        }

        console.error("[amaroad] Export generation failed:", err);
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
  }, [phase, format, resetExportState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      jobIdRef.current = ++nextJobId;
      abortRef.current?.abort();
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      imagesRef.current = [];
    };
  }, []);

  const slide = deck?.slides[currentSlideIndex];
  const isWorking = ACTIVE_EXPORT_PHASES.has(phase);
  const canCancel = isWorking;

  const job = useMemo<ExportJob>(
    () => ({ phase, format, deckName, progress, errorMessage }),
    [phase, format, deckName, progress, errorMessage],
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
            {formatExportLabel(phase, format, progress)}
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
            {errorMessage && (
              <span className="mt-1 block max-w-md whitespace-pre-line text-xs">{errorMessage}</span>
            )}
          </span>
        </div>
      )}

      {phase === "idle" && notice && (
        <div
          className="fixed bottom-4 right-4 z-50 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 px-4 py-3 shadow-lg border border-amber-200 dark:border-amber-800"
          role="status"
          aria-live="polite"
        >
          <span className="text-sm text-amber-800 dark:text-amber-300">
            Exported {deckName} with a note
            <span className="mt-1 block max-w-md whitespace-pre-line text-xs">{notice}</span>
          </span>
          <button
            onClick={() => setNotice(null)}
            className="rounded p-1 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-800/40 transition-colors"
            aria-label="Dismiss export note"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Offscreen slide renderer */}
      {phase === "capturing" && deck && slide &&
        createPortal(
          <div aria-hidden style={OFFSCREEN_STYLE}>
            <NativeSlideStage
              ref={containerRef}
              deck={deck}
              slide={slide}
              currentPage={currentSlideIndex}
              className={document.body.className}
            />
          </div>,
          document.body,
        )}
    </ExportJobContext.Provider>
  );
}
