import { getFontEmbedCSS, toCanvas } from "html-to-image";
import { jsPDF } from "jspdf";
import { SLIDE_WIDTH, SLIDE_HEIGHT } from "./slide-utils";

// ---------------------------------------------------------------------------
// Scheduling helpers
// ---------------------------------------------------------------------------

/**
 * Yield to the main thread using MessageChannel.
 * Unlike setTimeout(0), this is NOT throttled in background tabs.
 */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => {
      ch.port1.onmessage = null;
      ch.port1.close();
      ch.port2.close();
      resolve();
    };
    ch.port2.postMessage(undefined);
  });
}

function createAbortError(): Error {
  return new DOMException("The operation was aborted", "AbortError");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createAbortError();
}

function trimFontToken(token: string): string {
  return token.trim().replace(/^["']|["']$/g, "");
}

function collectFontLoadSpecs(container: HTMLElement): string[] {
  const specs = new Set<string>();
  const nodes = [container, ...Array.from(container.querySelectorAll("*"))];

  for (const node of nodes) {
    const font = getComputedStyle(node).font?.trim();
    if (font) specs.add(font);
  }

  return Array.from(specs);
}

function collectFontFamilies(container: HTMLElement): string[] {
  const families = new Set<string>();
  const nodes = [container, ...Array.from(container.querySelectorAll("*"))];

  for (const node of nodes) {
    const fontFamily = getComputedStyle(node).fontFamily;
    if (!fontFamily) continue;

    for (const token of fontFamily.split(",")) {
      const family = trimFontToken(token);
      if (family) families.add(family);
    }
  }

  return Array.from(families).sort();
}

function waitForSettledOrTimeout(
  tasks: Promise<unknown>[],
  timeoutMs: number,
): Promise<void> {
  return Promise.race([
    Promise.allSettled(tasks).then(() => undefined),
    new Promise<void>((resolve) => {
      setTimeout(resolve, timeoutMs);
    }),
  ]);
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function getMdxStatus(container: HTMLElement): string | null {
  return container.querySelector("[data-mdx-status]")?.getAttribute("data-mdx-status") ?? null;
}

export function waitForMdxReady(
  container: HTMLElement,
  timeoutMs = 15000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const status = getMdxStatus(container);
    if (status === "ready") return resolve();
    if (status === "error") return reject(new Error("MDX compilation failed"));

    const observer = new MutationObserver(() => {
      const s = getMdxStatus(container);
      if (s === "ready") {
        cleanup();
        resolve();
      } else if (s === "error") {
        cleanup();
        reject(new Error("MDX compilation failed"));
      }
    });

    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, timeoutMs);

    function cleanup(): void {
      observer.disconnect();
      clearTimeout(timer);
    }

    observer.observe(container, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-mdx-status"],
    });
  });
}

export function waitForImages(
  container: HTMLElement,
  timeoutMs = 10000,
): Promise<void> {
  return new Promise((resolve) => {
    const images = Array.from(container.querySelectorAll("img"));
    if (images.length === 0) return resolve();

    const pending = images.filter((img) => !img.complete);
    if (pending.length === 0) return resolve();

    let settled = 0;
    const total = pending.length;
    let finished = false;

    const cleanup = () => {
      clearTimeout(timer);
      for (const img of pending) {
        img.removeEventListener("load", onDone);
        img.removeEventListener("error", onDone);
      }
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve();
    };

    const onDone = () => {
      if (finished) return;
      settled++;
      if (settled >= total) {
        finish();
      }
    };

    const timer = setTimeout(finish, timeoutMs);

    for (const img of pending) {
      img.addEventListener("load", onDone);
      img.addEventListener("error", onDone);
    }
  });
}

export async function waitForFonts(
  container: HTMLElement,
  timeoutMs = 10000,
): Promise<void> {
  const fontFaceSet = document.fonts;
  if (!fontFaceSet) return;

  const tasks: Promise<unknown>[] = [fontFaceSet.ready];
  const fontSpecs = collectFontLoadSpecs(container);

  for (const font of fontSpecs) {
    tasks.push(fontFaceSet.load(font, "BESbswy あア亜"));
  }

  await waitForSettledOrTimeout(tasks, timeoutMs);
  await yieldToMain();
}

// ---------------------------------------------------------------------------
// Wait for DOM to stabilise (ResizeObserver, async re-renders, etc.)
// ---------------------------------------------------------------------------

/**
 * Resolves once no DOM mutations have occurred inside `container` for
 * `quietMs` consecutive milliseconds, or when `timeoutMs` elapses.
 *
 * This replaces fragile fixed delays — it adapts to actual rendering
 * activity regardless of slide complexity or machine speed.
 */
export function waitForDomStable(
  container: HTMLElement,
  quietMs = 200,
  timeoutMs = 5000,
): Promise<void> {
  return new Promise((resolve) => {
    let quietTimer: ReturnType<typeof setTimeout>;

    const settle = () => {
      observer.disconnect();
      clearTimeout(quietTimer);
      clearTimeout(deadline);
      resolve();
    };

    const resetQuietTimer = () => {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(settle, quietMs);
    };

    const observer = new MutationObserver(resetQuietTimer);

    const deadline = setTimeout(settle, timeoutMs);

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    // Kick off the quiet window — if the DOM is already stable we resolve
    // after quietMs without needing any mutation to fire first.
    resetQuietTimer();
  });
}

