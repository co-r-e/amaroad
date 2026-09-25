import * as fs from "node:fs";
import * as path from "node:path";
import {
  DEFAULT_PDF_IMAGE_SCALE,
  DEFAULT_PDF_JPEG_QUALITY,
  MAX_PDF_IMAGE_SCALE,
  MIN_PDF_IMAGE_SCALE,
  parseSlideRange,
} from "@/lib/pdf/shared";
import { renderDeckPdf, type DeckPdfPhase } from "@/lib/pdf/render-deck-pdf";
import { ensureServer, fetchDeckData, resolveBaseUrl } from "../lib/browser";
import { die, getBoolean, getNumber, getString, rejectUnknownFlags, type ParsedArgs } from "../lib/cli";

const USAGE = `Usage:
  pnpm amaroad pdf <deck> [options]

Exports a vector PDF: text stays selectable and searchable, SVG stays vector,
links stay clickable. One 1920x1080 page per slide. Needs a running server.

Options:
  --output <file>       PDF path (default: output/<deck>.pdf)
  --slides <range>      1-based slides to include, e.g. "1-5,8,12-" (default: all)
  --image-scale <n>     Keep raster images at n x their on-slide size, ${MIN_PDF_IMAGE_SCALE}-${MAX_PDF_IMAGE_SCALE} (default: ${DEFAULT_PDF_IMAGE_SCALE})
  --jpeg-quality <n>    JPEG quality for re-encoded opaque images, 1-100 (default: ${DEFAULT_PDF_JPEG_QUALITY})
  --original-images     Embed image files unchanged (largest output)
  --allow-errors        Write the PDF even if some slides show an MDX error
  --base-url <url>      Server URL (default: $BASE_URL or http://127.0.0.1:3850)
  --format md|json      Output format (default: md)
  --help                Show help`;

const PHASE_LABELS: Record<DeckPdfPhase, string> = {
  launching: "Launching Chromium",
  loading: "Opening print page",
  rendering: "Rendering slides",
  optimizing: "Optimizing images",
  printing: "Printing PDF",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function runPdfCommand(args: ParsedArgs): Promise<void> {
  if (getBoolean(args, "help") || getBoolean(args, "h")) {
    process.stdout.write(USAGE + "\n");
    return;
  }
  rejectUnknownFlags(args, [
    "output",
    "slides",
    "image-scale",
    "jpeg-quality",
    "original-images",
    "allow-errors",
    "base-url",
    "format",
    "deck",
  ]);

  const deck = args.positionals[0] ?? getString(args, "deck");
  if (!deck) die(`A deck name is required.\n\n${USAGE}`);

  const format = getString(args, "format") ?? "md";
  if (format !== "md" && format !== "json") die("--format must be md or json");

  const originalImages = getBoolean(args, "original-images");
  const imageScale = getNumber(args, "image-scale") ?? DEFAULT_PDF_IMAGE_SCALE;
  if (imageScale < MIN_PDF_IMAGE_SCALE || imageScale > MAX_PDF_IMAGE_SCALE) {
    die(`--image-scale must be between ${MIN_PDF_IMAGE_SCALE} and ${MAX_PDF_IMAGE_SCALE}`);
  }
  if (originalImages && args.flags.has("image-scale")) {
    die("--image-scale and --original-images cannot be combined");
  }
  const jpegQuality = getNumber(args, "jpeg-quality") ?? DEFAULT_PDF_JPEG_QUALITY;
  if (!Number.isInteger(jpegQuality) || jpegQuality < 1 || jpegQuality > 100) {
    die("--jpeg-quality must be an integer between 1 and 100");
  }

  const slides = getString(args, "slides");
  if (args.flags.has("slides") && slides === undefined) die("--slides needs a value, e.g. --slides 1-5");

  const baseUrl = resolveBaseUrl(getString(args, "base-url"));
  await ensureServer(baseUrl);
  const deckData = await fetchDeckData(baseUrl, deck);
  const range = parseSlideRange(slides, deckData.slides.length);
  if (!range.ok) die(range.error);
  if (range.indexes.length === 0) die(`Deck "${deck}" has no slides`);

  const output = path.resolve(getString(args, "output") ?? path.join("output", `${deck}.pdf`));

  let lastLine = "";
  const result = await renderDeckPdf({
    baseUrl,
    deck,
    slides,
    imageScale: originalImages ? null : imageScale,
    jpegQuality,
    allowErrors: getBoolean(args, "allow-errors"),
    onProgress: ({ phase, current, total }) => {
      if (format !== "md") return;
      const line = total > 0 ? `  ${PHASE_LABELS[phase]} ${current}/${total}` : `  ${PHASE_LABELS[phase]}...`;
      if (line === lastLine) return;
      lastLine = line;
      process.stderr.write(line + "\n");
    },
  });

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, result.pdf);

  const summary = {
    deck,
    output,
    title: result.title,
    pages: result.pages,
    bytes: result.pdf.length,
    durationMs: result.durationMs,
    images: result.images,
    errorSlides: result.errorSlides,
    warnings: result.warnings,
    pageErrors: result.pageErrors,
  };

  if (format === "json") {
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
    return;
  }

  const lines = [
    output,
    `  ${result.pages} page(s), ${formatBytes(result.pdf.length)}, ${(result.durationMs / 1000).toFixed(1)}s`,
  ];
  const { optimized, unchanged, inputBytes, outputBytes } = result.images;
  if (optimized + unchanged > 0) {
    lines.push(
      `  images: ${optimized} re-encoded, ${unchanged} unchanged (${formatBytes(inputBytes)} -> ${formatBytes(outputBytes)})`,
    );
  }
  if (result.errorSlides.length > 0) {
    lines.push(`  warning: MDX error on slide(s) ${result.errorSlides.join(", ")}`);
  }
  for (const message of result.warnings) {
    lines.push(`  warning: ${message}`);
  }
  for (const message of result.pageErrors) {
    lines.push(`  page error: ${message}`);
  }
  process.stdout.write(lines.join("\n") + "\n");
}
