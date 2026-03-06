import { toJpeg } from "html-to-image";
import { jsPDF } from "jspdf";
import { SLIDE_WIDTH, SLIDE_HEIGHT } from "./slide-utils";

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

    const timer = setTimeout(() => resolve(), timeoutMs);

    const onDone = () => {
      settled++;
      if (settled >= total) {
        clearTimeout(timer);
        resolve();
      }
    };

    for (const img of pending) {
      img.addEventListener("load", onDone, { once: true });
      img.addEventListener("error", onDone, { once: true });
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

const CAPTURE_JPEG_QUALITY = 0.92;

export async function captureSlide(container: HTMLElement): Promise<string> {
  await waitForSlideReady(container);

  return toJpeg(container, {
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
    pixelRatio: 1,
    quality: CAPTURE_JPEG_QUALITY,
    backgroundColor: "#FFFFFF",
    cacheBust: true,
    filter: (node) =>
      !(node instanceof HTMLIFrameElement || node instanceof HTMLVideoElement),
  });
}

// ---------------------------------------------------------------------------
// PDF output
// ---------------------------------------------------------------------------

export function savePdf(deckName: string, images: string[]): void {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [SLIDE_WIDTH, SLIDE_HEIGHT],
    hotfixes: ["px_scaling"],
  });

  for (let i = 0; i < images.length; i++) {
    if (i > 0) pdf.addPage([SLIDE_WIDTH, SLIDE_HEIGHT], "landscape");
    pdf.addImage(images[i], "JPEG", 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);
  }

  pdf.save(`${deckName}.pdf`);
}

// ---------------------------------------------------------------------------
// PPTX output (image-based)
// ---------------------------------------------------------------------------

export async function savePptx(deckName: string, images: string[]): Promise<void> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";

  for (const dataUrl of images) {
    const slide = pptx.addSlide();
    slide.addImage({ data: dataUrl, x: 0, y: 0, w: "100%", h: "100%" });
  }

  await pptx.writeFile({ fileName: `${deckName}.pptx` });
}
