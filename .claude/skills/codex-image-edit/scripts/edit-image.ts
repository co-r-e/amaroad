#!/usr/bin/env -S pnpm exec tsx
/**
 * codex-image-edit: edit an existing deck image with Codex's built-in
 * `image_gen` tool.
 *
 * Claude Code has no `image_gen` tool of its own, so this delegates one
 * non-interactive `codex exec` run. The source image is copied into a throwaway
 * temp dir, which is the only directory that run can write to — the original
 * file is never reachable from it. Overwriting the source, when asked for, is
 * done here after the result has been verified.
 *
 * Usage:
 *   pnpm exec tsx .claude/skills/codex-image-edit/scripts/edit-image.ts \
 *     --image "decks/<deck>/assets/<name>.png" --prompt "..."
 *
 * Options:
 *   --image         Source image: .png, .jpg, .jpeg, or .webp (required)
 *   --prompt        What to change, English recommended (required)
 *   --output        Destination .png (default: overwrite --image in place)
 *   --resolution    1K, 2K, or 4K longest-edge cap (default: 1K)
 *   --model         Codex model override (default: the Codex CLI default)
 *   --timeout       Seconds to wait for Codex (default: 480)
 *   --optimize      Shrink the PNG: lossless (default) | aggressive | off
 *   --no-resize     Keep Codex's native dimensions
 *   --force         Allow overwriting an existing destination other than --image
 *
 * Requires the Codex CLI signed in (`codex login`). No OPENAI_API_KEY is used.
 */

import * as fs from "fs";
import * as path from "path";
import {
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
  readPngSize,
  requireString,
  runCodex,
} from "../../codex-image/scripts/codex-image-lib";

const KNOWN_FLAGS = [
  "--image",
  "--prompt",
  "--output",
  "--resolution",
  "--model",
  "--timeout",
  "--optimize",
  "--no-resize",
  "--force",
] as const;

const BOOLEAN_FLAGS = ["--no-resize", "--force"] as const;

const SUPPORTED_INPUT_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];
const DEFAULT_RESOLUTION: Resolution = "1K";
const DEFAULT_TIMEOUT_SECONDS = 480;
// Lossless by default: the saved file is pixel-identical to what Codex produced.
const DEFAULT_OPTIMIZE: OptimizeMode = "lossless";

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2), KNOWN_FLAGS, BOOLEAN_FLAGS);

  const source = path.resolve(requireString(flags, "--image"));
  const prompt = requireString(flags, "--prompt");

  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
    fail(`--image not found: ${source}`);
  }
  const sourceExtension = path.extname(source).toLowerCase();
  if (!SUPPORTED_INPUT_EXTENSIONS.includes(sourceExtension)) {
    fail(
      `--image must be one of: ${SUPPORTED_INPUT_EXTENSIONS.join(", ")} (got ${sourceExtension || "no extension"})`,
    );
  }

  const outputFlag = optionalString(flags, "--output");
  let destination: string;
  if (outputFlag) {
    destination = assertPngPath(outputFlag, "--output");
  } else if (sourceExtension === ".png") {
    // Overwriting in place keeps every existing MDX reference valid.
    destination = source;
  } else {
    fail(
      `--output is required because the edit result is a PNG and --image is ${sourceExtension}.\n` +
        "Pass an explicit .png destination.",
    );
  }

  const replacingSource = destination === source;
  if (
    !replacingSource &&
    fs.existsSync(destination) &&
    flags.get("--force") !== true
  ) {
    fail(
      `${destination} already exists.\n` +
        "Pass --force to replace it, or choose a versioned sibling name such as <name>-v2.png.",
    );
  }

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

  const sourceSize = readPngSize(source);

  const sandbox = createSandbox();
  try {
    // Keep the real extension so Codex's view_image reads it correctly.
    const sandboxInput = `input${sourceExtension}`;
    fs.copyFileSync(source, path.join(sandbox.dir, sandboxInput));

    const instruction = [
      "Edit one existing image.",
      "",
      `The edit target is ./${sandboxInput} in the current working directory.`,
      "Load it with the built-in `view_image` tool first so it is visible in context, then edit it with the built-in `image_gen` tool.",
      "Treat it as the edit target, not as a style reference.",
      "",
      "Edit request:",
      prompt,
      "",
      "Preserve everything the request does not mention: subject identity, pose, composition, framing, colors, background, and art style.",
      "Do not change or add text inside the image unless the request asks for exact wording.",
      "",
      CODEX_GUARDRAILS,
    ].join("\n");

    info(`Editing with Codex built-in image_gen (timeout ${timeoutSeconds}s)...`);
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
      expectedRatio: sourceSize
        ? {
            value: sourceSize.width / sourceSize.height,
            label: "the source image's aspect ratio",
          }
        : undefined,
    });
    info(
      replacingSource
        ? "Replaced the source image in place; existing MDX references stay valid."
        : `Saved alongside the source; update MDX references from ./${path.basename(source)} to ./${path.basename(destination)}.`,
    );
  } finally {
    sandbox.cleanup();
  }
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});
