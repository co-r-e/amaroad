import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const DECKS_DIR = path.join(process.cwd(), "decks");

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const segments = (await params).path;

  // Prevent directory traversal
  if (segments.some((s) => s === ".." || s.includes("\0"))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const filePath = path.join(DECKS_DIR, ...segments);
  const resolved = path.resolve(filePath);

  if (!resolved.startsWith(path.resolve(DECKS_DIR))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  // Only serve whitelisted file types
  const ext = path.extname(resolved).toLowerCase();
  const contentType = ALLOWED_EXTENSIONS[ext];
  if (!contentType) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 403 });
  }

  try {
    const buffer = await fs.readFile(resolved);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control":
          process.env.NODE_ENV === "production"
            ? "public, max-age=31536000, immutable"
            : "no-cache, no-store, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
