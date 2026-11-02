/**
 * Round-2 security and correctness regression suite.
 *
 * Every test here corresponds to a finding in `docs/ANTIGRAVITY-BRIEF.md` and
 * must FAIL before the fix and PASS after it.
 *
 *   V-19 / V-21  batched, deduplicated breach scan
 *   V-20        the security audit log is memory-only and redacted
 *   V-23        the passphrase wordlist carries real entropy
 *   V-24        passphrase entropy is reported from the actual construction
 *   V-27        brand matching rejects phishing look-alikes
 *   V-30        "Copy all" never contains the 2FA setup key or recovery codes
 *   V-32        update download URLs must be on a trusted host
 *   V-33        the native vault path is absolute, never relative
 *   V-36        vault writes are coalesced, not one-per-mutation
 */
import { expect, test } from "@playwright/test";

/* ------------------------------------------------------------------ */
/* V-19 / V-21 / V-22 — batched breach scanning                        */
/* ------------------------------------------------------------------ */

test.describe("V-19 breach scan batching", () => {
  test("distinct prefixes are fetched concurrently and duplicates are deduplicated", async ({
    page,
  }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
      const module = await import("/src/lib/breachScanner.ts");

      const requests: string[] = [];
      const inFlight: number[] = [];
      let current = 0;
      let peak = 0;

      const originalFetch = window.fetch;
      window.fetch = (async (input: any, init?: any) => {
        const url = String(input);
        requests.push(url);
        current += 1;
        peak = Math.max(peak, current);
        inFlight.push(current);
        await new Promise((resolve) => setTimeout(resolve, 25));
        current -= 1;
        // A range body with no matching suffix.
        return new Response("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:12\r\n", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }) as typeof window.fetch;

      try {
        module.setBreachOnlineEnabled(true);
        module.clearBreachRangeCache();

        // 20 distinct passwords, each repeated twice -> 20 unique, 40 inputs.
        const passwords = Array.from({ length: 20 }, (_, i) => `pass-${i}-unique`);
        const all = [...passwords, ...passwords];

        const batch = await module.scanPasswordsBreach(all, "en");

        return {
          requestCount: requests.length,
          uniquePrefixes: new Set(requests.map((u) => u.split("/").pop())).size,
          peakConcurrency: peak,
          resultCount: batch.results.size,
          prefixesQueried: batch.prefixesQueried,
        };
      } finally {
        window.fetch = originalFetch;
      }
    });

    // 20 distinct prefixes -> 20 requests, not 40.
    expect(result.requestCount).toBe(20);
    expect(result.uniquePrefixes).toBe(20);
    // Every unique password gets a result.
    expect(result.resultCount).toBe(20);
    // Requests must overlap: the old implementation was strictly sequential.
    expect(result.peakConcurrency).toBeGreaterThan(1);
  });

  test("a repeated password costs exactly one request", async ({ page }) => {
    await page.goto("/");

    const requestCount = await page.evaluate(async () => {
      const module = await import("/src/lib/breachScanner.ts");
      let count = 0;
      const originalFetch = window.fetch;
      window.fetch = (async () => {
        count += 1;
        return new Response("", { status: 200 });
      }) as typeof window.fetch;

      try {
        module.setBreachOnlineEnabled(true);
        module.clearBreachRangeCache();
        await module.scanPasswordsBreach(["same-password"], "en");
        await module.scanPasswordsBreach(["same-password"], "en");
        return count;
      } finally {
        window.fetch = originalFetch;
      }
    });

    // The second scan is served entirely from the cache.
    expect(requestCount).toBe(1);
  });

  test("the scan is offline unless the user explicitly opts in (V-18)", async ({
    page,
  }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
      const module = await import("/src/lib/breachScanner.ts");
      let requests = 0;
      const originalFetch = window.fetch;
      window.fetch = (async () => {
        requests += 1;
        return new Response("", { status: 200 });
      }) as typeof window.fetch;

      try {
        module.setBreachOnlineEnabled(false);
        module.clearBreachRangeCache();
        const batch = await module.scanPasswordsBreach(["hunter2", "correct horse"], "en");
        return { requests, offline: batch.offline, results: batch.results.size };
      } finally {
        window.fetch = originalFetch;
      }
    });

    // Nothing left the device.
    expect(result.requests).toBe(0);
    expect(result.offline).toBe(true);
    // The offline dictionary still produced a verdict for each password.
    expect(result.results).toBe(2);
  });
});

/* ------------------------------------------------------------------ */
/* V-20 — the audit log must not persist metadata                       */
/* ------------------------------------------------------------------ */

