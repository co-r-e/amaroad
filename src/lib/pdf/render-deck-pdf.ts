/**
 * Vector PDF renderer: prints the `/[deck]/print` route with headless
 * Chromium. Text stays text (selectable, searchable, with embedded font
 * subsets), SVG stays vector, links stay clickable, and raster images are
 * re-encoded to the size they are shown at. Node only (Playwright, sharp).
 *
 * Needs a running Amaroad server at `baseUrl` (`pnpm dev`).
 */
import { availableParallelism } from "node:os";
import type { Browser, Route } from "playwright";
import { launchChromium } from "@/lib/chromium";
import { optimizeImageForPdf } from "./optimize-image";
import {
  DEFAULT_PDF_JPEG_QUALITY,
  PDF_IMAGE_WIDTH_PARAM,
  normalizePdfImageScale,
  type PrintState,
} from "./shared";

const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;
const POLL_INTERVAL_MS = 250;
const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;
/**
 * Fail when the print page shows no progress for this long. Longer than the
 * slowest single in-page step (waiting up to 120s for swapped images), short
 * enough that a page that never hydrates does not hang the export.
 */
const STALL_TIMEOUT_MS = 180_000;
/** Images decoded/encoded at once; bounds memory for image-heavy decks. */
const IMAGE_CONCURRENCY = Math.max(2, Math.min(8, availableParallelism()));

export type DeckPdfPhase = "launching" | "loading" | "rendering" | "optimizing" | "printing";

export interface DeckPdfProgress {
  phase: DeckPdfPhase;
  current: number;
  total: number;
}

export interface RenderDeckPdfOptions {
  baseUrl: string;
  deck: string;
  /** 1-based selection such as "1-5,8"; every slide when omitted. */
  slides?: string;
  /**
   * Oversampling of images relative to their on-slide size (1-4). `null`
   * embeds the original image files unchanged.
   */
  imageScale?: number | null;
  jpegQuality?: number;
  /** Produce the PDF even when some slides failed to render. */
  allowErrors?: boolean;
  onProgress?: (progress: DeckPdfProgress) => void;
  signal?: AbortSignal;
  /** Overall limit for the page to become ready (default 20 minutes). */
  timeoutMs?: number;
  /** Fail when the page shows no progress for this long (default 180s). */
  stallTimeoutMs?: number;
  /** Injected for tests; defaults to launching headless Chromium. */
  launch?: () => Promise<Browser>;
}

export interface DeckPdfImageStats {
  /** Distinct image files re-encoded for the PDF. */
  optimized: number;
  /** Distinct image files embedded unchanged (already optimal). */
  unchanged: number;
  inputBytes: number;
  outputBytes: number;
}

export interface DeckPdfResult {
  pdf: Buffer;
  title: string;
  pages: number;
  durationMs: number;
  /** 1-based slide numbers that rendered an MDX error (only with allowErrors). */
  errorSlides: number[];
  images: DeckPdfImageStats;
  /** Viewer-compatibility notes for the author (the PDF itself is valid). */
  warnings: string[];
  /** Uncaught page errors observed while rendering (diagnostics only). */
  pageErrors: string[];
}

interface PrintStatus {
  state: PrintState | null;
  step: string | null;
  ready: number;
  total: number;
  images: number;
  errors: string | null;
  shadowPages: string | null;
  message: string | null;
}

/**
 * Evaluated as a plain string so no transpiler helper (tsx `__name`, SWC
 * helpers) can leak into the page.
 */
const PRINT_STATUS_EXPRESSION = `(() => {
  const root = document.querySelector("[data-print-deck]");
  if (!root) return null;
  return {
    state: root.getAttribute("data-print-state"),
    step: root.getAttribute("data-print-step"),
    ready: Number(root.getAttribute("data-print-ready") || 0),
    total: Number(root.getAttribute("data-print-total") || 0),
    images: Number(root.getAttribute("data-print-images") || 0),
    errors: root.getAttribute("data-print-errors"),
    shadowPages: root.getAttribute("data-print-shadow-pages"),
    message: root.getAttribute("data-print-message"),
  };
})()`;

/** Hide Next.js dev overlays so they can never end up in the printout. */
const HIDE_DEV_OVERLAY_CSS = "nextjs-portal { display: none !important; }";

export class DeckPdfError extends Error {
  constructor(message: string, readonly code: "not-found" | "render" | "slides" | "timeout") {
    super(message);
    this.name = "DeckPdfError";
  }
}

