"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";
import type { PresenterNarration } from "@/types/deck";

/** Extra time past a playing track's remaining length before a missing `ended` is treated as lost. */
const WATCHDOG_GRACE_SECONDS = 5;
/** Same, while the track is still loading or buffering (slow links, e.g. a shared tunnel). */
const LOAD_GRACE_SECONDS = 20;
const SILENT_WAV_SAMPLE_RATE = 8000;
const SILENT_WAV_SAMPLES = 400; // 50 ms

/**
 * A tiny silent WAV as a blob: URL (the CSP allows `media-src 'self' blob:`,
 * not data:). Playing it inside the key press that starts auto-play marks the
 * shared <audio> element as user-activated, which Safari requires before
 * later, timer-driven `play()` calls are allowed.
 */
function createSilentWavUrl(): string {
  const dataBytes = SILENT_WAV_SAMPLES * 2;
  const view = new DataView(new ArrayBuffer(44 + dataBytes));
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SILENT_WAV_SAMPLE_RATE, true);
  view.setUint32(28, SILENT_WAV_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, dataBytes, true);
  return URL.createObjectURL(new Blob([view.buffer], { type: "audio/wav" }));
}

/**
 * Must run inside the key press that starts auto-play. The element is created
 * lazily here (never during render: SSR has no Audio) and played once with
 * the silent clip; that play() is interrupted right away by the first real
 * track (AbortError), only the gesture-time call matters.
 */
function primeAudioElement(
  audioRef: RefObject<HTMLAudioElement | null>,
  unlockUrlRef: RefObject<string | null>,
): void {
  let audio = audioRef.current;
  if (!audio) {
    audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;
  }
  unlockUrlRef.current ??= createSilentWavUrl();
  audio.src = unlockUrlRef.current;
  audio.play().catch(() => {});
}

/**
 * Unmount cleanup. Reads the refs at cleanup time on purpose: the element is
 * created after mount (on the first key press), so a value captured when the
 * effect ran would always be null.
 */
function releaseAudioElement(
  audioRef: RefObject<HTMLAudioElement | null>,
  unlockUrlRef: RefObject<string | null>,
): void {
  const audio = audioRef.current;
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  if (unlockUrlRef.current) URL.revokeObjectURL(unlockUrlRef.current);
  // Fast Refresh re-runs this cleanup without unmounting; never reuse a revoked URL.
  audioRef.current = null;
  unlockUrlRef.current = null;
}

export interface NarrationToggle {
  /** Increments each time auto-play starts; null while it is off. */
  session: number | null;
  toggle: () => void;
  stop: () => void;
  audioRef: RefObject<HTMLAudioElement | null>;
}

/**
 * Auto-play on/off state and the single reused <audio> element. Split from
 * the playback loop so the keyboard handler can be passed into
 * useDeckNavigation, whose `currentSlide` the loop then consumes.
 */
export function useNarrationToggle(): NarrationToggle {
  const [session, setSession] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockUrlRef = useRef<string | null>(null);
  const sessionCountRef = useRef(0);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setSession(null);
  }, []);

  const toggle = useCallback(() => {
    if (session !== null) {
      stop();
      return;
    }
    primeAudioElement(audioRef, unlockUrlRef);
    sessionCountRef.current += 1;
    setSession(sessionCountRef.current);
  }, [session, stop]);

  useEffect(() => () => releaseAudioElement(audioRef, unlockUrlRef), []);

  return { session, toggle, stop, audioRef };
}

export type NarrationPhase =
  | { kind: "off" }
  | { kind: "loading" }
  | { kind: "playing" }
  /** Counting down to the next slide; `key` restarts the countdown animation. */
  | { kind: "waiting"; seconds: number; key: string }
  /** The browser refused to play; pacing continues on the track's length. */
  | { kind: "blocked"; seconds: number; key: string };

type ReportedStatus =
  | { kind: "playing" }
  | { kind: "waiting" | "blocked"; seconds: number };

interface UseNarrationPlaybackOptions {
  toggle: NarrationToggle;
  narration: PresenterNarration;
  currentSlide: number;
  totalSlides: number;
  /** Navigate to an absolute slide index (and sync other windows). */
  onNavigate: (index: number) => void;
}

/**
 * The auto-play loop. Every slide change while active (auto-advance, arrow
 * keys, or navigation from the viewer window) restarts it for the new slide:
 * play the track then pause `pauseSeconds`, or show a track-less slide for
 * `silentSlideSeconds`, then advance. Stops after the last slide.
 */
