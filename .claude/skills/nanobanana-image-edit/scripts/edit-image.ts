#!/usr/bin/env -S pnpm exec tsx
/**
 * nanobanana-image-edit: Gemini API image editing script
 *
 * Usage:
 *   pnpm exec tsx edit-image.ts --image "path/to/input.png" --prompt "Edit instructions" --output "path/to/output.png"
 *
 * Options:
 *   --image         Input image file path (required)
 *   --prompt        Edit instructions (required)
 *   --output        Output file path: .png, .jpg, .jpeg, or .webp
 *                   (default: same as --image, which keeps MDX references valid).
 *                   Gemini's bytes are re-encoded into this container as needed.
 *   --aspect-ratio  Aspect ratio (default: 16:9)
 *   --resolution    Resolution: 1K, 2K, or 4K (default: 2K)
 *   --model         Gemini image model: gemini-3.1-flash-lite-image or
 *                   gemini-3.1-flash-image-preview (default: gemini-3.1-flash-lite-image)
 *   --optimize      Shrink the PNG: lossless (default) | aggressive | off
 *
 * Environment:
 *   GEMINI_API_KEY  Gemini API key (required)
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import {
  OPTIMIZE_MODES,
  OptimizeMode,
  SUPPORTED_IMAGE_EXTENSIONS,
  describeOptimization,
  optimizePng,
  saveImage,
} from "../../_shared/image";

// ---------------------------------------------------------------------------
// Load .env.local from project root
// ---------------------------------------------------------------------------

function loadEnvLocal(): void {
  let dir = path.resolve(__dirname, "..");
  for (let i = 0; i < 10; i++) {
    const envPath = path.join(dir, ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
      return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

loadEnvLocal();

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const VALID_MODELS = [
  "gemini-3.1-flash-image-preview",
  "gemini-3.1-flash-lite-image",
] as const;
// Lite is the default: it is faster and cheaper, and matches slide illustration
// quality. Switch to gemini-3.1-flash-image-preview when an edit needs finer
// detail preservation or dense text.
const DEFAULT_MODEL = "gemini-3.1-flash-lite-image";

interface Args {
  image: string;
  prompt: string;
  output: string;
  aspectRatio: string;
  resolution: string;
  model: string;
  optimize: OptimizeMode;
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

  const image = map.get("--image");
  const prompt = map.get("--prompt");

  if (!image) {
    process.stderr.write("Error: --image is required\n");
    process.exit(1);
  }
  if (!prompt) {
    process.stderr.write("Error: --prompt is required\n");
    process.exit(1);
  }
  if (!fs.existsSync(image)) {
    process.stderr.write(`Error: Input image not found: ${image}\n`);
    process.exit(1);
  }

  const output = map.get("--output") ?? image;
  if (
    !(SUPPORTED_IMAGE_EXTENSIONS as readonly string[]).includes(
      path.extname(output).toLowerCase(),
    )
  ) {
    process.stderr.write(
      `Error: --output must end with one of: ${SUPPORTED_IMAGE_EXTENSIONS.join(", ")}\n`,
    );
    process.exit(1);
  }

  const aspectRatio = map.get("--aspect-ratio") ?? "16:9";
  const validRatios = [
    "1:1",
    "2:3",
    "3:2",
    "3:4",
    "4:3",
    "4:5",
    "5:4",
    "9:16",
    "16:9",
    "21:9",
  ];
  if (!validRatios.includes(aspectRatio)) {
    process.stderr.write(
      `Error: --aspect-ratio must be one of: ${validRatios.join(", ")}\n`,
    );
    process.exit(1);
  }

  const resolution = map.get("--resolution") ?? "2K";
  const validResolutions = ["1K", "2K", "4K"];
  if (!validResolutions.includes(resolution)) {
    process.stderr.write(
      `Error: --resolution must be one of: ${validResolutions.join(", ")}\n`,
    );
    process.exit(1);
  }

  const model = map.get("--model") ?? DEFAULT_MODEL;
  if (!VALID_MODELS.includes(model as (typeof VALID_MODELS)[number])) {
    process.stderr.write(
      `Error: --model must be one of: ${VALID_MODELS.join(", ")}\n`,
    );
    process.exit(1);
  }

  const optimize = (map.get("--optimize") ?? "lossless") as OptimizeMode;
  if (!OPTIMIZE_MODES.includes(optimize)) {
    process.stderr.write(
      `Error: --optimize must be one of: ${OPTIMIZE_MODES.join(", ")}\n`,
    );
    process.exit(1);
  }

  return { image, prompt, output, aspectRatio, resolution, model, optimize };
}

// ---------------------------------------------------------------------------
// Image editing
// ---------------------------------------------------------------------------

async function editImage(args: Args): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    process.stderr.write(
      "Error: GEMINI_API_KEY environment variable is not set\n",
    );
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });

  // Read input image as base64
  const imageData = fs.readFileSync(args.image).toString("base64");
  const mimeType = "image/png";

  const response = await ai.models.generateContent({
    model: args.model,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: imageData } },
          { text: args.prompt },
        ],
      },
    ],
    config: {
      responseModalities: ["image"],
      imageConfig: {
        aspectRatio: args.aspectRatio,
        imageSize: args.resolution,
      },
    },
  });

  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) {
    process.stderr.write("Error: No candidates returned from Gemini API\n");
    process.exit(1);
  }

  const parts = candidates[0].content?.parts;
  if (!parts || parts.length === 0) {
    process.stderr.write(
      "Error: No content parts in response. The edit may have been blocked by safety filters.\n",
    );
    process.exit(1);
  }

  // Find the first image part
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart || !imagePart.inlineData?.data) {
    const textPart = parts.find((p) => p.text);
    if (textPart?.text) {
      process.stderr.write(
        `Error: No image generated. Model response: ${textPart.text}\n`,
      );
    } else {
      process.stderr.write("Error: No image data in response\n");
    }
    process.exit(1);
  }

  // Ensure output directory exists
  const outputDir = path.dirname(args.output);
  if (outputDir && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Decode and validate image data
  const imageBuffer = Buffer.from(imagePart.inlineData.data, "base64");
  if (imageBuffer.length === 0) {
    process.stderr.write("Error: Decoded image data is empty\n");
    process.exit(1);
  }

  // Keep the destination container: the default output is the source path, and
  // changing its extension would break every MDX reference to it.
  const saved = saveImage(imageBuffer, args.output);
  if (saved.note) {
    process.stderr.write(`Warning: ${saved.note}\n`);
  }

  // Shrink the saved file. Lossless by default, so pixels are untouched.
  // JPEG/WebP are already compressed and are left alone.
  const absolutePath = path.resolve(saved.path);
  const optimization = optimizePng(absolutePath, args.optimize);
  const optimizationSummary = describeOptimization(optimization);
  if (optimizationSummary) {
    process.stderr.write(`${optimizationSummary}\n`);
  }
  if (optimization.note) {
    process.stderr.write(`Warning: ${optimization.note}\n`);
  }

  // Output absolute path to stdout
  process.stdout.write(absolutePath + "\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

editImage(parseArgs()).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});
