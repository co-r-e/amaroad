import { defineConfig } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:3861";

export default defineConfig({
  testDir: "tests/rich",
  outputDir: "test-results/rich",
  workers: 1,
  timeout: 60000,
  use: { baseURL, viewport: { width: 1440, height: 900 }, trace: "retain-on-failure" },
  webServer: process.env.BASE_URL ? undefined : {
    command: "pnpm build && pnpm start --port 3861",
    url: baseURL,
    timeout: 600000,
    reuseExistingServer: !process.env.CI,
  },
});
