import * as path from "node:path";
import { captureAllSlides, captureSlide } from "../lib/capture";
import { die, getBoolean, getNumber, getString, rejectUnknownFlags, type ParsedArgs } from "../lib/cli";

const USAGE = `Usage:
  pnpm amaroad capture <deck> --slide <index> --output <file.png> [options]
  pnpm amaroad capture <deck> --all --out-dir <dir> [options]

Options:
  --slide <n>        0-based slide index
  --output <file>    PNG path for a single slide
  --all              Capture every slide of the deck
  --out-dir <dir>    Directory for --all (default: output/<deck>)
  --scale <n>        Raster scale relative to 1920x1080 (default: 1)
  --base-url <url>   Server URL (default: $BASE_URL or http://127.0.0.1:3850)
  --format md|json   Output format (default: md)
  --help             Show help`;

export async function runCaptureCommand(args: ParsedArgs): Promise<void> {
  if (getBoolean(args, "help") || getBoolean(args, "h")) {
    process.stdout.write(USAGE + "\n");
    return;
  }
  rejectUnknownFlags(args, ["slide", "output", "all", "out-dir", "scale", "base-url", "format", "deck"]);

  const deck = args.positionals[0] ?? getString(args, "deck");
  if (!deck) die(`A deck name is required.\n\n${USAGE}`);

  const format = getString(args, "format") ?? "md";
  if (format !== "md" && format !== "json") die("--format must be md or json");

  const scale = getNumber(args, "scale") ?? 1;
  if (scale <= 0 || scale > 4) die("--scale must be between 0 and 4");
  const baseUrl = getString(args, "base-url");

  if (getBoolean(args, "all")) {
    const outDir = getString(args, "out-dir") ?? path.join("output", deck);
    const results = await captureAllSlides({
      deck,
      baseUrl,
      scale,
      outDir,
      onProgress: (info) => {
        if (format === "md") {
          process.stderr.write(`  [${info.index + 1}/${info.total}] ${info.file} -> ${info.output}\n`);
        }
      },
    });
    if (format === "json") {
      process.stdout.write(JSON.stringify({ deck, outDir: path.resolve(outDir), slides: results }, null, 2) + "\n");
    } else {
      process.stdout.write(`Captured ${results.length} slide(s) to ${path.resolve(outDir)}\n`);
    }
    return;
  }

  const index = getNumber(args, "slide");
  const output = getString(args, "output");
  if (index === undefined || output === undefined) {
    die(`--slide and --output are required unless --all is given.\n\n${USAGE}`);
  }
  if (!Number.isInteger(index) || index < 0) die("--slide must be a non-negative integer");

  const result = await captureSlide({ deck, index, output, baseUrl, scale });
  if (format === "json") {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    process.stdout.write(result.output + "\n");
  }
}
