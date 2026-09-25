/**
 * Headless Chromium launcher shared by the tooling CLI (capture, overflow,
 * doctor, pdf) and the vector PDF export API route. Node only.
 */
import type { Browser } from "playwright";

/**
 * Launch headless Chromium. Falls back to the system Chrome channel when the
 * Playwright-managed browser binary is missing (common after a playwright
 * version bump without `playwright install`).
 */
export async function launchChromium(): Promise<Browser> {
  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error(
      "Playwright is not installed. Install dependencies with: pnpm install",
    );
  }

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
