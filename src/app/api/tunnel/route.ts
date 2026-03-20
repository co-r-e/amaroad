import { NextRequest, NextResponse } from "next/server";
import { tunnelManager } from "@/lib/tunnel-manager";
import { isLocalHost } from "@/lib/tunnel-access";
import { isUnsafeDeckName } from "@/lib/deck-loader";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function jsonNoStore(body: unknown, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

// Response factories — Response bodies are single-use ReadableStreams,
// so each request must receive a fresh instance.
const productionError = () =>
  jsonNoStore({ error: "Not available in production" }, { status: 403 });

const forbidden = () =>
  jsonNoStore({ error: "Forbidden" }, { status: 403 });

/** Detect the local port from the Host header (fallback to 3000). */
function detectPort(request: NextRequest): number {
  const host = request.headers.get("host")?.split(",")[0]?.trim() ?? "";
  const match = host.startsWith("[")
    ? host.match(/\]:(\d+)$/)
    : host.indexOf(":") === host.lastIndexOf(":")
      ? host.match(/:(\d+)$/)
      : null;
  return match ? parseInt(match[1], 10) : 3000;
}

/** Reject requests that originate from outside localhost. */
function rejectRemote(request: NextRequest): Response | null {
  const host = request.headers.get("host") ?? "";
  if (!isLocalHost(host)) return forbidden();
  return null;
}

function parseDeckName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isUnsafeDeckName(trimmed)) {
    throw new Error("Invalid deck name");
  }
  return trimmed;
}

/** GET /api/tunnel -- current tunnel status */
export function GET(request: NextRequest): Response {
  if (IS_PRODUCTION) return productionError();
  const rejected = rejectRemote(request);
  if (rejected) return rejected;
  return jsonNoStore(tunnelManager.getStatus());
}

/** POST /api/tunnel -- start tunnel */
export async function POST(request: NextRequest): Promise<Response> {
  if (IS_PRODUCTION) return productionError();
  const rejected = rejectRemote(request);
  if (rejected) return rejected;

  const port = detectPort(request);
  const body = await request.json().catch(() => ({}));
  try {
    const deckName = parseDeckName(body.deckName);
    return jsonNoStore(tunnelManager.start(port, deckName));
  } catch {
    return jsonNoStore({ error: "Invalid deck name" }, { status: 400 });
  }
}

/** DELETE /api/tunnel -- stop tunnel */
export async function DELETE(request: NextRequest): Promise<Response> {
  if (IS_PRODUCTION) return productionError();
  const rejected = rejectRemote(request);
  if (rejected) return rejected;
  await tunnelManager.stop();
  return jsonNoStore(tunnelManager.getStatus());
}