// ---------------------------------------------------------------------------
// Shared: wait until slide DOM is fully rendered and stable
// ---------------------------------------------------------------------------

async function waitForSlideReady(container: HTMLElement): Promise<void> {
  await waitForMdxReady(container);
  await waitForImages(container);
  await waitForFonts(container);
  await waitForDomStable(container);
  await waitForFonts(container, 3000);
}

// ---------------------------------------------------------------------------
// Image capture (JPEG data URL for each slide)
// ---------------------------------------------------------------------------

const CAPTURE_MIME_TYPE = "image/jpeg";
const CAPTURE_JPEG_QUALITY = 0.92;
const EMPTY_SLIDE_IMAGE = new Blob([], { type: CAPTURE_MIME_TYPE });

export type ExportedSlideImage = Blob;

function captureFilter(node: HTMLElement | SVGElement): boolean {
  return !(node instanceof HTMLIFrameElement || node instanceof HTMLVideoElement);
}

const CAPTURE_OPTIONS = {
  width: SLIDE_WIDTH,
  height: SLIDE_HEIGHT,
  pixelRatio: 1,
  quality: CAPTURE_JPEG_QUALITY,
  backgroundColor: "#FFFFFF",
  cacheBust: false,
  filter: captureFilter,
} as const;

const captureFontCssCache = new Map<string, Promise<string | null>>();

async function getCaptureFontEmbedCss(
  container: HTMLElement,
): Promise<string | null> {
  const families = collectFontFamilies(container);
  if (families.length === 0) return null;

  const cacheKey = families.join("|");
  const cached = captureFontCssCache.get(cacheKey);
  if (cached) return cached;

  const request = getFontEmbedCSS(container, {
    preferredFontFormat: "woff2",
  }).catch((error) => {
    console.warn("[amaroad] Failed to prepare embedded export fonts:", error);
    captureFontCssCache.delete(cacheKey);
    return null;
  });

  captureFontCssCache.set(cacheKey, request);
  return request;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Failed to convert slide blob to data URL"));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read slide blob"));
    reader.readAsDataURL(blob);
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to create slide export blob"));
        return;
      }
      resolve(blob);
    }, CAPTURE_MIME_TYPE, CAPTURE_JPEG_QUALITY);
  });
}

export async function captureSlide(container: HTMLElement): Promise<ExportedSlideImage> {
  await waitForSlideReady(container);
  const fontEmbedCSS = await getCaptureFontEmbedCss(container);
  const canvas = await toCanvas(
    container,
    fontEmbedCSS
      ? {
        ...CAPTURE_OPTIONS,
        fontEmbedCSS,
      }
      : CAPTURE_OPTIONS,
  );
  try {
    return await canvasToJpegBlob(canvas);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

// ---------------------------------------------------------------------------
// PDF output
// ---------------------------------------------------------------------------

/** Batch size for yielding to main thread during PDF/PPTX generation */
const GENERATION_BATCH_SIZE = 5;

export interface ExportSaveOptions {
  onProgress?: (current: number, total: number) => void;
  signal?: AbortSignal;
}

export async function savePdf(
  deckName: string,
  images: ExportedSlideImage[],
  options?: ExportSaveOptions,
): Promise<void> {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [SLIDE_WIDTH, SLIDE_HEIGHT],
    hotfixes: ["px_scaling"],
  });

  for (let i = 0; i < images.length; i++) {
    throwIfAborted(options?.signal);

    if (i > 0) pdf.addPage([SLIDE_WIDTH, SLIDE_HEIGHT], "landscape");

    const image = images[i];
    const imageDataUrl = await blobToDataUrl(image);
    pdf.addImage(imageDataUrl, "JPEG", 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);
    images[i] = EMPTY_SLIDE_IMAGE;
    options?.onProgress?.(i + 1, images.length);

    if ((i + 1) % GENERATION_BATCH_SIZE === 0) {
      await yieldToMain();
      throwIfAborted(options?.signal);
    }
  }

  await yieldToMain();
  throwIfAborted(options?.signal);
  await pdf.save(`${deckName}.pdf`, { returnPromise: true });
}

// ---------------------------------------------------------------------------
// PPTX output (image-based)
// ---------------------------------------------------------------------------

export async function savePptx(
  deckName: string,
  images: ExportedSlideImage[],
  options?: ExportSaveOptions,
): Promise<void> {
  throwIfAborted(options?.signal);

  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";

  for (let i = 0; i < images.length; i++) {
    throwIfAborted(options?.signal);

    const image = images[i];
    const dataUrl = await blobToDataUrl(image);
    const slide = pptx.addSlide();
    slide.addImage({ data: dataUrl, x: 0, y: 0, w: "100%", h: "100%" });
    images[i] = EMPTY_SLIDE_IMAGE;
    options?.onProgress?.(i + 1, images.length);

    if ((i + 1) % GENERATION_BATCH_SIZE === 0) {
      await yieldToMain();
      throwIfAborted(options?.signal);
    }
  }

  throwIfAborted(options?.signal);
  await pptx.writeFile({ fileName: `${deckName}.pptx` });
}
