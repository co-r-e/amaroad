/**
 * Re-encode one slide image for the vector PDF. Node only (sharp).
 *
 * Chromium embeds a JPEG as-is but stores every other raster format
 * losslessly at its full natural resolution, so a deck of AI-generated PNGs
 * turns into a PDF of several hundred MB. This shrinks each image to the
 * width the print page asked for (never below its on-slide size) and stores
 * opaque images as JPEG. Images with real transparency stay PNG.
 */

export interface PdfImageOptions {
  /** Target width in pixels; 0 or >= natural width keeps the size. */
  width: number;
  jpegQuality: number;
}

export interface PdfImageResult {
  body: Buffer;
  contentType: string;
}

const RESAMPLABLE_FORMATS = new Set(["png", "jpeg", "webp", "avif", "heif", "tiff"]);

/**
 * Returns the re-encoded image, or `null` when the original bytes are already
 * the best choice (SVG, GIF, animated images, JPEGs that need no resizing,
 * or when re-encoding would not make the file smaller).
 */
export async function optimizeImageForPdf(
  input: Buffer,
  options: PdfImageOptions,
): Promise<PdfImageResult | null> {
  const { default: sharp } = await import("sharp");
  const open = () => sharp(input, { failOn: "none", limitInputPixels: false }).autoOrient();

  let metadata;
  try {
    metadata = await sharp(input, { failOn: "none", limitInputPixels: false }).metadata();
  } catch {
    return null;
  }
  if (!metadata.format || !RESAMPLABLE_FORMATS.has(metadata.format)) return null;
  if ((metadata.pages ?? 1) > 1) return null;

  const naturalWidth = metadata.autoOrient?.width ?? metadata.width;
  const resize = options.width > 0 && naturalWidth !== undefined && options.width < naturalWidth;

  let opaque = !metadata.hasAlpha;
  if (!opaque) {
    const stats = await sharp(input, { failOn: "none", limitInputPixels: false }).stats();
    opaque = stats.isOpaque;
  }

  const resized = () => (resize ? open().resize({ width: options.width }) : open());

  if (opaque) {
    if (metadata.format === "jpeg" && !resize) return null;
    const jpeg = await resized()
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: options.jpegQuality, mozjpeg: true })
      .toBuffer();
    // Flat-color PNGs (UI screenshots, diagrams) can beat JPEG; keep the
    // smaller of the two so the PDF never grows.
    if (metadata.format === "png") {
      const png = resize ? await resized().png({ compressionLevel: 9 }).toBuffer() : input;
      if (png.length <= jpeg.length) {
        return resize ? { body: png, contentType: "image/png" } : null;
      }
    }
    return { body: jpeg, contentType: "image/jpeg" };
  }

  if (!resize) return null;
  const png = await resized().png({ compressionLevel: 9 }).toBuffer();
  return png.length < input.length ? { body: png, contentType: "image/png" } : null;
}
