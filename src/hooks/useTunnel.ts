"use client";

import { useState, useEffect, useCallback } from "react";
import type { TunnelState } from "@/lib/tunnel-manager";

export type TunnelPhase = "idle" | "connecting" | "active" | "stopping" | "error";

export interface UseTunnelReturn {
  phase: TunnelPhase;
  url: string | null;
  error: string | null;
  start: () => void;
  stop: () => void;
  copyUrl: () => void;
  copied: boolean;
}

interface ClientState {
  phase: TunnelPhase;
  url: string | null;
  error: string | null;
}

const POLL_INTERVAL = 3_000;
const ERROR_DISPLAY_MS = 3_000;
const COPY_FEEDBACK_MS = 2_000;

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
      return null; // caller decides whether to apply
  }
}

async function fetchTunnelState(): Promise<TunnelState | null> {
  try {
    const res = await fetch("/api/tunnel");
    if (!res.ok) return null;
    return (await res.json()) as TunnelState;
  } catch {
    return null;
  }
}

export function useTunnel(deckName?: string): UseTunnelReturn {
  const [state, setState] = useState<ClientState>(IDLE);
  const [copied, setCopied] = useState(false);

  const applyServerState = useCallback((data: TunnelState) => {
    // If an active tunnel belongs to a different deck, treat as idle for this hook.
    if (
      deckName &&
      data.deckName &&
      data.deckName !== deckName &&
      (data.status === "active" || data.status === "connecting")
    ) {
      setState((prev) => (prev.phase !== "idle" ? IDLE : prev));
      return;
    }

    const mapped = toClientState(data);
    if (mapped) {
      setState(mapped);
    } else {
      // Server reports idle -- sync client to idle
      setState((prev) => (prev.phase !== "idle" ? IDLE : prev));
    }
  }, [deckName]);

  // Sync server state on mount (handles page reload while tunnel is active)
  useEffect(() => {
    fetchTunnelState().then((data) => {
      if (data) applyServerState(data);
    });
  }, [applyServerState]);

  // Poll while connecting or active (sequential to avoid overlap)
  useEffect(() => {
    if (state.phase !== "connecting" && state.phase !== "active") return;

    let cancelled = false;

    async function poll() {
      while (!cancelled) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
        if (cancelled) break;
        const data = await fetchTunnelState();
        if (cancelled) break;
        if (data) applyServerState(data);
      }
    }

    poll();

    return () => {
      cancelled = true;
    };
  }, [state.phase, applyServerState]);

  // Auto-reset error after a short delay
  useEffect(() => {
    if (state.phase !== "error") return;
    const id = setTimeout(() => setState(IDLE), ERROR_DISPLAY_MS);
    return () => clearTimeout(id);
  }, [state.phase]);

  const start = useCallback(async () => {
    setState({ phase: "connecting", url: null, error: null });
    try {
      const res = await fetch("/api/tunnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckName: deckName ?? null }),
      });
      if (res.ok) {
        const data = (await res.json()) as TunnelState;
        applyServerState(data);
      }
    } catch {
      setState({ phase: "error", url: null, error: "Failed to reach tunnel API" });
    }
  }, [deckName, applyServerState]);

  const stop = useCallback(async () => {
    setState({ phase: "stopping", url: null, error: null });
    try {
      await fetch("/api/tunnel", { method: "DELETE" });
      setState(IDLE);
    } catch {
      setState({ phase: "error", url: null, error: "Failed to stop tunnel" });
    }
  }, []);

  // Auto-reset copy feedback
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    return () => clearTimeout(id);
  }, [copied]);

  const copyUrl = useCallback(() => {
    if (!state.url) return;
    navigator.clipboard.writeText(state.url).then(() => setCopied(true)).catch(() => {});
  }, [state.url]);

  return {
    phase: state.phase,
    url: state.url,
    error: state.error,
    start,
    stop,
    copyUrl,
    copied,
  };
}
