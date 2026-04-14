"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

interface UseSlideNavigationOptions {
  totalSlides: number;
  onSlideChange?: (index: number) => void;
}

const SLIDE_CHANGE_EVENT = "amaroad:slidechange";

function clampIndex(index: number, totalSlides: number): number {
  if (totalSlides <= 0) return 0;
  return Math.max(0, Math.min(totalSlides - 1, index));
}

function parseSlideParam(search: string): number {
  const slide = new URLSearchParams(search).get("slide");
  if (slide === null) return 0;

  const parsed = parseInt(slide, 10);
  if (isNaN(parsed) || parsed < 1) return 0;

  return parsed - 1;
}

function getSlideSnapshot(): number {
  if (typeof window === "undefined") return 0;
  return parseSlideParam(window.location.search);
}

function subscribeToSlideChanges(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("popstate", listener);
  window.addEventListener(SLIDE_CHANGE_EVENT, listener as EventListener);

  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(SLIDE_CHANGE_EVENT, listener as EventListener);
  };
}

function updateUrlForSlide(slideIndex: number) {
  const url = new URL(window.location.href);
  if (slideIndex === 0) {
    url.searchParams.delete("slide");
  } else {
    url.searchParams.set("slide", String(slideIndex + 1));
  }
  history.replaceState(null, "", url);
  window.dispatchEvent(new Event(SLIDE_CHANGE_EVENT));
}

export function useSlideNavigation({
  totalSlides,
  onSlideChange,
}: UseSlideNavigationOptions) {
  const urlSlideIndex = useSyncExternalStore(
    subscribeToSlideChanges,
    getSlideSnapshot,
    () => 0,
  );

  const currentSlide = clampIndex(urlSlideIndex, totalSlides);

  // Keep URL value valid when slide count changes.
  useEffect(() => {
    if (urlSlideIndex !== currentSlide) {
      updateUrlForSlide(currentSlide);
    }
  }, [urlSlideIndex, currentSlide]);

  useEffect(() => {
    onSlideChange?.(currentSlide);
  }, [currentSlide, onSlideChange]);

  const goTo = useCallback(
    (index: number): number => {
      const clamped = clampIndex(index, totalSlides);
      updateUrlForSlide(clamped);
      return clamped;
    },
    [totalSlides],
  );

  const next = useCallback((): number => {
    return goTo(currentSlide + 1);
  }, [goTo, currentSlide]);

  const previous = useCallback((): number => {
    return goTo(currentSlide - 1);
  }, [goTo, currentSlide]);

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
