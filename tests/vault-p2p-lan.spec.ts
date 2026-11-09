/**
 * Batch 3 / V-92 — P2P real networking, strict peers and camera fallback.
 *
 * BEFORE the fix (measured): `isValidPeerAddress` accepted ANY dotted IPv4,
 * including 8.8.8.8, and the Host tab derived its IP from
 * `window.location.hostname` — which is `tauri.localhost` inside Tauri, so it
 * printed "IP: not detected · use Discover" and the QR carried an empty IP.
 * The QR-photo fallback, the handshake-gated "connected" status, the footer
 * wrapping and the CAMERA/INTERNET permissions were already correct; B-14/B-15
 * are guards, not fixes.
 */
import { expect, test, type Page } from "@playwright/test";

const PHONE = { width: 360, height: 800 };

/** Simulate Tauri's IPC. `has_vault_file` keeps first-run detection honest. */
async function stubNative(page: Page, lanIp: string | null) {
  await page.addInitScript(
    ({ ip }) => {
      const w = window as unknown as {
        __TAURI_INTERNALS__: { invoke: (cmd: string) => Promise<unknown> };
      };
      w.__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => {
          if (cmd === "lan_ipv4") return ip;
          if (cmd === "has_vault_file") return true;
          return undefined;
        },
      };
    },
    { ip: lanIp },
  );
}

const openSync = (page: Page) => page.getByRole("button", { name: "Sync" }).click();
const openScan = async (page: Page) => {
  await openSync(page);
  await page.getByRole("button", { name: /Scan QR/ }).click();
};

test("B-11 a public IP is rejected as a peer (no fake Peer selected)", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/?unlocked=true");
  await openScan(page);
  await page.getByPlaceholder(/10\.0\.0\.5/).fill("8.8.8.8:1420");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByText(/not a valid peer address/i)).toBeVisible();
  await expect(page.getByText(/Peer selected: 8\.8\.8\.8|Connected: 8\.8\.8\.8/)).toHaveCount(0);
});

test("B-12 the Host tab shows the REAL LAN IP reported by Rust, never tauri.localhost", async ({ page }) => {
  await stubNative(page, "192.168.1.23");
  await page.setViewportSize(PHONE);
  await page.goto("/?unlocked=true");
  await openSync(page);
  await expect(page.getByText(/IP:\s*192\.168\.1\.23/)).toBeVisible();
  await expect(page.getByText(/not detected/i)).toHaveCount(0);
  await expect(page.getByText(/IP:\s*tauri\.localhost/i)).toHaveCount(0);
});

test("B-13 with no detected LAN IP the user can enter one manually", async ({ page }) => {
  await stubNative(page, null);
  await page.setViewportSize(PHONE);
  await page.goto("/?unlocked=true");
  await openSync(page);
  await expect(page.getByText(/not detected/i)).toBeVisible();
  const input = page.getByPlaceholder(/Enter your LAN IP/i);
  await expect(input).toBeVisible();
  // A hostname is not a LAN endpoint and must not be accepted. Check this
  // FIRST: once a valid IP is accepted the fallback row is no longer needed.
  await input.fill("tauri.localhost");
  await page.getByRole("button", { name: /^Use IP$/ }).click();
  await expect(page.getByText(/IP:\s*tauri\.localhost/i)).toHaveCount(0);
  await expect(input).toBeVisible();
  await input.fill("192.168.1.44");
  await page.getByRole("button", { name: /^Use IP$/ }).click();
  await expect(page.getByText(/IP:\s*192\.168\.1\.44/)).toBeVisible();
});

test("B-14 connecting alone never claims Connected; the QR-photo fallback is prominent", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/?unlocked=true");
  await openScan(page);
  await page.getByPlaceholder(/10\.0\.0\.5/).fill("192.1");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByText(/Connected: 192\.1/)).toHaveCount(0);
  const fallback = page.getByRole("button", { name: /Read QR from an image|ছবি থেকে QR/i });
  await expect(fallback).toBeVisible();
  const box = await fallback.boundingBox();
  expect(box, "the always-working photo fallback must be laid out").toBeTruthy();
  expect(box!.height, "44px thumb-zone target").toBeGreaterThanOrEqual(44);
});

test("B-15 Close / Send Vault / Receive & Merge stay inside a 360px viewport", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/?unlocked=true");
  await openScan(page);
  // The two transfer actions are intentionally hidden until a VALID peer is
  // selected; select one first (same sequence as the existing M-13 guard).
  await page.getByPlaceholder(/10\.0\.0\.5/).fill("192.168.1.5:52137");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  const footer = page.locator("footer");
  for (const name of ["Close", "Send Vault", "Receive & Merge"]) {
    const box = await footer.getByRole("button", { name, exact: true }).boundingBox();
    expect(box, `${name} must be laid out`).toBeTruthy();
    expect(box!.x, `${name} must not be clipped on the left`).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width, `${name} must not be clipped on the right`).toBeLessThanOrEqual(PHONE.width + 1);
  }
});

/**
 * V-92 improvement found by review: the incoming one-shot `useEffect` probed
 * `lan_ipv4` ONLY on mount. On Android the Wi-Fi interface frequently appears
 * after the app has drawn the Host tab, so the pairing QR kept `ip: ""`
 * until the modal was closed and reopened. Re-probing on Discover fixes that.
 */
test("B-16 a LAN interface that appears after the modal opens is picked up", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.addInitScript(() => {
    const w = window as unknown as {
      __TAURI_INTERNALS__: { invoke: (cmd: string) => Promise<unknown> };
      __lanProbeCalls: number;
      __allowIp: boolean;
    };
    w.__lanProbeCalls = 0;
    w.__allowIp = false;
    w.__TAURI_INTERNALS__ = {
      invoke: async (cmd: string) => {
        // Count EVERY probe. React StrictMode may invoke the mount effect
        // twice, so "the IP appeared" alone is NOT proof of a re-probe.
        if (cmd === "lan_ipv4") {
          w.__lanProbeCalls += 1;
          return w.__allowIp ? "192.168.1.77" : null;
        }
        if (cmd === "has_vault_file") return true;
        if (cmd === "discover_peers") return [];
        return undefined;
      },
    };
  });
  await page.goto("/?unlocked=true");
  await openSync(page);
  await expect(page.getByText(/not detected/i)).toBeVisible();
  const before = await page.evaluate(() => (window as any).__lanProbeCalls as number);
  await page.evaluate(() => { (window as any).__allowIp = true; });
  const discover = page.getByRole("button", { name: /Discover nearby VaultZero peers/i });
  await discover.scrollIntoViewIfNeeded();
  await discover.click();
  // `void probeLanIp()` is fire-and-forget and dynamically imports the Tauri
  // core first, so the counter can tick a few ms AFTER the click resolves.
  // A one-shot read is a race under a loaded full suite: poll instead.
  await expect.poll(
    () => page.evaluate(() => (window as any).__lanProbeCalls as number),
    { message: "Discover must actively re-probe the LAN interface", timeout: 10000 },
  ).toBeGreaterThan(before);
  await expect(page.getByText(/IP:\s*192\.168\.1\.77/)).toBeVisible();
});
