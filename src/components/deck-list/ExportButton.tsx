"use client";

import type { ReactNode } from "react";
import { useState, useCallback } from "react";
import { Share, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useIsLocal } from "@/hooks/useIsLocal";
import {
  ACTIVE_EXPORT_PHASES,
  useExportJob,
  formatExportLabel,
  type ExportFormat,
} from "@/contexts/ExportJobContext";

const MENU_ITEM_CLASS =
  "flex w-full items-center px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors";

interface ExportButtonProps {
  deckName: string;
}

export function ExportButton({ deckName }: ExportButtonProps): ReactNode {
  const { job, startExport } = useExportJob();
  // Vector PDFs are rendered by Chromium on the host, which only answers
  // localhost; a viewer on a shared tunnel URL gets the in-browser exports.
  const canExportVector = useIsLocal();
  const [menuOpen, setMenuOpen] = useState(false);

  const isThisDeck = job.deckName === deckName;
  const isWorking = isThisDeck && ACTIVE_EXPORT_PHASES.has(job.phase);

  const toggleMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen((v) => !v);
  }, []);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  function handleFormatSelect(format: ExportFormat): (e: React.MouseEvent) => void {
    return (e) => {
      e.preventDefault();
      e.stopPropagation();
      setMenuOpen(false);
      startExport(deckName, format);
    };
  }

  const isAnyExportActive = job.phase !== "idle" && job.phase !== "error";

  function renderButtonContent(): ReactNode {
    if (isThisDeck && job.phase === "error") {
      return <span className="text-red-300 dark:text-red-500">Error</span>;
    }

    if (isWorking) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{formatExportLabel(job.phase, job.format, job.progress)}</span>
        </>
      );
    }

    return (
      <>
        <Share className="h-4 w-4" />
        <span>Export</span>
      </>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={toggleMenu}
        disabled={isAnyExportActive}
        className="flex items-center gap-1.5 rounded-lg bg-[#02001A] dark:bg-gray-100 px-3 py-1.5 text-sm text-white dark:text-gray-900 transition-colors hover:bg-[#1a1a3a] dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        title={isThisDeck && job.phase === "error" && job.errorMessage ? job.errorMessage : `Export ${deckName}`}
      >
        {renderButtonContent()}
      </button>

      <Modal open={menuOpen && !isAnyExportActive} onClose={closeMenu}>
        <div className="w-48 overflow-hidden">
          {canExportVector && (
            <button
              onClick={handleFormatSelect("pdf-vector")}
              className={MENU_ITEM_CLASS}
              title="Selectable, searchable text and vector graphics"
            >
              PDF (vector)
            </button>
          )}
          <button
            onClick={handleFormatSelect("pdf")}
            className={MENU_ITEM_CLASS}
            title="Each slide captured as an image in this browser"
          >
            PDF (image)
          </button>
          <button onClick={handleFormatSelect("pptx-image")} className={MENU_ITEM_CLASS}>
            PPTX
          </button>
        </div>
      </Modal>
    </div>
  );
}
