/**
 * Overflow detection: measures, inside a real browser, which rendered MDX
 * elements leak outside the slide's inviolable area (`[data-slide-content]`)
 * and reports them with MDX source lines.
 */
import type { Page } from "playwright";
import {
  createSlideContext,
  ensureServer,
  fetchDeckData,
  launchBrowser,
  openNativeSlide,
  resolveBaseUrl,
} from "./browser";
import type { Finding, Severity } from "./findings";

export interface OverflowEdges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type OverflowRule =
  | "outside-frame"
  | "outside-safe-area"
  | "intentional-breakout"
  | "decorative-bleed"
  | "clipped-content"
  | "overlay-collision"
  | "render-error";

export interface OverflowFinding {
  rule: OverflowRule;
  severity: Severity;
  message: string;
  selector: string;
  text: string;
  line: number | null;
  overflow: OverflowEdges;
}

export interface SlideOverflowReport {
  index: number;
  file: string;
  type: string;
  status: "ready" | "error" | "timeout";
  findings: OverflowFinding[];
}

export interface OverflowReport {
  deck: string;
  baseUrl: string;
  slides: SlideOverflowReport[];
  summary: { slides: number; errors: number; warnings: number; infos: number };
}

interface BrowserMeasurement {
  rule: OverflowRule;
  selector: string;
  text: string;
  line: number | null;
  overflow: OverflowEdges;
  beyondFrame: boolean;
  hasNegativeMargin: boolean;
  /** Absolutely positioned, no text, no media: a decorative shape. */
  isDecorative: boolean;
}

interface MeasureOptions {
  tolerancePx: number;
}

/**
 * Runs inside the page (serialized by Playwright). Must be self-contained.
 */
