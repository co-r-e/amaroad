import { headers } from "next/headers";
import { tunnelManager } from "./tunnel-manager";

// ---------------------------------------------------------------------------
// Localhost detection
// ---------------------------------------------------------------------------
//
// SECURITY INVARIANT: The Host-header trust decision below (isLocalHost /
// isLocalRequest / getTunnelAccess) is only sound because the HTTP server is
// bound to loopback (127.0.0.1) in both `dev` and `start` — see the `--hostname
// 127.0.0.1` flags in package.json. Because no off-host peer can open a
// connection, a request whose Host is localhost/127.0.0.1 can only come from the
// local browser; the Cloudflare quick tunnel forwards the public
// `*.trycloudflare.com` Host instead (cloudflared dials http://localhost:<port>
// from this same machine). Do NOT relax that loopback bind, and do NOT derive
// trust from any other client-controllable header (e.g. X-Forwarded-For), which
// Next.js only fills from the socket peer via nullish-assignment and is
// therefore spoofable when sent by the client.

const LOCALHOST_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0:0:0:0:0:0:0:1",
  "::ffff:127.0.0.1",
]);

function extractHostname(host: string): string | null {
  const normalized = host.split(",")[0]?.trim().toLowerCase().replace(/\.$/, "") ?? "";
  if (!normalized) return null;

  // IPv6 bracket notation: [::1]:3000 -> ::1
  if (normalized.startsWith("[")) {
    const closing = normalized.indexOf("]");
    if (closing === -1) return null;
    return normalized.slice(1, closing).split("%")[0] ?? null;
  }

  const firstColon = normalized.indexOf(":");
  const lastColon = normalized.lastIndexOf(":");

  // Single colon means hostname:port. Multiple colons is an unbracketed IPv6 literal.
  if (firstColon !== -1 && firstColon === lastColon) {
    return normalized.slice(0, firstColon);
  }

  return normalized.split("%")[0] ?? null;
}

/** Check if a Host header value resolves to localhost. */
export function isLocalHost(host: string): boolean {
  const hostname = extractHostname(host);
  return hostname ? LOCALHOST_HOSTNAMES.has(hostname) : false;
}

// ---------------------------------------------------------------------------
// Tunnel state helpers
// ---------------------------------------------------------------------------

/**
 * Return the currently shared deck name, or null if no tunnel is active.
 *
 * Intentionally returns null during "connecting" state (~30s window) so that
 * remote requests are blocked until the tunnel is fully established.
 */
export function getSharedDeckName(): string | null {
  const state = tunnelManager.getStatus();
  return state.status === "active" ? state.deckName : null;
}

// ---------------------------------------------------------------------------
// Convenience helpers for pages / API routes
// ---------------------------------------------------------------------------

/** For Server Components — reads `headers()` and returns access info. */
export async function getTunnelAccess(): Promise<{
  isLocal: boolean;
  sharedDeck: string | null;
}> {
  const h = await headers();
  const host = h.get("host") ?? "";
  return {
    isLocal: isLocalHost(host),
    sharedDeck: getSharedDeckName(),
  };
}

/** For API Route handlers — reads the request's Host header. */
export function isLocalRequest(request: {
  headers: { get(name: string): string | null };
}): boolean {
  const host = request.headers.get("host") ?? "";
  return isLocalHost(host);
}
