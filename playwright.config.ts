import { defineConfig } from "@playwright/test";

/**
 * Visual regression suite for the slide engine.
 *
 *   pnpm test:visual                      # compare against committed baselines
 *   pnpm test:visual --update-snapshots   # regenerate baselines for this platform
 *
 * Baselines are stored per platform (darwin / linux) because font
 * rasterization differs between macOS and Linux. Linux baselines are
 * produced by the `visual-baseline` GitHub workflow.
 *
 * The suite renders the native single-slide route (`/[deck]/slide/[index]`)
 * against a production build on port 3860 so it never collides with `pnpm dev`.
 * Set BASE_URL to reuse an already-running server (e.g. http://127.0.0.1:3850).
 */
const PORT = 3860;
const baseURL = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`;
const useExternalServer = Boolean(process.env.BASE_URL);

export default defineConfig({
  testDir: "tests/visual",
  outputDir: "test-results",
  snapshotPathTemplate: "{testDir}/__snapshots__/{platform}/{arg}{ext}",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  // Missing baselines are written (and the test passes) so a fresh platform
  // bootstraps itself; changed baselines still fail.
  updateSnapshots: "missing",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      maxDiffPixelRatio: 0.005,
    },
  },
  use: {
    baseURL,
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  webServer: useExternalServer
    ? undefined
    : {
        command: `pnpm build && pnpm start --port ${PORT}`,
        url: `${baseURL}/`,
        reuseExistingServer: !process.env.CI,
        timeout: 600_000,
        stdout: "ignore",
        stderr: "pipe",
      },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
