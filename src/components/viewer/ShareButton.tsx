"use client";

import { useState, useCallback, useEffect, useEffectEvent, useRef } from "react";
import { Globe, Loader2, Copy, Check, Square, RotateCcw, AlertCircle } from "lucide-react";
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
  deckTitle?: string;
}

export function ShareButton({ deckName, deckTitle }: ShareButtonProps) {
  const {
    phase, url, error, elapsedSeconds,
    start, stop, retry, copyUrl, copied, copyFailed,
  } = useTunnel(deckName);
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const [confirmingStop, setConfirmingStop] = useState(false);
  const closeModal = useCallback(() => {
    setOpenUrl(null);
    setConfirmingStop(false);
  }, []);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const isModalVisible = phase === "active" && !!url && openUrl === url;

  // Auto-open modal when tunnel becomes active
  const prevPhaseRef = useRef(phase);
  const openShareDetails = useEffectEvent((nextUrl: string) => {
    setOpenUrl(nextUrl);
  });
  useEffect(() => {
    if (prevPhaseRef.current === "connecting" && phase === "active" && url) {
      openShareDetails(url);
    }
    prevPhaseRef.current = phase;
  }, [phase, url]);

  useEffect(() => {
    if (!isModalVisible || !copyFailed) return;
    urlInputRef.current?.focus();
    urlInputRef.current?.select();
  }, [copyFailed, isModalVisible]);

  const effectiveConfirmingStop = isModalVisible ? confirmingStop : false;

  // Register keyboard shortcut: Ctrl/Cmd+Shift+S to toggle sharing
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (phase === "idle") {
          start();
        } else if (phase === "active" && url) {
          setConfirmingStop(false);
          setOpenUrl((prev) => (prev === url ? null : url));
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [phase, start, url]);

  const handleStopClick = useCallback(() => {
    if (!effectiveConfirmingStop) {
      setConfirmingStop(true);
      return;
    }
    stop();
    closeModal();
  }, [effectiveConfirmingStop, stop, closeModal]);

  // Select-all on the fallback input for manual copy
  const handleInputFocus = useCallback(() => {
    urlInputRef.current?.select();
  }, []);

  return (
    <div className="relative">
      {/* Accessible live region for state change announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {phase === "connecting" && "Tunnel connecting..."}
        {phase === "active" && "Sharing is now active"}
        {phase === "error" && `Sharing failed: ${error}`}
        {phase === "stopping" && "Stopping tunnel..."}
      </div>

      {phase === "idle" && (
        <button
          type="button"
          onClick={start}
          aria-label="Start sharing"
          title="Share (Ctrl+Shift+S)"
          className={`${BTN_BASE} border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800`}
        >
          <Globe size={14} />
          Share
        </button>
      )}

      {phase === "connecting" && (
        <button
          type="button"
          onClick={stop}
          aria-label="Cancel connection"
          className={`${BTN_BASE} border-gray-200 dark:border-gray-700 text-gray-400 hover:border-red-200 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500`}
          title="Cancel"
        >
          <Loader2 size={14} className="animate-spin" />
          <span>Connecting... {elapsedSeconds > 0 && <span className="tabular-nums">{elapsedSeconds}s</span>}</span>
        </button>
      )}

      {phase === "active" && (
        <button
          type="button"
          onClick={() => {
            if (!url) return;
            setConfirmingStop(false);
            setOpenUrl((prev) => (prev === url ? null : url));
          }}
          aria-label="Show share details"
          title="Share details (Ctrl+Shift+S)"
          className={`${BTN_BASE} border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50`}
        >
          <PulsingDot />
          Sharing
        </button>
      )}

      {phase === "stopping" && (
        <button type="button" disabled aria-label="Stopping tunnel" className={`${BTN_BASE} border-gray-200 dark:border-gray-700 text-gray-400`}>
          <Loader2 size={14} className="animate-spin" />
          Stopping...
        </button>
      )}

      {phase === "error" && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={retry}
            aria-label="Retry sharing"
            className={`${BTN_BASE} border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50`}
            title={error ?? undefined}
          >
            <RotateCcw size={13} />
            Retry
          </button>
          {error && (
            <p className="px-1 text-[10px] leading-4 text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      )}

      <Modal open={isModalVisible && !!url} onClose={closeModal} ariaLabel="Share tunnel URL">
        <div className="w-full max-w-sm px-1">
          {/* Deck name */}
          {deckTitle && (
            <p className="mb-1 truncate text-xs font-semibold text-gray-700 dark:text-gray-200">
              {deckTitle}
            </p>
          )}

          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Tunnel URL
          </p>

          {/* URL display + copy */}
          <div className="flex items-center gap-2">
            {copyFailed ? (
              /* Fallback: selectable input for manual copy */
              <input
                ref={urlInputRef}
                type="text"
                readOnly
                value={url ?? ""}
                onFocus={handleInputFocus}
                className="min-w-0 flex-1 rounded bg-gray-50 dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-300 outline-none"
              />
            ) : (
              <code className="min-w-0 flex-1 break-all rounded bg-gray-50 dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-300">
                {url}
              </code>
            )}
            <button
              type="button"
              onClick={copyUrl}
              aria-label={copied ? "URL copied" : "Copy URL to clipboard"}
              className="flex flex-shrink-0 items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              {copied ? (
                <>
                  <Check size={13} className="text-emerald-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={13} />
                  Copy
                </>
              )}
            </button>
          </div>

          {/* Copy failure hint */}
          {copyFailed && (
            <p className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
              <AlertCircle size={10} />
              Auto-copy unavailable. Select the URL above and copy manually.
            </p>
          )}

          {/* Stop sharing */}
          {effectiveConfirmingStop ? (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingStop(false)}
                className="flex flex-1 items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStopClick}
                aria-label="Confirm stop sharing"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-2 py-1.5 text-[11px] font-medium text-red-600 dark:text-red-400 transition-colors hover:bg-red-100 dark:hover:bg-red-900/50"
              >
                <Square size={10} />
                Confirm stop
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStopClick}
              aria-label="Stop sharing"
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Square size={10} />
              Stop sharing
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}
