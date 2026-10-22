"use client";

import { useEffect, useState } from "react";
import { useSlideScale } from "@/hooks/useSlideScale";
import { useRichDeckFrame } from "@/hooks/useRichDeckFrame";
import { buildScaledSlideStyle } from "@/lib/slide-utils";
import { RichDeckFrame } from "./RichDeckFrame";

interface PreviewProps {
  deckName: string;
  index?: number;
  title: string;
}

function PreviewFrame({ deckName, index = 0, title, scale }: PreviewProps & { scale: number | null }) {
  const connection = useRichDeckFrame({ deckName, preview: true,
    initialPosition: { slideIndex: index, stepIndex: Number.MAX_SAFE_INTEGER } });

  return <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
    <div style={{ ...buildScaledSlideStyle(scale, "#000"), transformOrigin: "center" }} className="relative">
      <RichDeckFrame {...connection} title={title} preview />
    </div>
  </div>;
}

/** Shared cover/page preview; release its HTML document when it leaves view. */
export function RichDeckPreview({ deckName, index = 0, title }: PreviewProps) {
  const { containerRef, scale } = useSlideScale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "100px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef]);

  return <div ref={containerRef} aria-hidden="true" className="relative aspect-video overflow-hidden bg-black" data-rich-thumbnail="">
    {visible && <PreviewFrame deckName={deckName} index={index} title={title} scale={scale} />}
  </div>;
}
