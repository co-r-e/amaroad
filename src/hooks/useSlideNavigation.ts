"use client";

import { useState, useCallback, useRef } from "react";

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
  if (isNaN(parsed) || parsed < 0) return 0;

  return clampIndex(parsed, totalSlides);
}

export function useSlideNavigation({
  totalSlides,
  onSlideChange,
}: UseSlideNavigationOptions) {
  const [currentSlide, setCurrentSlide] = useState(() =>
    getInitialSlide(totalSlides),
  );
  const currentSlideRef = useRef(currentSlide);

  const goTo = useCallback(
    (index: number) => {
      const clamped = clampIndex(index, totalSlides);
      currentSlideRef.current = clamped;
      setCurrentSlide(clamped);
      onSlideChange?.(clamped);
    },
    [totalSlides, onSlideChange],
  );

  const next = useCallback(() => {
    goTo(currentSlideRef.current + 1);
  }, [goTo]);

  const previous = useCallback(() => {
    goTo(currentSlideRef.current - 1);
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
