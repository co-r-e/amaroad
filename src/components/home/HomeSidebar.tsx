"use client";

import Link from "next/link";
import { useState } from "react";
import { createPortal } from "react-dom";
import type { DeckSummary } from "@/types/deck";
import { AmaroadLogo } from "@/components/AmaroadLogo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface HomeSidebarProps {
  decks: DeckSummary[];
}

interface TooltipState {
  text: string;
  x: number;
  y: number;
}

export function HomeSidebar({ decks }: HomeSidebarProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const showTooltip = (
    event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
    text: string,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({
      text,
      x: rect.right + 10,
      y: rect.top + rect.height / 2,
    });
  };

  const hideTooltip = () => setTooltip(null);

  return (
    <>
      <aside className="sticky top-0 flex h-screen w-64 flex-col bg-white dark:bg-gray-900">
        <div className="p-5">
          <AmaroadLogo
            width={120}
            height={30}
            aria-label="Amaroad"
            className="text-[#02001A] dark:text-white"
          />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-none">
          <ul className="flex flex-col gap-0.5">
            {decks.map((deck) => (
              <li key={deck.name}>
                <Link
                  href={`/${deck.name}`}
                  className="block truncate rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  onMouseEnter={(e) => showTooltip(e, deck.title)}
                  onMouseLeave={hideTooltip}
                  onFocus={(e) => showTooltip(e, deck.title)}
                  onBlur={hideTooltip}
                >
                  {deck.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <a
              href="https://co-r-e.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              About Us
            </a>
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
            <a
              href="https://x.com/okuwaki_m"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
              aria-label="X (Twitter)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/in/okuwakim/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
              aria-label="LinkedIn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          </div>
        </div>
      </aside>

      {tooltip && typeof document !== "undefined"
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-50 -translate-y-1/2 rounded-md bg-[#02001A] px-2.5 py-1.5 text-xs text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              {tooltip.text}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
