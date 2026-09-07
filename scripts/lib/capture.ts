/**
 * Real-render slide capture: screenshots the native single-slide route with
 * Playwright. Replaces the old `/api/capture` Satori approximation.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import type { Browser, Page } from "playwright";
import {
  createSlideContext,
  ensureServer,
  fetchDeckData,
  launchBrowser,
  openNativeSlide,
  NATIVE_STAGE_SELECTOR,
  resolveBaseUrl,
} from "./browser";

export interface CaptureOptions {
  deck: string;
  baseUrl?: string;
  /** Raster scale relative to 1920x1080 (1 = native). */
  scale?: number;
}

export interface CaptureOneOptions extends CaptureOptions {
  index: number;
  output: string;
}

export interface CaptureAllOptions extends CaptureOptions {
  outDir: string;
  /** Optional subset of slide indexes. */
  indexes?: number[];
  onProgress?: (info: { index: number; total: number; file: string; output: string }) => void;
}

export interface CaptureResult {
  index: number;
  file: string;
  output: string;
  width: number;
  height: number;
}

async function screenshotStage(page: Page, output: string): Promise<{ width: number; height: number }> {
  const rect = await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  }, NATIVE_STAGE_SELECTOR);

  if (!rect || rect.width === 0 || rect.height === 0) {
    throw new Error(`Slide stage ${NATIVE_STAGE_SELECTOR} not found on page`);
  }

  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });

  // Compositor-side clip capture: element.screenshot() can duplicate
  // absolutely positioned children when the stage carries a transform.
  await page.screenshot({
    path: output,
    clip: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    type: "png",
    animations: "disabled",
  });

  return { width: Math.round(rect.width), height: Math.round(rect.height) };
}

async function withBrowser<T>(fn: (browser: Browser) => Promise<T>): Promise<T> {
  const browser = await launchBrowser();
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

export async function captureSlide(options: CaptureOneOptions): Promise<CaptureResult> {
  const baseUrl = resolveBaseUrl(options.baseUrl);
  await ensureServer(baseUrl);
  const deck = await fetchDeckData(baseUrl, options.deck);
  const slide = deck.slides[options.index];
  if (!slide) {
    throw new Error(
      `Slide index ${options.index} is out of range for "${options.deck}" (${deck.slides.length} slides)`,
    );
  }
  const scale = options.scale ?? 1;

  return withBrowser(async (browser) => {
    const context = await createSlideContext(browser, scale);
    const page = await context.newPage();
    const ready = await openNativeSlide(page, baseUrl, {
      deck: options.deck,
      index: options.index,
      scale,
    });
    if (ready.status !== "ready") {
      throw new Error(`Slide ${options.index} did not render: ${ready.message ?? ready.status}`);
    }
    const size = await screenshotStage(page, options.output);
    await context.close();
    return {
      index: options.index,
      file: slide.filename,
      output: path.resolve(options.output),
      ...size,
    };
  });
}

export async function captureAllSlides(options: CaptureAllOptions): Promise<CaptureResult[]> {
  const baseUrl = resolveBaseUrl(options.baseUrl);
  await ensureServer(baseUrl);
  const deck = await fetchDeckData(baseUrl, options.deck);
  const scale = options.scale ?? 1;
  const indexes = options.indexes ?? deck.slides.map((s) => s.index);
  const width = String(deck.slides.length).length;

  return withBrowser(async (browser) => {
    const context = await createSlideContext(browser, scale);
    const page = await context.newPage();
    const results: CaptureResult[] = [];

    for (const index of indexes) {
      const slide = deck.slides[index];
      if (!slide) continue;
      const base = slide.filename.replace(/\.mdx$/i, "");
      const output = path.join(options.outDir, `${String(index + 1).padStart(width, "0")}-${base}.png`);
      const ready = await openNativeSlide(page, baseUrl, { deck: options.deck, index, scale });
      if (ready.status !== "ready") {
        throw new Error(`Slide ${index} (${slide.filename}) did not render: ${ready.message ?? ready.status}`);
      }
      const size = await screenshotStage(page, output);
      results.push({ index, file: slide.filename, output: path.resolve(output), ...size });
      options.onProgress?.({ index, total: deck.slides.length, file: slide.filename, output });
    }

    await context.close();
    return results;
  });
}
