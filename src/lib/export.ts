import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { SLIDE_WIDTH, SLIDE_HEIGHT } from "./slide-utils";
import type { DeckConfig, SlideType } from "@/types/deck";

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
// Image capture (used by PDF and image-PPTX)
// ---------------------------------------------------------------------------

export async function captureSlide(container: HTMLElement): Promise<string> {
  await waitForSlideReady(container);

  return toPng(container, {
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
    pixelRatio: 1,
    cacheBust: true,
    filter: (node) => {
      if (node instanceof HTMLIFrameElement) return false;
      if (node instanceof HTMLVideoElement) return false;
      return true;
    },
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
    pdf.addImage(images[i], "PNG", 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);
  }

  pdf.save(`${deckName}.pdf`);
}

// ---------------------------------------------------------------------------
// Image-based PPTX output
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

// ---------------------------------------------------------------------------
// Native (editable) PPTX output
// ---------------------------------------------------------------------------

/** PPTX slide dimensions in inches (LAYOUT_WIDE = 13.33 x 7.5). */
const PPTX_WIDTH = 13.33;
const PPTX_HEIGHT = 7.5;
const PPTX_MARGIN = 0.7;
const PPTX_CONTENT_W = PPTX_WIDTH - PPTX_MARGIN * 2;

/** A styled text run for pptxgenjs addText() */
interface TextRun {
  text: string;
  options?: {
    bold?: boolean;
    italic?: boolean;
    fontFace?: string;
    color?: string;
    fontSize?: number;
    underline?: { style: "sng" };
    breakLine?: true;
    bullet?: boolean | { type: "number" };
    paraSpaceBefore?: number;
  };
}

type NativeElement =
  | { type: "heading"; level: 1 | 2 | 3; runs: TextRun[] }
  | { type: "paragraph"; runs: TextRun[] }
  | { type: "list"; ordered: boolean; items: TextRun[][] }
  | { type: "blockquote"; runs: TextRun[] }
  | { type: "code"; text: string }
  | { type: "image"; dataUrl: string }
  | { type: "table"; rows: string[][]; headerRowCount: number }
  | { type: "hr" };

export interface NativeSlideContent {
  elements: NativeElement[];
  background: string;
  slideIndex: number;
  slideType: SlideType;
}

export async function extractSlideContent(
  container: HTMLElement,
  background: string,
  slideIndex: number,
  slideType: SlideType,
): Promise<NativeSlideContent> {
  await waitForSlideReady(container);

  const elements: NativeElement[] = [];
  const mdxRoot = container.querySelector("[data-mdx-status]");
  if (mdxRoot) {
    walkDOM(mdxRoot, elements);
  }

  for (const el of elements) {
    if (el.type === "image" && el.dataUrl && !el.dataUrl.startsWith("data:")) {
      el.dataUrl = await imgToDataUrl(el.dataUrl);
    }
  }

  return { elements, background, slideIndex, slideType };
}

// ---------------------------------------------------------------------------
// DOM walking: extract styled text runs preserving bold/italic/code
// ---------------------------------------------------------------------------

function extractTextRuns(node: Node): TextRun[] {
  const runs: TextRun[] = [];

  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? "";
      if (text) runs.push({ text });
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const el = child as HTMLElement;
    switch (el.tagName) {
      case "STRONG":
      case "B":
        for (const run of extractTextRuns(el)) {
          runs.push({ text: run.text, options: { ...run.options, bold: true } });
        }
        break;
      case "EM":
      case "I":
        for (const run of extractTextRuns(el)) {
          runs.push({ text: run.text, options: { ...run.options, italic: true } });
        }
        break;
      case "CODE":
        runs.push({ text: el.textContent ?? "", options: { fontFace: "Courier New" } });
        break;
      case "A":
        runs.push({ text: el.textContent ?? "", options: { underline: { style: "sng" } } });
        break;
      case "BR":
        runs.push({ text: "\n" });
        break;
      default:
        runs.push(...extractTextRuns(el));
        break;
    }
  }

  return runs;
}

