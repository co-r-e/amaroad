import * as fs from "node:fs";
import * as path from "node:path";
import {
  NARRATION_MANIFEST_FILE,
  computeNarrationStatus,
  narrationAudioFileName,
  narrationDirPath,
  narrationOutputDigest,
  normalizeNarrationText,
  readNarrationManifest,
  resolveNarrationSettings,
  unknownNarrationConfigKeys,
  validateNarrationConfig,
  type NarrationManifest,
} from "@/lib/narration";
import { buildDeckContext } from "../doctor/context";
import { die, getBoolean, getNumber, getString, rejectUnknownFlags, type ParsedArgs } from "../lib/cli";
import { findProjectRoot, resolveDeckEntry } from "../lib/decks";
import { loadProjectEnv } from "../lib/env";
import { nonTextNarrationProblem } from "../lib/frontmatter";
import { NarrationFatalError, createNarrationSynthesizer } from "../lib/narration-tts";

const USAGE = `Usage:
  pnpm amaroad narrate <deck> [options]

Generates read-aloud audio (Gemini TTS -> MP3) for every slide that has a
\`narration\` frontmatter field, into decks/<deck>/narration/ (git-ignored).
Presenter mode plays it with the A key. Audio whose script and voice
settings are unchanged is reused, so re-running only pays for edits.

Needs GEMINI_API_KEY in .env.local (your own key; usage is billed to it).

Options:
  --slide N          Only this slide (0-based, as in capture/overflow)
  --force            Regenerate even when up-to-date audio exists
  --dry-run          Show what would be generated or removed (no API calls, no key needed)
  --format md|json   Output format (default: md)
  --help             Show help`;

/** Scripts past this length risk the TTS output cap (~10 minutes of audio). */
const LONG_SCRIPT_CHARS = 3000;
const AUDIO_FILE_PATTERN = /^[0-9a-f]{16}\.mp3$/;
const TEMP_PREFIX = ".tmp-";

type SlideResultStatus = "generated" | "up-to-date" | "no-narration" | "would-generate" | "failed" | "not-run";

interface SlideResult {
  index: number;
  file: string;
  status: SlideResultStatus;
  durationSec?: number;
  bytes?: number;
  error?: string;
  warning?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Write via a same-directory temp file so a crash never leaves a truncated file behind. */
async function writeFileAtomic(target: string, data: Uint8Array | string): Promise<void> {
  const temp = path.join(path.dirname(target), `${TEMP_PREFIX}${process.pid}-${Date.now()}-${path.basename(target)}.part`);
  fs.writeFileSync(temp, data);
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(temp, target);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      // Windows: antivirus / indexers briefly hold handles on fresh files.
      const transient = code === "EPERM" || code === "EACCES" || code === "EBUSY";
      if (!transient || attempt >= 4) {
        fs.rmSync(temp, { force: true });
        throw error;
      }
      await sleep(100 * 2 ** attempt);
    }
  }
}

