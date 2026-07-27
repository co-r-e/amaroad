#!/usr/bin/env -S pnpm exec tsx
/**
 * codex-image: generate a slide image with Codex's built-in `image_gen` tool.
 *
 * Claude Code has no `image_gen` tool of its own, so this delegates one
 * non-interactive `codex exec` run whose only writable directory is a throwaway
 * temp dir. The bitmap is verified and installed here, not by the delegated
 * agent — nothing under decks/ is ever writable from that run.
 *
 * Usage:
 *   pnpm exec tsx .claude/skills/codex-image/scripts/generate-image.ts \
 *     --prompt "..." --output "decks/<deck>/assets/<name>.png"
 *
 * Options:
 *   --prompt        Image description, English recommended (required)
 *   --output        Destination path, must end with .png (required)
 *   --aspect-ratio  Requested framing (default: 16:9)
 *   --resolution    1K, 2K, or 4K longest-edge cap (default: 1K)
 *   --model         Codex model override (default: the Codex CLI default)
 *   --timeout       Seconds to wait for Codex (default: 480)
 *   --optimize      Shrink the PNG: lossless (default) | aggressive | off
 *   --no-resize     Keep Codex's native dimensions
 *   --force         Allow overwriting an existing destination file
 *
 * Requires the Codex CLI signed in (`codex login`). No OPENAI_API_KEY is used.
 */

import * as fs from "fs";
import {
  ASPECT_RATIOS,
  AspectRatio,
  CODEX_GUARDRAILS,
  OPTIMIZE_MODES,
  OptimizeMode,
  RESOLUTIONS,
  Resolution,
  assertPngPath,
  assertSandboxOutput,
  createSandbox,
  fail,
  info,
  installOutput,
  optionalString,
  parseChoice,
  parseFlags,
  parsePositiveInt,
  requireString,
  runCodex,
} from "./codex-image-lib";

const KNOWN_FLAGS = [
  "--prompt",
  "--output",
  "--aspect-ratio",
  "--resolution",
  "--model",
  "--timeout",
  "--optimize",
  "--no-resize",
  "--force",
] as const;

const BOOLEAN_FLAGS = ["--no-resize", "--force"] as const;

const DEFAULT_ASPECT_RATIO: AspectRatio = "16:9";
// CLAUDE.md's ai_image_generation rule defaults decks to 1K.
const DEFAULT_RESOLUTION: Resolution = "1K";
const DEFAULT_TIMEOUT_SECONDS = 480;
// Lossless by default: the saved file is pixel-identical to what Codex produced.
const DEFAULT_OPTIMIZE: OptimizeMode = "lossless";

function describeFraming(ratio: AspectRatio): string {
  const value = ASPECT_RATIOS[ratio];
  if (value > 1.05) return "landscape";
  if (value < 0.95) return "portrait";
  return "square";
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2), KNOWN_FLAGS, BOOLEAN_FLAGS);

  const prompt = requireString(flags, "--prompt");
  const destination = assertPngPath(requireString(flags, "--output"), "--output");
  const aspectRatio = parseChoice(
    optionalString(flags, "--aspect-ratio"),
    Object.keys(ASPECT_RATIOS) as AspectRatio[],
    "--aspect-ratio",
    DEFAULT_ASPECT_RATIO,
  );
  const resolution = parseChoice(
    optionalString(flags, "--resolution"),
    Object.keys(RESOLUTIONS) as Resolution[],
    "--resolution",
    DEFAULT_RESOLUTION,
  );
  const model = optionalString(flags, "--model");
  const timeoutSeconds = parsePositiveInt(
    optionalString(flags, "--timeout"),
    "--timeout",
    DEFAULT_TIMEOUT_SECONDS,
  );
  const optimize = parseChoice(
    optionalString(flags, "--optimize"),
    OPTIMIZE_MODES,
    "--optimize",
    DEFAULT_OPTIMIZE,
  );

  if (fs.existsSync(destination) && flags.get("--force") !== true) {
    fail(
      `${destination} already exists.\n` +
        "Pass --force to replace it, or choose a versioned sibling name such as <name>-v2.png.",
    );
  }

  const instruction = [
    "Generate one image to be used inside a presentation slide.",
    "",
    "Image request:",
    prompt,
    "",
    `Framing: ${describeFraming(aspectRatio)} composition, ${aspectRatio} aspect ratio.`,
    "Do not render any text inside the image unless the request above asks for exact wording.",
    "",
    CODEX_GUARDRAILS,
  ].join("\n");

  const sandbox = createSandbox();
  try {
    info(`Generating with Codex built-in image_gen (timeout ${timeoutSeconds}s)...`);
    const result = await runCodex({
      instruction,
      workdir: sandbox.dir,
      model,
      timeoutMs: timeoutSeconds * 1000,
    });
    info(`Codex finished in ${Math.round(result.durationMs / 1000)}s.`);

    assertSandboxOutput(sandbox, result);
    installOutput({
      sandbox,
      destination,
      resolution,
      resize: flags.get("--no-resize") !== true,
      optimize,
      expectedRatio: { value: ASPECT_RATIOS[aspectRatio], label: aspectRatio },
    });
  } finally {
    sandbox.cleanup();
  }
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});