export function useNarrationPlayback({
  toggle,
  narration,
  currentSlide,
  totalSlides,
  onNavigate,
}: UseNarrationPlaybackOptions): NarrationPhase {
  const { session, stop, audioRef } = toggle;
  const [reported, setReported] = useState<{ session: number; slide: number; seq: number; status: ReportedStatus } | null>(
    null,
  );
  const track = narration.tracks[currentSlide] ?? null;

  const advance = useEffectEvent((from: number) => {
    if (from >= totalSlides - 1) {
      stop();
      return;
    }
    onNavigate(from + 1);
  });

  const report = useEffectEvent((slide: number, status: ReportedStatus) => {
    if (session === null) return;
    setReported((prev) => ({ session, slide, seq: (prev?.seq ?? 0) + 1, status }));
  });

  const stopFromOutside = useEffectEvent(() => stop());

  useEffect(() => {
    if (session === null) return;
    const slide = currentSlide;
    const audio = audioRef.current;
    // One controller per run: once this slide is left, its late events,
    // play() rejections and timers must not act.
    const controller = new AbortController();
    const { signal } = controller;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (seconds: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!signal.aborted) advance(slide);
      }, seconds * 1000);
    };
    const waitThenAdvance = (seconds: number, kind: "waiting" | "blocked" = "waiting") => {
      report(slide, { kind, seconds });
      schedule(seconds);
    };

    if (!track || !audio) {
      // Rendered as "waiting" from props; no state update needed here.
      schedule(narration.silentSlideSeconds);
    } else {
      // Media events are dispatched asynchronously, so ones still queued from
      // the previous source (or the unlock clip) can arrive after these
      // listeners exist. Only trust ended/pause once *this* play() resolved.
      let started = false;
      audio.addEventListener(
        "ended",
        () => {
          if (started) waitThenAdvance(narration.pauseSeconds);
        },
        { signal },
      );
      audio.addEventListener("error", () => waitThenAdvance(narration.silentSlideSeconds), { signal });
      // A pause nobody here asked for (media keys, headset, OS controls)
      // means the presenter took over: stop instead of advancing under it.
      audio.addEventListener(
        "pause",
        () => {
          if (started && !audio.ended) stopFromOutside();
        },
        { signal },
      );

      // Watchdog for a file that never loads, stalls, or is truncated so that
      // `ended` never fires. Generous while loading or buffering, then re-armed
      // to the remaining track time whenever audio is actually playing, so a
      // slow start never cuts a track short.
      const armWatchdog = (graceSeconds: number) => {
        const remaining = Math.max(0, track.durationSec - (started ? audio.currentTime : 0));
        schedule(remaining + narration.pauseSeconds + graceSeconds);
      };
      audio.addEventListener(
        "playing",
        () => {
          if (started) armWatchdog(WATCHDOG_GRACE_SECONDS);
        },
        { signal },
      );
      audio.addEventListener(
        "waiting",
        () => {
          if (started) armWatchdog(LOAD_GRACE_SECONDS);
        },
        { signal },
      );

      audio.src = track.src;
      armWatchdog(LOAD_GRACE_SECONDS);
      audio.play().then(
        () => {
          if (signal.aborted) return;
          started = true;
          armWatchdog(WATCHDOG_GRACE_SECONDS);
          report(slide, { kind: "playing" });
        },
        (error: unknown) => {
          if (signal.aborted) return;
          const name = error instanceof DOMException ? error.name : "";
          if (name === "AbortError") return;
          if (name === "NotAllowedError") {
            waitThenAdvance(track.durationSec + narration.pauseSeconds, "blocked");
            return;
          }
          waitThenAdvance(narration.silentSlideSeconds);
        },
      );
    }

    return () => {
      controller.abort();
      clearTimeout(timer);
      audio?.pause();
    };
  }, [session, currentSlide, track, narration.silentSlideSeconds, narration.pauseSeconds, audioRef]);

  if (session === null) return { kind: "off" };
  const current = reported && reported.session === session && reported.slide === currentSlide ? reported : null;
  if (!current) {
    return track
      ? { kind: "loading" }
      : { kind: "waiting", seconds: narration.silentSlideSeconds, key: `${session}-${currentSlide}-silent` };
  }
  if (current.status.kind === "playing") return { kind: "playing" };
  return { kind: current.status.kind, seconds: current.status.seconds, key: `${session}-${currentSlide}-${current.seq}` };
}
