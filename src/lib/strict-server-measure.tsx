import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright-core";
import { StrictSlideMarkup } from "@/components/strict/StrictSlideMarkup";
import type { DeckConfig, SlideData } from "@/types/deck";
import type { PaginatedSlidePage, SlideMeasureFn, SlideMeasureResult } from "./slide-paginate";
import { type LayoutDefinition } from "./layout-spec";

const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;

const SAFE_AREA_PADDING: Record<LayoutDefinition["safeAreaPreset"], { top: number; right: number; bottom: number; left: number }> = {
  content: { top: 80, right: 72, bottom: 64, left: 72 },
  cover: { top: 96, right: 96, bottom: 80, left: 96 },
  section: { top: 96, right: 96, bottom: 80, left: Math.round(0.18 * SLIDE_WIDTH + 72) },
  quote: { top: 120, right: 140, bottom: 100, left: 140 },
  "image-full": { top: 0, right: 0, bottom: 0, left: 0 },
};

interface StrictServerMeasurer {
  measure: SlideMeasureFn;
  close: () => Promise<void>;
}

export async function createStrictServerMeasurer(
  config: DeckConfig,
  logicalSlide: SlideData,
): Promise<StrictServerMeasurer> {
  const executablePath = resolveChromeExecutable();
  const browser = await chromium.launch({
    executablePath,
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  return {
    measure: async (paginatedPage, spec) =>
      measureStrictSlidePage(page, config, logicalSlide, paginatedPage, spec),
    close: async () => {
      await context.close();
      await browser.close();
    },
  };
}

async function measureStrictSlidePage(
  page: Page,
  config: DeckConfig,
  logicalSlide: SlideData,
  paginatedPage: PaginatedSlidePage,
  spec: LayoutDefinition,
): Promise<SlideMeasureResult> {
  const shell = SAFE_AREA_PADDING[spec.safeAreaPreset];
  const safeWidth = SLIDE_WIDTH - shell.left - shell.right;
  const safeHeight = SLIDE_HEIGHT - shell.top - shell.bottom;

  const slideForMeasure: SlideData = {
    ...logicalSlide,
    strictInput: {
      layout: paginatedPage.layout,
      variantId: paginatedPage.variantId,
      sourceId: paginatedPage.sourceId,
      slots: paginatedPage.slots,
    },
  };

  const { renderToStaticMarkup } = await import("react-dom/server");
  const markup = renderToStaticMarkup(<StrictSlideMarkup slide={slideForMeasure} />);
  const html = createMeasurementHtml(markup, config, logicalSlide, safeWidth, safeHeight);

  await page.setContent(html, { waitUntil: "domcontentloaded" });

  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("[data-strict-root]");
    if (!root) {
      return {
        fits: false,
        failingSlots: ["__root__"],
        reason: "Strict root not found during server measurement",
      };
    }

    const slots = Array.from(
      root.querySelectorAll<HTMLElement>("[data-strict-slot]"),
    ).map((element) => {
      const overflowX = Math.max(0, element.scrollWidth - element.clientWidth);
      const overflowY = Math.max(0, element.scrollHeight - element.clientHeight);
      return {
        slot: element.dataset.strictSlot ?? "unknown",
        overflowX,
        overflowY,
        fits: overflowX <= 1 && overflowY <= 1,
      };
    });

    const failingSlots = slots.filter((slot) => !slot.fits).map((slot) => slot.slot);
    return {
      fits: failingSlots.length === 0,
      failingSlots,
      overflowX: Math.max(0, ...slots.map((slot) => slot.overflowX)),
      overflowY: Math.max(0, ...slots.map((slot) => slot.overflowY)),
      reason:
        failingSlots.length > 0
          ? `Server DOM overflow in slot(s): ${failingSlots.join(", ")}`
          : undefined,
    };
  });
}

function createMeasurementHtml(
  strictMarkup: string,
  config: DeckConfig,
  logicalSlide: SlideData,
  safeWidth: number,
  safeHeight: number,
): string {
  const theme = config.theme;
  const colors = theme.colors;
  const fonts = theme.fonts ?? {};
  const background = logicalSlide.frontmatter.background ?? colors.background ?? "#FFFFFF";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        width: ${SLIDE_WIDTH}px;
        height: ${SLIDE_HEIGHT}px;
        overflow: hidden;
        background: ${background};
      }
      body {
        font-family: ${fonts.body ?? 'Inter, "Noto Sans JP", sans-serif'};
        color: ${colors.text ?? "#1a1a1a"};
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      #measure-shell {
        position: absolute;
        left: 0;
        top: 0;
        width: ${SLIDE_WIDTH}px;
        height: ${SLIDE_HEIGHT}px;
        background: ${background};
      }
      #measure-safe-area {
        position: absolute;
        left: 0;
        top: 0;
        width: ${safeWidth}px;
        height: ${safeHeight}px;
      }
      :root {
        --slide-primary: ${colors.primary};
        --slide-secondary: ${colors.secondary ?? colors.primary};
        --slide-accent: ${colors.accent ?? colors.primary};
        --slide-bg: ${background};
        --slide-text: ${colors.text ?? "#1a1a1a"};
        --slide-text-muted: ${colors.textMuted ?? "#6b7280"};
        --slide-text-subtle: ${colors.textSubtle ?? "#9ca3af"};
        --slide-surface: ${colors.surface ?? "#f8f9fa"};
        --slide-surface-alt: ${colors.surfaceAlt ?? "#f0f2f5"};
        --slide-border: ${colors.border ?? "#e5e7eb"};
        --slide-border-light: ${colors.borderLight ?? "#f3f4f6"};
        --slide-font-heading: ${fonts.heading ?? 'Inter, "Noto Sans JP", sans-serif'};
        --slide-font-body: ${fonts.body ?? 'Inter, "Noto Sans JP", sans-serif'};
      }
    </style>
  </head>
  <body>
    <div id="measure-shell">
      <div id="measure-safe-area">
        ${strictMarkup}
      </div>
    </div>
  </body>
</html>`;
}

function resolveChromeExecutable(): string {
  const candidates = [
    process.env.DEXCODE_CHROME_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  for (const candidate of candidates) {
    if (fs.existsSync(path.resolve(candidate))) return candidate;
  }

  throw new Error(
    "Chrome executable not found. Set DEXCODE_CHROME_EXECUTABLE_PATH or CHROME_PATH.",
  );
}
