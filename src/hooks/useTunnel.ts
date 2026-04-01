"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TunnelState } from "@/lib/tunnel-manager";

export type TunnelPhase = "idle" | "connecting" | "active" | "stopping" | "error";

export interface UseTunnelReturn {
  phase: TunnelPhase;
  url: string | null;
  error: string | null;
  /** Seconds elapsed since the "connecting" phase began (0 when not connecting). */
  elapsedSeconds: number;
  start: () => void;
  stop: () => void;
  /** Retry after an error — re-issues a start request. */
  retry: () => void;
  copyUrl: () => void;
  copied: boolean;
  /** True when the clipboard API is unavailable or the write failed. */
  copyFailed: boolean;
}

interface ClientState {
  phase: TunnelPhase;
  url: string | null;
  error: string | null;
}

const POLL_INTERVAL = 3_000;
const POLL_JITTER = 1_000;
const COPY_FEEDBACK_MS = 3_500;
const TUNNEL_ENABLED = process.env.NODE_ENV !== "production";

const IDLE: ClientState = { phase: "idle", url: null, error: null };

/** Map server-side TunnelState to client-side ClientState. */
function toClientState(data: TunnelState): ClientState | null {
  switch (data.status) {
    case "active":
      return { phase: "active", url: data.url, error: null };
    case "connecting":
      return { phase: "connecting", url: null, error: null };
    case "error":
      return { phase: "error", url: null, error: data.error };
    case "idle":
      return null;
  }
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }
  } catch {
    // Ignore JSON parsing failures and fall back to status text.
  }
  return res.statusText || "Tunnel request failed";
}

async function fetchTunnelState(signal?: AbortSignal): Promise<TunnelState | null> {
  try {
    const res = await fetch("/api/tunnel", {
      cache: "no-store",
      signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as TunnelState;
  } catch {
    return null;
  }
}

export function useTunnel(deckName?: string): UseTunnelReturn {
  const [state, setState] = useState<ClientState>(IDLE);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [connectingStart, setConnectingStart] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const requestVersionRef = useRef(0);

  const syncTimingForPhase = useCallback((phase: TunnelPhase) => {
    if (phase === "connecting") {
      setConnectingStart((prev) => prev ?? Date.now());
      return;
    }
    setConnectingStart(null);
    setElapsedSeconds(0);
  }, []);

  const applyClientState = useCallback((next: ClientState) => {
    syncTimingForPhase(next.phase);
    setState((prev) => {
      if (
        prev.phase === next.phase &&
        prev.url === next.url &&
        prev.error === next.error
      ) {
        return prev;
      }
      return next;
    });
  }, [syncTimingForPhase]);

  const applyServerState = useCallback((data: TunnelState) => {
    if (deckName && data.deckName && data.deckName !== deckName) {
      applyClientState(IDLE);
      return;
    }

    const mapped = toClientState(data);
    applyClientState(mapped ?? IDLE);
  }, [applyClientState, deckName]);

  useEffect(() => {
    if (!TUNNEL_ENABLED) return;

    const controller = new AbortController();
    const requestVersion = ++requestVersionRef.current;

    fetchTunnelState(controller.signal).then((data) => {
      if (controller.signal.aborted || requestVersion !== requestVersionRef.current || !data) {
        return;
      }
      applyServerState(data);
    });

    return () => controller.abort();
  }, [applyServerState]);

  // Poll while connecting or active (sequential with jitter to avoid overlap)
  useEffect(() => {
    if (!TUNNEL_ENABLED) return;
    if (state.phase !== "connecting" && state.phase !== "active") return;

    const controller = new AbortController();
    let cancelled = false;

    async function poll() {
      while (!cancelled) {
        const jitter = Math.random() * POLL_JITTER;
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL + jitter));
        if (cancelled) break;

        const requestVersion = ++requestVersionRef.current;
        const data = await fetchTunnelState(controller.signal);
        if (
          cancelled ||
          controller.signal.aborted ||
          requestVersion !== requestVersionRef.current ||
          !data
        ) {
          continue;
        }

        applyServerState(data);
      }
    }

    void poll();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [applyServerState, state.phase]);

  useEffect(() => {
    if (state.phase !== "connecting" || connectingStart === null) return;

    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - connectingStart) / 1000));
    }, 1000);

    return () => clearInterval(id);
  }, [connectingStart, state.phase]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    return () => clearTimeout(id);
  }, [copied]);

  const start = useCallback(async () => {
    if (!TUNNEL_ENABLED) {
      applyClientState({
        phase: "error",
        url: null,
        error: "Sharing is unavailable in production",
      });
      return;
    }

    const requestVersion = ++requestVersionRef.current;
    setCopied(false);
    setCopyFailed(false);
    setConnectingStart(Date.now());
    setElapsedSeconds(0);
    setState({ phase: "connecting", url: null, error: null });

    try {
      const res = await fetch("/api/tunnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckName: deckName ?? null }),
      });

      if (requestVersion !== requestVersionRef.current) return;

      if (!res.ok) {
        applyClientState({
          phase: "error",
          url: null,
          error: await readErrorMessage(res),
        });
        return;
      }

      const data = (await res.json()) as TunnelState;
      if (requestVersion !== requestVersionRef.current) return;
      applyServerState(data);
    } catch {
      if (requestVersion !== requestVersionRef.current) return;
      applyClientState({
        phase: "error",
        url: null,
        error: "Failed to reach tunnel API",
      });
    }
  }, [applyClientState, applyServerState, deckName]);

  const stop = useCallback(async () => {
    if (!TUNNEL_ENABLED) {
      applyClientState(IDLE);
      return;
    }

    const requestVersion = ++requestVersionRef.current;
    applyClientState({ phase: "stopping", url: null, error: null });

    try {
      const res = await fetch("/api/tunnel", { method: "DELETE" });
      if (requestVersion !== requestVersionRef.current) return;

      if (!res.ok) {
        applyClientState({
          phase: "error",
          url: null,
          error: await readErrorMessage(res),
        });
        return;
      }

      const data = (await res.json()) as TunnelState;
      if (requestVersion !== requestVersionRef.current) return;
      applyServerState(data);
    } catch {
      if (requestVersion !== requestVersionRef.current) return;
      applyClientState({
        phase: "error",
        url: null,
        error: "Failed to stop tunnel",
      });
    }
  }, [applyClientState, applyServerState]);

  const retry = useCallback(() => {
    void start();
  }, [start]);

  const copyUrl = useCallback(() => {
    if (!state.url) return;

    setCopied(false);
    setCopyFailed(false);

    if (!navigator.clipboard?.writeText) {
      setCopyFailed(true);
      return;
    }

    navigator.clipboard.writeText(state.url).then(
      () => {
        setCopyFailed(false);
        setCopied(true);
      },
      () => {
        setCopied(false);
        setCopyFailed(true);
      },
    );
  }, [state.url]);

  return {
    phase: state.phase,
    url: state.url,
    error: state.error,
    elapsedSeconds: state.phase === "connecting" ? elapsedSeconds : 0,
    start: () => {
      void start();
    },
    stop: () => {
      void stop();
    },
    retry,
    copyUrl,
    copied,
    copyFailed,
  };
}
