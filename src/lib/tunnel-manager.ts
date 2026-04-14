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

interface TunnelListeners {
  tunnel: InstanceType<typeof Tunnel>;
  url: (url: string) => void;
  connected: () => void;
  error: (err: Error) => void;
  exit: (code: number | null, signal: NodeJS.Signals | null) => void;
}

// ---------------------------------------------------------------------------
// TunnelManager — singleton that wraps a cloudflared quick tunnel
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 2_000;
const MIN_START_INTERVAL_MS = 5_000;
const HEALTH_CHECK_INTERVAL_MS = 15_000;
const HEALTH_CHECK_TIMEOUT_MS = 5_000;
const STOP_WAIT_TIMEOUT_MS = 3_000;

const IDLE_STATE: TunnelState = {
  status: "idle",
  url: null,
  error: null,
  connectedAt: null,
  deckName: null,
};

function normalizeTunnelError(message: string): string {
  return /ENOENT/i.test(message)
    ? "cloudflared binary not found. Ensure the 'cloudflared' npm package is installed correctly."
    : message;
}

function errorState(message: string, deckName: string | null): TunnelState {
  return {
    status: "error",
    url: null,
    error: normalizeTunnelError(message),
    connectedAt: null,
    deckName,
  };
}

class TunnelManager {
  private tunnel: InstanceType<typeof Tunnel> | null = null;
  private tunnelListeners: TunnelListeners | null = null;
  private state: TunnelState = { ...IDLE_STATE };
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  /** Incremented on each start()/stop(); event handlers ignore stale generations. */
  private generation = 0;

  // Auto-reconnect state
  private retryCount = 0;
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private lastPort = 3000;
  private lastDeckName: string | null = null;

  // Rate limiting
  private lastStartTime = 0;

  // Health check
  private healthCheckId: ReturnType<typeof setTimeout> | null = null;
  private healthCheckAbortController: AbortController | null = null;

  constructor() {
    const handler = () => this.cleanupImmediate();
    process.on("SIGINT", handler);
    process.on("SIGTERM", handler);
  }

  /** Start a quick tunnel pointing at the given local port. */
  start(port: number, deckName: string | null = null): TunnelState {
    if (this.state.status === "connecting" || this.state.status === "active") {
      // Allow switching which deck is shared without restarting the process.
      if (deckName && this.state.deckName !== deckName) {
        this.state = { ...this.state, deckName };
        this.lastDeckName = deckName;
      }
      return this.getStatus();
    }

    const now = Date.now();
    if (now - this.lastStartTime < MIN_START_INTERVAL_MS) {
      return errorState("Please wait a few seconds before retrying", deckName);
    }

    this.lastPort = port;
    this.lastDeckName = deckName;
    this.lastStartTime = now;
    this.retryCount = 0;

    return this.startInternal(port, deckName);
  }

  /** Stop the running tunnel. Returns a promise that resolves once the process exits. */
  async stop(): Promise<void> {
    this.generation++;
    const tunnel = this.tunnel;

    this.retryCount = MAX_RETRIES;
    this.lastDeckName = null;
    this.clearTimeout();
    this.clearRetryTimeout();
    this.stopHealthCheck();
    this.detachTunnelListeners(tunnel);
    this.tunnel = null;
    this.state = { ...IDLE_STATE };

    if (!tunnel) return;

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        tunnel.off("exit", handleExit);
        resolve();
      };
      const handleExit = () => finish();
      const timeout = setTimeout(finish, STOP_WAIT_TIMEOUT_MS);

      if (tunnel.process.exitCode !== null) {
        finish();
        return;
      }

