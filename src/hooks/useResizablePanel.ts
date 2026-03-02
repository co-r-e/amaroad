"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface PanelState {
  width: number;
  isOpen: boolean;
}

const STORAGE_KEY = "dexcode-notes-panel";
const MIN_WIDTH = 240;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 320;
const DEFAULT_STATE: PanelState = { width: DEFAULT_WIDTH, isOpen: false };

function clampWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
}

function loadState(): PanelState {
  if (typeof window === "undefined") return DEFAULT_STATE;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;

    const parsed = JSON.parse(raw) as Partial<PanelState>;
    return {
      width: clampWidth(parsed.width ?? DEFAULT_WIDTH),
      isOpen: parsed.isOpen ?? false,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(state: PanelState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable (e.g. Safari private mode)
  }
}

export function useResizablePanel() {
  const [state, setState] = useState<PanelState>(() => loadState());
  const stateRef = useRef(state);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const hasPersistedRef = useRef(false);

  // Keep ref in sync for stable callbacks to read current width
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Persist on change (skip first render to avoid clobbering existing storage values)
  useEffect(() => {
    if (!hasPersistedRef.current) {
      hasPersistedRef.current = true;
      return;
    }
    saveState(state);
  }, [state]);

  // Cleanup drag listeners if component unmounts mid-drag
  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  const toggle = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  // Stable callback — reads width via ref instead of closing over state.width
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    const startX = e.clientX;
    const startWidth = stateRef.current.width;

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = clampWidth(startWidth + (startX - ev.clientX));
      setState((prev) => ({ ...prev, width: newWidth }));
    };

    const cleanup = () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", cleanup);
      dragCleanupRef.current = null;
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", cleanup);
    dragCleanupRef.current = cleanup;
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;

    const startX = touch.clientX;
    const startWidth = stateRef.current.width;

    const onTouchMove = (ev: TouchEvent) => {
      ev.preventDefault();
      const t = ev.touches[0];
      if (!t) return;
      const newWidth = clampWidth(startWidth + (startX - t.clientX));
      setState((prev) => ({ ...prev, width: newWidth }));
    };

    const cleanup = () => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", cleanup);
      document.removeEventListener("touchcancel", cleanup);
      dragCleanupRef.current = null;
    };

    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", cleanup);
    document.addEventListener("touchcancel", cleanup);
    dragCleanupRef.current = cleanup;
  }, []);

  // Stable object reference — avoids re-rendering NotesPanel on every frame during drag
  const resizeHandleProps = useMemo(() => ({ onMouseDown, onTouchStart }), [onMouseDown, onTouchStart]);

  return {
    width: state.width,
    isOpen: state.isOpen,
    toggle,
    resizeHandleProps,
  };
}
