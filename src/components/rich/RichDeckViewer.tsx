"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Maximize, RefreshCw } from "lucide-react";
import { DeckSidebar } from "@/components/sidebar/DeckSidebar";
import { ViewerLayout } from "@/components/viewer/ViewerLayout";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useRichDeckFrame } from "@/hooks/useRichDeckFrame";
import { useRichPresenterSync } from "@/hooks/useRichPresenterSync";
import { buildScaledSlideStyle } from "@/lib/slide-utils";
import type { RichDeck, RichDeckPosition } from "@/types/rich-deck";
import { RichDeckFrame } from "./RichDeckFrame";
import { RichSlideThumbnail } from "./RichSlideThumbnail";
import styles from "./RichDeckViewer.module.css";

const BUTTON = "inline-flex items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-30 dark:text-gray-200 dark:hover:bg-gray-800";

export function RichDeckViewer({ deck, presenter = false, initialPosition }: {
  deck: RichDeck; presenter?: boolean; initialPosition?: RichDeckPosition;
}) {
  const connection = useRichDeckFrame({ deckName: deck.name, initialPosition });
  const { state, capabilities, slides, ready, send } = connection;
  const stageRef = useRef<HTMLDivElement>(null);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const error = connection.error ?? fullscreenError;

  const navigate = useCallback((position: RichDeckPosition) => send({ action: "goTo", ...position }), [send]);
  const selectSlide = useCallback((slideIndex: number) => navigate({ slideIndex, stepIndex: 0 }), [navigate]);
  useRichPresenterSync({ deckName: deck.name, presenter, state, enabled: ready && capabilities.goTo, onNavigate: navigate });

  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stageRef.current?.requestFullscreen().catch(() => setFullscreenError("全画面に切り替えられませんでした。"));
  }, []);

  useEffect(() => {
    if (presenter) void stageRef.current?.requestFullscreen().catch(() => {});
  }, [presenter]);

  useEffect(() => {
    if (!state || presenter) return;
    const url = new URL(window.location.href);
    if (state.slideIndex === 0 && state.stepIndex === 0) { url.searchParams.delete("slide"); url.searchParams.delete("step"); }
    else { url.searchParams.set("slide", String(state.slideIndex + 1)); url.searchParams.set("step", String(state.stepIndex)); }
    history.replaceState(null, "", url);
  }, [state, presenter]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.isComposing ||
        (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)))) return;
      if (event.key === "Escape" && document.fullscreenElement) { event.preventDefault(); void document.exitFullscreen(); return; }
      if (event.key.toLowerCase() === "f") { event.preventDefault(); fullscreen(); return; }
      if (target instanceof HTMLElement && ["BUTTON", "A"].includes(target.tagName) && [" ", "Enter"].includes(event.key)) return;
      if (["ArrowRight", "ArrowDown", " ", "Enter", "PageDown"].includes(event.key) && capabilities.next) {
        event.preventDefault(); send({ action: "next" });
      } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key) && capabilities.previous) {
        event.preventDefault(); send({ action: "previous" });
      } else if (state && capabilities.goTo && ["Home", "End"].includes(event.key)) {
        event.preventDefault(); navigate({ slideIndex: event.key === "Home" ? 0 : state.slideCount - 1, stepIndex: 0 });
      }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [capabilities, fullscreen, navigate, send, state]);

  const pageLabel = state ? `${state.slideIndex + 1} / ${state.slideCount}` : "HTML";
  const position = <span data-rich-position="" aria-live="polite">{state ? `${pageLabel} · ${state.stepIndex + 1} / ${state.stepCount}` : "HTML"}</span>;
  const frame = <RichDeckFrame {...connection} title={deck.config.title} />;
  const alert = error ? <div role="alert" className="absolute left-4 right-4 top-14 z-10 flex items-center justify-between gap-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
    <span>{error}</span><button type="button" className={BUTTON} onClick={() => { setFullscreenError(null); connection.reload(); }}><RefreshCw size={14} />再読み込み</button>
  </div> : null;
  const nextPrevious = <>
    {capabilities.previous && <button type="button" className={BUTTON} aria-label="前の段階へ" onClick={() => connection.send({ action: "previous" })}
      disabled={state?.slideIndex === 0 && state.stepIndex === 0}><ChevronLeft size={18} /></button>}
    {capabilities.next && <button type="button" className={BUTTON} aria-label="次の段階へ" onClick={() => connection.send({ action: "next" })}
      disabled={!!state && state.slideIndex === state.slideCount - 1 && state.stepIndex === state.stepCount - 1}><ChevronRight size={18} /></button>}
    <button type="button" className={BUTTON} onClick={fullscreen}><Maximize size={14} />全画面</button>
  </>;

  if (presenter) return <div data-rich-status={error ? "error" : ready ? "ready" : "loading"} className="relative h-screen bg-black">
    <div ref={stageRef} data-rich-stage="" className="absolute inset-0">{frame}</div>
    <div className="sr-only">{position}</div>{alert}
  </div>;

  if (isMobile) return <div data-rich-status={error ? "error" : ready ? "ready" : "loading"} className="flex min-h-dvh flex-col bg-ice-gray dark:bg-ice-gray-dark">
    <header className="sticky top-0 z-20 border-b border-black/6 bg-ice-gray/92 px-4 py-2.5 text-sm font-semibold text-gray-700 backdrop-blur dark:border-white/10 dark:bg-ice-gray-dark/92 dark:text-gray-200">{deck.config.title}</header>
    <div ref={stageRef} data-rich-stage="" className={`${styles.stage} relative aspect-video w-full bg-black`}>{frame}</div>
    <div className="flex items-center justify-between p-3 text-xs text-gray-500">{position}<div className="flex gap-1">{nextPrevious}</div></div>{alert}
  </div>;

  const openPresenter = () => {
    const query = state ? `?slide=${state.slideIndex + 1}&step=${state.stepIndex}` : "";
    window.open(`/${encodeURIComponent(deck.name)}/presenter${query}`, "amaroad-presenter");
  };
  const exportAction = deck.config.standalone ? <a href={`${connection.source}?download=1`} download aria-label="HTMLを保存" title="HTMLを保存"
    className="flex items-center gap-1 rounded-lg bg-[#02001A] px-2 py-1.5 text-xs text-white dark:bg-gray-100 dark:text-gray-900"><Download size={14} />HTML</a> :
    <button type="button" disabled title="単一HTMLのデッキのみ保存できます" className="rounded-lg bg-[#02001A] px-2 py-1.5 text-xs text-white opacity-30 dark:bg-gray-100 dark:text-gray-900"><Download size={14} /></button>;
  const sidebar = <DeckSidebar deckName={deck.name} title={deck.config.title} backHref="/?mode=rich" backLabel="リッチスライド一覧へ"
    onPresenterMode={openPresenter} onOverview={slides.length ? () => window.open(`/${encodeURIComponent(deck.name)}/thumbnails`, "_blank") : undefined}
    exportAction={exportAction} extraControls={<div className="flex items-center gap-1">{nextPrevious}</div>} pageStatus={position}>
    {slides.length ? slides.map((slide, index) => <RichSlideThumbnail key={index} deckName={deck.name} index={index} title={slide.title}
      active={state?.slideIndex === index} disabled={!capabilities.goTo} onSelect={selectSlide} />) :
      <p className="px-2 py-3 text-xs text-gray-500">{ready ? "HTMLプレゼンテーション" : "スライドを読み込んでいます..."}</p>}
  </DeckSidebar>;

  return <div data-rich-status={error ? "error" : ready ? "ready" : "loading"}>
    <ViewerLayout sidebar={sidebar} notes={slides[state?.slideIndex ?? 0]?.notes} pageStatus={pageLabel} overlay={alert}>
      {(scale) => <div ref={stageRef} data-rich-stage="" className={`${styles.stage} relative shadow-xl dark:shadow-2xl dark:shadow-black/60`}
        style={buildScaledSlideStyle(scale, "#000")}>
        {frame}
      </div>}
    </ViewerLayout>
  </div>;
}
