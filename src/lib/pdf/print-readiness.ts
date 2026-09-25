/**
 * Browser-side preparation of the `/[deck]/print` page for vector PDF output.
 *
 * Every selected slide is mounted at once, so "ready" means: every slide's MDX
 * module has loaded (or failed), images are decoded, web-font subsets used by
 * any slide are loaded, and the DOM has gone quiet. Progress and the outcome
 * are published as data attributes on the root element so a headless renderer
 * can poll them with a plain string expression.
 *
 * When an image scale is given, raster `<img>` sources are then swapped for
 * right-sized copies (see PDF_IMAGE_WIDTH_PARAM). The new width is never
 * smaller than the image's laid-out size, so layout cannot change.
 */
import { waitForDomStable, waitForFonts, waitForImages, yieldToMain } from "@/lib/export";
import { PDF_IMAGE_WIDTH_PARAM, type PrintState } from "./shared";

export interface PreparePrintOptions {
  /** Number of slide stages mounted under the root. */
  expected: number;
  /** Oversampling relative to on-slide size; `null` leaves images untouched. */
  imageScale: number | null;
  signal: AbortSignal;
  /** Fail when no further slide finishes loading for this long. */
  idleTimeoutMs?: number;
}

const STAGE_SELECTOR = "[data-print-page]";
const MDX_STATUS_SELECTOR = "[data-mdx-status]";
const MDX_ERROR_SELECTOR = "[data-mdx-error]";

function setState(root: HTMLElement, state: PrintState, message?: string): void {
  root.setAttribute("data-print-state", state);
  if (message) root.setAttribute("data-print-message", message);
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException("Print preparation aborted", "AbortError");
}

/** Publish the current preparation step (diagnostics and stall detection). */
function setStep(root: HTMLElement, step: string): void {
  root.setAttribute("data-print-step", step);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Grace period after the last embed loaded, for players that paint late. */
const EMBED_SETTLE_MS = 1_000;

/**
 * Watch `<iframe>` (YouTube/Vimeo embeds) and `<video>` elements from the
 * moment they are inserted, so their load can be awaited before printing.
 * Without this a player prints as an empty box when its document or first
 * frame arrives after the slides themselves are ready.
 */
function trackEmbeds(root: HTMLElement) {
  const pending = new Map<Element, Promise<void>>();

  const watch = (el: Element) => {
    if (pending.has(el)) return;
    if (el instanceof HTMLIFrameElement) {
      if (el.loading === "lazy") el.loading = "eager";
      pending.set(
        el,
        new Promise((resolve) => {
          el.addEventListener("load", () => resolve(), { once: true });
          el.addEventListener("error", () => resolve(), { once: true });
        }),
      );
    } else if (el instanceof HTMLVideoElement) {
      // HAVE_CURRENT_DATA: a frame is available to paint.
      if (el.readyState >= 2 || el.error) {
        pending.set(el, Promise.resolve());
        return;
      }
      if (el.preload !== "auto") el.preload = "auto";
      pending.set(
        el,
        new Promise((resolve) => {
          el.addEventListener("loadeddata", () => resolve(), { once: true });
          el.addEventListener("error", () => resolve(), { once: true });
        }),
      );
    }
  };

  const scan = (node: ParentNode) => {
    for (const el of node.querySelectorAll("iframe, video")) watch(el);
  };
  scan(root);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches("iframe, video")) watch(node);
        scan(node);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });

  return {
    stop: () => observer.disconnect(),
    /** Wait for every embed seen so far, but never longer than `timeoutMs`. */
    settle: async (timeoutMs: number) => {
      observer.disconnect();
      if (pending.size === 0) return;
      await Promise.race([Promise.allSettled(pending.values()), delay(timeoutMs)]);
      await delay(EMBED_SETTLE_MS);
    },
  };
}

interface MdxTally {
  settled: number;
  errorPages: number[];
}

function tallyMdx(root: HTMLElement): MdxTally {
  let settled = 0;
  const errorPages: number[] = [];
  for (const stage of root.querySelectorAll<HTMLElement>(STAGE_SELECTOR)) {
    const status = stage.querySelector(MDX_STATUS_SELECTOR)?.getAttribute("data-mdx-status");
    if (status !== "ready" && status !== "error") continue;
    settled++;
    if (status === "error" || stage.querySelector(MDX_ERROR_SELECTOR)) {
      errorPages.push(Number(stage.getAttribute("data-print-page")));
    }
  }
  return { settled, errorPages };
}

