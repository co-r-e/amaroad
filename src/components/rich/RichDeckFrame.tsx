"use client";

import type { RichDeckFrameConnection } from "@/hooks/useRichDeckFrame";

type FrameProps = Pick<RichDeckFrameConnection, "bindFrame" | "revision" | "source" | "initialize" | "ready" | "error"> & {
  title: string; preview?: boolean;
};

export function RichDeckFrame({ bindFrame, revision, source, initialize, ready, error, title, preview = false }: FrameProps) {
  return (
    <>
      <iframe key={revision} ref={bindFrame} title={title} src={source}
        data-rich-main-frame={preview ? undefined : ""} data-rich-preview-frame={preview ? "" : undefined}
        aria-hidden={preview ? true : undefined} tabIndex={preview ? -1 : undefined}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" allow="fullscreen *; autoplay *"
        onLoad={initialize}
        className={`absolute inset-0 h-full w-full border-0 ${preview ? "pointer-events-none" : ""} ${ready ? "" : "opacity-0"}`} />
      {!ready && !error && <div role={preview ? undefined : "status"}
        className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-white">
        {preview ? "" : "スライドを読み込んでいます..."}
      </div>}
      {preview && error && <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-xs text-gray-500 dark:bg-gray-800">プレビューを表示できません</div>}
    </>
  );
}