      tunnel.once("exit", handleExit);
      try {
        tunnel.stop();
      } catch {
        finish();
      }
    });
  }

  /** Return a snapshot of the current tunnel state. */
  getStatus(): TunnelState {
    return { ...this.state };
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private startInternal(port: number, deckName: string | null): TunnelState {
    this.generation++;
    const gen = this.generation;
    const isStale = () => gen !== this.generation;

    this.clearTimeout();
    this.clearRetryTimeout();
    this.stopHealthCheck();
    this.destroyTunnel(this.tunnel, true);
    this.state = {
      status: "connecting",
      url: null,
      error: null,
      connectedAt: null,
      deckName,
    };

    let tunnel: InstanceType<typeof Tunnel>;
    try {
      // Use the Tunnel constructor directly with --config /dev/null to prevent
      // ~/.cloudflared/config.yml (named-tunnel ingress rules, catch-all 404)
      // from interfering with the quick tunnel.
      tunnel = new Tunnel([
        "tunnel",
        "--url", `http://localhost:${port}`,
        "--config", "/dev/null",
      ]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      this.state = errorState(raw, deckName);
      return this.getStatus();
    }

    this.tunnel = tunnel;

    // Transition to "active" only when both url and connected events have
    // fired, regardless of order.
    let receivedUrl: string | null = null;
    let receivedConnected = false;

    const tryActivate = () => {
      if (isStale()) return;
      if (receivedUrl && receivedConnected) {
        this.clearTimeout();
        this.retryCount = 0;
        this.state = {
          status: "active",
          url: receivedUrl,
          error: null,
          connectedAt: Date.now(),
          deckName: this.state.deckName,
        };
        this.startHealthCheck();
      } else if (receivedUrl) {
        this.state = { ...this.state, url: receivedUrl };
      }
    };

    const listeners: TunnelListeners = {
      tunnel,
      url: (url: string) => {
        if (isStale()) return;
        receivedUrl = url;
        tryActivate();
      },
      connected: () => {
        if (isStale()) return;
        receivedConnected = true;
        tryActivate();
      },
      error: (err: Error) => {
        if (isStale()) return;
        this.clearTimeout();
        this.stopHealthCheck();
        this.destroyTunnel(tunnel, true);
        this.state = errorState(err.message, this.state.deckName ?? deckName ?? this.lastDeckName);
      },
      exit: (code: number | null) => {
        if (isStale()) return;
        this.clearTimeout();
        this.stopHealthCheck();
        this.destroyTunnel(tunnel, false);

        if (this.state.status === "active" || this.state.status === "connecting") {
          this.scheduleReconnect(
            `Tunnel exited unexpectedly (code ${code ?? "unknown"}). Auto-reconnect failed after ${MAX_RETRIES} attempts.`,
          );
        }
      },
    };

    this.attachTunnelListeners(listeners);

    this.timeoutId = setTimeout(() => {
      if (isStale() || this.state.status !== "connecting") return;
      this.generation++;
      this.destroyTunnel(tunnel, true);
      this.state = errorState(
        "Connection timed out (60s). Check your network connection and firewall settings.",
        this.state.deckName ?? deckName ?? this.lastDeckName,
      );
    }, TIMEOUT_MS);

    return this.getStatus();
  }

  /**
   * Periodically verify the tunnel URL is reachable.
   * Checks run sequentially to avoid overlapping fetches.
   */
  private startHealthCheck(): void {
    this.stopHealthCheck();
    let consecutiveFailures = 0;
    const gen = this.generation;

    const runCheck = async () => {
      if (gen !== this.generation || this.state.status !== "active" || !this.state.url) {
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
      this.healthCheckAbortController = controller;

      let healthy = false;
      try {
        const res = await fetch(this.state.url, {
          method: "HEAD",
          cache: "no-store",
          signal: controller.signal,
        });
        healthy = res.ok || res.status === 404;
      } catch {
        healthy = false;
      } finally {
        clearTimeout(timeout);
        if (this.healthCheckAbortController === controller) {
          this.healthCheckAbortController = null;
        }
      }

      if (gen !== this.generation || this.state.status !== "active") {
        return;
      }

      consecutiveFailures = healthy ? 0 : consecutiveFailures + 1;

      if (consecutiveFailures >= 2) {
        this.generation++;
        this.stopHealthCheck();
        this.destroyTunnel(this.tunnel, true);
        this.scheduleReconnect(
          `Tunnel became unreachable. Auto-reconnect failed after ${MAX_RETRIES} attempts.`,
        );
        return;
      }

      this.healthCheckId = setTimeout(() => {
        void runCheck();
      }, HEALTH_CHECK_INTERVAL_MS);
    };

    this.healthCheckId = setTimeout(() => {
      void runCheck();
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckId) {
      clearTimeout(this.healthCheckId);
      this.healthCheckId = null;
    }
    if (this.healthCheckAbortController) {
      this.healthCheckAbortController.abort();
      this.healthCheckAbortController = null;
    }
  }

  private scheduleReconnect(finalErrorMessage: string): void {
    if (this.retryCount >= MAX_RETRIES) {
      this.state = errorState(finalErrorMessage, this.lastDeckName);
      return;
    }

    this.retryCount++;
    const delay = BASE_RETRY_DELAY_MS * 2 ** (this.retryCount - 1);
    const gen = this.generation;
    this.clearRetryTimeout();
    this.state = {
      status: "connecting",
      url: null,
      error: null,
      connectedAt: null,
      deckName: this.lastDeckName,
    };
    this.retryTimeoutId = setTimeout(() => {
      if (gen !== this.generation) return;
      this.startInternal(this.lastPort, this.lastDeckName);
    }, delay);
  }

  private attachTunnelListeners(listeners: TunnelListeners): void {
    this.tunnelListeners = listeners;
    listeners.tunnel.on("url", listeners.url);
    listeners.tunnel.on("connected", listeners.connected);
    listeners.tunnel.on("error", listeners.error);
    listeners.tunnel.on("exit", listeners.exit);
  }

  private detachTunnelListeners(tunnel: InstanceType<typeof Tunnel> | null): void {
    if (!tunnel || !this.tunnelListeners || this.tunnelListeners.tunnel !== tunnel) {
      return;
    }

    tunnel.off("url", this.tunnelListeners.url);
    tunnel.off("connected", this.tunnelListeners.connected);
    tunnel.off("error", this.tunnelListeners.error);
    tunnel.off("exit", this.tunnelListeners.exit);
    this.tunnelListeners = null;
  }

  private destroyTunnel(
    tunnel: InstanceType<typeof Tunnel> | null,
    stopProcess: boolean,
  ): void {
    if (!tunnel) return;
    this.detachTunnelListeners(tunnel);
    if (this.tunnel === tunnel) {
      this.tunnel = null;
    }
    if (!stopProcess) return;
    try {
      tunnel.stop();
    } catch {
      // ignore -- process may already be dead
    }
  }

  private cleanupImmediate(): void {
    this.generation++;
    this.retryCount = MAX_RETRIES;
    this.lastDeckName = null;
    this.clearTimeout();
    this.clearRetryTimeout();
    this.stopHealthCheck();
    this.destroyTunnel(this.tunnel, true);
    this.state = { ...IDLE_STATE };
  }

  private clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private clearRetryTimeout(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton (survives HMR via globalThis)
// ---------------------------------------------------------------------------

const globalForTunnel = globalThis as typeof globalThis & {
  __amaroadTunnel?: TunnelManager;
};

export const tunnelManager =
  globalForTunnel.__amaroadTunnel ??= new TunnelManager();