/**
 * Resolve once every stage's MDX module is ready or failed. Rejects when no
 * stage settles for `idleTimeoutMs` (a stuck compile or a broken server).
 */
function waitForAllMdx(
  root: HTMLElement,
  expected: number,
  idleTimeoutMs: number,
  signal: AbortSignal,
): Promise<MdxTally> {
  return new Promise((resolve, reject) => {
    let lastSettled = -1;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (fn: () => void) => {
      observer.disconnect();
      if (idleTimer) clearTimeout(idleTimer);
      signal.removeEventListener("abort", onAbort);
      fn();
    };

    const onAbort = () =>
      finish(() => reject(new DOMException("Print preparation aborted", "AbortError")));

    const armIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        const { settled } = tallyMdx(root);
        finish(() =>
          reject(
            new Error(
              `Timed out: ${settled}/${expected} slides finished loading and none progressed for ${Math.round(idleTimeoutMs / 1000)}s`,
            ),
          ),
        );
      }, idleTimeoutMs);
    };

    const check = () => {
      const tally = tallyMdx(root);
      if (tally.settled !== lastSettled) {
        lastSettled = tally.settled;
        root.setAttribute("data-print-ready", String(tally.settled));
        armIdleTimer();
      }
      if (tally.settled >= expected) finish(() => resolve(tally));
    };

    const observer = new MutationObserver(check);
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-mdx-status"],
    });
    signal.addEventListener("abort", onAbort, { once: true });
    check();
  });
}

interface ImagePlan {
  natural: { width: number; height: number };
  /** Largest ratio of laid-out (or painted) size to natural size. */
  factor: number;
  elements: HTMLImageElement[];
}

