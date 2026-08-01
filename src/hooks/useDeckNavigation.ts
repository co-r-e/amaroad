"use client";

import { useCallback } from "react";
import { useSlideNavigation } from "./useSlideNavigation";
import { usePresenterSync } from "./usePresenterSync";
import {
  useKeyboardNavigation,
  type UseKeyboardNavigationOptions,
} from "./useKeyboardNavigation";

interface UseDeckNavigationOptions {
  deckName: string;
  totalSlides: number;
  role: "viewer" | "presenter";
  /** Extra keyboard handlers; navigation keys are wired here. */
  keyboard?: Omit<
    UseKeyboardNavigationOptions,
    "onNext" | "onPrevious" | "onFirst" | "onLast"
  >;
}

export function useDeckNavigation({
  deckName,
  totalSlides,
  role,
  keyboard,
}: UseDeckNavigationOptions) {
  const { currentSlide, goTo, next, previous } = useSlideNavigation({
    totalSlides,
  });

  const { broadcastNavigation } = usePresenterSync({
    deckName,
    role,
    currentSlide,
    totalSlides,
    onNavigate: goTo,
  });

  const handleNavigate = useCallback(
    (index: number) => {
      const clamped = goTo(index);
      broadcastNavigation(clamped);
    },
    [goTo, broadcastNavigation],
  );

  const handleNext = useCallback(() => {
    const newIndex = next();
    broadcastNavigation(newIndex);
  }, [next, broadcastNavigation]);

  const handlePrevious = useCallback(() => {
    const newIndex = previous();
    broadcastNavigation(newIndex);
  }, [previous, broadcastNavigation]);

  useKeyboardNavigation({
    onNext: handleNext,
    onPrevious: handlePrevious,
    onFirst: () => handleNavigate(0),
    onLast: () => handleNavigate(totalSlides - 1),
    ...keyboard,
  });

  return { currentSlide, handleNavigate };
}
