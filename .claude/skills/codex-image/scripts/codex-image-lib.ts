/**
 * Shared runtime for the codex-image and codex-image-edit skills.
 *
 * Claude Code cannot call Codex's built-in `image_gen` tool, so these skills
 * delegate one non-interactive `codex exec` run per image. The delegated agent
 * is confined to a throwaway temp directory: it never sees the deck, and the
 * bitmap it produces is validated and installed at the destination by this
 * module rather than by the agent itself.
 *
 * Requires the Codex CLI (`codex`) to be installed and signed in. No
 * OPENAI_API_KEY is involved — the built-in tool runs on the ChatGPT/Codex
 * subscription.
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  OptimizeMode,
  describeOptimization,
  downscaleToMaxEdge,
  formatBytes,
  formatRatio,
  isPng,
  optimizePng,
  readPngSize,
} from "../../_shared/image";

export { OPTIMIZE_MODES, readPngSize } from "../../_shared/image";
export type { ImageSize, OptimizeMode } from "../../_shared/image";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Aspect ratios shared with the nanobanana skills, mapped to width / height. */
export const ASPECT_RATIOS = {
  "9:16": 9 / 16,
  "2:3": 2 / 3,
  "3:4": 3 / 4,
  "4:5": 4 / 5,
  "1:1": 1,
  "5:4": 5 / 4,
  "4:3": 4 / 3,
  "3:2": 3 / 2,
  "16:9": 16 / 9,
  "21:9": 21 / 9,
} as const;

export type AspectRatio = keyof typeof ASPECT_RATIOS;

/** Longest-edge budget per resolution tier, in pixels. */
export const RESOLUTIONS = {
  "1K": 1536,
  "2K": 2560,
  "4K": 3840,
} as const;

export type Resolution = keyof typeof RESOLUTIONS;

/** Filename the delegated agent must write inside the sandbox directory. */
export const SANDBOX_OUTPUT = "output.png";

/** Beyond this the deck runtime starts to suffer; see CLAUDE.md. */
const SIZE_WARN_BYTES = 2 * 1024 * 1024;

/** Relative aspect drift tolerated before we warn the caller. */
const ASPECT_TOLERANCE = 0.05;

// ---------------------------------------------------------------------------
// Console helpers
//
// stdout carries exactly one line — the absolute destination path — so callers
// can pipe it. Everything human-facing goes to stderr.
// ---------------------------------------------------------------------------

export function info(message: string): void {
  process.stderr.write(`${message}\n`);
}

export function warn(message: string): void {
  process.stderr.write(`Warning: ${message}\n`);
}

export function fail(message: string): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

export type Flags = Map<string, string | true>;

/**
 * Parses `--key value` pairs plus the boolean flags named in `booleanFlags`.
 *
 * A value is consumed unconditionally so prompts starting with `-` survive, and
 * unknown keys are rejected rather than silently ignored — a typo in
 * `--resolution` must not quietly fall back to the default.
 */
export function parseFlags(
  argv: string[],
  knownFlags: readonly string[],
  booleanFlags: readonly string[] = [],
): Flags {
  const known = new Set(knownFlags);
  const booleans = new Set(booleanFlags);
  const flags: Flags = new Map();

  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--")) {
      fail(`Unexpected argument: ${key}`);
    }
    if (!known.has(key)) {
      fail(`Unknown option: ${key}\nKnown options: ${knownFlags.join(", ")}`);
    }
    if (booleans.has(key)) {
      flags.set(key, true);
      continue;
    }
    if (i + 1 >= argv.length) {
      fail(`Missing value for ${key}`);
    }
    flags.set(key, argv[++i]);
  }

  return flags;
}

