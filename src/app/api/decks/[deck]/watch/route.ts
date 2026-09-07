import { NextRequest } from "next/server";
import { existsSync, watch, type FSWatcher } from "fs";
import { join } from "path";
import { isLocalRequest, getSharedDeckName } from "@/lib/tunnel-access";
import { isUnsafeDeckName } from "@/lib/deck-loader";

const DEBOUNCE_MS = 600;
const KEEPALIVE_MS = 30_000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deck: string }> },
) {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }

  const { deck: deckName } = await params;

  if (isUnsafeDeckName(deckName)) {
    return new Response("Invalid deck name", { status: 400 });
  }

  const localRequest = isLocalRequest(request);

  // Block remote access: only allow localhost or the currently shared deck
  if (!localRequest && getSharedDeckName() !== deckName) {
    return new Response("Not found", { status: 404 });
  }

  const deckDir = join(process.cwd(), "decks", deckName);
  // Shared theme presets (decks/_themes) are imported by deck.config.ts, so
  // editing one must refresh the deck too.
  const themesDir = join(process.cwd(), "decks", "_themes");
  const encoder = new TextEncoder();

  let watcher: FSWatcher | null = null;
  let themesWatcher: FSWatcher | null = null;
  let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  function cleanup() {
    if (closed) return;
    closed = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    if (keepaliveTimer) clearInterval(keepaliveTimer);
    for (const w of [watcher, themesWatcher]) {
      if (!w) continue;
      try {
        w.close();
      } catch {
        // watcher may already be closed
      }
    }
    debounceTimer = null;
    keepaliveTimer = null;
    watcher = null;
    themesWatcher = null;
  }

  function hasAccess(): boolean {
    return localRequest || getSharedDeckName() === deckName;
  }

  const stream = new ReadableStream({
    start(controller) {
      const closeStream = () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      const onChange = () => {
        if (!hasAccess()) {
          closeStream();
          return;
        }
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "change" })}\n\n`),
            );
          } catch {
            // Controller closed
          }
        }, DEBOUNCE_MS);
      };

      try {
        watcher = watch(deckDir, { recursive: true }, onChange);
      } catch {
        closeStream();
        return;
      }

      if (existsSync(themesDir)) {
        try {
          themesWatcher = watch(themesDir, { recursive: true }, onChange);
        } catch {
          themesWatcher = null;
        }
      }

      keepaliveTimer = setInterval(() => {
        if (!hasAccess()) {
          closeStream();
          return;
        }
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          closeStream();
        }
      }, KEEPALIVE_MS);

      request.signal.addEventListener("abort", closeStream, { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
