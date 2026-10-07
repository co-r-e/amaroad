/**
 * Narration (slide read-aloud) settings, hashing and the per-deck audio
 * manifest, shared by the presenter page, `pnpm amaroad narrate` and doctor.
 *
 * Audio lives in `decks/<deck>/narration/` (git-ignored) and is named after
 * the hash of its inputs, so renaming or reordering slides reuses it and
 * editing a script or voice makes it stale. Uses node:crypto and the runtime
 * fs, so never import this from client components.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import fs from "./runtime-fs";
import type { DeckConfig, NarrationTrack } from "@/types/deck";

export const NARRATION_DIR = "narration";
export const NARRATION_MANIFEST_FILE = "manifest.json";
export const DEFAULT_NARRATION_MODEL = "gemini-3.8-flash-tts";
export const DEFAULT_NARRATION_VOICE = "Kore";
export const DEFAULT_SILENT_SLIDE_SECONDS = 5;
export const DEFAULT_PAUSE_SECONDS = 1;
/** Bump when encoding or prompt assembly changes so existing audio is regenerated. */
export const NARRATION_PIPELINE_VERSION = 2;

const HASH_PATTERN = /^[0-9a-f]{16}$/;

export interface NarrationSettings {
  model: string;
  voice: string;
  language: string | null;
  style: string | null;
  silentSlideSeconds: number;
  pauseSeconds: number;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function nonNegativeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** Deck narration settings with defaults filled in. Invalid values fall back (doctor reports them). */
export function resolveNarrationSettings(config: Pick<DeckConfig, "narration"> | null): NarrationSettings {
  const raw: Record<string, unknown> = { ...(config?.narration ?? {}) };
  return {
    model: nonEmptyString(raw.model) ?? DEFAULT_NARRATION_MODEL,
    voice: nonEmptyString(raw.voice) ?? DEFAULT_NARRATION_VOICE,
    language: nonEmptyString(raw.language),
    style: nonEmptyString(raw.style),
    silentSlideSeconds: nonNegativeNumber(raw.silentSlideSeconds, DEFAULT_SILENT_SLIDE_SECONDS),
    pauseSeconds: nonNegativeNumber(raw.pauseSeconds, DEFAULT_PAUSE_SECONDS),
  };
}

const NARRATION_CONFIG_KEYS = ["voice", "language", "style", "model", "silentSlideSeconds", "pauseSeconds"];

/** Keys in `narration` that nothing reads, usually typos (e.g. `silentSlideSecond`). */
export function unknownNarrationConfigKeys(config: Pick<DeckConfig, "narration"> | null): string[] {
  const narration: unknown = config?.narration;
  if (typeof narration !== "object" || narration === null || Array.isArray(narration)) return [];
  return Object.keys(narration).filter((key) => !NARRATION_CONFIG_KEYS.includes(key));
}

/** Problems in `deck.config.ts` `narration`, as human-readable messages. */
export function validateNarrationConfig(config: Pick<DeckConfig, "narration"> | null): string[] {
  const narration: unknown = config?.narration;
  if (narration === undefined) return [];
  if (typeof narration !== "object" || narration === null || Array.isArray(narration)) {
    return ["narration must be an object"];
  }
  const raw = narration as Record<string, unknown>;
  const problems: string[] = [];
  for (const key of ["voice", "language", "style", "model"] as const) {
    if (raw[key] !== undefined && typeof raw[key] !== "string") problems.push(`narration.${key} must be a string`);
  }
  for (const key of ["silentSlideSeconds", "pauseSeconds"] as const) {
    const value = raw[key];
    if (value !== undefined && !(typeof value === "number" && Number.isFinite(value) && value >= 0)) {
      problems.push(`narration.${key} must be a number of seconds >= 0`);
    }
  }
  return problems;
}

/** The script as it is sent to TTS: unified newlines, NFC, trimmed. Empty means no narration. */
export function normalizeNarrationText(text: string | undefined): string {
  return (text ?? "").replace(/\r\n?/g, "\n").normalize("NFC").trim();
}

/** Identifies one generated audio file: everything that changes what is spoken or how. */
export function narrationInputHash(settings: NarrationSettings, text: string): string {
  const input = JSON.stringify({
    v: NARRATION_PIPELINE_VERSION,
    model: settings.model,
    voice: settings.voice,
    language: settings.language,
    style: settings.style,
    text: normalizeNarrationText(text),
  });
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

/** Digest of the encoded audio; used as the cache-busting `?v=` so regenerated audio is refetched. */
export function narrationOutputDigest(audio: Uint8Array): string {
  return createHash("sha256").update(audio).digest("hex").slice(0, 16);
}

export function narrationAudioFileName(inputHash: string): string {
  return `${inputHash}.mp3`;
}

export interface NarrationManifestEntry {
  file: string;
  outputDigest: string;
  durationSec: number;
  createdAt: string;
}

export interface NarrationManifest {
  version: 1;
  /** Generated audio keyed by input hash. */
  entries: Record<string, NarrationManifestEntry>;
  /** Slide filename -> input hash of the audio last generated for it (tells "stale" from "missing"). */
  slides: Record<string, string>;
}

export function emptyNarrationManifest(): NarrationManifest {
  return { version: 1, entries: {}, slides: {} };
}

function isValidEntry(hash: string, entry: unknown): entry is NarrationManifestEntry {
  if (!HASH_PATTERN.test(hash) || typeof entry !== "object" || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return (
    e.file === narrationAudioFileName(hash) &&
    typeof e.outputDigest === "string" &&
    HASH_PATTERN.test(e.outputDigest) &&
    typeof e.durationSec === "number" &&
    Number.isFinite(e.durationSec) &&
    e.durationSec > 0 &&
    typeof e.createdAt === "string"
  );
}

/**
 * Parse a manifest, dropping anything malformed. The file is plain JSON on
 * disk, so `file` is only trusted when it is exactly `<hash>.mp3`.
 */
export function parseNarrationManifest(text: string): NarrationManifest {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return emptyNarrationManifest();
  }
  const manifest = emptyNarrationManifest();
  if (typeof data !== "object" || data === null) return manifest;
  const { entries, slides } = data as Record<string, unknown>;
  if (typeof entries === "object" && entries !== null) {
    for (const [hash, entry] of Object.entries(entries)) {
      if (isValidEntry(hash, entry)) manifest.entries[hash] = entry;
    }
  }
  if (typeof slides === "object" && slides !== null) {
    for (const [filename, hash] of Object.entries(slides)) {
      if (typeof hash === "string" && HASH_PATTERN.test(hash)) manifest.slides[filename] = hash;
    }
  }
  return manifest;
}

export function narrationDirPath(deckDir: string): string {
  return path.join(deckDir, NARRATION_DIR);
}

export async function readNarrationManifest(deckDir: string): Promise<NarrationManifest> {
  try {
    const text = await fs.readFile(path.join(narrationDirPath(deckDir), NARRATION_MANIFEST_FILE), "utf-8");
    return parseNarrationManifest(text);
  } catch {
    return emptyNarrationManifest();
  }
}

/**
 * - none: the slide has no narration text
 * - fresh: audio matching the current script and settings exists
 * - stale: audio was generated for this slide, but the script or settings changed since
 * - missing: no audio was ever generated for this slide (or its file is gone)
 */
export type NarrationState = "none" | "fresh" | "stale" | "missing";

export interface NarrationSlideStatus {
  filename: string;
  state: NarrationState;
  /** Input hash for the current script; null when state is "none". */
  hash: string | null;
  /** The matching manifest entry; set only when state is "fresh". */
  entry: NarrationManifestEntry | null;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch {
    return false;
  }
}

export async function computeNarrationStatus(
  deckDir: string,
  settings: NarrationSettings,
  slides: readonly { filename: string; narration?: string }[],
  manifest?: NarrationManifest,
): Promise<NarrationSlideStatus[]> {
  const current = manifest ?? (await readNarrationManifest(deckDir));
  const dir = narrationDirPath(deckDir);

  return Promise.all(
    slides.map(async ({ filename, narration }): Promise<NarrationSlideStatus> => {
      const text = normalizeNarrationText(narration);
      if (!text) return { filename, state: "none", hash: null, entry: null };

      const hash = narrationInputHash(settings, text);
      const entry = current.entries[hash];
      if (entry && (await fileExists(path.join(dir, entry.file)))) {
        return { filename, state: "fresh", hash, entry };
      }
      const previous = current.slides[filename];
      const state = previous && previous !== hash ? "stale" : "missing";
      return { filename, state, hash, entry: null };
    }),
  );
}

export function narrationTrackFor(deckName: string, entry: NarrationManifestEntry): NarrationTrack {
  return {
    src: `/api/decks/${encodeURIComponent(deckName)}/${NARRATION_DIR}/${entry.file}?v=${entry.outputDigest}`,
    durationSec: entry.durationSec,
  };
}
