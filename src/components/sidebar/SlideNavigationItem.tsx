"use client";

import { useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { SidebarContext } from "./SidebarContext";

interface SlideNavigationItemProps {
  index: number;
  title?: string;
  active: boolean;
  disabled?: boolean;
  onSelect: (index: number) => void;
  children: ReactNode;
}

interface PreviewPosition {
  left: number;
  top: number;
  width: number;
}

/** A thumbnail when expanded, or a numbered button with a floating slide preview. */
export function SlideNavigationItem({ index, title, active, disabled = false, onSelect, children }: SlideNavigationItemProps) {
  const sidebar = useContext(SidebarContext);
  const collapsed = sidebar?.collapsed ?? false;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [preview, setPreview] = useState<PreviewPosition | null>(null);
  const tooltipId = useId();
  const previewOpen = collapsed && sidebar?.previewId === tooltipId && preview !== null;

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);
  const hidePreview = useCallback(() => {
    cancelClose();
    setPreview(null);
  }, [cancelClose]);
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(hidePreview, 120);
  };
  const showPreview = () => {
    if (!collapsed || !buttonRef.current) return;
    cancelClose();
    const rect = buttonRef.current.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - rect.right - 24);
    const height = width * 9 / 16 + 40;
    setPreview({
      left: rect.right + 12,
      top: Math.max(12, Math.min(rect.top + rect.height / 2 - height / 2, window.innerHeight - height - 12)),
      width,
    });
    sidebar?.showPreview(tooltipId);
  };

  useEffect(() => {
    if (active) buttonRef.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, [active, collapsed]);

  useEffect(() => cancelClose, [cancelClose]);

  useEffect(() => {
    if (!previewOpen) return;
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") hidePreview();
    };
    window.addEventListener("resize", hidePreview);
    window.addEventListener("scroll", hidePreview, true);
    window.addEventListener("keydown", dismissOnEscape);
    return () => {
      window.removeEventListener("resize", hidePreview);
      window.removeEventListener("scroll", hidePreview, true);
      window.removeEventListener("keydown", dismissOnEscape);
    };
  }, [previewOpen, hidePreview]);

  return <>
    <div className="relative w-full shrink-0">
    {!collapsed && <div inert aria-hidden="true" className="pointer-events-none overflow-hidden rounded-lg">
      {children}
      <span className="absolute bottom-1 right-2 z-10 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">{index + 1}</span>
    </div>}
    <button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      onClick={() => { hidePreview(); onSelect(index); }}
      onMouseEnter={showPreview}
      onMouseLeave={scheduleClose}
      onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) showPreview(); }}
      onBlur={hidePreview}
      aria-label={`Slide ${index + 1}`}
      aria-current={active ? "true" : undefined}
      aria-describedby={previewOpen ? tooltipId : undefined}
      title={collapsed ? undefined : title}
      className={cn(
        "z-10 w-full cursor-pointer rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-default disabled:opacity-40",
        collapsed
          ? "relative flex h-9 items-center justify-center text-xs font-medium tabular-nums"
          : "absolute inset-0 h-full hover:ring-2 hover:ring-gray-300 dark:hover:ring-gray-600",
        collapsed && (active
          ? "bg-[#02001A] text-white dark:bg-gray-100 dark:text-gray-900"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"),
        !collapsed && active && "ring-2 ring-[#02001A] dark:ring-gray-100",
      )}
    >
      {collapsed ? index + 1 : null}
    </button>
    </div>
    {previewOpen && preview && createPortal(
      <div id={tooltipId} role="tooltip" onMouseEnter={cancelClose} onMouseLeave={scheduleClose}
        className="fixed z-50 overflow-hidden rounded-xl bg-white p-1 shadow-xl ring-1 ring-black/10 dark:bg-gray-900 dark:ring-white/15"
        style={preview}>
        <div inert aria-hidden="true" className="pointer-events-none overflow-hidden rounded-lg">{children}</div>
        <div className="flex h-8 items-center gap-2 px-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="shrink-0 font-medium tabular-nums">Slide {index + 1}</span>
          {title && <span className="truncate">{title}</span>}
        </div>
      </div>,
      document.body,
    )}
  </>;
}