function isRasterCandidate(img: HTMLImageElement): URL | null {
  const src = img.currentSrc || img.src;
  if (!src) return null;
  let url: URL;
  try {
    url = new URL(src, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  if (/\.svg$/i.test(url.pathname)) return null;
  if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) return null;
  return url;
}

/**
 * Swap each same-origin raster `<img>` for a copy sized to
 * `max(laid-out size, painted size) * scale`, capped at its natural size.
 * Returns the number of distinct image URLs that were swapped.
 */
export async function swapImagesForPrint(root: HTMLElement, scale: number): Promise<number> {
  const plans = new Map<string, ImagePlan>();

  for (const img of root.querySelectorAll("img")) {
    const url = isRasterCandidate(img);
    if (!url) continue;
    const rect = img.getBoundingClientRect();
    // offsetWidth/Height are the untransformed layout box; the rect is what is
    // painted (after transforms). Taking the max keeps both layout and pixels.
    const width = Math.max(img.offsetWidth, rect.width);
    const height = Math.max(img.offsetHeight, rect.height);
    if (width === 0 || height === 0) continue;

    const natural = { width: img.naturalWidth, height: img.naturalHeight };
    const factor = Math.max(width / natural.width, height / natural.height);
    const key = url.href;
    const plan = plans.get(key);
    if (plan) {
      plan.factor = Math.max(plan.factor, factor);
      plan.elements.push(img);
    } else {
      plans.set(key, { natural, factor, elements: [img] });
    }
  }

  for (const [href, plan] of plans) {
    const ratio = Math.min(1, plan.factor * scale);
    const targetWidth = Math.max(1, Math.min(plan.natural.width, Math.ceil(plan.natural.width * ratio)));
    const url = new URL(href);
    url.searchParams.set(PDF_IMAGE_WIDTH_PARAM, String(targetWidth));
    for (const img of plan.elements) {
      img.removeAttribute("srcset");
      img.src = url.href;
    }
  }

  return plans.size;
}

// ---------------------------------------------------------------------------
// background-clip: text
// ---------------------------------------------------------------------------
//
// Chromium prints `background-clip: text` (used by every slide h1 for the
// heading gradient) as a soft-mask composite that PDF viewers disagree on:
// Preview/PDFKit paints the element's box as a solid block and poppler draws
// hairlines along it. Before printing, such text is rewritten to plain fill
// colors: a solid background becomes the text color, and a gradient is sampled
// once per character so the text keeps its color ramp.

type Rgba = [number, number, number, number];

interface GradientStop {
  color: Rgba;
  /** 0..1 along the gradient line; null until distributed. */
  position: number | null;
}

interface ParsedGradient {
  /** CSS angle in degrees (0 = to top, 90 = to right). */
  angle: number;
  stops: GradientStop[];
}

let colorProbe: CanvasRenderingContext2D | null = null;

/** Resolve any CSS color string to RGBA through a 1x1 canvas. */
function resolveColor(css: string): Rgba | null {
  if (!colorProbe) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    colorProbe = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (!colorProbe) return null;
  colorProbe.clearRect(0, 0, 1, 1);
  colorProbe.fillStyle = "#00000000";
  colorProbe.fillStyle = css;
  colorProbe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = colorProbe.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
}

function toCssColor([r, g, b, a]: Rgba): string {
  return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

/** Split on commas that are not inside parentheses. */
function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const SIDE_ANGLES: Record<string, number> = {
  top: 0,
  "top right": 45,
  "right top": 45,
  right: 90,
  "bottom right": 135,
  "right bottom": 135,
  bottom: 180,
  "bottom left": 225,
  "left bottom": 225,
  left: 270,
  "top left": 315,
  "left top": 315,
};

function parseAngle(token: string): number | null {
  const side = /^to\s+(.+)$/i.exec(token);
  if (side) return SIDE_ANGLES[side[1].trim().toLowerCase().replace(/\s+/g, " ")] ?? null;
  const angle = /^(-?[\d.]+)(deg|rad|turn|grad)$/i.exec(token);
  if (!angle) return null;
  const value = Number.parseFloat(angle[1]);
  switch (angle[2].toLowerCase()) {
    case "rad":
      return (value * 180) / Math.PI;
    case "turn":
      return value * 360;
    case "grad":
      return value * 0.9;
    default:
      return value;
  }
}

/**
 * Parse the first gradient layer of a computed `background-image`. Linear
 * gradients keep their angle; radial/conic ones are approximated left to
 * right, which is close enough for a line of text.
 */
function parseGradient(backgroundImage: string, lengthPx: (angle: number) => number): ParsedGradient | null {
  const match = /(?:repeating-)?(linear|radial|conic)-gradient\(/i.exec(backgroundImage);
  if (!match) return null;
  let depth = 0;
  let end = match.index + match[0].length;
  for (; end < backgroundImage.length; end++) {
    const char = backgroundImage[end];
    if (char === "(") depth++;
    if (char === ")") {
      if (depth === 0) break;
      depth--;
    }
  }
  const args = splitTopLevel(backgroundImage.slice(match.index + match[0].length, end));
  let angle = match[1].toLowerCase() === "linear" ? 180 : 90;
  if (args.length > 0) {
    const first = match[1].toLowerCase() === "linear" ? parseAngle(args[0]) : null;
    if (first !== null) {
      angle = first;
      args.shift();
    } else if (match[1].toLowerCase() !== "linear" && !resolveColorish(args[0])) {
      args.shift(); // radial shape/position or conic "from ..." prelude
    }
  }

  const length = lengthPx(angle);
  const stops: GradientStop[] = [];
  for (const arg of args) {
    const stop = /^(.*?)(?:\s+(-?[\d.]+)(%|px))?(?:\s+(-?[\d.]+)(%|px))?$/.exec(arg);
    if (!stop) continue;
    const color = resolveColor(stop[1]);
    if (!color) continue;
    const toFraction = (num?: string, unit?: string) =>
      num === undefined ? null : unit === "%" ? Number.parseFloat(num) / 100 : Number.parseFloat(num) / Math.max(1, length);
    stops.push({ color, position: toFraction(stop[2], stop[3]) });
    if (stop[4] !== undefined) stops.push({ color, position: toFraction(stop[4], stop[5]) });
  }
  if (stops.length === 0) return null;

  // CSS stop fix-up: first/last default to 0/1, positions never decrease,
  // missing ones are spread evenly between their known neighbours.
  if (stops[0].position === null) stops[0].position = 0;
  if (stops[stops.length - 1].position === null) stops[stops.length - 1].position = 1;
  let maxSoFar = 0;
  for (const stop of stops) {
    if (stop.position !== null) {
      stop.position = Math.max(stop.position, maxSoFar);
      maxSoFar = stop.position;
    }
  }
  for (let i = 1; i < stops.length; i++) {
    if (stops[i].position !== null) continue;
    let j = i;
    while (stops[j].position === null) j++;
    const from = stops[i - 1].position!;
    const to = stops[j].position!;
    for (let k = i; k < j; k++) stops[k].position = from + ((to - from) * (k - i + 1)) / (j - i + 1);
  }
  return { angle, stops };
}

/** Cheap check used to tell a radial prelude ("circle at center") from a stop. */
function resolveColorish(token: string): boolean {
  return /^(#|rgb|hsl|hwb|lab|lch|oklab|oklch|color\(|[a-z]+$)/i.test(token) && !/^(circle|ellipse|closest|farthest|at|from)\b/i.test(token);
}

function sampleGradient(gradient: ParsedGradient, t: number): Rgba {
  const { stops } = gradient;
  const clamped = Math.min(1, Math.max(0, t));
  if (clamped <= stops[0].position!) return stops[0].color;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (clamped <= b.position!) {
      const span = b.position! - a.position!;
      const f = span <= 0 ? 1 : (clamped - a.position!) / span;
      return [
        Math.round(a.color[0] + (b.color[0] - a.color[0]) * f),
        Math.round(a.color[1] + (b.color[1] - a.color[1]) * f),
        Math.round(a.color[2] + (b.color[2] - a.color[2]) * f),
        a.color[3] + (b.color[3] - a.color[3]) * f,
      ];
    }
  }
  return stops[stops.length - 1].color;
}

function setImportant(el: HTMLElement, property: string, value: string): void {
  el.style.setProperty(property, value, "important");
}

function isClipText(style: CSSStyleDeclaration): boolean {
  return (
    /\btext\b/.test(style.getPropertyValue("background-clip")) ||
    /\btext\b/.test(style.getPropertyValue("-webkit-background-clip"))
  );
}

interface Point {
  x: number;
  y: number;
}

interface GraphemeRun {
  node: Text;
  /** `center` is null for whitespace, which stays a plain text node. */
  segments: { text: string; center: Point | null }[];
}

interface WrappedRun {
  original: Text;
  inserted: Node[];
  spans: { span: HTMLSpanElement; center: Point }[];
}

/** Largest movement (CSS px) of a glyph that still counts as "layout unchanged". */
const GLYPH_TOLERANCE_PX = 0.75;

/** Record where every grapheme under `el` is painted, before touching the DOM. */
function measureGraphemes(el: HTMLElement): GraphemeRun[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const runs: GraphemeRun[] = [];
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (!node.data.trim()) continue;
    const segments: GraphemeRun["segments"] = [];
    for (const { segment, index } of segmenter.segment(node.data)) {
      if (!segment.trim()) {
        segments.push({ text: segment, center: null });
        continue;
      }
      range.setStart(node, index);
      range.setEnd(node, index + segment.length);
      const r = range.getBoundingClientRect();
      segments.push({ text: segment, center: { x: r.left + r.width / 2, y: r.top + r.height / 2 } });
    }
    runs.push({ node, segments });
  }
  return runs;
}

/** Replace each measured text node with one span per grapheme. */
function wrapGraphemes(runs: GraphemeRun[]): WrappedRun[] {
  return runs.map(({ node, segments }) => {
    const inserted: Node[] = [];
    const spans: WrappedRun["spans"] = [];
    for (const { text, center } of segments) {
      if (!center) {
        inserted.push(document.createTextNode(text));
        continue;
      }
      const span = document.createElement("span");
      span.setAttribute("data-print-gradient-char", "");
      span.textContent = text;
      inserted.push(span);
      spans.push({ span, center });
    }
    node.replaceWith(...inserted);
    return { original: node, inserted, spans };
  });
}

function unwrapGraphemes(runs: WrappedRun[]): void {
  for (const { original, inserted } of runs) {
    const first = inserted[0];
    first?.parentNode?.insertBefore(original, first);
    for (const node of inserted) node.parentNode?.removeChild(node);
  }
}

/**
 * Splitting text into spans can change kerning, and with it a line break.
 * True when every glyph is still where it was painted before the split.
 */
function glyphsStayedPut(runs: WrappedRun[]): boolean {
  for (const { spans } of runs) {
    for (const { span, center } of spans) {
      const r = span.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      if (Math.abs(x - center.x) > GLYPH_TOLERANCE_PX || Math.abs(y - center.y) > GLYPH_TOLERANCE_PX) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Map a point to the gradient's own coordinate box. Inline elements that wrap
 * paint their background as one strip across the line fragments
 * (box-decoration-break: slice), so fragments are laid end to end.
 */
function createGradientSampler(el: HTMLElement, gradient: (length: (angle: number) => number) => ParsedGradient | null) {
  const fragments = Array.from(el.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
  if (fragments.length === 0) return null;
  const width = fragments.reduce((sum, r) => sum + r.width, 0);
  const height = Math.max(...fragments.map((r) => r.height));
  const lengthFor = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return Math.abs(width * Math.sin(rad)) + Math.abs(height * Math.cos(rad));
  };
  const parsed = gradient(lengthFor);
  if (!parsed) return null;
  const rad = (parsed.angle * Math.PI) / 180;
  const dir = { x: Math.sin(rad), y: -Math.cos(rad) };
  const length = Math.max(1, lengthFor(parsed.angle));

  return (x: number, y: number): Rgba => {
    let offset = 0;
    let local = { x: width / 2, y: height / 2 };
    for (const r of fragments) {
      if (y >= r.top - 1 && y <= r.bottom + 1 && x >= r.left - 1 && x <= r.right + 1) {
        local = { x: offset + (x - r.left), y: y - r.top };
        break;
      }
      offset += r.width;
    }
    const t = 0.5 + ((local.x - width / 2) * dir.x + (local.y - height / 2) * dir.y) / length;
    return sampleGradient(parsed, t);
  };
}

/**
 * Rewrite `background-clip: text` under `root` into plain text colors.
 * Returns how many elements were rewritten.
 */
export function flattenBackgroundClipText(root: HTMLElement): number {
  const targets: { el: HTMLElement; image: string; background: string; color: string }[] = [];
  for (const el of [root, ...root.querySelectorAll<HTMLElement>("*")]) {
    const style = getComputedStyle(el);
    if (!isClipText(style)) continue;
    targets.push({
      el,
      image: style.backgroundImage,
      background: style.backgroundColor,
      color: style.color,
    });
  }

  for (const { el, image, background, color } of targets) {
    const backgroundRgba = resolveColor(background);
    const colorRgba = resolveColor(color);
    let solid: Rgba | null =
      backgroundRgba && backgroundRgba[3] > 0 ? backgroundRgba : colorRgba && colorRgba[3] > 0 ? colorRgba : null;

    const sampler =
      image && image !== "none"
        ? createGradientSampler(el, (length) => parseGradient(image, length))
        : null;

    if (sampler) {
      const rect = el.getBoundingClientRect();
      solid = sampler(rect.left + rect.width / 2, rect.top + rect.height / 2);
      // Colors come from where each glyph was painted before the split; if the
      // split moved any glyph, fall back to one solid color (never reflow text).
      const runs = wrapGraphemes(measureGraphemes(el));
      if (glyphsStayedPut(runs)) {
        for (const { spans } of runs) {
          for (const { span, center } of spans) {
            const fill = toCssColor(sampler(center.x, center.y));
            setImportant(span, "color", fill);
            setImportant(span, "-webkit-text-fill-color", fill);
          }
        }
      } else {
        unwrapGraphemes(runs);
      }
    }

    const fill = toCssColor(solid ?? [26, 26, 26, 1]);
    setImportant(el, "-webkit-text-fill-color", fill);
    setImportant(el, "color", fill);
    setImportant(el, "background-image", "none");
    setImportant(el, "background-color", "transparent");
    setImportant(el, "-webkit-background-clip", "border-box");
    setImportant(el, "background-clip", "border-box");
  }

  return targets.length;
}

// ---------------------------------------------------------------------------
// Blurred box-shadows
// ---------------------------------------------------------------------------
//
// Chromium stores each blurred box-shadow as a soft-masked image. macOS
// Preview/PDFKit honours only the first few soft masks on a page and paints
// later shadows as solid gray boxes (poppler renders them correctly). Moving
// shadows into separate elements would risk layout and paint-order changes, so
// affected slides are reported instead.

/** Blurred shadows per page from which PDFKit starts drawing gray boxes. */
export const PDFKIT_SHADOW_LIMIT = 4;

function countBlurredShadows(boxShadow: string): number {
  if (!boxShadow || boxShadow === "none") return 0;
  let count = 0;
  for (const shadow of splitTopLevel(boxShadow)) {
    if (/\binset\b/.test(shadow)) continue;
    // Drop color functions/keywords; the remaining lengths are x y blur spread.
    const lengths = shadow
      .replace(/[a-z-]+\([^)]*\)/gi, " ")
      .match(/-?[\d.]+(?:px)?/g);
    if (lengths && lengths.length >= 3 && Number.parseFloat(lengths[2]) > 0) count++;
  }
  return count;
}

/** 1-based slide numbers whose page holds enough blurred shadows to hit the PDFKit limit. */
export function findShadowHeavyPages(root: HTMLElement): number[] {
  const pages: number[] = [];
  for (const page of root.querySelectorAll<HTMLElement>(STAGE_SELECTOR)) {
    let shadows = 0;
    for (const el of [page, ...page.querySelectorAll<HTMLElement>("*")]) {
      const count = countBlurredShadows(getComputedStyle(el).boxShadow);
      // display:none boxes (and their shadows) are never painted.
      if (count === 0 || el.getClientRects().length === 0) continue;
      shadows += count;
      if (shadows >= PDFKIT_SHADOW_LIMIT) break;
    }
    if (shadows >= PDFKIT_SHADOW_LIMIT) pages.push(Number(page.getAttribute("data-print-page")));
  }
  return pages;
}

/**
 * Drive the print page to a printable state. Never throws: failures land in
 * `data-print-state="error"` plus `data-print-message`.
 */
export async function preparePrintDocument(
  root: HTMLElement,
  options: PreparePrintOptions,
): Promise<void> {
  const { expected, imageScale, signal } = options;
  const idleTimeoutMs = options.idleTimeoutMs ?? 90_000;
  const embeds = trackEmbeds(root);

  try {
    setState(root, "loading");
    root.setAttribute("data-print-total", String(expected));

    setStep(root, "mdx");
    const tally = await waitForAllMdx(root, expected, idleTimeoutMs, signal);
    root.setAttribute("data-print-errors", JSON.stringify(tally.errorPages));

    // Lazy images far below the first page would never load before printing.
    for (const img of root.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')) {
      img.loading = "eager";
    }

    setStep(root, "images");
    await waitForImages(root, 60_000);
    throwIfAborted(signal);
    setStep(root, "embeds");
    await embeds.settle(20_000);
    throwIfAborted(signal);
    setStep(root, "fonts");
    await waitForFonts(root, 30_000);
    throwIfAborted(signal);
    setStep(root, "layout");
    await waitForDomStable(root, 300, 15_000);
    throwIfAborted(signal);

    // Layout is final: rewrite constructs PDF viewers render inconsistently.
    setStep(root, "rewrite");
    root.setAttribute("data-print-clip-text", String(flattenBackgroundClipText(root)));
    root.setAttribute("data-print-shadow-pages", JSON.stringify(findShadowHeavyPages(root)));

    if (imageScale !== null) {
      setState(root, "optimizing");
      setStep(root, "swap-images");
      const swapped = await swapImagesForPrint(root, imageScale);
      root.setAttribute("data-print-images", String(swapped));
      if (swapped > 0) {
        await yieldToMain();
        await waitForImages(root, 120_000);
        throwIfAborted(signal);
        await waitForDomStable(root, 300, 15_000);
        throwIfAborted(signal);
      }
    }

    // A last font pass after layout settled, then two frames so the final
    // layout has been painted at least once.
    setStep(root, "final");
    await waitForFonts(root, 5_000);
    throwIfAborted(signal);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    setState(root, "ready");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    const message = error instanceof Error ? error.message : String(error);
    setState(root, "error", message);
  } finally {
    embeds.stop();
  }
}
