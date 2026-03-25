"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Defers rendering until the element enters the viewport.
 * Once visible, stays visible (one-shot).
 */
export function useIntersectionVisibility(
  rootMargin = "200px",
  initialVisible = false,
) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(initialVisible);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  return { ref, visible };
}
