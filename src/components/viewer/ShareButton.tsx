"use client";

import { useState, useCallback } from "react";
import { Globe, Loader2, Copy, Check, Square } from "lucide-react";
import { useTunnel } from "@/hooks/useTunnel";
import { Modal } from "@/components/ui/Modal";

const BTN_BASE =
  "flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors";

function PulsingDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
    </span>
  );
}

interface ShareButtonProps {
  deckName?: string;
}

export function ShareButton({ deckName }: ShareButtonProps) {
  const { phase, url, error, start, stop, copyUrl, copied } = useTunnel(deckName);
  const [showModal, setShowModal] = useState(false);
  const closeModal = useCallback(() => setShowModal(false), []);

  const isModalVisible = showModal && phase === "active";

  return (
    <div className="relative">
      {phase === "idle" && (
        <button onClick={start} aria-label="Start sharing" className={`${BTN_BASE} border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800`}>
          <Globe size={14} />
          Share
        </button>
      )}

      {phase === "connecting" && (
        <button
          onClick={stop}
          aria-label="Cancel connection"
          className={`${BTN_BASE} border-gray-200 dark:border-gray-700 text-gray-400 hover:border-red-200 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500`}
          title="Cancel"
        >
          <Loader2 size={14} className="animate-spin" />
          Connecting...
        </button>
      )}

      {phase === "active" && (
        <button
          onClick={() => setShowModal((v) => !v)}
          aria-label="Show share details"
          className={`${BTN_BASE} border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50`}
        >
          <PulsingDot />
          Sharing
        </button>
      )}

      {phase === "stopping" && (
        <button disabled aria-label="Stopping tunnel" className={`${BTN_BASE} border-gray-200 dark:border-gray-700 text-gray-400`}>
          <Loader2 size={14} className="animate-spin" />
          Stopping...
        </button>
      )}

      {phase === "error" && (
        <button
          disabled
          aria-label="Sharing error"
          className={`${BTN_BASE} border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400`}
          title={error ?? undefined}
        >
          Error
        </button>
      )}

      <Modal open={isModalVisible && !!url} onClose={closeModal} ariaLabel="Share tunnel URL">
        <div className="w-96">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Tunnel URL
          </p>
          <div className="flex items-center gap-1.5">
            <code className="min-w-0 flex-1 break-all rounded bg-gray-50 dark:bg-gray-800 px-2 py-1 text-[11px] text-gray-600 dark:text-gray-300">
              {url}
            </code>
            <button
              onClick={copyUrl}
              aria-label="Copy URL"
              className="flex-shrink-0 rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300"
              title="Copy URL"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>
          </div>
          <button
            onClick={() => { stop(); closeModal(); }}
            aria-label="Stop sharing"
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Square size={10} />
            Stop sharing
          </button>
        </div>
      </Modal>
    </div>
  );
}
