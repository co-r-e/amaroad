#!/usr/bin/env -S pnpm exec tsx
/**
 * capture-slide.ts: Capture a slide as a real-render PNG (1920x1080).
 *
 * Thin wrapper around `scripts/lib/capture.ts` (the same code path as
 * `pnpm amaroad capture`). Kept for backwards compatibility with skill docs.
 *
 * Usage (the .claude and .codex copies are the same file):
 *   pnpm exec tsx .claude/skills/nanobanana-image/scripts/capture-slide.ts \
 *     --deck <deck-name> \
 *     --slide <0-indexed> \
 *     --output <output.png> \
 *     [--port 3850 | --base-url http://127.0.0.1:3850] [--scale 1]
 *
 * Requires the dev server to be running (`pnpm dev`, which serves port 3850).
 */

import { captureSlide } from "../../../../scripts/lib/capture";

interface Args {
  deck: string;
  slide: number;
  output: string;
  baseUrl?: string;
  scale: number;
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
  const port = map.get("--port");
  const baseUrl = map.get("--base-url") ?? (port ? `http://127.0.0.1:${port}` : undefined);
  const scale = Number.parseFloat(map.get("--scale") ?? "1");

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

  const slide = Number.parseInt(slideStr, 10);
  if (Number.isNaN(slide) || slide < 0) {
    process.stderr.write("Error: --slide must be a non-negative integer\n");
    process.exit(1);
  }
  if (!Number.isFinite(scale) || scale <= 0) {
    process.stderr.write("Error: --scale must be a positive number\n");
    process.exit(1);
  }

  return { deck, slide, output, baseUrl, scale };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const result = await captureSlide({
    deck: args.deck,
    index: args.slide,
    output: args.output,
    baseUrl: args.baseUrl,
    scale: args.scale,
  });
  // Output absolute path to stdout (same contract as before)
  process.stdout.write(result.output + "\n");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});
