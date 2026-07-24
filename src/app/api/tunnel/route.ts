import { NextRequest, NextResponse } from "next/server";
import { tunnelManager } from "@/lib/tunnel-manager";
import { isLocalHost } from "@/lib/tunnel-access";
import { isUnsafeDeckName } from "@/lib/deck-loader";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// The `dev` script starts Next.js with `next dev --port 3850`.
const DEFAULT_DEV_PORT = 3850;

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

/** Reject requests that originate from outside localhost. */
function rejectRemote(request: NextRequest): Response | null {
  const host = request.headers.get("host") ?? "";
  if (!isLocalHost(host)) return forbidden();
  return null;
}

/**
 * Reject cross-site (CSRF) requests to state-changing endpoints.
 *
 * Browsers always attach an `Origin` header to cross-origin requests whose
 * method is not GET/HEAD (POST, DELETE, ...), so a request forged by another
 * site (e.g. https://evil.com) carries that site's Origin and is rejected
 * here. A genuine same-origin request from the app served on localhost carries
 * its own local Origin and passes. `Referer` is used as a fallback for the rare
 * client that omits Origin; if neither header proves a local origin the request
 * is rejected. This is the CSRF defense and is additive to `rejectRemote()`
 * (the Host check), which is left in place.
 */
function rejectCrossSite(request: NextRequest): Response | null {
  const source =
    request.headers.get("origin") ?? request.headers.get("referer");
  if (!source) return forbidden();

  let sourceHost: string;
  try {
    sourceHost = new URL(source).host;
  } catch {
    return forbidden();
  }

  if (!isLocalHost(sourceHost)) return forbidden();
  return null;
}

/**
 * Reject requests whose body is not declared `application/json`.
 *
 * `request.json()` ignores Content-Type, so a CORS-safelisted `text/plain` or
 * form body could be sent cross-site without triggering a CORS preflight.
 * Requiring `application/json` forces a preflight for any cross-site body,
 * closing that bypass. Defense in depth alongside the Origin check.
 */
function rejectNonJsonBody(request: NextRequest): Response | null {
  const mediaType = (request.headers.get("content-type") ?? "")
    .split(";")[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/json") return forbidden();
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
