#!/usr/bin/env npx tsx
/**
 * capture-slide.ts: Capture a slide as PNG via the /api/capture route
 *
 * Usage:
 *   npx tsx .claude/skills/nanobanana-image/scripts/capture-slide.ts \
 *     --deck <deck-name> \
 *     --slide <0-indexed> \
 *     --output <output.png> \
 *     [--port 3000]
 *
 * Requires the dev server to be running (`npm run dev`).
 */

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// CLI argument parsing (same pattern as generate-image.ts)
// ---------------------------------------------------------------------------

interface Args {
  deck: string;
  slide: number;
  output: string;
  port: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const map = new Map<string, string>();

  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key.startsWith("--") && i + 1 < args.length) {
      map.set(key, args[++i]);
    }
  }

  const deck = map.get("--deck");
  const slideStr = map.get("--slide");
  const output = map.get("--output");
  const port = parseInt(map.get("--port") || "3000", 10);

  if (!deck) {
    process.stderr.write("Error: --deck is required\n");
    process.exit(1);
  }
  if (slideStr === undefined) {
    process.stderr.write("Error: --slide is required\n");
    process.exit(1);
  }
  if (!output) {
    process.stderr.write("Error: --output is required\n");
    process.exit(1);
  }

  const slide = parseInt(slideStr, 10);
  if (isNaN(slide) || slide < 0) {
    process.stderr.write("Error: --slide must be a non-negative integer\n");
    process.exit(1);
  }

  return { deck, slide, output, port };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs();
  const url = `http://localhost:${args.port}/api/capture/${args.deck}/${args.slide}`;

  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    process.stderr.write(`Error: ${res.status} — ${text}\n`);
    process.exit(1);
  }

  const buffer = Buffer.from(await res.arrayBuffer());

  // Ensure output directory exists
  const outputDir = path.dirname(args.output);
  if (outputDir && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(args.output, buffer);

  // Output absolute path to stdout
  const absolutePath = path.resolve(args.output);
  process.stdout.write(absolutePath + "\n");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});
