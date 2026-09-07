/**
 * Shared Playwright helpers for Amaroad tooling (capture, overflow, doctor).
 */
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { waitForNativeSlideReady, type SlideReadyResult } from "./slide-ready";

export const DEFAULT_BASE_URL = "http://127.0.0.1:3850";
export const SLIDE_WIDTH = 1920;
export const SLIDE_HEIGHT = 1080;
export const NATIVE_STAGE_SELECTOR = "[data-native-slide-stage]";

export interface ServerInfo {
  baseUrl: string;
}

export function resolveBaseUrl(explicit?: string): string {
  const raw = explicit || process.env.BASE_URL || DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, "");
}

/**
 * Verify the Amaroad server answers on `baseUrl`. Throws a user-facing error
 * (with the command to run) when it does not.
 */
export async function ensureServer(baseUrl: string): Promise<ServerInfo> {
  try {
    const res = await fetch(`${baseUrl}/`, { redirect: "manual" });
    if (res.status >= 500) {
      throw new Error(`server responded with HTTP ${res.status}`);
    }
    return { baseUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Amaroad server is not reachable at ${baseUrl} (${message}).\n` +
        `Start it with: pnpm dev   (or pass --base-url / BASE_URL for another port)`,
    );
  }
}

/**
 * Launch headless Chromium. Falls back to the system Chrome channel when the
 * Playwright-managed browser binary is missing (common after a playwright
 * version bump without `playwright install`).
 */
export async function launchBrowser(): Promise<Browser> {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/Executable doesn't exist|browserType\.launch|Failed to launch/i.test(message)) {
      throw error;
    }
    try {
      return await chromium.launch({ headless: true, channel: "chrome" });
    } catch {
      throw new Error(
        `Could not launch Chromium (${message.split("\n")[0]}).\n` +
          `Install the Playwright browser with: pnpm exec playwright install chromium`,
      );
    }
  }
}

export interface SlidePageOptions {
  deck: string;
  index: number;
  scale?: number;
  sourceLines?: boolean;
}

export function nativeSlideUrl(baseUrl: string, options: SlidePageOptions): string {
  const params = new URLSearchParams();
  if (options.scale && options.scale !== 1) params.set("scale", String(options.scale));
  if (options.sourceLines) params.set("lines", "1");
  const query = params.toString();
  return `${baseUrl}/${encodeURIComponent(options.deck)}/slide/${options.index}${query ? `?${query}` : ""}`;
}

/**
 * tsx/esbuild wraps serialized functions in a `__name(fn, "name")` helper that
 * does not exist inside the browser. Define a no-op shim before any
 * `page.evaluate` runs.
 */
const ESBUILD_NAME_SHIM = "globalThis.__name = globalThis.__name || ((fn) => fn);";

export async function createSlideContext(
  browser: Browser,
  scale = 1,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: {
      width: Math.max(1, Math.round(SLIDE_WIDTH * scale)),
      height: Math.max(1, Math.round(SLIDE_HEIGHT * scale)),
    },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  await context.addInitScript(ESBUILD_NAME_SHIM);
  return context;
}

/**
 * Navigate a page to one slide on the native render route and wait until the
 * slide is fully rendered. `networkidle` is deliberately avoided because the
 * dev server keeps an SSE connection open.
 */
export async function openNativeSlide(
  page: Page,
  baseUrl: string,
  options: SlidePageOptions,
): Promise<SlideReadyResult> {
  const url = nativeSlideUrl(baseUrl, options);
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (!response) {
    return { status: "error", message: `no response from ${url}` };
  }
  if (response.status() === 404) {
    return { status: "error", message: `HTTP 404 for ${url} (deck or slide not found)` };
  }
  if (response.status() >= 400) {
    return { status: "error", message: `HTTP ${response.status()} for ${url}` };
  }
  await page.evaluate(ESBUILD_NAME_SHIM);
  return page.evaluate(waitForNativeSlideReady, { rootSelector: NATIVE_STAGE_SELECTOR });
}

export interface DeckDataSlide {
  index: number;
  filename: string;
  frontmatter: { type: string };
  contentStartLine?: number;
}

export interface DeckData {
  name: string;
  config: { title: string };
  slides: DeckDataSlide[];
}

/** Fetch the deck manifest the server itself renders from. */
export async function fetchDeckData(baseUrl: string, deck: string): Promise<DeckData> {
  const res = await fetch(`${baseUrl}/api/decks/${encodeURIComponent(deck)}/data`);
  if (res.status === 404) {
    throw new Error(`Deck "${deck}" not found on ${baseUrl}`);
  }
  if (!res.ok) {
    throw new Error(`Failed to load deck data for "${deck}": HTTP ${res.status}`);
  }
  return (await res.json()) as DeckData;
}
