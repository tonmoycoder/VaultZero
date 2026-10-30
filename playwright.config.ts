import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: 2,
  timeout: 35000,
  expect: { timeout: 7000 },
  reporter: "list",
  outputDir: ".artifacts/test-results",
  use: {
    baseURL: "http://127.0.0.1:1420",
    browserName: "chromium",
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: { args: ["--no-sandbox"] },
  },
  webServer: {
    command: "npm run dev -- --host 0.0.0.0 --port 1420",
    url: "http://127.0.0.1:1420",
    reuseExistingServer: true,
  },
});