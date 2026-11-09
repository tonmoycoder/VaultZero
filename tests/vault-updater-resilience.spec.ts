/**
 * Batch 4 / V-93 — "Check for Updates" on a device WITH internet.
 *
 * Reproduced in real Chromium BEFORE the fix: clicking the update button
 * showed "Offline / Air-gapped network: Cannot reach remote release server."
 * because ANY throw from the single `api.github.com/.../releases/latest`
 * fetch was labelled "offline". Here the primary API is made to fail while
 * the CORS-enabled `/releases?per_page=1` fallback still answers.
 */
import { expect, test, type Page } from "@playwright/test";

const DESKTOP = { width: 1440, height: 900 };
const release = (tag: string) => ({
  tag_name: tag,
  name: `VaultZero ${tag}`,
  body: "",
  published_at: "2026-11-02T01:18:40Z",
  html_url: `https://github.com/tonmoycoder/VaultZero/releases/tag/${tag}`,
  assets: [],
});

type Mode = "fallback" | "all-down" | "rate-limited";

async function mockGitHub(page: Page, mode: Mode) {
  await page.route(/github\.com/, async (route) => {
    const url = route.request().url();
    const isApiLatest = url.includes("api.github.com") && url.includes("/releases/latest");
    const isApiList = url.includes("api.github.com") && url.includes("/releases?per_page=1");
    const isRedirect = !url.includes("api.github.com") && url.includes("/releases/latest");

    if (isApiLatest) {
      if (mode === "rate-limited") {
        return route.fulfill({ status: 403, contentType: "application/json", body: '{"message":"API rate limit exceeded"}' });
      }
      return route.abort("failed"); // simulate the WebView TLS / UA failure
    }
    if (isApiList) {
      if (mode === "all-down") return route.abort("failed");
      const tag = mode === "rate-limited" ? "v2.6.0" : "v2.5.2";
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify([release(tag)]),
      });
    }
    if (isRedirect) {
      // The public 302 host has NO CORS header. The checker uses it only as
      // an opaque no-cors reachability probe.
      if (mode === "all-down") return route.abort("failed");
      return route.fulfill({ status: 200, contentType: "text/html", body: "" });
    }
    return route.continue();
  });
}

const openUpdate = async (page: Page) => {
  await page.goto("/?unlocked=true");
  await page.locator('[aria-label="Check for software updates"]').click();
  await expect(page.locator('[role="dialog"][aria-modal="true"]')).toBeVisible();
};

test("B-17 a failing primary API with a working fallback shows UP-TO-DATE, never Offline", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await mockGitHub(page, "fallback");
  await openUpdate(page);
  await expect(page.getByText(/Your software is completely up-to-date/i)).toBeVisible();
  await expect(page.getByText(/Offline \/ Air-gapped network/i)).toHaveCount(0);
  await expect(page.getByText(/You are currently running version v2\.5\.2/i)).toBeVisible();
});

test("B-18 a rate-limited API falls back and still offers a strictly newer version", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await mockGitHub(page, "rate-limited");
  await openUpdate(page);
  await expect(page.getByText(/Offline \/ Air-gapped network/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Download & Update Now/i })).toBeVisible();
});

test("B-19 when every release endpoint is truly unreachable, offline is still honest", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await mockGitHub(page, "all-down");
  await openUpdate(page);
  await expect(page.getByText(/Offline \/ Air-gapped network/i)).toBeVisible();
});

test("B-20 reachable network + unreadable metadata shows the new honest error, not Offline", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.route(/github\.com/, async (route) => {
    const url = route.request().url();
    if (url.includes("api.github.com")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: "not-json" });
    }
    return route.fulfill({ status: 200, contentType: "text/html", body: "" });
  });
  await openUpdate(page);
  await expect(page.getByText(/Release information unavailable — the network is reachable/i)).toBeVisible();
  await expect(page.getByText(/Offline \/ Air-gapped network/i)).toHaveCount(0);
});
