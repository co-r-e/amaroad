"use client";

import { useRef, type KeyboardEvent } from "react";

export type SlideMode = "simple" | "rich";

const MODES = [
  { value: "simple", label: "シンプルスライド" },
  { value: "rich", label: "リッチスライド" },
] as const;

interface SlideModeTabsProps {
  mode: SlideMode;
  onModeChange: (mode: SlideMode) => void;
}

export function SlideModeTabs({ mode, onModeChange }: SlideModeTabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % MODES.length;
        break;
      case "ArrowLeft":
        nextIndex = (index + MODES.length - 1) % MODES.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = MODES.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    onModeChange(MODES[nextIndex].value);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="スライドモード"
      className="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800"
    >
      {MODES.map(({ value, label }, index) => (
        <button
          key={value}
          ref={(element) => {
            tabRefs.current[index] = element;
          }}
          type="button"
          role="tab"
          id={`${value}-slides-tab`}
          aria-controls={`${value}-slides-panel`}
          aria-selected={mode === value}
          tabIndex={mode === value ? 0 : -1}
          onClick={() => onModeChange(value)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          className={`flex-1 rounded-md px-1.5 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 ${
            mode === value
              ? "bg-white text-[#02001A] shadow-sm dark:bg-gray-700 dark:text-white"
              : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
