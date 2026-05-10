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
            <a
              href="https://github.com/co-r-e/amaroad"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
              aria-label="GitHub"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
            </a>
            <a
              href="https://amaroad.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
              aria-label="Website"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
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
