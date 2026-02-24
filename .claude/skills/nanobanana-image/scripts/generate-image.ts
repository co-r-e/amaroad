#!/usr/bin/env npx tsx
/**
 * nanobanana-image: Gemini API image generation script
 *
 * Usage:
 *   npx tsx generate-image.ts --prompt "..." --output "path/to/output.png"
 *
 * Options:
 *   --prompt        Image generation prompt (required)
 *   --output        Output file path, must end with .png (required)
 *   --aspect-ratio  Aspect ratio (default: 16:9)
 *   --resolution    Resolution: 1K, 2K, or 4K (default: 2K)
 *
 * Environment:
 *   GEMINI_API_KEY  Gemini API key (required)
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Load .env.local from project root
// ---------------------------------------------------------------------------

function loadEnvLocal(): void {
  // Walk up from script directory to find project root (where .env.local lives)
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
        const value = trimmed.slice(eqIndex + 1).trim();
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

interface Args {
  prompt: string;
  output: string;
  aspectRatio: string;
  resolution: string;
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

  const prompt = map.get("--prompt");
  const output = map.get("--output");

  if (!prompt) {
    process.stderr.write("Error: --prompt is required\n");
    process.exit(1);
  }
  if (!output) {
    process.stderr.write("Error: --output is required\n");
    process.exit(1);
  }
  if (!output.endsWith(".png")) {
    process.stderr.write("Error: --output must end with .png\n");
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

  return { prompt, output, aspectRatio, resolution };
}

// ---------------------------------------------------------------------------
// Image generation
// ---------------------------------------------------------------------------

async function generateImage(args: Args): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    process.stderr.write(
      "Error: GEMINI_API_KEY environment variable is not set\n",
    );
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: args.prompt,
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
      "Error: No content parts in response. The image may have been blocked by safety filters.\n",
    );
    process.exit(1);
  }

  // Find the first image part
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart || !imagePart.inlineData?.data) {
    // Check if there's a text-only response (may contain refusal reason)
    const textPart = parts.find((p) => p.text);
    if (textPart?.text) {
      process.stderr.write(`Error: No image generated. Model response: ${textPart.text}\n`);
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

  // Write image file
  const imageBuffer = Buffer.from(imagePart.inlineData.data, "base64");
  fs.writeFileSync(args.output, imageBuffer);

  // Output absolute path to stdout
  const absolutePath = path.resolve(args.output);
  process.stdout.write(absolutePath + "\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

generateImage(parseArgs()).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});
