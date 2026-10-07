"use client";

import type { CSSProperties } from "react";
import type { NarrationPhase } from "@/hooks/useNarrationAutoplay";
import styles from "./NarrationIndicator.module.css";

export type IndicatorCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface NarrationIndicatorProps {
  phase: NarrationPhase;
  /** Pick a corner the deck's logo / copyright / page number do not use. */
  corner: IndicatorCorner;
}

const CORNER_CLASSES: Record<IndicatorCorner, string> = {
  "top-left": styles.topLeft,
  "top-right": styles.topRight,
  "bottom-left": styles.bottomLeft,
  "bottom-right": styles.bottomRight,
};

const LABELS: Record<Exclude<NarrationPhase["kind"], "off">, string> = {
  loading: "Narration",
  playing: "Narrating",
  waiting: "Next slide",
  blocked: "Audio blocked: press A twice",
};

/**
 * Small auto-play status chip for the presenter (audience-facing) window.
 * The countdown is a CSS animation keyed per wait, so it never re-renders
 * the presenter while it runs.
 */
export function NarrationIndicator({ phase, corner }: NarrationIndicatorProps): React.JSX.Element | null {
  if (phase.kind === "off") return null;

  const counting = phase.kind === "waiting" || phase.kind === "blocked";

  return (
    <div className={`${styles.indicator} ${CORNER_CLASSES[corner]}`} role="status" data-narration-phase={phase.kind}>
      <span className={styles.label}>
        <span className={`${styles.dot} ${phase.kind === "playing" ? styles.dotPlaying : ""}`} />
        {LABELS[phase.kind]}
      </span>
      {counting && (
        <span className={styles.progress}>
          <span
            key={phase.key}
            className={styles.bar}
            style={{ "--wait-duration": `${phase.seconds}s` } as CSSProperties}
          />
        </span>
      )}
    </div>
  );
}
