"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface UseSlideNavigationOptions {
  totalSlides: number;
  onSlideChange?: (index: number) => void;
}

function clampIndex(index: number, totalSlides: number): number {
  if (totalSlides <= 0) return 0;
  return Math.max(0, Math.min(totalSlides - 1, index));
}

function getInitialSlide(totalSlides: number): number {
  if (typeof window === "undefined") return 0;

  const slide = new URLSearchParams(window.location.search).get("slide");
  if (slide === null) return 0;

  const parsed = parseInt(slide, 10);
  if (isNaN(parsed) || parsed < 1) return 0;

  return clampIndex(parsed - 1, totalSlides);
}

export function useSlideNavigation({
  totalSlides,
  onSlideChange,
}: UseSlideNavigationOptions) {
  const [currentSlide, setCurrentSlide] = useState(() =>
    getInitialSlide(totalSlides),
  );
  const currentSlideRef = useRef(currentSlide);

  // Clamp currentSlide when totalSlides changes (e.g. hot reload removes slides)
  useEffect(() => {
    const clamped = clampIndex(currentSlideRef.current, totalSlides);
    if (clamped !== currentSlideRef.current) {
      currentSlideRef.current = clamped;
      setCurrentSlide(clamped);
    }
  }, [totalSlides]);

  const goTo = useCallback(
    (index: number): number => {
      const clamped = clampIndex(index, totalSlides);
      currentSlideRef.current = clamped;
      setCurrentSlide(clamped);
      onSlideChange?.(clamped);

      const url = new URL(window.location.href);
      if (clamped === 0) {
        url.searchParams.delete("slide");
      } else {
        url.searchParams.set("slide", String(clamped + 1));
      }
      history.replaceState(null, "", url);

      return clamped;
    },
    [totalSlides, onSlideChange],
  );

  useEffect(() => {
    const onPopState = () => {
      const slide = new URLSearchParams(window.location.search).get("slide");
      const parsed = slide === null ? 0 : parseInt(slide, 10);
      const clamped = clampIndex(
        isNaN(parsed) || parsed < 1 ? 0 : parsed - 1,
        totalSlides,
      );
      currentSlideRef.current = clamped;
      setCurrentSlide(clamped);
      onSlideChange?.(clamped);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [totalSlides, onSlideChange]);

  const next = useCallback((): number => {
    return goTo(currentSlideRef.current + 1);
  }, [goTo]);

  const previous = useCallback((): number => {
    return goTo(currentSlideRef.current - 1);
  }, [goTo]);

  const first = useCallback(() => goTo(0), [goTo]);
  const last = useCallback(() => goTo(totalSlides - 1), [goTo, totalSlides]);

  return {
    currentSlide,
    goTo,
    next,
    previous,
    first,
    last,
  };
}