/** Run at most `concurrency` tasks at a time. */
function createLimiter(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return async function limit<T>(task: () => Promise<T>): Promise<T> {
    if (active >= concurrency) await new Promise<void>((resolve) => queue.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

function createAbortError(): Error {
  return new DOMException("PDF export aborted", "AbortError");
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(createAbortError());
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function buildPrintUrl(
  baseUrl: string,
  deck: string,
  options: { slides?: string; imageScale: number | null },
): string {
  const params = new URLSearchParams();
  if (options.slides) params.set("slides", options.slides);
  if (options.imageScale !== null) params.set("images", String(options.imageScale));
  const query = params.toString();
  return `${baseUrl.replace(/\/+$/, "")}/${encodeURIComponent(deck)}/print${query ? `?${query}` : ""}`;
}

export async function renderDeckPdf(options: RenderDeckPdfOptions): Promise<DeckPdfResult> {
  const startedAt = Date.now();
  const imageScale =
    options.imageScale === null ? null : normalizePdfImageScale(options.imageScale);
  const jpegQuality = Math.round(
    Math.min(100, Math.max(1, options.jpegQuality ?? DEFAULT_PDF_JPEG_QUALITY)),
  );
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const stallTimeoutMs = options.stallTimeoutMs ?? STALL_TIMEOUT_MS;
  const { signal, onProgress } = options;

  if (signal?.aborted) throw createAbortError();
  onProgress?.({ phase: "launching", current: 0, total: 0 });

  const browser = await (options.launch ?? launchChromium)();
  const closeOnAbort = () => {
    void browser.close().catch(() => {});
  };
  signal?.addEventListener("abort", closeOnAbort, { once: true });

  try {
    // The abort listener was attached after launch; catch an abort during it.
    if (signal?.aborted) throw createAbortError();
    const context = await browser.newContext({
      viewport: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();

    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      if (pageErrors.length < 20) pageErrors.push(error.message);
    });

    const imageStats: DeckPdfImageStats = { optimized: 0, unchanged: 0, inputBytes: 0, outputBytes: 0 };
    let imagesHandled = 0;
    let imagesTotal = 0;

    if (imageScale !== null) {
      const limit = createLimiter(IMAGE_CONCURRENCY);
      await page.route(
        (url) => url.searchParams.has(PDF_IMAGE_WIDTH_PARAM),
        (route: Route) => limit(async () => {
          const requestUrl = new URL(route.request().url());
          const width = Number.parseInt(requestUrl.searchParams.get(PDF_IMAGE_WIDTH_PARAM) ?? "0", 10);
          requestUrl.searchParams.delete(PDF_IMAGE_WIDTH_PARAM);
          try {
            const response = await route.fetch({ url: requestUrl.toString() });
            try {
              if (!response.ok()) {
                await route.fulfill({ response });
                return;
              }
              const input = await response.body();
              const optimized = await optimizeImageForPdf(input, {
                width: Number.isFinite(width) ? width : 0,
                jpegQuality,
              });
              imageStats.inputBytes += input.length;
              if (optimized) {
                imageStats.optimized++;
                imageStats.outputBytes += optimized.body.length;
                await route.fulfill({
                  status: 200,
                  body: optimized.body,
                  contentType: optimized.contentType,
                  headers: { "cache-control": "no-store" },
                });
              } else {
                imageStats.unchanged++;
                imageStats.outputBytes += input.length;
                await route.fulfill({ response, body: input });
              }
            } finally {
              // route.fetch() keeps every body in memory until the context
              // closes; for an image-heavy deck that is the whole asset folder.
              await response.dispose().catch(() => {});
            }
          } catch {
            // The browser or page is going away (abort) or the fetch failed:
            // let the request fall through to the network unmodified.
            await route.fallback({ url: requestUrl.toString() }).catch(() => {});
          } finally {
            imagesHandled++;
            if (imagesTotal > 0) {
              onProgress?.({ phase: "optimizing", current: Math.min(imagesHandled, imagesTotal), total: imagesTotal });
            }
          }
        }),
      );
    }

    onProgress?.({ phase: "loading", current: 0, total: 0 });
    const url = buildPrintUrl(options.baseUrl, options.deck, { slides: options.slides, imageScale });
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    if (!response) throw new DeckPdfError(`No response from ${url}`, "render");
    if (response.status() === 404) {
      throw new DeckPdfError(
        `Deck "${options.deck}" was not found, or the slide selection "${options.slides ?? ""}" is invalid`,
        "not-found",
      );
    }
    if (response.status() >= 400) {
      throw new DeckPdfError(`HTTP ${response.status()} for ${url}`, "render");
    }
    await page.addStyleTag({ content: HIDE_DEV_OVERLAY_CSS });

    // Poll the page's own readiness signal.
    const deadline = Date.now() + timeoutMs;
    let status: PrintStatus | null = null;
    let lastReported = "";
    let lastSignature = "";
    let lastProgressAt = Date.now();
    for (;;) {
      try {
        status = (await page.evaluate(PRINT_STATUS_EXPRESSION)) as PrintStatus | null;
      } catch (error) {
        // A dev-server reload can replace the execution context mid-poll.
        if (signal?.aborted) throw createAbortError();
        if (!/Execution context was destroyed|navigation/i.test(String(error))) throw error;
        status = null;
      }
      if (status?.state === "ready" || status?.state === "error") break;
      if (status) {
        if (status.state === "optimizing") {
          imagesTotal = status.images;
        } else if (status.total > 0) {
          const key = `rendering:${status.ready}/${status.total}`;
          if (key !== lastReported) {
            lastReported = key;
            onProgress?.({ phase: "rendering", current: status.ready, total: status.total });
          }
        }
      }
      const signature = `${JSON.stringify(status)}|${imagesHandled}`;
      if (signature !== lastSignature) {
        lastSignature = signature;
        lastProgressAt = Date.now();
      }
      const stalled = Date.now() - lastProgressAt > stallTimeoutMs;
      if (stalled || Date.now() > deadline) {
        const where = status
          ? `step "${status.step ?? status.state ?? "start"}", ${status.ready}/${status.total} slides loaded`
          : "the page never started rendering";
        const cause = pageErrors.length > 0 ? ` First page error: ${pageErrors[0]}` : "";
        throw new DeckPdfError(
          stalled
            ? `The print page stopped making progress for ${Math.round(stallTimeoutMs / 1000)}s (${where}).${cause}`
            : `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for the deck to render (${where}).${cause}`,
          "timeout",
        );
      }
      await sleep(POLL_INTERVAL_MS, signal);
    }

    if (status.state === "error") {
      throw new DeckPdfError(status.message || "The print page failed to render", "render");
    }

    const errorSlides = status.errors ? (JSON.parse(status.errors) as number[]) : [];
    if (errorSlides.length > 0 && !options.allowErrors) {
      throw new DeckPdfError(
        `MDX error on slide${errorSlides.length > 1 ? "s" : ""} ${errorSlides.join(", ")}. ` +
          `Fix them (pnpm amaroad doctor ${options.deck}), or export anyway with ` +
          `pnpm amaroad pdf ${options.deck} --allow-errors.`,
        "slides",
      );
    }

    const warnings: string[] = [];
    const shadowPages = status.shadowPages ? (JSON.parse(status.shadowPages) as number[]) : [];
    if (shadowPages.length > 0) {
      warnings.push(
        `${shadowPages.length > 1 ? "Slides" : "Slide"} ${shadowPages.join(", ")} ` +
          `${shadowPages.length > 1 ? "use" : "uses"} 4 or more blurred box-shadows; ` +
          `macOS Preview draws the later ones as gray boxes ` +
          `(poppler-based viewers render them correctly). Fewer or unblurred shadows avoid it.`,
      );
    }

    const title = (await page.title()) || options.deck;
    onProgress?.({ phase: "printing", current: 0, total: 0 });
    // Keep screen styles: the print page is laid out exactly like the viewer.
    await page.emulateMedia({ media: "screen" });
    const pdf = await page.pdf({
      width: `${SLIDE_WIDTH}px`,
      height: `${SLIDE_HEIGHT}px`,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      printBackground: true,
      preferCSSPageSize: true,
      tagged: true,
    });

    await context.close();
    return {
      pdf,
      title,
      pages: status.total,
      durationMs: Date.now() - startedAt,
      errorSlides,
      images: imageStats,
      warnings,
      pageErrors,
    };
  } catch (error) {
    if (signal?.aborted) throw createAbortError();
    throw error;
  } finally {
    signal?.removeEventListener("abort", closeOnAbort);
    await browser.close().catch(() => {});
  }
}
