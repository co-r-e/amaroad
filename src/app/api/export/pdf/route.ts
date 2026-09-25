import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { isUnsafeDeckName, loadDeck } from "@/lib/deck-loader";
import {
  jsonNoStore,
  rejectCrossSite,
  rejectNonJsonBody,
  rejectRemote,
} from "@/lib/local-request-guards";
import { parseSlideRange } from "@/lib/pdf/shared";
import { renderDeckPdf, type DeckPdfProgress } from "@/lib/pdf/render-deck-pdf";

export const dynamic = "force-dynamic";

/**
 * Vector PDF export for the browser UI.
 *
 *   POST /api/export/pdf  {"deck": "...", "slides"?: "1-5,8"}
 *     Streams NDJSON: {"type":"progress",...}* then {"type":"done","url":...}
 *     or {"type":"error","message":...}. Aborting the request cancels the job.
 *   GET  /api/export/pdf?token=...
 *     Downloads the finished PDF once (the token expires after 10 minutes).
 *
 * Rendering launches headless Chromium on this machine, so both methods are
 * localhost-only, POST is CSRF-guarded, and one export runs at a time.
 */

const DOWNLOAD_TTL_MS = 10 * 60 * 1000;
const DEFAULT_PORT = 3850;

interface StoredPdf {
  pdf: Buffer;
  filename: string;
  expiresAt: number;
}

interface RunningJob {
  abort: AbortController;
  /** Settles once the job has fully cleaned up (browser closed). */
  done: Promise<void>;
}

interface PdfExportState {
  job: RunningJob | null;
  downloads: Map<string, StoredPdf>;
}

// Survives dev-server HMR like the tunnel manager.
const globalForPdf = globalThis as typeof globalThis & {
  __amaroadPdfExport?: PdfExportState;
};
const state: PdfExportState = (globalForPdf.__amaroadPdfExport ??= {
  job: null,
  downloads: new Map(),
});

/** How long a new export waits for a just-cancelled one to finish cleaning up. */
const CANCELLED_JOB_GRACE_MS = 15_000;
/** How long a new export waits for a disconnect to register as a cancel. */
const ABORT_NOTICE_GRACE_MS = 3_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolve when no export is running. A job whose client already went away
 * (cancel, closed tab) is given a moment to shut its browser down, so
 * "cancel, then export again" does not bounce off a 409.
 */
async function waitForIdle(): Promise<boolean> {
  const noticeDeadline = Date.now() + ABORT_NOTICE_GRACE_MS;
  while (state.job && !state.job.abort.signal.aborted && Date.now() < noticeDeadline) {
    await sleep(100);
  }
  const job = state.job;
  if (job?.abort.signal.aborted) {
    await Promise.race([job.done, sleep(CANCELLED_JOB_GRACE_MS)]);
  }
  return state.job === null;
}

function storeDownload(pdf: Buffer, filename: string): string {
  pruneExpiredDownloads();
  const token = randomUUID();
  state.downloads.set(token, { pdf, filename, expiresAt: Date.now() + DOWNLOAD_TTL_MS });
  // Free the buffer even if nobody ever downloads it or calls this route again.
  setTimeout(() => state.downloads.delete(token), DOWNLOAD_TTL_MS + 1_000).unref?.();
  return token;
}

function pruneExpiredDownloads(now = Date.now()): void {
  for (const [token, entry] of state.downloads) {
    if (entry.expiresAt <= now) state.downloads.delete(token);
  }
}

/**
 * Where headless Chromium loads the print page from. Next.js records the port
 * it actually listens on in PORT (dev and start), and the server is bound to
 * 127.0.0.1 by the package.json scripts. Never derived from the request's Host
 * header, which the client controls.
 */
function resolveServerBaseUrl(): string {
  const port = Number.parseInt(process.env.PORT ?? "", 10);
  const safePort = Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_PORT;
  return `http://127.0.0.1:${safePort}`;
}

function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function POST(request: NextRequest): Promise<Response> {
  const rejected = rejectRemote(request) ?? rejectCrossSite(request) ?? rejectNonJsonBody(request);
  if (rejected) return rejected;

  const body = (await request.json().catch(() => null)) as { deck?: unknown; slides?: unknown } | null;
  const deckName = typeof body?.deck === "string" ? body.deck.trim() : "";
  if (!deckName || isUnsafeDeckName(deckName)) {
    return jsonNoStore({ error: "Invalid deck name" }, { status: 400 });
  }
  const slides = typeof body?.slides === "string" && body.slides.trim() ? body.slides.trim() : undefined;

  let totalSlides: number;
  try {
    totalSlides = (await loadDeck(deckName)).slides.length;
  } catch {
    return jsonNoStore({ error: `Deck "${deckName}" not found` }, { status: 404 });
  }
  const range = parseSlideRange(slides, totalSlides);
  if (!range.ok) return jsonNoStore({ error: range.error }, { status: 400 });
  if (range.indexes.length === 0) return jsonNoStore({ error: "Deck has no slides" }, { status: 400 });

  const idle = await waitForIdle();
  // Re-check synchronously: another request may have claimed the slot while
  // this one was waiting.
  if (!idle || state.job) {
    return jsonNoStore({ error: "Another PDF export is already running" }, { status: 409 });
  }
  if (request.signal.aborted) return jsonNoStore({ error: "Cancelled" }, { status: 499 });

  const abort = new AbortController();
  let markDone: () => void = () => {};
  const job: RunningJob = { abort, done: new Promise<void>((resolve) => (markDone = resolve)) };
  state.job = job;
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: Record<string, unknown>) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          open = false;
        }
      };

      try {
        const result = await renderDeckPdf({
          baseUrl: resolveServerBaseUrl(),
          deck: deckName,
          slides,
          signal: abort.signal,
          onProgress: (progress: DeckPdfProgress) => send({ type: "progress", ...progress }),
        });
        const filename = `${deckName}.pdf`;
        const token = storeDownload(result.pdf, filename);
        send({
          type: "done",
          url: `/api/export/pdf?token=${token}`,
          filename,
          bytes: result.pdf.length,
          pages: result.pages,
          durationMs: result.durationMs,
          images: result.images,
          warnings: result.warnings,
        });
      } catch (error) {
        if (!abort.signal.aborted) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[amaroad] Vector PDF export of "${deckName}" failed:`, message);
          send({ type: "error", message });
        }
      } finally {
        if (state.job === job) state.job = null;
        markDone();
        if (open) {
          open = false;
          try {
            controller.close();
          } catch {
            // Already closed by a cancelled reader.
          }
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

export function GET(request: NextRequest): Response {
  const rejected = rejectRemote(request);
  if (rejected) return rejected;

  pruneExpiredDownloads();
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const entry = state.downloads.get(token);
  if (!entry) {
    return jsonNoStore({ error: "Export not found or expired" }, { status: 404 });
  }
  state.downloads.delete(token);

  return new Response(new Uint8Array(entry.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition(entry.filename),
      "Content-Length": String(entry.pdf.length),
      "Cache-Control": "no-store",
    },
  });
}