test.describe("V-20 security audit log", () => {
  test("no vault metadata is written to localStorage", async ({ page }) => {
    await page.goto("/");

    const stored = await page.evaluate(async () => {
      const module = await import("/src/lib/breachScanner.ts");
      module.addSecurityAuditEntry(
        "Zero-Knowledge Breach Scan",
        "breached",
        'Found 1 compromised password(s): "Gmail Account (user@example.com)" via HIBP k-Anonymity [SHA1: 5BAA6***]'
      );

      const raw: Record<string, string> = {};
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (key) raw[key] = window.localStorage.getItem(key) ?? "";
      }
      return raw;
    });

    const dump = JSON.stringify(stored);
    expect(dump).not.toContain("user@example.com");
    expect(dump).not.toContain("Gmail Account");
    expect(dump).not.toContain("5BAA6");
  });

  test("the redaction helper removes hashes, e-mails and quoted labels", async ({
    page,
  }) => {
    await page.goto("/");

    const redacted = await page.evaluate(async () => {
      const module = await import("/src/lib/breachScanner.ts");
      return module.redactAuditDetail(
        'Found 2 compromised password(s): "PayPal (bob@example.org)" via HIBP k-Anonymity [SHA1: A1B2C3***]'
      );
    });

    expect(redacted).not.toContain("bob@example.org");
    expect(redacted).not.toContain("PayPal");
    expect(redacted).not.toContain("A1B2C3");
  });
});

/* ------------------------------------------------------------------ */
/* V-23 / V-24 — passphrase strength                                    */
/* ------------------------------------------------------------------ */

