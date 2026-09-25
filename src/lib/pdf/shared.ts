/**
 * Vector PDF export: pieces shared by the print route (browser), the renderer
 * (Node, Playwright), the API route and the CLI. Keep this file free of Node
 * or browser-only imports.
 */

/**
 * Query parameter the print page appends to an `<img>` URL once it knows the
 * image's on-slide size. The PDF renderer intercepts those requests and serves
 * a re-encoded copy `N` pixels wide. Without the renderer (a person printing
 * the page by hand) the asset route ignores the parameter and serves the
 * original file.
 */
export const PDF_IMAGE_WIDTH_PARAM = "__amaroad_pdf_w";

/** Default oversampling of images relative to their on-slide CSS size. */
export const DEFAULT_PDF_IMAGE_SCALE = 2;
export const MIN_PDF_IMAGE_SCALE = 1;
export const MAX_PDF_IMAGE_SCALE = 4;

/** Default JPEG quality for opaque images re-encoded for the PDF. */
export const DEFAULT_PDF_JPEG_QUALITY = 85;

/** Lifecycle published on `[data-print-deck]` as `data-print-state`. */
export type PrintState = "loading" | "optimizing" | "ready" | "error";

export type SlideRangeResult =
  | { ok: true; indexes: number[] }
  | { ok: false; error: string };

/**
 * Parse a 1-based slide selection such as `"1-5,8,12-"` into sorted, unique,
 * 0-based slide indexes. `"N-"` runs to the last slide. An empty or missing
 * spec selects every slide.
 */
export function parseSlideRange(spec: string | undefined | null, total: number): SlideRangeResult {
  const all = Array.from({ length: total }, (_, i) => i);
  if (spec === undefined || spec === null || spec.trim() === "") {
    return { ok: true, indexes: all };
  }

  const selected = new Set<number>();
  for (const rawPart of spec.split(",")) {
    const part = rawPart.trim();
    const match = /^(\d+)(?:\s*-\s*(\d*))?$/.exec(part);
    if (!match) {
      return { ok: false, error: `Invalid slide range "${part}" (use e.g. "1-5,8,12-")` };
    }
    const start = Number.parseInt(match[1], 10);
    const isRange = part.includes("-");
    const end = isRange ? (match[2] ? Number.parseInt(match[2], 10) : total) : start;
    if (start < 1 || end < start) {
      return { ok: false, error: `Invalid slide range "${part}"` };
    }
    if (end > total) {
      return { ok: false, error: `Slide ${end} is out of range (the deck has ${total} slides)` };
    }
    for (let n = start; n <= end; n++) selected.add(n - 1);
  }

  return { ok: true, indexes: Array.from(selected).sort((a, b) => a - b) };
}

/** Clamp a user-supplied image scale; `null` means "embed images as-is". */
export function normalizePdfImageScale(value: number | null | undefined): number | null {
  if (value === null) return null;
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_PDF_IMAGE_SCALE;
  return Math.min(MAX_PDF_IMAGE_SCALE, Math.max(MIN_PDF_IMAGE_SCALE, value));
}
