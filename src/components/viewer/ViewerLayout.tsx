"use client";

import type { ReactNode } from "react";
import { PanelRight } from "lucide-react";
import { useSlideScale } from "@/hooks/useSlideScale";
import { useResizablePanel } from "@/hooks/useResizablePanel";
import { NotesPanel } from "./NotesPanel";

interface ViewerLayoutProps {
  sidebar: ReactNode;
  notes?: string;
  pageStatus?: ReactNode;
  overlay?: ReactNode;
  children: (scale: number | null) => ReactNode;
}

/** Shared desktop viewer: sidebar, centered stage, and resizable speaker notes. */
export function ViewerLayout({ sidebar, notes, pageStatus, overlay, children }: ViewerLayoutProps) {
  const { containerRef, scale } = useSlideScale({ padding: 64 });
  const { width, isOpen, toggle, resizeHandleProps } = useResizablePanel();
  return (
    <div data-viewer-layout="" className="flex h-screen">
      {sidebar}
      <main ref={containerRef} data-viewer-main="" className="relative flex flex-1 items-center justify-center overflow-hidden bg-ice-gray dark:bg-ice-gray-dark">
        {children(scale)}
        {overlay}
        {!isOpen && <button onClick={toggle} aria-label="Open notes panel"
          className="absolute right-3 top-3 rounded bg-white/80 p-1.5 text-gray-400 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-gray-600 dark:bg-gray-800/80 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"><PanelRight size={18} /></button>}
        {!isOpen && pageStatus && <div className="absolute bottom-3 right-3 rounded bg-black/50 px-2 py-1 text-xs tabular-nums text-white backdrop-blur">{pageStatus}</div>}
      </main>
      <NotesPanel notes={notes} isOpen={isOpen} width={width} onToggle={toggle} resizeHandleProps={resizeHandleProps} />
    </div>
  );
}
