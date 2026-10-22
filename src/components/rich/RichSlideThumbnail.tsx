"use client";

import { memo } from "react";
import { SlideNavigationItem } from "@/components/sidebar/SlideNavigationItem";
import { RichDeckPreview } from "./RichDeckPreview";

export const RichSlideThumbnail = memo(function RichSlideThumbnail({ deckName, index, title, active, disabled = false, onSelect }: {
  deckName: string; index: number; title: string; active: boolean; disabled?: boolean; onSelect: (index: number) => void;
}) {
  return <SlideNavigationItem index={index} title={title} active={active} disabled={disabled} onSelect={onSelect}>
    <RichDeckPreview deckName={deckName} index={index} title={title} />
  </SlideNavigationItem>;
});
