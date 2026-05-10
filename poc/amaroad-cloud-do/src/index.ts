import { DeckPresence } from "./deck-presence";
import { CLIENT_HTML } from "./client";

export { DeckPresence };

interface Env {
  DECK_PRESENCE: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Serve the test client HTML
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(CLIENT_HTML, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    // Route WebSocket upgrades to the DeckPresence DO for the given deckId
    if (url.pathname === "/ws") {
      const deckId = url.searchParams.get("deckId") || "test-deck";
      const id = env.DECK_PRESENCE.idFromName(deckId);
      const stub = env.DECK_PRESENCE.get(id);
      return stub.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