export function requireString(flags: Flags, key: string): string {
  const value = flags.get(key);
  if (value === undefined) {
    fail(`${key} is required`);
  }
  if (value === true) {
    fail(`${key} requires a value`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    fail(`${key} must not be empty`);
  }
  return trimmed;
}

export function optionalString(flags: Flags, key: string): string | undefined {
  const value = flags.get(key);
  if (value === undefined || value === true) return undefined;
  return value.trim() || undefined;
}

export function parseChoice<T extends string>(
  raw: string | undefined,
  choices: readonly T[],
  key: string,
  fallback: T,
): T {
  if (raw === undefined) return fallback;
  if (!(choices as readonly string[]).includes(raw)) {
    fail(`${key} must be one of: ${choices.join(", ")}`);
  }
  return raw as T;
}

export function parsePositiveInt(
  raw: string | undefined,
  key: string,
  fallback: number,
): number {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    fail(`${key} must be a positive integer`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Codex delegation
// ---------------------------------------------------------------------------

/**
 * Rules every delegated run must follow. They keep the agent on the built-in
 * tool (no API key, no fallback script) and inside the sandbox directory.
 */
export const CODEX_GUARDRAILS = `Hard rules:
- Use the built-in \`image_gen\` tool. Never run scripts/image_gen.py, never call the OpenAI Images API directly, and never ask for OPENAI_API_KEY.
- Write the final image to ./${SANDBOX_OUTPUT} in the current working directory. Copy it out of \$CODEX_HOME/generated_images/ if the tool leaves it there.
- Keep the output a valid PNG file.
- Write nothing outside the current working directory. Do not run git commands.
- Do not resize, crop, pad, or re-encode the generated image; the caller handles that.
- Do not ask clarifying questions. If a detail is unspecified, choose a sensible option and proceed.
- End your final message with the single line: DONE`;

export interface CodexRunOptions {
  instruction: string;
  workdir: string;
  model?: string;
  timeoutMs: number;
}

export interface CodexRunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
}

/** Keeps only the tail of a stream so a chatty run cannot exhaust memory. */
class TailBuffer {
  private chunks: string[] = [];
  private length = 0;

  constructor(private readonly limit: number) {}

  push(chunk: string): void {
    this.chunks.push(chunk);
    this.length += chunk.length;
    while (this.length > this.limit && this.chunks.length > 1) {
      this.length -= this.chunks.shift()!.length;
    }
  }

  toString(): string {
    return this.chunks.join("").slice(-this.limit);
  }
}

export function runCodex(options: CodexRunOptions): Promise<CodexRunResult> {
  const args = [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "workspace-write",
    "-c",
    'approval_policy="never"',
    "-C",
    options.workdir,
    "--color",
    "never",
  ];
  if (options.model) {
    args.push("-m", options.model);
  }
  args.push("-");

  return new Promise((resolve) => {
    const startedAt = Date.now();
    const stdout = new TailBuffer(64 * 1024);
    const stderr = new TailBuffer(64 * 1024);
    let timedOut = false;
    let settled = false;

    const child = spawn("codex", args, {
      cwd: options.workdir,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const heartbeat = setInterval(() => {
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      info(`  ... codex still working (${seconds}s elapsed)`);
    }, 30_000);

    const killTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
    }, options.timeoutMs);

    const settle = (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearInterval(heartbeat);
      clearTimeout(killTimer);
      resolve({
        exitCode,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        timedOut,
        durationMs: Date.now() - startedAt,
      });
    };

    child.stdout.setEncoding("utf-8");
    child.stdout.on("data", (chunk: string) => stdout.push(chunk));
    child.stderr.setEncoding("utf-8");
    child.stderr.on("data", (chunk: string) => stderr.push(chunk));

    child.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        clearInterval(heartbeat);
        clearTimeout(killTimer);
        fail(
          "the `codex` CLI was not found on PATH.\n" +
            "Install it (https://developers.openai.com/codex/cli) and sign in with `codex login`,\n" +
            "or use the nanobanana-image / nanobanana-image-edit skills instead.",
        );
      }
      stderr.push(`\n${err.message}\n`);
      settle(null);
    });

    // A closed stdin before Codex reads it is not fatal; surface it as output.
    child.stdin.on("error", (err: Error) => stderr.push(`\n${err.message}\n`));
    child.stdin.end(options.instruction);

    child.on("close", (code) => settle(code));
  });
}

// ---------------------------------------------------------------------------
// Sandbox lifecycle
// ---------------------------------------------------------------------------

export interface Sandbox {
  dir: string;
  outputPath: string;
  cleanup: () => void;
}

export function createSandbox(): Sandbox {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-image-"));
  return {
    dir,
    outputPath: path.join(dir, SANDBOX_OUTPUT),
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // A leftover temp dir is not worth failing an otherwise good run.
      }
    },
  };
}

