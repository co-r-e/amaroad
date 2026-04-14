import { DurableObject } from "cloudflare:workers";

interface Env {
  DECK_PRESENCE: DurableObjectNamespace;
}

type Role = "viewer" | "owner";

interface ViewerAttachment {
  role: Role;
  sessionId: string;
  fingerprint: string;
  currentSlide: number;
  joinedAt: number;
  lastHeartbeat: number;
  disconnected: boolean;
}

interface ViewerSnapshot {
  sessionId: string;
  fingerprint: string;
  currentSlide: number;
  joinedAt: number;
}

type ClientMessage =
  | { type: "slide_change"; slideIndex: number }
  | { type: "heartbeat" };

const SESSION_ID_PATTERN = /^[a-zA-Z0-9-]{1,64}$/;
const FINGERPRINT_PATTERN = /^[a-zA-Z0-9]{1,64}$/;
const MAX_SLIDE_INDEX = 10_000;

/**
 * DeckPresence — Durable Object that coordinates viewer and owner WebSockets
 * for a single deck. One DO instance per deckId (via env.DECK_PRESENCE.idFromName).
 *
 * Uses the Hibernation API: in-memory state is intentionally minimal.
 * Per-connection state lives in WebSocket attachments, which survive hibernation.
 * Connection grouping uses tag-based getWebSockets() lookups.
 */
export class DeckPresence extends DurableObject<Env> {
  private readonly disconnectedSockets = new WeakSet<WebSocket>();

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const url = new URL(request.url);
    const role: Role = url.searchParams.get("role") === "owner" ? "owner" : "viewer";
    const sessionId = parseSessionId(url.searchParams.get("sessionId"));
    const fingerprint = parseFingerprint(url.searchParams.get("fp"));

    if (!sessionId || !fingerprint) {
      return new Response("Invalid sessionId or fingerprint", { status: 400 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    if (!client || !server) {
      return new Response("Failed to create WebSocket pair", { status: 500 });
    }

    // Hibernation API: tag the socket so we can later select groups with getWebSockets(tag)
    this.ctx.acceptWebSocket(server, [role, sessionId]);

    const attachment: ViewerAttachment = {
      role,
      sessionId,
      fingerprint,
      currentSlide: 0,
      joinedAt: Date.now(),
      lastHeartbeat: Date.now(),
      disconnected: false,
    };
    server.serializeAttachment(attachment);

    if (role === "owner") {
      // Send current snapshot of all active viewers
      server.send(
        JSON.stringify({
          type: "snapshot",
          viewers: this.getViewerSnapshot(),
        }),
      );
    } else {
      // Notify owners that a new viewer joined
      this.broadcastToOwners({
        type: "viewer.joined",
        sessionId,
        fingerprint,
        currentSlide: 0,
        joinedAt: attachment.joinedAt,
      });
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): void {
    if (typeof raw !== "string") return;

    let message: ClientMessage;
    try {
      message = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }

    const attachment = this.readAttachment(ws);
    if (!attachment) return;
    if (attachment.disconnected) return;

    switch (message.type) {
      case "slide_change": {
        if (
          !Number.isSafeInteger(message.slideIndex) ||
          message.slideIndex < 0 ||
          message.slideIndex > MAX_SLIDE_INDEX
        ) {
          return;
        }
        attachment.currentSlide = message.slideIndex;
        attachment.lastHeartbeat = Date.now();
        ws.serializeAttachment(attachment);
        if (attachment.role === "viewer") {
          this.broadcastToOwners({
            type: "viewer.slide_changed",
            sessionId: attachment.sessionId,
            slideIndex: message.slideIndex,
          });
        }
        break;
      }
      case "heartbeat": {
        attachment.lastHeartbeat = Date.now();
        ws.serializeAttachment(attachment);
        break;
      }
    }
  }

  webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): void {
    void _code;
    void _reason;
    void _wasClean;
    this.handleDisconnect(ws);
  }

  webSocketError(ws: WebSocket, _error: unknown): void {
    void _error;
    this.handleDisconnect(ws);
  }

  private handleDisconnect(ws: WebSocket): void {
    if (this.disconnectedSockets.has(ws)) return;
    this.disconnectedSockets.add(ws);

    const attachment = this.readAttachment(ws);
    if (!attachment) return;
    if (attachment.disconnected) return;

    attachment.disconnected = true;
    try {
      ws.serializeAttachment(attachment);
    } catch {
      // Closed sockets may reject attachment writes; best effort is enough.
    }

    if (attachment.role === "viewer") {
      this.broadcastToOwners({
        type: "viewer.left",
        sessionId: attachment.sessionId,
      });
    }
  }

  private getViewerSnapshot(): ViewerSnapshot[] {
    const viewers: ViewerSnapshot[] = [];

    for (const ws of this.ctx.getWebSockets("viewer")) {
      if (ws.readyState !== WebSocket.OPEN) continue;

      const attachment = this.readAttachment(ws);
      if (!attachment || attachment.disconnected || attachment.role !== "viewer") continue;

      viewers.push({
        sessionId: attachment.sessionId,
        fingerprint: attachment.fingerprint,
        currentSlide: attachment.currentSlide,
        joinedAt: attachment.joinedAt,
      });
    }

    return viewers;
  }

  private broadcastToOwners(message: unknown): void {
    const data = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets("owner")) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      try {
        ws.send(data);
      } catch {
        // Socket may be closing — skip
      }
    }
  }

  private readAttachment(ws: WebSocket): ViewerAttachment | null {
    try {
      return ws.deserializeAttachment() as ViewerAttachment | null;
    } catch {
      return null;
    }
  }
}

function parseSessionId(raw: string | null): string | null {
  if (raw && SESSION_ID_PATTERN.test(raw)) {
    return raw;
  }
  return null;
}

function parseFingerprint(raw: string | null): string | null {
  if (raw && FINGERPRINT_PATTERN.test(raw)) {
    return raw;
  }
  return null;
}
