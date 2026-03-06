"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { measureStrictSlideElement, type StrictMeasureResult } from "@/lib/strict-measure";
import type { SlideData } from "@/types/deck";
import { StrictSlideMarkup } from "./StrictSlideMarkup";

interface StrictSlideRendererProps {
  slide: SlideData;
  onFitStatusChange?: (status: "measuring" | "fit" | "overflow", result: StrictMeasureResult | null) => void;
}

export function StrictSlideRenderer({
  slide,
  onFitStatusChange,
}: StrictSlideRendererProps): React.JSX.Element {
  if (!slide.strictInput) {
    throw new Error("StrictSlideRenderer requires slide.strictInput.");
  }

  const rootRef = useRef<HTMLDivElement>(null);
  const [measure, setMeasure] = useState<StrictMeasureResult | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    onFitStatusChange?.("measuring", null);

    const update = () => {
      const next = measureStrictSlideElement(root);
      setMeasure(next);
      onFitStatusChange?.(next.fits ? "fit" : "overflow", next);
    };

    update();

    const observer = new ResizeObserver(() => update());
    observer.observe(root);
    root.querySelectorAll<HTMLElement>("[data-strict-slot]").forEach((element) => {
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [slide.filename, slide.strictInput, onFitStatusChange]);

  const overflowSlots = (measure?.slots ?? [])
    .filter((slot) => !slot.fits)
    .map((slot) => slot.slot)
    .join(",");

  const fitStatus = measure === null ? "measuring" : measure.fits ? "fit" : "overflow";

  return (
    <div
      ref={rootRef}
      style={{ width: "100%", height: "100%", minHeight: 0 }}
    >
      <StrictSlideMarkup
        slide={slide}
        fitStatus={fitStatus}
        overflowSlotsAttr={overflowSlots || undefined}
        overflowingSlots={
          new Set(
            (measure?.slots ?? [])
              .filter((slot) => !slot.fits)
              .map((slot) => slot.slot),
          )
        }
      />
    </div>
  );
}