/**
 * Turns a finished Codex run into a verified PNG at `sandbox.outputPath`.
 *
 * Exits with a readable diagnosis when the run failed or produced nothing —
 * Codex can end successfully while having written no file at all, so the file
 * check is what actually decides success.
 */
export function assertSandboxOutput(
  sandbox: Sandbox,
  result: CodexRunResult,
): void {
  const produced = fs.existsSync(sandbox.outputPath);

  if (result.timedOut) {
    fail(
      `codex exec timed out after ${Math.round(result.durationMs / 1000)}s.\n` +
        "Raise --timeout, or simplify the prompt.\n" +
        tail(result.stderr || result.stdout),
    );
  }

  if (result.exitCode !== 0) {
    fail(
      `codex exec failed (exit code ${result.exitCode ?? "unknown"}).\n` +
        "If this is an authentication problem, run `codex login` and retry.\n" +
        tail(result.stderr || result.stdout),
    );
  }

  if (!produced) {
    fail(
      "codex exec finished but wrote no image.\n" +
        "This usually means the request was declined or the built-in image_gen tool was unavailable.\n" +
        `Codex said:\n${tail(result.stdout || result.stderr)}`,
    );
  }

  const bytes = fs.statSync(sandbox.outputPath).size;
  if (bytes === 0) {
    fail("codex exec produced an empty file.");
  }
  if (!isPng(sandbox.outputPath)) {
    fail("codex exec produced a file that is not a valid PNG.");
  }
}

function tail(text: string, lines = 25): string {
  return text.trim().split("\n").slice(-lines).join("\n");
}

// ---------------------------------------------------------------------------
// Destination handling
// ---------------------------------------------------------------------------

export function assertPngPath(value: string, flag: string): string {
  if (!value.toLowerCase().endsWith(".png")) {
    fail(`${flag} must end with .png`);
  }
  return path.resolve(value);
}

/** A ratio the result is compared against, plus how to name it in a warning. */
export interface ExpectedRatio {
  value: number;
  label: string;
}

/**
 * Moves the verified sandbox output to its destination, reports what landed
 * there, and prints the absolute path on stdout.
 *
 * `expectedRatio` is only ever a warning: the built-in tool picks its own
 * dimensions, so a mismatch is information for the caller, not a failure.
 */
export function installOutput(options: {
  sandbox: Sandbox;
  destination: string;
  resolution: Resolution;
  resize: boolean;
  optimize: OptimizeMode;
  expectedRatio?: ExpectedRatio;
}): void {
  const { sandbox, destination } = options;

  // Resize, then optimize, then install: everything happens inside the sandbox
  // so a failure at any step cannot leave a half-written file at the destination.
  if (options.resize) {
    const downscale = downscaleToMaxEdge(
      sandbox.outputPath,
      RESOLUTIONS[options.resolution],
    );
    if (downscale.note) warn(downscale.note);
  }

  const optimization = optimizePng(sandbox.outputPath, options.optimize);
  const optimizationSummary = describeOptimization(optimization);
  if (optimizationSummary) info(optimizationSummary);
  if (optimization.note) warn(optimization.note);

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  // copy rather than rename: the temp dir is often on another device.
  fs.copyFileSync(sandbox.outputPath, destination);

  const bytes = fs.statSync(destination).size;
  const size = readPngSize(destination);

  info(
    `Saved: ${destination}` +
      (size ? ` (${size.width}x${size.height}, ` : " (") +
      `${formatBytes(bytes)})`,
  );

  if (bytes > SIZE_WARN_BYTES) {
    warn(
      `the image is ${formatBytes(bytes)}. CLAUDE.md targets roughly 500KB-1MB; ` +
        "regenerate with a simpler composition or a lower --resolution rather than compressing it further.",
    );
  }

  if (size && options.expectedRatio) {
    const actual = size.width / size.height;
    const { value: target, label } = options.expectedRatio;
    if (Math.abs(actual - target) / target > ASPECT_TOLERANCE) {
      warn(
        `expected ${label} (${target.toFixed(2)}) but got ${formatRatio(size)}. ` +
          "The built-in image_gen tool chooses its own dimensions. Re-run if the framing matters.",
      );
    }
  }

  process.stdout.write(`${destination}\n`);
}
