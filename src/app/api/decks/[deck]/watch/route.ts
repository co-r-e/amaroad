import { NextRequest } from "next/server";
import { watch, type FSWatcher } from "fs";
import { join } from "path";

const DEBOUNCE_MS = 300;
const KEEPALIVE_MS = 30_000;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ deck: string }> },
) {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }

  const { deck: deckName } = await params;

  if (deckName.includes("/") || deckName.includes("\\") || deckName.includes("..")) {
    return new Response("Invalid deck name", { status: 400 });
  }

  const deckDir = join(process.cwd(), "decks", deckName);
  const encoder = new TextEncoder();

  let watcher: FSWatcher | null = null;
  let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function cleanup() {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (keepaliveTimer) clearInterval(keepaliveTimer);
    if (watcher) watcher.close();
    debounceTimer = null;
    keepaliveTimer = null;
    watcher = null;
  }

  const stream = new ReadableStream({
    start(controller) {
      try {
        watcher = watch(deckDir, { recursive: true }, () => {
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
        });
      } catch {
        controller.close();
        return;
      }

      keepaliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          // Controller closed
        }
      }, KEEPALIVE_MS);

      _request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
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
    },
  });
}