function writeManifest(dir: string, manifest: NarrationManifest): Promise<void> {
  return writeFileAtomic(path.join(dir, NARRATION_MANIFEST_FILE), JSON.stringify(manifest, null, 2) + "\n");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runNarrateCommand(args: ParsedArgs): Promise<void> {
  if (getBoolean(args, "help") || getBoolean(args, "h")) {
    process.stdout.write(USAGE + "\n");
    return;
  }
  rejectUnknownFlags(args, ["slide", "force", "dry-run", "format", "deck"]);

  const deckName = args.positionals[0] ?? getString(args, "deck");
  if (!deckName) die(`A deck name is required.\n\n${USAGE}`);
  if (deckName.startsWith("_") || deckName.startsWith(".")) die(`"${deckName}" is not a deck`);

  const format = getString(args, "format") ?? "md";
  if (format !== "md" && format !== "json") die("--format must be md or json");
  const dryRun = getBoolean(args, "dry-run");
  const force = getBoolean(args, "force");
  const log = (line: string) => {
    if (format === "md") process.stderr.write(line + "\n");
  };

  const projectRoot = findProjectRoot();
  const ctx = await buildDeckContext(projectRoot, resolveDeckEntry(projectRoot, deckName));
  if (ctx.configError) die(`decks/${deckName}/deck.config.ts: ${ctx.configError}`);
  const configProblems = validateNarrationConfig(ctx.config);
  if (configProblems.length > 0) die(`decks/${deckName}/deck.config.ts: ${configProblems.join("; ")}`);
  for (const key of unknownNarrationConfigKeys(ctx.config)) {
    process.stderr.write(`warning: narration.${key} in deck.config.ts is not a known setting and is ignored\n`);
  }

  const slideIndex = getNumber(args, "slide");
  if (slideIndex !== undefined && (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex >= ctx.slides.length)) {
    die(`--slide must be an integer between 0 and ${ctx.slides.length - 1}`);
  }

  const settings = resolveNarrationSettings(ctx.config);
  const dir = narrationDirPath(ctx.deckDir);
  const manifest = await readNarrationManifest(ctx.deckDir);
  const statuses = await computeNarrationStatus(
    ctx.deckDir,
    settings,
    ctx.slides.map((slide) => ({ filename: slide.filename, narration: slide.data?.frontmatter.narration })),
    manifest,
  );

  const selected = slideIndex === undefined ? ctx.slides.map((_, i) => i) : [slideIndex];
  const results: SlideResult[] = [];
  const toGenerate: { result: SlideResult; hash: string; text: string }[] = [];
  let manifestChanged = false;

  for (const index of selected) {
    const slide = ctx.slides[index];
    const status = statuses[index];
    const result: SlideResult = { index, file: slide.filename, status: "no-narration" };
    results.push(result);

    if (!slide.data) {
      result.status = "failed";
      result.error = "slide could not be parsed";
      continue;
    }
    const nonText = nonTextNarrationProblem(slide.raw);
    if (nonText) {
      result.status = "failed";
      result.error = nonText;
      continue;
    }
    if (status.state === "none" || !status.hash) continue;

    const text = normalizeNarrationText(slide.data.frontmatter.narration);
    if (text.length > LONG_SCRIPT_CHARS) {
      result.warning = `script is ${text.length} characters; very long scripts can exceed the TTS output limit (~10 min). Consider splitting the slide.`;
    }
    if (status.state === "fresh" && !force) {
      result.status = "up-to-date";
      result.durationSec = status.entry?.durationSec;
      // Renamed slide or reverted script: remember the reuse so "stale" stays accurate.
      if (manifest.slides[slide.filename] !== status.hash) {
        manifest.slides[slide.filename] = status.hash;
        manifestChanged = true;
      }
      continue;
    }
    result.status = dryRun ? "would-generate" : "not-run";
    toGenerate.push({ result, hash: status.hash, text });
  }

  const hasParseFailures = results.some((r) => r.status === "failed");

  if (!dryRun && toGenerate.length > 0) {
    loadProjectEnv(projectRoot);
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      die("GEMINI_API_KEY is not set. Add your own Gemini API key to .env.local (see .env.example).");
    }
    fs.mkdirSync(dir, { recursive: true });
    const synthesize = await createNarrationSynthesizer(apiKey);

    log(`Generating ${toGenerate.length} narration track(s) with ${settings.model} (voice ${settings.voice})`);
    let previousError: string | null = null;
    for (const [i, job] of toGenerate.entries()) {
      const label = `  [${i + 1}/${toGenerate.length}] ${job.result.file}`;
      try {
        const audio = await synthesize(settings, job.text);
        const file = narrationAudioFileName(job.hash);
        await writeFileAtomic(path.join(dir, file), audio.mp3);
        manifest.entries[job.hash] = {
          file,
          outputDigest: narrationOutputDigest(audio.mp3),
          durationSec: audio.durationSec,
          createdAt: new Date().toISOString(),
        };
        manifest.slides[job.result.file] = job.hash;
        // Persist after every track so an interrupted run keeps what it paid for.
        await writeManifest(dir, manifest);
        manifestChanged = false;
        job.result.status = "generated";
        job.result.durationSec = audio.durationSec;
        job.result.bytes = audio.mp3.length;
        previousError = null;
        log(`${label} ${audio.durationSec.toFixed(1)}s`);
      } catch (error) {
        const message = errorMessage(error);
        job.result.status = "failed";
        job.result.error = message;
        log(`${label} failed: ${message}`);
        if (error instanceof NarrationFatalError) {
          log("  Stopping: every remaining slide would fail the same way. Finished tracks are kept.");
          break;
        }
        // The same rejection twice in a row (e.g. an unknown voice name) is a
        // settings problem, not a per-slide one.
        if (message === previousError) {
          log("  Stopping: the same error repeated; check narration settings in deck.config.ts. Finished tracks are kept.");
          break;
        }
        previousError = message;
      }
    }
  }

  // Cleanup only on a complete, successful full-deck run: never discard paid
  // audio because of a partial selection or a failed request.
  const removed: string[] = [];
  const complete = slideIndex === undefined && !hasParseFailures && results.every((r) => r.status !== "failed" && r.status !== "not-run");
  if (complete && fs.existsSync(dir)) {
    const referenced = new Set(statuses.map((s) => s.hash).filter((h): h is string => h !== null));
    const narrated = new Set(statuses.filter((s) => s.state !== "none").map((s) => s.filename));

    for (const hash of Object.keys(manifest.entries)) {
      if (referenced.has(hash)) continue;
      removed.push(manifest.entries[hash].file);
      if (!dryRun) delete manifest.entries[hash];
    }
    for (const name of fs.readdirSync(dir)) {
      const orphanAudio = AUDIO_FILE_PATTERN.test(name) && !referenced.has(name.slice(0, 16)) && !removed.includes(name);
      if (orphanAudio || name.startsWith(TEMP_PREFIX)) removed.push(name);
    }
    for (const filename of Object.keys(manifest.slides)) {
      if (!narrated.has(filename)) {
        if (!dryRun) delete manifest.slides[filename];
        manifestChanged = true;
      }
    }
    if (!dryRun) {
      for (const name of removed) fs.rmSync(path.join(dir, name), { force: true });
      if (removed.length > 0) manifestChanged = true;
    }
  }

  if (!dryRun && manifestChanged && fs.existsSync(dir)) await writeManifest(dir, manifest);

  const count = (status: SlideResultStatus) => results.filter((r) => r.status === status).length;
  const summary = {
    generated: count("generated"),
    upToDate: count("up-to-date"),
    wouldGenerate: count("would-generate"),
    noNarration: count("no-narration"),
    failed: count("failed"),
    notRun: count("not-run"),
    removed: removed.length,
    audioSec: Math.round(results.reduce((sum, r) => sum + (r.durationSec ?? 0), 0) * 10) / 10,
  };
  const failed = summary.failed > 0 || summary.notRun > 0;

  if (format === "json") {
    process.stdout.write(
      JSON.stringify(
        { deck: deckName, dryRun, model: settings.model, voice: settings.voice, directory: path.relative(projectRoot, dir), slides: results, removed, summary },
        null,
        2,
      ) + "\n",
    );
  } else {
    const lines = [`decks/${deckName}/narration (${settings.model}, voice ${settings.voice})${dryRun ? " [dry run]" : ""}`];
    for (const r of results) {
      if (r.status === "no-narration") continue;
      const detail = r.error ? `: ${r.error}` : r.durationSec !== undefined ? ` (${r.durationSec.toFixed(1)}s)` : "";
      lines.push(`  ${String(r.index).padStart(3)}  ${r.file}  ${r.status}${detail}`);
      if (r.warning) lines.push(`       warning: ${r.warning}`);
    }
    for (const name of removed) lines.push(`  ${dryRun ? "would remove" : "removed"} ${name}`);
    lines.push(
      `  ${summary.generated} generated, ${summary.upToDate} up to date, ${summary.wouldGenerate} to generate, ${summary.failed} failed${summary.notRun > 0 ? `, ${summary.notRun} not run` : ""}, ${summary.noNarration} without narration`,
    );
    if (summary.generated > 0) lines.push("  Reload the presenter window to pick up new audio.");
    process.stdout.write(lines.join("\n") + "\n");
  }

  if (failed) process.exitCode = 1;
}
