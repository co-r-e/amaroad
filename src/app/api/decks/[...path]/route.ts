import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { isLocalRequest, getSharedDeckName } from "@/lib/tunnel-access";
import fs from "@/lib/runtime-fs";

const DECKS_DIR = path.join(process.cwd(), "decks");
const DECKS_DIR_RESOLVED = path.resolve(DECKS_DIR);

const ALLOWED_EXTENSIONS: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

/**
 * Media answered with byte ranges: Safari will not play <audio>/<video>
 * without 206 responses. Everything else (notably SVG, which is scanned in
 * full) is always sent whole.
 */
const RANGE_EXTENSIONS = new Set([".mp3", ".mp4", ".webm"]);

const SVG_UNSAFE_PATTERNS = [
  /<script[\s>]/i,
  /\bon[a-z]+\s*=/i,
  /javascript\s*:/i,
  /<foreignObject[\s>]/i,
  /<(?:iframe|object|embed)[\s>]/i,
];

function isSafeSegment(segment: string): boolean {
  return Boolean(
    segment &&
    segment !== "." &&
    segment !== ".." &&
    !segment.includes("\0") &&
    !segment.includes("/") &&
    !segment.includes("\\"),
  );
}

function isWithinDecksDir(resolvedPath: string): boolean {
  const relative = path.relative(DECKS_DIR_RESOLVED, resolvedPath);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function isSafeSvg(svg: string): boolean {
  return !SVG_UNSAFE_PATTERNS.some((pattern) => pattern.test(svg));
}

type ByteRange = { start: number; end: number } | "unsatisfiable" | null;

/**
 * Parse a single `bytes=` range (RFC 9110). Returns null when the whole file
 * should be sent instead: no header, another unit, several ranges, or a
 * malformed value.
 */
function parseByteRange(header: string | null, size: number): ByteRange {
  const match = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null;
  if (!match) return null;
  const [, first, last] = match;
  if (first === "" && last === "") return null;
  if (size === 0) return "unsatisfiable";

  if (first === "") {
    // Suffix range: the final N bytes.
    const length = Number(last);
    if (length === 0) return "unsatisfiable";
    return { start: Math.max(0, size - length), end: size - 1 };
  }
  const start = Number(first);
  if (start >= size) return "unsatisfiable";
  const end = last === "" ? size - 1 : Math.min(Number(last), size - 1);
  if (end < start) return null;
  return { start, end };
}

async function readByteRange(filePath: string, start: number, end: number): Promise<Buffer> {
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(end - start + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const segments = (await params).path;
  const deckFromPath = segments[0];

  if (!deckFromPath || !segments.every(isSafeSegment)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  // Block remote access to non-shared decks
  if (!isLocalRequest(request) && getSharedDeckName() !== deckFromPath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(DECKS_DIR, ...segments);
  const resolved = path.resolve(filePath);

  if (!isWithinDecksDir(resolved)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  // Only serve whitelisted file types
  const ext = path.extname(resolved).toLowerCase();
  const contentType = ALLOWED_EXTENSIONS[ext];
  if (!contentType) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 403 });
  }

  try {
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // ETag based on mtime + size for conditional requests
    const etag = `"${stat.mtimeMs.toString(36)}-${stat.size.toString(36)}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }

    const isLocal = isLocalRequest(request);
    let cacheControl: string;
    if (process.env.NODE_ENV === "production") {
      cacheControl = "public, max-age=31536000, immutable";
    } else if (!isLocal) {
      // Remote viewers via tunnel: cache assets to avoid re-fetching through the tunnel on every navigation
      cacheControl = "public, max-age=3600, stale-while-revalidate=86400";
    } else {
      cacheControl = "no-cache, no-store, must-revalidate";
    }

    const headers = new Headers({
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    });

    if (RANGE_EXTENSIONS.has(ext)) {
      headers.set("Accept-Ranges", "bytes");
      // If-Range: a range is only valid against the representation the client already has.
      const ifRange = request.headers.get("if-range");
      const range = ifRange && ifRange !== etag ? null : parseByteRange(request.headers.get("range"), stat.size);
      if (range === "unsatisfiable") {
        headers.set("Content-Range", `bytes */${stat.size}`);
        return new NextResponse(null, { status: 416, headers });
      }
      if (range) {
        const chunk = await readByteRange(resolved, range.start, range.end);
        headers.set("Content-Range", `bytes ${range.start}-${range.start + chunk.length - 1}/${stat.size}`);
        headers.set("Content-Length", String(chunk.length));
        return new NextResponse(new Uint8Array(chunk), { status: 206, headers });
      }
    }

    const buffer = await fs.readFile(resolved);

    if (ext === ".svg") {
      const svg = buffer.toString("utf-8");
      if (!isSafeSvg(svg)) {
        return NextResponse.json({ error: "Invalid SVG" }, { status: 400 });
      }
      headers.set(
        "Content-Security-Policy",
        "default-src 'none'; style-src 'unsafe-inline'; sandbox;",
      );
    }

    return new NextResponse(buffer, {
      headers,
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
