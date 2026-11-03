// V-60 / V-65: 2FA must be a real, live RFC 6238 code computed from the
// Base32 setup secret — never a hardcoded demo string, never the secret
// itself, and never leaked into "Copy All".
import { test, expect } from "@playwright/test";
import { seedVault } from "./helpers/seedVault";

const SECRET = "JBSWY3DPEHPK3PXP";
const item = {
  id: "totp-live",
  title: "GitHub",
  username: "dev@example.com",
  password: "Gh#Secure!2026",
  url: "github.com",
  category: "login",
  brand: "github",
  favorite: false,
  strength: "strong",
  score: 4,
  modified: "just now",
  tags: ["Work", "2FA"],
  folder: "Work",
  totp: SECRET,
};

test.describe("V-60 live RFC 6238 2FA", () => {
  test("the inspector shows a generated 6-digit code, not the setup secret", async ({ page }) => {
    await seedVault(page, [item]);
    const code = page.getByLabel("Copy two factor code");
    await expect(code).toBeVisible();
    await expect.poll(async () => (await code.innerText()).trim()).toMatch(/^\d{3} \d{3}$/);
    expect((await code.innerText()).includes(SECRET)).toBe(false);
    // The secret must not be rendered anywhere in the inspector.
    const inspectorText = await page.getByTestId("detail-inspector").innerText();
    expect(inspectorText).not.toContain(SECRET);
  });

  test("an invalid stored secret shows bullets instead of a fake code", async ({ page }) => {
    await seedVault(page, [{ ...item, totp: "839 201" }]);
    const code = page.getByLabel("Copy two factor code");
    await expect(code).toBeVisible();
    await expect(code).toContainText("••• •••");
    expect((await code.innerText()).includes("839 201")).toBe(false);
  });

  test("Copy All without a live code cannot leak the setup secret", async ({ page }) => {
    await seedVault(page, [item]);
    const bundle = await page.evaluate(async (secret) => {
      const vault = await import("/src/lib/vault.ts");
      return vault.buildFormattedQuickCopy({
        id: "x", title: "Example", username: "u@example.com", password: "hunter2",
        url: "example.com", category: "login", score: 90, modified: "Today",
        totp: secret, recoveryCodes: ["AAAA-BBBB"],
      } as never);
    }, SECRET);
    expect(bundle).toContain("hunter2");
    expect(bundle).not.toContain(SECRET);
    expect(bundle).not.toContain("2FA Code (TOTP)");
    expect(bundle).not.toContain("AAAA-BBBB");
  });

  test("the RFC 6238 engine still produces the canonical test vector", async ({ page }) => {
    await seedVault(page, [item]);
    const raw = await page.evaluate(async () => {
      const totp = await import("/src/lib/totp.ts");
      const r = await totp.generateTotp(
        { secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", algorithm: "SHA-1", digits: 8, period: 30 },
        59
      );
      return r.rawCode;
    });
    expect(raw).toBe("94287082");
  });
});
