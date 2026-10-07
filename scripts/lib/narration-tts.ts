/**
 * Gemini TTS -> MP3 for `pnpm amaroad narrate`.
 *
 * Gemini TTS models only return uncompressed audio (gemini-3.8-flash-tts:
 * 24 kHz mono WAV; gemini-3.1-flash-tts-preview: raw `audio/l16` PCM) and
 * reject both MP3 output and system instructions, so the delivery `style`
 * travels inside the prompt (see buildNarrationPrompt) and the samples are
 * encoded with lamejs.
 */
import type { NarrationSettings } from "@/lib/narration";

const MP3_KBPS = 64;
const MP3_FRAME_SAMPLES = 1152;
const DEFAULT_SAMPLE_RATE = 24_000;
const REQUEST_TIMEOUT_MS = 180_000;
/** Anything shorter is treated as a broken response, not speech. */
const MIN_AUDIO_SEC = 0.3;

export interface SynthesizedNarration {
  mp3: Uint8Array;
  durationSec: number;
}

/**
 * A failure every remaining slide would hit too (quota after the SDK's own
 * retries, a rejected key, an unknown model): stop the run instead of paying
 * for one doomed request per slide.
 */
export class NarrationFatalError extends Error {}

class BadAudioError extends Error {}

/**
 * With a `style`, use the layout from Google's TTS prompting guide (audio
 * profile, scene, director's notes, transcript). gemini-3.8-flash-tts reads a
 * bare instruction line placed before the script aloud; this layout keeps the
 * direction out of the audio on both 3.8 and 3.1 (checked by transcribing).
 */
export function buildNarrationPrompt(settings: NarrationSettings, text: string): string {
  if (!settings.style) return text;
  return [
    "# AUDIO PROFILE: Presenter",
    "## THE SCENE: A conference room during a slide presentation.",
    "",
    "### DIRECTOR'S NOTES",
    `Style: ${settings.style}`,
    "",
    "#### TRANSCRIPT",
    text,
  ].join("\n");
}

function statusOf(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
}

/**
 * The API's own explanation. The SDK's `message` can be a bare
 * "400 API error occurred: {...}" while the reason ("API key not valid",
 * API_KEY_INVALID, ...) is only in the raw JSON `body`.
 */
function apiErrorDetail(error: unknown): string {
  const fallback = error instanceof Error ? error.message : String(error);
  const body = (error as { body?: unknown } | null)?.body;
  if (typeof body !== "string") return fallback;
  try {
    const parsed: unknown = JSON.parse(body);
    const first = (Array.isArray(parsed) ? parsed[0] : parsed) as {
      error?: { message?: unknown; details?: { reason?: unknown }[] };
    } | null;
    const message = first?.error?.message;
    if (typeof message !== "string") return fallback;
    const reason = first?.error?.details?.find((d) => typeof d?.reason === "string")?.reason;
    return typeof reason === "string" ? `${message} (${reason})` : message;
  } catch {
    return fallback;
  }
}

function fatalErrorFor(error: unknown, settings: NarrationSettings): NarrationFatalError | null {
  const status = statusOf(error);
  const detail = apiErrorDetail(error);
  if (status === 429) return new NarrationFatalError(`Gemini API rate limit or quota exceeded: ${detail}`);
  // The Gemini API answers an invalid key with 400 API_KEY_INVALID, a revoked or restricted one with 401/403.
  if (status === 401 || status === 403 || (status === 400 && /api[ _-]?key/i.test(detail))) {
    return new NarrationFatalError(`GEMINI_API_KEY was rejected: ${detail}`);
  }
  if (status === 404) {
    return new NarrationFatalError(`Model "${settings.model}" was not found (check narration.model in deck.config.ts): ${detail}`);
  }
  return null;
}

function sampleRateOf(mimeType: string | undefined, sampleRate: number | undefined): number {
  if (typeof sampleRate === "number" && sampleRate > 0) return sampleRate;
  const match = /rate=(\d+)/i.exec(mimeType ?? "");
  return match ? Number(match[1]) : DEFAULT_SAMPLE_RATE;
}

/** Locate PCM samples inside a RIFF/WAVE container by walking its chunks. */
function pcmFromWav(bytes: Uint8Array): { pcm: Uint8Array; sampleRate: number; channels: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let sampleRate = DEFAULT_SAMPLE_RATE;
  let channels = 1;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt " && body + 16 <= bytes.length) {
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
    } else if (id === "data") {
      return { pcm: bytes.subarray(body, Math.min(body + size, bytes.length)), sampleRate, channels };
    }
    offset = body + size + (size % 2);
  }
  throw new BadAudioError("WAV response has no data chunk");
}

