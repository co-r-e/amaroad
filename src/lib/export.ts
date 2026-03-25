import { toSvg } from "html-to-image";
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
  await waitForDomStable(container);
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
  skipFonts: true,
  filter: captureFilter,
} as const;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
    };

    img.onload = async () => {
      try {
        if (typeof img.decode === "function") {
          await img.decode().catch(() => undefined);
        }
        cleanup();
        resolve(img);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    img.onerror = () => {
      cleanup();
      reject(new Error("Failed to decode slide image"));
    };

    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = url;
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

async function renderSvgToJpegBlob(svgDataUrl: string): Promise<Blob> {
  const image = await loadImage(svgDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = SLIDE_WIDTH;
  canvas.height = SLIDE_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create export canvas context");

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);
  ctx.drawImage(image, 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);

  try {
    return await canvasToJpegBlob(canvas);
  } finally {
    ctx.clearRect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);
    canvas.width = 0;
    canvas.height = 0;
  }
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

export async function captureSlide(container: HTMLElement): Promise<ExportedSlideImage> {
  await waitForSlideReady(container);
  const svgDataUrl = await toSvg(container, CAPTURE_OPTIONS);
  return renderSvgToJpegBlob(svgDataUrl);
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
    const imageBytes = new Uint8Array(await image.arrayBuffer());
    pdf.addImage(imageBytes, "JPEG", 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);
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