function hasTextContent(runs: TextRun[]): boolean {
  return runs.some((r) => r.text.trim().length > 0);
}

function walkDOM(node: Element, elements: NativeElement[]): void {
  for (const child of Array.from(node.children)) {
    const tag = child.tagName;

    if (tag === "H1" || tag === "H2" || tag === "H3") {
      const runs = extractTextRuns(child);
      if (hasTextContent(runs)) {
        elements.push({ type: "heading", level: parseInt(tag[1]) as 1 | 2 | 3, runs });
      }
    } else if (tag === "P") {
      // Check for images inside paragraphs
      const imgs = child.querySelectorAll("img");
      if (imgs.length > 0) {
        for (const img of Array.from(imgs)) {
          if (img.src) elements.push({ type: "image", dataUrl: img.src });
        }
      }
      const runs = extractTextRuns(child);
      if (hasTextContent(runs)) {
        elements.push({ type: "paragraph", runs });
      }
    } else if (tag === "UL" || tag === "OL") {
      const items: TextRun[][] = [];
      for (const li of Array.from(child.querySelectorAll(":scope > li"))) {
        const runs = extractTextRuns(li);
        if (hasTextContent(runs)) items.push(runs);
      }
      if (items.length) {
        elements.push({ type: "list", ordered: tag === "OL", items });
      }
    } else if (tag === "BLOCKQUOTE") {
      const runs = extractTextRuns(child);
      if (hasTextContent(runs)) elements.push({ type: "blockquote", runs });
    } else if (tag === "PRE") {
      const text = child.textContent?.trim() ?? "";
      if (text) elements.push({ type: "code", text });
    } else if (tag === "IMG") {
      const src = (child as HTMLImageElement).src;
      if (src) elements.push({ type: "image", dataUrl: src });
    } else if (tag === "TABLE") {
      const tableEl = extractTable(child);
      if (tableEl) elements.push(tableEl);
    } else if (tag === "HR") {
      elements.push({ type: "hr" });
    } else {
      // Recurse into wrapper divs (Columns, Fragment, etc.)
      walkDOM(child, elements);
    }
  }
}

function extractRowCells(tr: Element): string[] {
  return Array.from(tr.querySelectorAll("td, th"), (cell) => cell.textContent?.trim() ?? "");
}

function extractTable(table: Element): NativeElement | null {
  const theadRows = Array.from(table.querySelectorAll("thead tr"));
  const tbodyRows = Array.from(table.querySelectorAll("tbody tr"));

  let headerRowCount = theadRows.length;
  let allRows = [...theadRows, ...tbodyRows].map(extractRowCells);

  // Fallback: if no thead/tbody, extract all <tr> directly
  if (allRows.length === 0) {
    const directRows = Array.from(table.querySelectorAll("tr"));
    allRows = directRows.map(extractRowCells);
    headerRowCount = directRows[0]?.querySelector("th") ? 1 : 0;
  }

  if (allRows.length === 0) return null;
  return { type: "table", rows: allRows, headerRowCount };
}

async function imgToDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn(`[nipry] Failed to convert image to data URL: ${url}`, err);
    return "";
  }
}

/** Strip `#` prefix for pptxgenjs color values. */
function stripHash(hex: string): string {
  return hex.replace("#", "");
}

type PptxAlign = "left" | "center" | "right";
type PptxPos = { x: number; y: number };

function resolveAlignment(position: string): PptxAlign {
  if (position.includes("right")) return "right";
  if (position.includes("center")) return "center";
  return "left";
}

function getAlignOffset(align: PptxAlign, rightOffset: number, centerOffset: number): number {
  if (align === "right") return rightOffset;
  if (align === "center") return centerOffset;
  return 0;
}