/**
 * 16-bit little-endian PCM as mono samples. Copies into a fresh buffer first:
 * a Node Buffer's byteOffset can be odd, which an Int16Array view rejects.
 */
function toMonoSamples(pcm: Uint8Array, channels: number): Int16Array {
  const usable = pcm.length - (pcm.length % (2 * channels));
  const copy = new Uint8Array(usable);
  copy.set(pcm.subarray(0, usable));
  const samples = new Int16Array(copy.buffer);
  if (channels <= 1) return samples;
  const mono = new Int16Array(samples.length / channels);
  for (let i = 0; i < mono.length; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += samples[i * channels + c];
    mono[i] = Math.round(sum / channels);
  }
  return mono;
}

async function encodeMp3(samples: Int16Array, sampleRate: number): Promise<Uint8Array> {
  // Dynamic import: under tsx (CommonJS) a static import resolves to the
  // package's IIFE build, which exports nothing.
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const encoder = new Mp3Encoder(1, sampleRate, MP3_KBPS);
  const chunks: Uint8Array[] = [];
  // lamejs returns Int8Array at runtime despite its typings; view the bytes.
  const push = (chunk: ArrayBufferView) => {
    if (chunk.byteLength > 0) chunks.push(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
  };
  for (let i = 0; i < samples.length; i += MP3_FRAME_SAMPLES) {
    push(encoder.encodeBuffer(samples.subarray(i, i + MP3_FRAME_SAMPLES)));
  }
  push(encoder.flush());
  return Buffer.concat(chunks);
}

export async function createNarrationSynthesizer(apiKey: string) {
  // Loaded lazily so `--dry-run` never pulls in the SDK.
  const { GoogleGenAI } = await import("@google/genai");
  // apiKey is explicit (the SDK would otherwise prefer GOOGLE_API_KEY when both
  // are set) and so is vertexai: GOOGLE_GENAI_USE_VERTEXAI in the environment
  // would otherwise route the request to Vertex AI and ignore the key.
  const client = new GoogleGenAI({ apiKey, vertexai: false });

  async function requestOnce(settings: NarrationSettings, text: string): Promise<SynthesizedNarration> {
    let result;
    try {
      // 408/409/429/5xx are already retried with backoff inside the SDK.
      result = await client.interactions.create(
        {
          model: settings.model,
          input: buildNarrationPrompt(settings, text),
          store: false,
          response_format: { type: "audio" },
          generation_config: {
            speech_config: [
              settings.language ? { voice: settings.voice, language: settings.language } : { voice: settings.voice },
            ],
          },
        },
        { timeout_ms: REQUEST_TIMEOUT_MS },
      );
    } catch (error) {
      const fatal = fatalErrorFor(error, settings);
      if (fatal) throw fatal;
      const status = statusOf(error);
      throw status === undefined ? error : new Error(`HTTP ${status}: ${apiErrorDetail(error)}`);
    }

    const audio = result.output_audio;
    if (result.status && result.status !== "completed") throw new BadAudioError(`interaction status "${result.status}"`);
    if (!audio?.data) throw new BadAudioError("response contains no audio");

    const bytes = Buffer.from(audio.data, "base64");
    const mimeType = audio.mime_type?.toLowerCase() ?? "";
    let pcm: Uint8Array = bytes;
    let sampleRate = sampleRateOf(mimeType, audio.sample_rate);
    let channels = audio.channels ?? Number(/channels=(\d+)/i.exec(mimeType)?.[1] ?? 1);
    if (mimeType.includes("wav") || bytes.subarray(0, 4).toString("latin1") === "RIFF") {
      ({ pcm, sampleRate, channels } = pcmFromWav(bytes));
    } else if (mimeType && !mimeType.includes("l16") && !mimeType.includes("pcm")) {
      throw new BadAudioError(`unsupported audio format "${audio.mime_type}"`);
    }

    const samples = toMonoSamples(pcm, Math.max(1, channels));
    const durationSec = samples.length / sampleRate;
    if (durationSec < MIN_AUDIO_SEC) throw new BadAudioError(`audio is only ${durationSec.toFixed(2)}s long`);

    return { mp3: await encodeMp3(samples, sampleRate), durationSec: Math.round(durationSec * 1000) / 1000 };
  }

  return async function synthesize(settings: NarrationSettings, text: string): Promise<SynthesizedNarration> {
    try {
      return await requestOnce(settings, text);
    } catch (error) {
      // Transport errors were retried by the SDK; retry a malformed result once.
      if (!(error instanceof BadAudioError)) throw error;
      return requestOnce(settings, text);
    }
  };
}
