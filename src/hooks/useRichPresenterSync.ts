"use client";

import { useEffect, useRef } from "react";
import type { RichDeckPosition, RichDeckState } from "@/types/rich-deck";

export function useRichPresenterSync({ deckName, presenter, state, enabled, onNavigate }: {
  deckName: string; presenter: boolean; state: RichDeckState | null; enabled: boolean;
  onNavigate: (position: RichDeckPosition) => void;
}) {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const stateRef = useRef({ state, enabled, onNavigate });
  const pendingRef = useRef<RichDeckPosition | null>(null);
  const linkedRef = useRef(false);
  useEffect(() => { stateRef.current = { state, enabled, onNavigate }; }, [state, enabled, onNavigate]);

  useEffect(() => {
    let channel: BroadcastChannel;
    try { channel = new BroadcastChannel(`amaroad-rich-presenter-${deckName}`); } catch { return; }
    channelRef.current = channel;
    const publish = () => {
      const current = stateRef.current.state;
      if (current) channel.postMessage({ type: "state", slideIndex: current.slideIndex, stepIndex: current.stepIndex });
    };
    channel.onmessage = (event: MessageEvent) => {
      const message = event.data;
      if (!message || typeof message !== "object") return;
      if (message.type === "request") { if (!presenter) publish(); return; }
      if (message.type !== "state" || !Number.isSafeInteger(message.slideIndex) || message.slideIndex < 0 ||
        !Number.isSafeInteger(message.stepIndex) || message.stepIndex < 0) return;
      linkedRef.current = true;
      const position = { slideIndex: message.slideIndex, stepIndex: message.stepIndex };
      const current = stateRef.current;
      if (!current.enabled) { pendingRef.current = position; return; }
      if (current.state?.slideIndex !== position.slideIndex || current.state?.stepIndex !== position.stepIndex) current.onNavigate(position);
    };
    let retry: ReturnType<typeof setTimeout> | undefined;
    if (presenter) {
      channel.postMessage({ type: "request" });
      retry = setTimeout(() => channel.postMessage({ type: "request" }), 500);
    }
    return () => { clearTimeout(retry); channel.close(); channelRef.current = null; };
  }, [deckName, presenter]);

  const slideIndex = state?.slideIndex;
  const stepIndex = state?.stepIndex;
  useEffect(() => {
    if (!enabled || slideIndex === undefined || stepIndex === undefined) return;
    if (pendingRef.current) {
      const position = pendingRef.current;
      pendingRef.current = null;
      onNavigate(position);
      return;
    }
    if (!presenter || linkedRef.current) channelRef.current?.postMessage({ type: "state", slideIndex, stepIndex });
  }, [enabled, slideIndex, stepIndex, presenter, onNavigate]);
}
