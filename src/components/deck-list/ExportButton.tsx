"use client";

import type { ReactNode } from "react";
import { useState, useCallback } from "react";
import { Share, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useExportJob, formatExportLabel, type ExportFormat } from "@/contexts/ExportJobContext";

const MENU_ITEM_CLASS =
  "flex w-full items-center px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors";

interface ExportButtonProps {
  deckName: string;
}

export function ExportButton({ deckName }: ExportButtonProps): ReactNode {
  const { job, startExport } = useExportJob();
  const [menuOpen, setMenuOpen] = useState(false);

  const isThisDeck = job.deckName === deckName;
  const isWorking =
    isThisDeck &&
    (job.phase === "fetching" || job.phase === "capturing" || job.phase === "generating");

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
        title={`Export ${deckName}`}
      >
        {renderButtonContent()}
      </button>

      <Modal open={menuOpen && !isAnyExportActive} onClose={closeMenu}>
        <div className="w-44 overflow-hidden">
          <button onClick={handleFormatSelect("pdf")} className={MENU_ITEM_CLASS}>
            PDF
          </button>
          <button onClick={handleFormatSelect("pptx-image")} className={MENU_ITEM_CLASS}>
            PPTX
          </button>
        </div>
      </Modal>
    </div>
  );
}
