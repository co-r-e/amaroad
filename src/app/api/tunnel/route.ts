import type { NextRequest } from "next/server";
import { tunnelManager } from "@/lib/tunnel-manager";
import { isUnsafeDeckName } from "@/lib/deck-loader";
import {
  jsonNoStore,
  rejectCrossSite,
  rejectNonJsonBody,
  rejectRemote,
} from "@/lib/local-request-guards";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// The `dev` script starts Next.js with `next dev --port 3850`.
const DEFAULT_DEV_PORT = 3850;

// Response bodies are single-use ReadableStreams, so each request must
// receive a fresh instance.
const productionError = () =>
  jsonNoStore({ error: "Not available in production" }, { status: 403 });

/**
 * Resolve the local port cloudflared should expose, from trustworthy
 * server-side sources only.
 *
 * This must NEVER be derived from the request Host header: that value is
 * client-controlled, so a request such as `Host: localhost:6379` could point
 * the public quick tunnel at an arbitrary local service (Redis, a DB, an admin
 * panel), i.e. SSRF (CWE-918). The port is instead read from the process
 * environment the operator controls, defaulting to the dev server's own port.
 *
 * Resolution order (all server/operator-controlled, none request-derived):
 *   1. AMAROAD_TUNNEL_PORT — explicit operator override
 *   2. PORT                — port the process/Next.js is configured to serve on
 *   3. DEFAULT_DEV_PORT    — the `dev` script default (`next dev --port 3850`)
 */
function resolveTunnelTargetPort(): number {
  for (const value of [process.env.AMAROAD_TUNNEL_PORT, process.env.PORT]) {
    if (!value) continue;
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535) {
      return parsed;
    }
  }
  return DEFAULT_DEV_PORT;
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
  const rejected =
    rejectRemote(request) ??
    rejectCrossSite(request) ??
    rejectNonJsonBody(request);
  if (rejected) return rejected;

  const port = resolveTunnelTargetPort();
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
  const rejected = rejectRemote(request) ?? rejectCrossSite(request);
  if (rejected) return rejected;
  await tunnelManager.stop();
  return jsonNoStore(tunnelManager.getStatus());
}
