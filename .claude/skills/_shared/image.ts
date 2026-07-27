/**
 * Image utilities shared by the image skills (codex-image, codex-image-edit,
 * nanobanana-image, nanobanana-image-edit).
 *
 * This directory holds no SKILL.md on purpose — it is a library, not a skill.
 *
 * Nothing here writes to the console. Callers get a result object and decide
 * how to report it, so the same helpers work from any of the four scripts.
 */

import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// ---------------------------------------------------------------------------
// Formats
// ---------------------------------------------------------------------------

export type ImageFormat = "png" | "jpeg" | "webp";

/** Extensions the deck asset route serves as images (see src/app/api/decks). */
export const SUPPORTED_IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
] as const;

const EXTENSION_BY_FORMAT: Record<ImageFormat, string> = {
  png: ".png",
  jpeg: ".jpg",
  webp: ".webp",
};

/** Identifies the real format from magic bytes, not from a declared MIME type. */
export function detectImageFormat(buffer: Buffer): ImageFormat | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_MAGIC)) {
    return "png";
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export function formatForExtension(extension: string): ImageFormat | null {
  switch (extension.toLowerCase()) {
    case ".png":
      return "png";
    case ".jpg":
    case ".jpeg":
      return "jpeg";
    case ".webp":
      return "webp";
    default:
      return null;
  }
}

/** Returns `file` with its extension swapped to the canonical one for `format`. */
export function withFormatExtension(file: string, format: ImageFormat): string {
  const directory = path.dirname(file);
  const stem = path.basename(file, path.extname(file));
  return path.join(directory, stem + EXTENSION_BY_FORMAT[format]);
}

/** Re-encodes `source` into `format` at `destination` using macOS `sips`. */
function convertImage(
  source: string,
  destination: string,
  format: ImageFormat,
): boolean {
  const result = spawnSync(
    "sips",
    ["-s", "format", format, source, "--out", destination],
    { stdio: "pipe" },
  );
  return result.status === 0 && fs.existsSync(destination);
}

export interface SaveResult {
  /** Where the bytes actually landed — not always the requested path. */
  path: string;
  note?: string;
}

/**
 * Writes `buffer` to `requestedPath`, re-encoding when the bytes are in a
 * different format than the extension asks for.
 *
 * Gemini's lite model routinely answers with JPEG even for a .png destination.
 * Re-encoding it into PNG is lossless, costs almost nothing in file size
 * (measured: 371KB as JPEG vs 368KB as an optimized PNG), keeps one predictable
 * extension per asset, and leaves the PNG optimizer able to run on the result.
 *
 * When re-encoding is impossible (no `sips` outside macOS) the file is renamed
 * to match its real format rather than hiding JPEG bytes behind a .png name.
 */
export function saveImage(buffer: Buffer, requestedPath: string): SaveResult {
  const actual = detectImageFormat(buffer);
  const requested = formatForExtension(path.extname(requestedPath));

  if (!actual) {
    fs.writeFileSync(requestedPath, buffer);
    return {
      path: requestedPath,
      note: "could not identify the returned image format from its magic bytes; saved to --output as-is.",
    };
  }

  if (!requested || actual === requested) {
    fs.writeFileSync(requestedPath, buffer);
    return { path: requestedPath };
  }

  const scratch = `${requestedPath}.incoming`;
  fs.writeFileSync(scratch, buffer);

  if (convertImage(scratch, requestedPath, requested)) {
    fs.unlinkSync(scratch);
    return { path: requestedPath };
  }

  const corrected = withFormatExtension(requestedPath, actual);
  fs.renameSync(scratch, corrected);
  return {
    path: corrected,
    note:
      `could not re-encode into ${path.extname(requestedPath)} (sips is macOS-only), so the image was saved as ` +
      `${path.basename(corrected)} to keep the extension honest. Update MDX references to that filename.`,
  };
}

// ---------------------------------------------------------------------------
// Inspection
// ---------------------------------------------------------------------------

export interface ImageSize {
  width: number;
  height: number;
}

export function isPng(file: string): boolean {
  let fd: number;
  try {
    fd = fs.openSync(file, "r");
  } catch {
    return false;
  }
  try {
    const header = Buffer.alloc(8);
    return fs.readSync(fd, header, 0, 8, 0) === 8 && header.equals(PNG_MAGIC);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Reads dimensions straight out of the PNG IHDR chunk, so this works on every
 * platform rather than only where an image CLI happens to be installed.
 * Returns null for non-PNG files.
 */
export function readPngSize(file: string): ImageSize | null {
  let fd: number;
  try {
    fd = fs.openSync(file, "r");
  } catch {
    return null;
  }
  try {
    const header = Buffer.alloc(24);
    if (fs.readSync(fd, header, 0, 24, 0) < 24) return null;
    if (!header.subarray(0, 8).equals(PNG_MAGIC)) return null;
    if (header.subarray(12, 16).toString("ascii") !== "IHDR") return null;
    const width = header.readUInt32BE(16);
    const height = header.readUInt32BE(20);
    return width && height ? { width, height } : null;
  } finally {
    fs.closeSync(fd);
  }
}

export function formatRatio(size: ImageSize): string {
  return (size.width / size.height).toFixed(2);
}

export function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)}MB`
    : `${(bytes / 1024).toFixed(0)}KB`;
}

function hasCommand(command: string): boolean {
  const probe = spawnSync(command, ["--version"], { stdio: "ignore" });
  return !probe.error;
}

// ---------------------------------------------------------------------------
// Downscaling
// ---------------------------------------------------------------------------

export interface DownscaleResult {
  resized: boolean;
  size: ImageSize | null;
  note?: string;
}

/**
 * Shrinks `file` in place so its longest edge is at most `maxEdge`, preserving
 * the aspect ratio. Uses macOS `sips`; elsewhere it reports back instead of
 * failing, which is harmless because slide images render with object-fit:
 * contain anyway.
 */
export function downscaleToMaxEdge(
  file: string,
  maxEdge: number,
): DownscaleResult {
  const size = readPngSize(file);
  if (!size) return { resized: false, size: null };
  if (Math.max(size.width, size.height) <= maxEdge) {
    return { resized: false, size };
  }

  const scratch = `${file}.resize.png`;
  const result = spawnSync(
    "sips",
    ["--resampleHeightWidthMax", String(maxEdge), file, "--out", scratch],
    { stdio: "pipe" },
  );

  if (result.status !== 0 || !fs.existsSync(scratch)) {
    if (fs.existsSync(scratch)) fs.unlinkSync(scratch);
    return {
      resized: false,
      size,
      note: `could not downscale to ${maxEdge}px (sips unavailable or failed); keeping ${size.width}x${size.height}`,
    };
  }

  fs.renameSync(scratch, file);
  return { resized: true, size: readPngSize(file) };
}

// ---------------------------------------------------------------------------
// Optimization
// ---------------------------------------------------------------------------

/**
 * - `off`        leave the file exactly as generated
 * - `lossless`   oxipng only; every pixel is preserved bit-for-bit (default)
 * - `aggressive` lossless, then high-quality palette quantization (pngquant at
 *                quality 90-100) when it holds that quality bar. Visually
 *                indistinguishable on flat illustration, but not bit-identical,
 *                so it stays opt-in.
 *
 * PNG only. JPEG and WebP files are already compressed, and re-encoding them
 * would lose quality for little gain, so they are left untouched.
 */
export type OptimizeMode = "off" | "lossless" | "aggressive";

export const OPTIMIZE_MODES: readonly OptimizeMode[] = [
  "off",
  "lossless",
  "aggressive",
];

export interface OptimizeResult {
  /** Tools that actually changed the file, in the order they ran. */
  applied: string[];
  beforeBytes: number;
  afterBytes: number;
  /** Set when a step could not run, or when the result was rejected. */
  note?: string;
}

/** Recompresses without touching pixel data. Returns true if the file shrank. */
function runOxipng(file: string): boolean {
  const before = fs.statSync(file).size;
  // `-o 4` rather than `-o max`: measured within 1% of max on both flat art and
  // photographic assets, at 35-40% less wall time.
  // `--strip safe` drops only metadata chunks; pixel data is untouched.
  const result = spawnSync("oxipng", ["-o", "4", "--strip", "safe", "-q", file], {
    stdio: "pipe",
  });
  if (result.status !== 0) return false;
  return fs.statSync(file).size < before;
}

/**
 * Palette-quantizes at a hard quality floor. pngquant exits non-zero when it
 * cannot reach the requested quality, which is exactly the guard we want:
 * photographic images fail it and keep their full color depth.
 */
function runPngquant(file: string): boolean {
  const before = fs.statSync(file).size;
  const scratch = `${file}.quant.png`;
  const result = spawnSync(
    "pngquant",
    ["--quality", "90-100", "--speed", "1", "--strip", "--force", "--output", scratch, file],
    { stdio: "pipe" },
  );

  const produced = result.status === 0 && fs.existsSync(scratch);
  if (!produced || fs.statSync(scratch).size >= before) {
    if (fs.existsSync(scratch)) fs.unlinkSync(scratch);
    return false;
  }

  fs.renameSync(scratch, file);
  return true;
}

/**
 * Shrinks a PNG in place. Non-PNG files are returned untouched.
 *
 * Every run is guarded: the file is backed up first, and the optimized result
 * is only kept when it is still a valid PNG of identical dimensions. Anything
 * unexpected rolls back to the original, so optimization can never be the
 * reason an asset is broken.
 */
export function optimizePng(file: string, mode: OptimizeMode): OptimizeResult {
  const beforeBytes = fs.statSync(file).size;
  const base: OptimizeResult = { applied: [], beforeBytes, afterBytes: beforeBytes };

  // JPEG/WebP arrive already compressed; touching them would cost quality.
  if (mode === "off" || !isPng(file)) return base;

  const oxipngAvailable = hasCommand("oxipng");
  const pngquantAvailable = mode === "aggressive" && hasCommand("pngquant");

  if (!oxipngAvailable && !pngquantAvailable) {
    return {
      ...base,
      note:
        "skipped image optimization: `oxipng` is not installed. Install it with `brew install oxipng` to cut roughly 30-40% off generated PNGs losslessly.",
    };
  }

  const sizeBefore = readPngSize(file);
  const backup = `${file}.pre-optimize`;
  fs.copyFileSync(file, backup);

  try {
    const applied: string[] = [];
    if (oxipngAvailable && runOxipng(file)) applied.push("oxipng");
    if (pngquantAvailable && runPngquant(file)) {
      applied.push("pngquant");
      // Quantized output still has slack that lossless recompression removes.
      if (oxipngAvailable) runOxipng(file);
    }

    const sizeAfter = readPngSize(file);
    const intact =
      isPng(file) &&
      fs.statSync(file).size > 0 &&
      sizeAfter !== null &&
      (sizeBefore === null ||
        (sizeAfter.width === sizeBefore.width &&
          sizeAfter.height === sizeBefore.height));

    if (!intact) {
      fs.copyFileSync(backup, file);
      return {
        ...base,
        note: "image optimization produced an unexpected result and was rolled back; the original file is unchanged.",
      };
    }

    const afterBytes = fs.statSync(file).size;
    const note =
      mode === "aggressive" && !pngquantAvailable
        ? "`pngquant` is not installed, so only lossless optimization ran. Install it with `brew install pngquant`."
        : undefined;

    return { applied, beforeBytes, afterBytes, note };
  } catch (err) {
    fs.copyFileSync(backup, file);
    return {
      ...base,
      note: `image optimization failed and was rolled back: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    if (fs.existsSync(backup)) fs.unlinkSync(backup);
  }
}

/** One-line human summary, or null when nothing changed. */
export function describeOptimization(result: OptimizeResult): string | null {
  if (!result.applied.length || result.afterBytes >= result.beforeBytes) {
    return null;
  }
  const saved = 1 - result.afterBytes / result.beforeBytes;
  const lossless = !result.applied.includes("pngquant");
  return (
    `Optimized: ${formatBytes(result.beforeBytes)} -> ${formatBytes(result.afterBytes)} ` +
    `(-${(saved * 100).toFixed(0)}%, ${result.applied.join(" + ")}, ` +
    `${lossless ? "pixel-identical" : "quality floor 90"})`
  );
}
