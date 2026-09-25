import { NextResponse, type NextRequest } from "next/server";
import { isLocalHost } from "./tunnel-access";

/**
 * Guards for API routes that change local state or spend local resources
 * (the share tunnel, vector PDF export). They are only sound because the
 * server binds to loopback; see the SECURITY INVARIANT in tunnel-access.ts.
 */

export function jsonNoStore(body: unknown, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

// Response bodies are single-use streams, so every rejection is a new instance.
export const forbidden = () => jsonNoStore({ error: "Forbidden" }, { status: 403 });

/** Reject requests that originate from outside localhost. */
export function rejectRemote(request: NextRequest): Response | null {
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
export function rejectCrossSite(request: NextRequest): Response | null {
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
export function rejectNonJsonBody(request: NextRequest): Response | null {
  const mediaType = (request.headers.get("content-type") ?? "")
    .split(";")[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/json") return forbidden();
  return null;
}
