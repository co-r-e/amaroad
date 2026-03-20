import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { isLocalRequest, getSharedDeckName } from "@/lib/tunnel-access";

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
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

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

    const buffer = await fs.readFile(resolved);

    const headers = new Headers({
      "Content-Type": contentType,
      "Cache-Control":
        process.env.NODE_ENV === "production"
          ? "public, max-age=31536000, immutable"
          : "no-cache, no-store, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    });

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
