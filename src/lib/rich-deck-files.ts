import path from "node:path";
import fs from "./runtime-fs";
import { readDeckConfig } from "./deck-config";
import { resolveRichDeckDirectory, resolveRichDeckFile, validateRichConfig } from "./rich-deck-loader";
import { injectRichDeckBridge } from "./rich-deck-bridge";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml",
  ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".wav": "audio/wav",
  ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".bin": "application/octet-stream",
};

export async function richDeckFileResponse(request: Request, name: string, segments: string[]): Promise<Response> {
  const extension = path.extname(segments.at(-1) ?? "").toLowerCase();
  if (!MIME_TYPES[extension]) return new Response("File type not allowed", { status: 403 });
  // Only the deck entry is executable HTML; nested browsing contexts are disabled.
  if (extension === ".html" && segments.join("/") !== "index.html") return new Response("Not found", { status: 404 });
  try {
    const directory = await resolveRichDeckDirectory(name);
    const config = validateRichConfig(await readDeckConfig(directory));
    const file = await resolveRichDeckFile(directory, segments);
    const data = await fs.readFile(file);
    const url = new URL(request.url);
    const download = url.searchParams.get("download") === "1";
    if (download && (extension !== ".html" || !config.standalone)) {
      return new Response("Standalone HTML download is not available for this deck", { status: 400 });
    }
    const headers = new Headers({
      "Content-Type": MIME_TYPES[extension],
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Cross-Origin-Resource-Policy": "cross-origin",
      // The sandbox gives the child an opaque origin, including local fonts and module scripts.
      "Access-Control-Allow-Origin": "*",
    });
    if (extension === ".html" || extension === ".svg") {
      // Host and scheme select resource URLs only; access checks never trust forwarded headers.
      const origin = new URL(request.url);
      if (request.headers.get("x-forwarded-proto") === "https") origin.protocol = "https:";
      const host = request.headers.get("host");
      if (host) origin.host = host;
      const source = `${origin.origin}/api/rich-decks/${encodeURIComponent(name)}/files/`;
      headers.set("Content-Security-Policy", [
        "default-src 'none'", `script-src 'unsafe-inline' data: ${source}`,
        `style-src 'unsafe-inline' ${source}`, `img-src data: blob: ${source}`,
        `font-src data: ${source}`, `media-src data: blob: ${source}`,
        `connect-src data: blob: ${source}`, "object-src 'none'", "base-uri 'none'", "form-action 'none'",
        `frame-ancestors ${origin.origin}`,
        "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox",
      ].join("; "));
    }
    if (download) {
      headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}.html`);
      return new Response(data, { headers });
    }
    return new Response(extension === ".html" ? injectRichDeckBridge(data.toString("utf8")) : data, { headers });
  } catch {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}