function resolveOverlayPosition(position: string, isFooter: boolean): PptxPos {
  const top = 0.3;
  const bottom = PPTX_HEIGHT - 0.5;
  const left = 0.4;
  const right = PPTX_WIDTH - 0.4;
  const center = PPTX_WIDTH / 2;

  switch (position) {
    case "top-left": return { x: left, y: top };
    case "top-center": return { x: center, y: top };
    case "top-right": return { x: right, y: top };
    case "bottom-left": return { x: left, y: bottom };
    case "bottom-center": return { x: center, y: bottom };
    case "bottom-right": return { x: right, y: bottom };
    default: return { x: isFooter ? left : right, y: isFooter ? bottom : top };
  }
}

export async function saveNativePptx(
  deckName: string,
  slides: NativeSlideContent[],
  config: DeckConfig,
): Promise<void> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";

  const primary = stripHash(config.theme.colors.primary);
  const textColor = stripHash(config.theme.colors.text ?? "#1a1a1a");
  const headingFont = config.theme.fonts?.heading ?? "Arial";
  const bodyFont = config.theme.fonts?.body ?? "Arial";

  let logoDataUrl = "";
  if (config.logo) {
    const src = config.logo.src;
    if (src.startsWith("data:")) {
      logoDataUrl = src;
    } else {
      const logoUrl = src.startsWith("http") || src.startsWith("/")
        ? src
        : `/api/decks/${encodeURIComponent(deckName)}/assets/${src}`;
      logoDataUrl = await imgToDataUrl(logoUrl);
    }
  }

  for (const slideData of slides) {
    const slide = pptx.addSlide();
    slide.background = { color: stripHash(slideData.background) };

    let y = PPTX_MARGIN;

    for (const el of slideData.elements) {
      if (y > PPTX_HEIGHT - PPTX_MARGIN) break;

      switch (el.type) {
        case "heading": {
          const fontSizeByLevel = { 1: 36, 2: 28, 3: 22 } as const;
          const spacingByLevel = { 1: 0.9, 2: 0.7, 3: 0.6 } as const;
          const fontSize = fontSizeByLevel[el.level];
          const spacing = spacingByLevel[el.level];
          const runs = applyRunDefaults(el.runs, {
            fontSize,
            fontFace: headingFont,
            bold: true,
            color: primary,
          });
          slide.addText(runs, { x: PPTX_MARGIN, y, w: PPTX_CONTENT_W });
          y += spacing;
          break;
        }
        case "paragraph": {
          const runs = applyRunDefaults(el.runs, {
            fontSize: 18,
            fontFace: bodyFont,
            color: textColor,
          });
          slide.addText(runs, { x: PPTX_MARGIN, y, w: PPTX_CONTENT_W });
          y += 0.5;
          break;
        }
        case "list": {
          const listRuns: TextRun[] = [];
          const bulletOpt = el.ordered ? { type: "number" as const } : true;
          for (const itemRuns of el.items) {
            const styled = applyRunDefaults(itemRuns, {
              fontSize: 18,
              fontFace: bodyFont,
              color: textColor,
            });
            // bullet on first run only, breakLine on last run only
            for (let r = 0; r < styled.length; r++) {
              if (r === 0) {
                styled[r].options = { ...styled[r].options, bullet: bulletOpt, paraSpaceBefore: 4 };
              }
              if (r === styled.length - 1) {
                styled[r].options = { ...styled[r].options, breakLine: true as const };
              }
            }
            listRuns.push(...styled);
          }
          slide.addText(listRuns, { x: PPTX_MARGIN + 0.3, y, w: PPTX_CONTENT_W - 0.3 });
          y += el.items.length * 0.35 + 0.15;
          break;
        }
        case "blockquote": {
          slide.addShape(pptx.ShapeType.rect, {
            x: PPTX_MARGIN,
            y,
            w: 0.06,
            h: 0.5,
            fill: { color: "CCCCCC" },
          });
          const runs = applyRunDefaults(el.runs, {
            fontSize: 18,
            fontFace: bodyFont,
            color: "666666",
            italic: true,
          });
          slide.addText(runs, { x: PPTX_MARGIN + 0.2, y, w: PPTX_CONTENT_W - 0.2 });
          y += 0.6;
          break;
        }
        case "code": {
          slide.addText(el.text, {
            x: PPTX_MARGIN,
            y,
            w: PPTX_CONTENT_W,
            fontSize: 14,
            fontFace: "Courier New",
            color: textColor,
            fill: { color: "F5F5F5" },
            paraSpaceBefore: 6,
            paraSpaceAfter: 6,
          });
          const lines = el.text.split("\n").length;
          y += Math.max(0.5, lines * 0.22 + 0.15);
          break;
        }
        case "image": {
          if (el.dataUrl) {
            slide.addImage({
              data: el.dataUrl,
              x: PPTX_MARGIN,
              y,
              w: Math.min(PPTX_CONTENT_W, 8),
              h: 3,
            });
            y += 3.2;
          }
          break;
        }
        case "table": {
          const pptxRows: { text: string; options?: Record<string, unknown> }[][] = [];
          for (let i = 0; i < el.rows.length; i++) {
            const isHeader = i < el.headerRowCount;
            pptxRows.push(
              el.rows[i].map((cell) => ({
                text: cell,
                options: isHeader
                  ? { bold: true, fill: { color: "F0F0F0" }, fontSize: 14 }
                  : { fontSize: 14 },
              })),
            );
          }
          if (pptxRows.length) {
            slide.addTable(pptxRows, {
              x: PPTX_MARGIN,
              y,
              w: PPTX_CONTENT_W,
              fontFace: bodyFont,
              color: textColor,
              border: { type: "solid", pt: 1, color: "DDDDDD" },
            });
            y += pptxRows.length * 0.35 + 0.2;
          }
          break;
        }
        case "hr": {
          slide.addShape(pptx.ShapeType.line, {
            x: PPTX_MARGIN,
            y: y + 0.1,
            w: PPTX_CONTENT_W,
            h: 0,
            line: { color: "DDDDDD", width: 1 },
          });
          y += 0.3;
          break;
        }
      }
    }

    // Overlay: logo
    if (config.logo && logoDataUrl) {
      const pos = resolveOverlayPosition(config.logo.position, false);
      const xOffset = config.logo.position.includes("right") ? -1.5 : 0;
      slide.addImage({
        data: logoDataUrl,
        x: pos.x + xOffset,
        y: pos.y,
        w: 2,
        h: 0.5,
      });
    }

    // Overlay: copyright
    if (config.copyright) {
      const pos = resolveOverlayPosition(config.copyright.position, true);
      const align = resolveAlignment(config.copyright.position);
      const xOffset = getAlignOffset(align, 3, 1.5);
      slide.addText(config.copyright.text, {
        x: pos.x - xOffset,
        y: pos.y,
        w: 3,
        fontSize: 10,
        color: "999999",
        align,
      });
    }

    // Overlay: page number
    if (config.pageNumber) {
      const isHiddenCover =
        config.pageNumber.hideOnCover !== false && slideData.slideType === "cover";
      if (!isHiddenCover) {
        const pos = resolveOverlayPosition(config.pageNumber.position, true);
        const pageNum = slideData.slideIndex + (config.pageNumber.startFrom ?? 1);
        const align = resolveAlignment(config.pageNumber.position);
        const xOffset = getAlignOffset(align, 1, 0.5);
        slide.addText(String(pageNum), {
          x: pos.x - xOffset,
          y: pos.y,
          w: 1,
          fontSize: 10,
          color: "999999",
          align,
        });
      }
    }
  }

  await pptx.writeFile({ fileName: `${deckName}.pptx` });
}

/** Apply default styling to text runs, preserving any run-specific overrides. */
function applyRunDefaults(
  runs: TextRun[],
  defaults: NonNullable<TextRun["options"]>,
): TextRun[] {
  return runs.map((run) => ({
    text: run.text,
    options: { ...defaults, ...run.options },
  }));
}
