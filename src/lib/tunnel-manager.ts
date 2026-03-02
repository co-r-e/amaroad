import { Tunnel } from "cloudflared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TunnelStatus = "idle" | "connecting" | "active" | "error";

export interface TunnelState {
  status: TunnelStatus;
  url: string | null;
  error: string | null;
  connectedAt: number | null;
  deckName: string | null;
}

// ---------------------------------------------------------------------------
// TunnelManager — singleton that wraps a cloudflared quick tunnel
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 30_000;

const IDLE_STATE: TunnelState = {
  status: "idle",
  url: null,
  error: null,
  connectedAt: null,
  deckName: null,
};

function errorState(message: string): TunnelState {
  return { status: "error", url: null, error: message, connectedAt: null, deckName: null };
}

class TunnelManager {
  private tunnel: InstanceType<typeof Tunnel> | null = null;
  private state: TunnelState = { ...IDLE_STATE };
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  /** Incremented on each start(); event handlers ignore stale generations. */
  private generation = 0;

  constructor() {
    const handler = () => this.cleanup();
    process.on("SIGINT", handler);
    process.on("SIGTERM", handler);
  }

  /** Start a quick tunnel pointing at the given local port. */
  start(port: number, deckName: string | null = null): TunnelState {
    if (this.state.status === "connecting" || this.state.status === "active") {
      return this.state;
    }

    this.generation++;
    const gen = this.generation;
    const isStale = () => gen !== this.generation;

    this.state = { status: "connecting", url: null, error: null, connectedAt: null, deckName };

    try {
      // Use the Tunnel constructor directly with --config /dev/null to prevent
      // ~/.cloudflared/config.yml (named-tunnel ingress rules, catch-all 404)
      // from interfering with the quick tunnel.
      this.tunnel = new Tunnel([
        "tunnel",
        "--url", `http://localhost:${port}`,
        "--config", "/dev/null",
      ]);
    } catch (err) {
      this.state = errorState(
        err instanceof Error ? err.message : "Failed to start cloudflared",
      );
      return this.state;
    }

    // Transition to "active" only when both url and connected events have
    // fired, regardless of order.
    let receivedUrl: string | null = null;
    let receivedConnected = false;

    const tryActivate = () => {
      if (isStale()) return;
      if (receivedUrl && receivedConnected) {
        this.clearTimeout();
        this.state = {
          status: "active",
          url: receivedUrl,
          error: null,
          connectedAt: Date.now(),
          deckName,
        };
      } else if (receivedUrl) {
        this.state = { ...this.state, url: receivedUrl };
      }
    };

    this.tunnel.on("url", (url: string) => {
      receivedUrl = url;
      tryActivate();
    });

    this.tunnel.on("connected", () => {
      receivedConnected = true;
      tryActivate();
    });

    this.tunnel.on("error", (err: Error) => {
      if (isStale()) return;
      this.state = errorState(err.message);
      this.cleanup();
    });

    this.tunnel.on("exit", (code: number | null) => {
      if (isStale()) return;
      if (this.state.status === "active" || this.state.status === "connecting") {
        this.state = errorState(`Tunnel exited unexpectedly (code ${code})`);
      }
      this.tunnel = null;
    });

    this.timeoutId = setTimeout(() => {
      if (isStale() || this.state.status !== "connecting") return;
      this.state = errorState("Connection timed out");
      this.cleanup();
    }, TIMEOUT_MS);

    return this.state;
  }

  /** Stop the running tunnel. */
  stop(): void {
    this.generation++;
    this.cleanup();
    this.state = { ...IDLE_STATE };
  }

  /** Return a snapshot of the current tunnel state. */
  getStatus(): TunnelState {
    return { ...this.state };
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private cleanup(): void {
    this.clearTimeout();
    if (this.tunnel) {
      try {
        this.tunnel.stop();
      } catch {
        // ignore -- process may already be dead
      }
      this.tunnel = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton (survives HMR via globalThis)
// ---------------------------------------------------------------------------

const globalForTunnel = globalThis as typeof globalThis & {
  __dexcodeTunnel?: TunnelManager;
};

export const tunnelManager =
  globalForTunnel.__dexcodeTunnel ??= new TunnelManager();
