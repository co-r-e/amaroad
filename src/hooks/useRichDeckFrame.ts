"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseRichDeckEvent } from "@/lib/rich-deck-protocol";
import type { RichDeckCapabilities, RichDeckCommand, RichDeckPosition, RichDeckSlide, RichDeckState } from "@/types/rich-deck";

const EMPTY_CAPABILITIES: RichDeckCapabilities = { next: false, previous: false, goTo: false };

interface Options {
  deckName: string;
  preview?: boolean;
  initialPosition?: RichDeckPosition;
}

export function useRichDeckFrame({ deckName, preview = false, initialPosition }: Options) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const tokenRef = useRef("");
  const lastStateRef = useRef<RichDeckState | null>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<RichDeckState | null>(null);
  const [slides, setSlides] = useState<RichDeckSlide[]>([]);
  const [capabilities, setCapabilities] = useState(EMPTY_CAPABILITIES);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const source = `/api/rich-decks/${encodeURIComponent(deckName)}/files/index.html`;
  const initialSlide = initialPosition?.slideIndex;
  const initialStep = initialPosition?.stepIndex;
  const bindFrame = useCallback((element: HTMLIFrameElement | null) => { iframeRef.current = element; }, []);

  const initialize = useCallback(() => {
    tokenRef.current ||= crypto.randomUUID();
    // Opaque sandbox origins require '*'; responses are bound to this frame/token.
    iframeRef.current?.contentWindow?.postMessage({ type: "amaroad:rich:init", token: tokenRef.current,
      mode: preview ? "preview" : "viewer", slideIndex: lastStateRef.current?.slideIndex ?? initialSlide,
      stepIndex: lastStateRef.current?.stepIndex ?? initialStep }, "*");
  }, [preview, initialSlide, initialStep]);

  const send = useCallback((command: RichDeckCommand) => {
    iframeRef.current?.contentWindow?.postMessage({ type: "amaroad:rich:command", token: tokenRef.current, ...command }, "*");
  }, []);

  useEffect(() => {
    let acknowledged = false;
    const receive = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || event.origin !== "null") return;
      const message = parseRichDeckEvent(event.data, tokenRef.current);
      if (!message) return;
      acknowledged = true;
      lastStateRef.current = message.state;
      setReady(true); setState(message.state); setSlides(message.slides);
      setCapabilities(message.capabilities); setError(message.error ?? null);
    };
    window.addEventListener("message", receive);
    const retry = setInterval(() => { if (!acknowledged) initialize(); }, 300);
    const timeout = setTimeout(() => { if (!acknowledged) setError("HTMLを読み込めませんでした。再読み込みしてください。"); }, 15000);
    return () => { window.removeEventListener("message", receive); clearInterval(retry); clearTimeout(timeout); };
  }, [initialize, revision]);

  const reload = () => {
    setReady(false); setState(null); setSlides([]); setCapabilities(EMPTY_CAPABILITIES); setError(null);
    tokenRef.current = ""; setRevision((value) => value + 1);
  };

  return { bindFrame, initialize, send, source, revision, ready, state, slides, capabilities, error, reload };
}

export type RichDeckFrameConnection = ReturnType<typeof useRichDeckFrame>;
