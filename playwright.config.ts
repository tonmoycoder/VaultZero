import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

/**
 * The browser to drive.
 *
 * The Playwright browser download is blocked in some environments, so the
 * suite can be pointed at a Chromium that is already on the machine with
 * `VAULTZERO_CHROMIUM`. Without it, Playwright uses its own download,
 * which is what CI does.
 */
const chromiumPath = process.env.VAULTZERO_CHROMIUM;

export default defineConfig({
  testDir: "./tests",
  /*
   * The browserless verification suites live in `tests/harness` and are
   * plain Node programs, not Playwright tests. Without this filter the
   * Playwright runner picks them up as well, so a plain `playwright test`
   * runs them twice and reports the result of the wrong suite.
   */
  testIgnore: ["**/tests/harness/**"],
  fullyParallel: true,
  workers: 2,
  timeout: 60000,
  expect: { timeout: 7000 },
  reporter: "list",
  outputDir: ".artifacts/test-results",
  use: {
    baseURL: "http://127.0.0.1:1420",
    browserName: "chromium",
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
      ...(chromiumPath && existsSync(chromiumPath)
        ? { executablePath: chromiumPath }
        : {}),
    },
  },
  webServer: {
    command: "npm run dev -- --host 0.0.0.0 --port 1420",
    url: "http://127.0.0.1:1420",
    reuseExistingServer: true,
  },
});