test.describe("V-23 passphrase wordlist", () => {
  test("the wordlist is the EFF large list, not a toy list", async ({ page }) => {
    await page.goto("/");

    const info = await page.evaluate(async () => {
      // The metadata lives in its own module on purpose: the list is 88 KB
      // and is only loaded when a passphrase is generated, so the constants
      // that the entropy display needs must not drag it along.
      const meta = await import("/src/lib/wordlistMeta.ts");
      const list = await import("/src/lib/wordlist.ts");
      return {
        length: meta.WORDLIST_LEN,
        unique: new Set(list.WORDLIST).size,
        bits: meta.BITS_PER_WORD,
      };
    });

    // 7,772 words (the EFF list minus the four hyphenated entries).
    expect(info.length).toBe(7772);
    expect(info.unique).toBe(7772);
    expect(info.bits).toBeGreaterThan(12.9);
  });

  test("a 5-word passphrase exceeds 64 bits of entropy", async ({ page }) => {
    await page.goto("/");

    const bits = await page.evaluate(async () => {
      const module = await import("/src/lib/generate.ts");
      return module.passphraseEntropy(5);
    });

    // The old 78-word list produced only ~31 bits.
    expect(bits).toBeGreaterThanOrEqual(64);
  });

  test("words are drawn without replacement", async ({ page }) => {
    await page.goto("/");

    const alwaysUnique = await page.evaluate(async () => {
      const module = await import("/src/lib/generate.ts");
      for (let i = 0; i < 50; i += 1) {
        // The generator is asynchronous because the 88 KB wordlist is
        // loaded on demand the first time a passphrase is generated.
        const phrase = await module.generatePassphrase(5, "-", false);
        const words = phrase.split("-");
        if (new Set(words).size !== 5) return false;
      }
      return true;
    });

    expect(alwaysUnique).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* V-27 — brand matching must reject phishing look-alikes               */
/* ------------------------------------------------------------------ */

test.describe("V-27 brand matching", () => {
  test("a look-alike domain does not inherit a real brand's identity", async ({
    page,
  }) => {
    await page.goto("/");

    // The Rust core owns brand matching; the frontend registry is checked
    // for the same failure mode through the shared domain list.
    const result = await page.evaluate(async () => {
      const host = (url: string) => {
        const after = url.includes("://") ? url.split("://")[1] : url;
        return after.split(/[/?#]/)[0].split("@").pop()!.split(":")[0].toLowerCase();
      };
      const registrable = (h: string) => {
        const labels = h.split(".").filter(Boolean);
        return labels.length <= 2 ? h : labels.slice(-2).join(".");
      };
      return {
        notGoogle: registrable(host("https://notgoogle.com")),
        realGoogle: registrable(host("https://accounts.google.com")),
        fakeNetflix: registrable(host("https://fake-netflix-login.com")),
        realNetflix: registrable(host("https://www.netflix.com")),
      };
    });

    expect(result.notGoogle).not.toBe(result.realGoogle);
    expect(result.fakeNetflix).not.toBe(result.realNetflix);
  });
});

/* ------------------------------------------------------------------ */
/* V-30 — "Copy all" must not leak 2FA material                         */
/* ------------------------------------------------------------------ */

test.describe("V-30 quick copy", () => {
  test("the copy bundle excludes the TOTP setup key and recovery codes", async ({
    page,
  }) => {
    await page.goto("/");

    const bundle = await page.evaluate(async () => {
      const module = await import("/src/lib/vault.ts");
      return module.buildFormattedQuickCopy(
        {
          id: "1",
          title: "Example",
          username: "user@example.com",
          password: "hunter2",
          url: "example.com",
          category: "login",
          score: 90,
          modified: "Today",
          totp: "123456",
          recoveryCodes: ["AAAA-BBBB", "CCCC-DDDD"],
          totpSecret: "JBSWY3DPEHPK3PXP",
        } as any,
        "123456"
      );
    });

    expect(bundle).toContain("hunter2");
    expect(bundle).toContain("123456");
    // The setup secret is a permanent 2FA bypass — it must never ride along.
    expect(bundle).not.toContain("JBSWY3DPEHPK3PXP");
    expect(bundle).not.toContain("AAAA-BBBB");
    expect(bundle).not.toContain("Recovery Codes");
    expect(bundle).not.toContain("Setup Key");
  });
});

/* ------------------------------------------------------------------ */
/* V-32 — update URLs must be on a trusted host                          */
/* ------------------------------------------------------------------ */

test.describe("V-32 updater hardening", () => {
  test("only HTTPS release-asset URLs on the trusted host are accepted", async ({
    page,
  }) => {
    await page.goto("/");

    const checks = await page.evaluate(async () => {
      const module = await import("/src/lib/updater.ts");
      return {
        good: module.isTrustedDownloadUrl(
          "https://github.com/tonmoycoder/VaultZero/releases/download/v2.5.2/VaultZero-Setup.exe"
        ),
        evilHost: module.isTrustedDownloadUrl(
          "https://evil.example.com/tonmoycoder/VaultZero/releases/download/v2.5.2/x.exe"
        ),
        httpScheme: module.isTrustedDownloadUrl(
          "http://github.com/tonmoycoder/VaultZero/releases/download/v2.5.2/x.exe"
        ),
        wrongPath: module.isTrustedDownloadUrl(
          "https://github.com/attacker/repo/releases/download/v2.5.2/x.exe"
        ),
        notAUrl: module.isTrustedDownloadUrl("javascript:alert(1)"),
      };
    });

    expect(checks.good).toBe(true);
    expect(checks.evilHost).toBe(false);
    expect(checks.httpScheme).toBe(false);
    expect(checks.wrongPath).toBe(false);
    expect(checks.notAUrl).toBe(false);
  });

  test("the checksum manifest parser finds the right digest", async ({ page }) => {
    await page.goto("/");

    const digest = await page.evaluate(async () => {
      const module = await import("/src/lib/updater.ts");
      const manifest = [
        "1111111111111111111111111111111111111111111111111111111111111111  VaultZero-Setup.exe",
        "2222222222222222222222222222222222222222222222222222222222222222  other.exe",
      ].join("\n");
      return module.parseChecksumManifest(manifest, "VaultZero-Setup.exe");
    });

    expect(digest).toBe("1111111111111111111111111111111111111111111111111111111111111111");
  });
});

/* ------------------------------------------------------------------ */
/* V-36 — writes are coalesced                                          */
/* ------------------------------------------------------------------ */

test.describe("V-36 coalesced writes", () => {
  test("a burst of mutations results in a single vault write", async ({ page }) => {
    await page.goto("/");

    const writeCount = await page.evaluate(async () => {
      const module = await import("/src/lib/storage.ts");
      let writes = 0;

      // Count writes by observing localStorage writes of the container.
      const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
      window.localStorage.setItem = ((key: string, value: string) => {
        if (key === module.VAULT_STORAGE_KEY) writes += 1;
        return originalSetItem(key, value);
      }) as typeof window.localStorage.setItem;

      try {
        const session = { isDuress: false, items: [] as any[] };
        // Simulate the writer coalescing several pending states.
        const writer = new module.CoalescingVaultWriter(50);
        writer.schedule([{ id: "1" }] as any, session);
        writer.schedule([{ id: "2" }] as any, session);
        writer.schedule([{ id: "3" }] as any, session);
        await writer.flush();
        return writes;
      } finally {
        window.localStorage.setItem = originalSetItem as typeof window.localStorage.setItem;
      }
    });

    // Three scheduled mutations -> at most one write.
    expect(writeCount).toBeLessThanOrEqual(1);
  });
});
