"use client";

import Link from "next/link";
import { ArrowLeft, LayoutGrid, Monitor, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ShareButton } from "@/components/viewer/ShareButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useIsLocal } from "@/hooks/useIsLocal";
import { cn } from "@/lib/utils";
import { SidebarContext } from "./SidebarContext";

interface DeckSidebarProps {
  deckName: string;
  title: string;
  backHref?: string;
  backLabel?: string;
  onPresenterMode: () => void;
  onOverview?: () => void;
  exportAction: ReactNode;
  extraControls?: ReactNode;
  pageStatus: ReactNode;
  children: ReactNode;
}

/** Shared app chrome; slide renderers supply their own previews and export action. */
export function DeckSidebar({ deckName, title, backHref = "/", backLabel = "Back to deck list",
  onPresenterMode, onOverview, exportAction, extraControls, pageStatus, children }: DeckSidebarProps) {
  const isLocal = useIsLocal();
  const [collapsed, setCollapsed] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const toggleLabel = collapsed ? "Expand slide sidebar" : "Collapse slide sidebar";
  return (
    <SidebarContext value={{ collapsed, previewId, showPreview: setPreviewId }}>
    <aside data-deck-sidebar="" data-collapsed={collapsed} aria-label={title}
      className={cn("flex h-full shrink-0 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900", collapsed ? "w-14" : "w-64")}>
      <div className={cn("flex shrink-0 flex-col border-b border-gray-200 dark:border-gray-700", collapsed ? "gap-2 p-2" : "gap-3 p-4")}>
        <div className="flex min-w-0 items-center gap-2">
          <h1 className={cn("min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-sm font-semibold text-gray-900 scrollbar-none dark:text-gray-100", collapsed && "sr-only")}>{title}</h1>
          <button type="button" onClick={() => { setPreviewId(null); setCollapsed((value) => !value); }}
            aria-label={toggleLabel} title={toggleLabel} aria-expanded={!collapsed}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100">
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <div className={cn("flex min-w-0 gap-2", collapsed && "flex-col")}>
          {isLocal && <Link href={backHref} aria-label={backLabel} title={backLabel}
            className={cn("flex items-center justify-center rounded-lg px-2 text-[#02001A] transition-colors hover:bg-gray-100 dark:text-white dark:hover:bg-gray-800", collapsed && "size-9")}><ArrowLeft size={20} /></Link>}
          <button type="button" onClick={onPresenterMode} aria-label="Presenter Mode" title="Presenter Mode"
            className={cn("flex items-center justify-center gap-2 rounded-lg bg-[#02001A] text-xs font-medium text-white transition-opacity hover:opacity-80 dark:bg-gray-100 dark:text-gray-900", collapsed ? "size-9" : "flex-1 px-3 py-2")}>
            <Monitor size={collapsed ? 18 : 14} /><span className={collapsed ? "sr-only" : undefined}>Presenter Mode</span>
          </button>
        </div>
        <div className="flex min-w-0 gap-2">
          {isLocal && process.env.NODE_ENV !== "production" && <div className={cn("min-w-0 flex-1", collapsed && "hidden")}><ShareButton deckName={deckName} deckTitle={title} /></div>}
          <div className={collapsed ? "hidden" : "contents"}>{exportAction}</div>
          <button type="button" onClick={onOverview} disabled={!onOverview} title="Thumbnail overview" aria-label="Thumbnail overview"
            className={cn("flex items-center justify-center gap-1 rounded-lg text-sm transition-colors disabled:opacity-30", collapsed ? "size-9 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800" : "bg-[#02001A] px-2 py-1.5 text-white hover:bg-[#1a1a3a] dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200")}>
            <LayoutGrid size={collapsed ? 18 : 14} />
          </button>
        </div>
        {extraControls && <div className={collapsed ? "hidden" : "contents"}>{extraControls}</div>}
      </div>
      <div className={cn("min-h-0 flex-1 overflow-y-auto", collapsed ? "p-2 scrollbar-none" : "p-3")}>
        <div className={cn("flex flex-col", collapsed ? "gap-1" : "gap-2")}>{children}</div>
      </div>
      <div className={cn("flex shrink-0 items-center border-t border-gray-200 dark:border-gray-700", collapsed ? "justify-center p-2" : "justify-between p-3")}>
        <ThemeToggle /><span className={cn("text-xs text-gray-400 dark:text-gray-500", collapsed && "sr-only")}>{pageStatus}</span>
      </div>
    </aside>
    </SidebarContext>
  );
}
