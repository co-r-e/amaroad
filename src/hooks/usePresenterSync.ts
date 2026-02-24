"use client";

import { useEffect, useRef, useCallback } from "react";

type PresenterMessage =
  | { type: "navigate"; slideIndex: number }
  | { type: "sync-request" }
  | { type: "sync-response"; slideIndex: number; totalSlides: number };

interface UsePresenterSyncOptions {
  deckName: string;
  role: "viewer" | "presenter";
  currentSlide: number;
  totalSlides: number;
  onNavigate: (slideIndex: number) => void;
}

export function usePresenterSync({
  deckName,
  role,
  currentSlide,
  totalSlides,
  onNavigate,
}: UsePresenterSyncOptions) {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const stateRef = useRef({ currentSlide, totalSlides, onNavigate, role });

  // Keep ref in sync with latest props without re-creating channel
  useEffect(() => {
    stateRef.current = { currentSlide, totalSlides, onNavigate, role };
  }, [currentSlide, totalSlides, onNavigate, role]);

  useEffect(() => {
    const channel = new BroadcastChannel(`nipry-presenter-${deckName}`);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<PresenterMessage>) => {
      const msg = event.data;
      const { currentSlide: slide, totalSlides: total, onNavigate: navigate, role: r } = stateRef.current;

      switch (msg.type) {
        case "navigate":
          navigate(msg.slideIndex);
          break;
        case "sync-request":
          channel.postMessage({
            type: "sync-response",
            slideIndex: slide,
            totalSlides: total,
          } satisfies PresenterMessage);
          break;
        case "sync-response":
          if (r === "presenter") {
            navigate(msg.slideIndex);
          }
          break;
      }
    };

    // Presenter requests sync on mount with retry
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    if (role === "presenter") {
      channel.postMessage({ type: "sync-request" } satisfies PresenterMessage);
      retryTimer = setTimeout(() => {
        channel.postMessage({ type: "sync-request" } satisfies PresenterMessage);
      }, 500);
    }

    return () => {
      clearTimeout(retryTimer);
      channel.close();
      channelRef.current = null;
    };
  }, [deckName, role]);

  const broadcastNavigation = useCallback(
    (slideIndex: number) => {
      channelRef.current?.postMessage({
        type: "navigate",
        slideIndex,
      } satisfies PresenterMessage);
    },
    [],
  );

  return { broadcastNavigation };
}
