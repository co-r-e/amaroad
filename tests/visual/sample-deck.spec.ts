import { test, expect, type Page } from "@playwright/test";
import { waitForNativeSlideReady } from "../../scripts/lib/slide-ready";

/**
 * Renders every slide of the committed `sample-deck` at half size (960x540)
 * through the native slide route and compares it with the stored baseline.
 * Any change in the slide engine (components, CSS, fonts, spacing rules)
 * shows up here as a pixel diff.
 */
const DECK = "sample-deck";
const SCALE = 0.5;
const STAGE = "[data-native-slide-stage]";

interface DeckSlide {
  index: number;
  filename: string;
}

async function loadSlides(page: Page): Promise<DeckSlide[]> {
  const res = await page.request.get(`/api/decks/${DECK}/data`);
  expect(res.ok(), `GET /api/decks/${DECK}/data`).toBeTruthy();
  const data = (await res.json()) as { slides: DeckSlide[] };
  return data.slides;
}

// Slide list is fetched once at collection time so each slide is its own test.
let slides: DeckSlide[] = [];
test.beforeAll(async ({ request }) => {
  const res = await request.get(`/api/decks/${DECK}/data`);
  expect(res.ok()).toBeTruthy();
  slides = ((await res.json()) as { slides: DeckSlide[] }).slides;
});

test("sample-deck has slides", async ({ page }) => {
  const list = await loadSlides(page);
  expect(list.length).toBeGreaterThan(0);
});

// The number of slides is known from the manifest at collection time.
import order from "../../decks/sample-deck/slide-order";

for (const [index, name] of order.entries()) {
  test(`slide ${String(index + 1).padStart(3, "0")} ${name}`, async ({ page }) => {
    // Shim for functions serialized by tsx/esbuild (see scripts/lib/browser.ts).
    await page.addInitScript("globalThis.__name = globalThis.__name || ((fn) => fn);");
    const response = await page.goto(`/${DECK}/slide/${index}?scale=${SCALE}`, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `HTTP status for slide ${index}`).toBe(200);

    const ready = await page.evaluate(waitForNativeSlideReady, { rootSelector: STAGE });
    expect(ready.status, ready.message ?? "").toBe("ready");

    // Sanity: the manifest the server renders from must match the checked-in one.
    expect(slides[index]?.filename).toBe(`${name}.mdx`);

    await expect(page.locator(STAGE)).toHaveScreenshot(`${String(index + 1).padStart(3, "0")}-${name}.png`);
  });
}