function measureOverflowInPage(options: MeasureOptions): BrowserMeasurement[] {
  const tolerance = options.tolerancePx;
  const frame = document.querySelector<HTMLElement>("[data-slide-frame]");
  const safeArea = document.querySelector<HTMLElement>("[data-slide-frame] [data-slide-content]");
  const mdxRoot = document.querySelector<HTMLElement>("[data-slide-frame] [data-mdx-status]");
  if (!frame || !safeArea || !mdxRoot) return [];

  const frameRect = frame.getBoundingClientRect();
  const safeRect = safeArea.getBoundingClientRect();
  const results: BrowserMeasurement[] = [];

  const classHint = (node: Element): string => {
    const names: string[] = [];
    for (const cls of Array.from(node.classList)) {
      const idx = cls.indexOf("-module__");
      if (idx !== -1) {
        const suffix = cls.slice(cls.lastIndexOf("__") + 2);
        if (suffix) names.push(suffix);
      } else if (!/^(flex|h-full|flex-col)$/.test(cls)) {
        names.push(cls);
      }
      if (names.length >= 2) break;
    }
    return names.map((n) => `.${n}`).join("");
  };

  const describe = (el: Element): string => {
    const parts: string[] = [];
    let node: Element | null = el;
    let depth = 0;
    while (node && node !== mdxRoot && depth < 6) {
      let label = node.tagName.toLowerCase() + classHint(node);
      const dataAttrs = Array.from(node.attributes)
        .filter((a) => a.name.startsWith("data-") && a.name !== "data-mdx-line")
        .map((a) => `[${a.name}${a.value ? `="${a.value}"` : ""}]`)
        .join("");
      label += dataAttrs;
      const parent = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
        if (siblings.length > 1) label += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
      parts.unshift(label);
      node = node.parentElement;
      depth++;
    }
    return parts.join(" > ");
  };

  const textOf = (el: Element): string =>
    (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);

  const parseLine = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string") return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  // Components that do not forward unknown props drop `data-mdx-line` before
  // it reaches the DOM. Walk React's fiber tree (attached to DOM nodes as
  // `__reactFiber$…`) to recover the prop from the nearest component.
  const lineFromFiber = (el: Element): number | null => {
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    if (!key) return null;
    type FiberLike = { memoizedProps?: Record<string, unknown> | null; return?: FiberLike | null };
    let fiber = (el as unknown as Record<string, FiberLike | undefined>)[key] ?? null;
    let hops = 0;
    while (fiber && hops < 200) {
      const props = fiber.memoizedProps;
      if (props && typeof props === "object") {
        const line = parseLine(props["data-mdx-line"]);
        if (line !== null) return line;
        if (props["data-mdx-status"] !== undefined) break;
      }
      fiber = fiber.return ?? null;
      hops++;
    }
    return null;
  };

  const lineOf = (el: Element): number | null => {
    let node: Element | null = el;
    while (node && node !== mdxRoot.parentElement) {
      const line = parseLine(node.getAttribute("data-mdx-line"));
      if (line !== null) return line;
      node = node.parentElement;
    }
    const viaFiber = lineFromFiber(el);
    if (viaFiber !== null) return viaFiber;
    // Fall back to the first descendant that carries a line.
    const inner = el.querySelector("[data-mdx-line]");
    if (inner) return parseLine(inner.getAttribute("data-mdx-line"));
    return null;
  };

  const isVisible = (el: HTMLElement, rect: DOMRect): boolean => {
    if (rect.width === 0 && rect.height === 0) return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (Number.parseFloat(style.opacity || "1") === 0) return false;
    return true;
  };

  const isDecorative = (el: HTMLElement): boolean => {
    if ((el.textContent ?? "").trim().length > 0) return false;
    if (el instanceof HTMLImageElement || el.tagName.toLowerCase() === "svg") return false;
    if (el.querySelector("img, svg, video, canvas")) return false;
    let node: Element | null = el;
    while (node && node !== mdxRoot) {
      const position = getComputedStyle(node).position;
      if (position === "absolute" || position === "fixed") return true;
      node = node.parentElement;
    }
    return false;
  };

  const hasNegativeMarginChain = (el: Element): boolean => {
    let node: Element | null = el;
    while (node && node !== mdxRoot) {
      const style = getComputedStyle(node);
      for (const side of ["marginTop", "marginRight", "marginBottom", "marginLeft"] as const) {
        if (Number.parseFloat(style[side] || "0") < -0.5) return true;
      }
      node = node.parentElement;
    }
    return false;
  };

  const edges = (rect: DOMRect, bounds: DOMRect): OverflowEdges => ({
    top: Math.max(0, Math.round(bounds.top - rect.top)),
    right: Math.max(0, Math.round(rect.right - bounds.right)),
    bottom: Math.max(0, Math.round(rect.bottom - bounds.bottom)),
    left: Math.max(0, Math.round(bounds.left - rect.left)),
  });
  const exceeds = (e: OverflowEdges): boolean =>
    e.top > tolerance || e.right > tolerance || e.bottom > tolerance || e.left > tolerance;

  // 1. Elements leaking outside the safe area (outermost offender only).
  const reported = new Set<Element>();
  const all = Array.from(mdxRoot.querySelectorAll<HTMLElement>("*"));
  for (const el of all) {
    let skip = false;
    for (const done of reported) {
      if (done.contains(el)) {
        skip = true;
        break;
      }
    }
    if (skip) continue;
    // Ignore the pure text/inline wrappers inside SVG (measure the <svg> itself).
    if (el.namespaceURI === "http://www.w3.org/2000/svg" && el.tagName.toLowerCase() !== "svg") continue;

    const rect = el.getBoundingClientRect();
    if (!isVisible(el, rect)) continue;
    const safeEdges = edges(rect, safeRect);
    if (!exceeds(safeEdges)) continue;

    const frameEdges = edges(rect, frameRect);
    const beyondFrame = exceeds(frameEdges);
    reported.add(el);
    results.push({
      rule: beyondFrame ? "outside-frame" : "outside-safe-area",
      selector: describe(el),
      text: textOf(el),
      line: lineOf(el),
      overflow: beyondFrame ? frameEdges : safeEdges,
      beyondFrame,
      hasNegativeMargin: hasNegativeMarginChain(el),
      isDecorative: isDecorative(el),
    });
  }

  // 2. Scroll containers that clip their content.
  const clipCandidates: HTMLElement[] = [safeArea, ...Array.from(mdxRoot.querySelectorAll<HTMLElement>("[data-column]"))];
  for (const el of clipCandidates) {
    if (reported.has(el)) continue;
    const overflowY = el.scrollHeight - el.clientHeight;
    const overflowX = el.scrollWidth - el.clientWidth;
    if (overflowY <= tolerance && overflowX <= tolerance) continue;
    // Only meaningful when the box actually clips (otherwise rule 1 already caught it).
    const style = getComputedStyle(el);
    const clips = /hidden|clip|auto|scroll/.test(style.overflowY) || /hidden|clip|auto|scroll/.test(style.overflowX);
    if (!clips) continue;
    results.push({
      rule: "clipped-content",
      selector: el === safeArea ? "[data-slide-content]" : describe(el),
      text: textOf(el),
      line: lineOf(el),
      overflow: { top: 0, right: Math.max(0, overflowX), bottom: Math.max(0, overflowY), left: 0 },
      beyondFrame: false,
      hasNegativeMargin: false,
      isDecorative: false,
    });
  }

  // 3. Overlay collisions (logo, copyright, page number). Compare against
  // the painted text runs / media boxes, not element bounding boxes, so a
  // full-width heading whose glyphs stop well before the logo is not flagged.
  const overlays = Array.from(
    frame.querySelectorAll<HTMLElement>("[class*='SlideOverlay'][class*='overlay']"),
  ).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  if (overlays.length > 0) {
    const overlayRects = overlays.map((el) => el.getBoundingClientRect());
    const minOverlap = Math.max(4, tolerance * 4);
    const intersects = (r: DOMRect): boolean => {
      for (const o of overlayRects) {
        const ix = Math.min(r.right, o.right) - Math.max(r.left, o.left);
        const iy = Math.min(r.bottom, o.bottom) - Math.max(r.top, o.top);
        if (ix > minOverlap && iy > minOverlap) return true;
      }
      return false;
    };
    const paintedRects = (el: HTMLElement): DOMRect[] => {
      const tag = el.tagName.toLowerCase();
      if (el instanceof HTMLImageElement || tag === "svg" || tag === "video" || tag === "canvas") {
        return [el.getBoundingClientRect()];
      }
      const rects: DOMRect[] = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let textNode = walker.nextNode();
      while (textNode) {
        if ((textNode.textContent ?? "").trim().length > 0) {
          const range = document.createRange();
          range.selectNodeContents(textNode);
          for (const r of Array.from(range.getClientRects())) {
            if (r.width > 0 && r.height > 0) rects.push(r);
          }
        }
        textNode = walker.nextNode();
      }
      return rects;
    };
    const collided = new Set<Element>();
    for (const el of all) {
      const tag = el.tagName.toLowerCase();
      const isMedia = el instanceof HTMLImageElement || tag === "svg" || tag === "video" || tag === "canvas";
      const isTextLeaf = !isMedia && Array.from(el.childNodes).some(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim().length > 0,
      );
      if (!isMedia && !isTextLeaf) continue;
      if (el.namespaceURI === "http://www.w3.org/2000/svg" && tag !== "svg") continue;
      let skip = false;
      for (const done of collided) {
        if (done.contains(el)) {
          skip = true;
          break;
        }
      }
      if (skip) continue;
      const rect = el.getBoundingClientRect();
      if (!isVisible(el, rect)) continue;
      const rects = isMedia
        ? paintedRects(el)
        : Array.from(el.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim().length > 0)
            .flatMap((n) => {
              const range = document.createRange();
              range.selectNodeContents(n);
              return Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
            });
      if (rects.some(intersects)) {
        collided.add(el);
        results.push({
          rule: "overlay-collision",
          selector: describe(el),
          text: textOf(el),
          line: lineOf(el),
          overflow: { top: 0, right: 0, bottom: 0, left: 0 },
          beyondFrame: false,
          hasNegativeMargin: false,
          isDecorative: false,
        });
      }
    }
  }

  return results;
}

