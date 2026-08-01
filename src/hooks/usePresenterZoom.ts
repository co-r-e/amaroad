"use client";

import { useCallback, useEffect, useRef } from "react";

const ZOOM_SCALE = 2;

/**
 * Magnifier-style zoom for presenter mode. While active, the view is scaled
 * around the pointer and pans as the pointer moves, so whatever the cursor
 * points at stays under the cursor. Transform writes go straight to the DOM
 * (no React re-renders) to keep pointer-follow at 60fps.
 */
export function usePresenterZoom() {
  const zoomRef = useRef<HTMLDivElement>(null);
  const zoomedRef = useRef(false);
  const pointerRef = useRef({ x: 0, y: 0 });

  const applyTransform = useCallback(() => {
    const el = zoomRef.current;
    if (!el) return;
    if (zoomedRef.current) {
      const { x, y } = pointerRef.current;
      const shift = ZOOM_SCALE - 1;
      // will-change only while zoomed; leaving it on would pin the whole
      // slide subtree to a GPU layer for the entire presentation.
      el.style.willChange = "transform";
      el.style.transform = `translate3d(${-shift * x}px, ${-shift * y}px, 0) scale(${ZOOM_SCALE})`;
    } else {
      el.style.willChange = "";
      el.style.transform = "";
    }
  }, []);

  useEffect(() => {
    // Until the pointer moves, anchor a potential zoom at screen center.
    pointerRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    const handlePointerMove = (event: PointerEvent): void => {
      pointerRef.current.x = event.clientX;
      pointerRef.current.y = event.clientY;
      if (zoomedRef.current) applyTransform();
    };
    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [applyTransform]);

  const toggleZoom = useCallback(() => {
    zoomedRef.current = !zoomedRef.current;
    applyTransform();
  }, [applyTransform]);

  /** Deactivates zoom; returns true if it was active. */
  const resetZoom = useCallback(() => {
    if (!zoomedRef.current) return false;
    zoomedRef.current = false;
    applyTransform();
    return true;
  }, [applyTransform]);

  return { zoomRef, toggleZoom, resetZoom };
}