const BREAKOUT_TYPES = new Set(["cover", "section", "ending"]);
/** Max px a full-bleed band may extend past the frame before it counts as an error. */
const BREAKOUT_BLEED_PX = 32;

function classify(m: BrowserMeasurement, slideType: string): OverflowFinding {
  const fmt = (e: OverflowEdges) =>
    (Object.entries(e) as Array<[keyof OverflowEdges, number]>)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k} +${v}px`)
      .join(", ");

  if (m.isDecorative && (m.rule === "outside-frame" || m.rule === "outside-safe-area")) {
    return {
      rule: "decorative-bleed",
      severity: "info",
      message: `Decorative shape extends past the ${m.beyondFrame ? "frame" : "safe area"} (${fmt(m.overflow)}); no text or media affected`,
      selector: m.selector,
      text: m.text,
      line: m.line,
      overflow: m.overflow,
    };
  }
  if (m.rule === "outside-frame") {
    // Full-bleed bands on cover/section/ending slides may bleed a little past
    // the (overflow:hidden) frame edge; that is background, not lost content.
    const bleed = Math.max(m.overflow.top, m.overflow.right, m.overflow.bottom, m.overflow.left);
    const intentional = m.hasNegativeMargin && BREAKOUT_TYPES.has(slideType) && bleed <= BREAKOUT_BLEED_PX;
    return {
      rule: intentional ? "intentional-breakout" : "outside-frame",
      severity: intentional ? "info" : "error",
      message: intentional
        ? `Full-bleed breakout on a ${slideType} slide bleeds past the frame (${fmt(m.overflow)}); clipped, allowed`
        : `Content extends beyond the slide frame (${fmt(m.overflow)})`,
      selector: m.selector,
      text: m.text,
      line: m.line,
      overflow: m.overflow,
    };
  }
  if (m.rule === "outside-safe-area") {
    const intentional = m.hasNegativeMargin && BREAKOUT_TYPES.has(slideType);
    return {
      rule: intentional ? "intentional-breakout" : "outside-safe-area",
      severity: intentional ? "info" : "error",
      message: intentional
        ? `Full-bleed breakout on a ${slideType} slide (${fmt(m.overflow)}); allowed`
        : `Content leaves the safe area (${fmt(m.overflow)})`,
      selector: m.selector,
      text: m.text,
      line: m.line,
      overflow: m.overflow,
    };
  }
  if (m.rule === "clipped-content") {
    return {
      rule: "clipped-content",
      severity: "error",
      message: `Content is clipped inside its container (${fmt(m.overflow)} hidden)`,
      selector: m.selector,
      text: m.text,
      line: m.line,
      overflow: m.overflow,
    };
  }
  return {
    rule: "overlay-collision",
    severity: "warning",
    message: "Content overlaps a logo / copyright / page number overlay",
    selector: m.selector,
    text: m.text,
    line: m.line,
    overflow: m.overflow,
  };
}

export interface RunOverflowOptions {
  deck: string;
  baseUrl?: string;
  indexes?: number[];
  tolerancePx?: number;
  onProgress?: (info: { index: number; total: number; file: string; findings: number }) => void;
}

const ESBUILD_NAME_SHIM = "globalThis.__name = globalThis.__name || ((fn) => fn);";

async function measurePage(page: Page, tolerancePx: number): Promise<BrowserMeasurement[]> {
  await page.evaluate(ESBUILD_NAME_SHIM);
  return page.evaluate(measureOverflowInPage, { tolerancePx });
}

export async function runOverflowCheck(options: RunOverflowOptions): Promise<OverflowReport> {
  const baseUrl = resolveBaseUrl(options.baseUrl);
  await ensureServer(baseUrl);
  const deck = await fetchDeckData(baseUrl, options.deck);
  const indexes = options.indexes ?? deck.slides.map((s) => s.index);
  const tolerancePx = options.tolerancePx ?? 1;

  const browser = await launchBrowser();
  const slides: SlideOverflowReport[] = [];
  try {
    const context = await createSlideContext(browser, 1);
    const page = await context.newPage();

    for (const index of indexes) {
      const slide = deck.slides[index];
      if (!slide) continue;
      const type = slide.frontmatter.type;
      const ready = await openNativeSlide(page, baseUrl, { deck: options.deck, index, sourceLines: true });
      if (ready.status !== "ready") {
        slides.push({
          index,
          file: slide.filename,
          type,
          status: ready.status,
          findings: [
            {
              rule: "render-error",
              severity: "error",
              message: `Slide did not render: ${ready.message ?? ready.status}`,
              selector: "",
              text: "",
              line: null,
              overflow: { top: 0, right: 0, bottom: 0, left: 0 },
            },
          ],
        });
        options.onProgress?.({ index, total: deck.slides.length, file: slide.filename, findings: 1 });
        continue;
      }
      const measurements = await measurePage(page, tolerancePx);
      const findings = measurements.map((m) => classify(m, type));
      slides.push({ index, file: slide.filename, type, status: "ready", findings });
      options.onProgress?.({ index, total: deck.slides.length, file: slide.filename, findings: findings.length });
    }
    await context.close();
  } finally {
    await browser.close();
  }

  const summary = { slides: slides.length, errors: 0, warnings: 0, infos: 0 };
  for (const s of slides) {
    for (const f of s.findings) {
      if (f.severity === "error") summary.errors++;
      else if (f.severity === "warning") summary.warnings++;
      else summary.infos++;
    }
  }

  return { deck: options.deck, baseUrl, slides, summary };
}

/** Flatten an overflow report into shared doctor findings. */
export function overflowReportToFindings(report: OverflowReport): Finding[] {
  const findings: Finding[] = [];
  for (const slide of report.slides) {
    for (const f of slide.findings) {
      findings.push({
        deck: report.deck,
        check: "overflow",
        rule: f.rule,
        severity: f.severity,
        message: f.message,
        file: `decks/${report.deck}/${slide.file}`,
        line: f.line ?? undefined,
        snippet: f.text ? `${f.selector}  "${f.text}"` : f.selector || undefined,
        meta: { slideIndex: slide.index, slideType: slide.type, overflow: f.overflow, selector: f.selector },
      });
    }
  }
  return findings;
}
