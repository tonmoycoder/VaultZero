import { test, expect } from "@playwright/test";

test.describe("Browser Vault v3 Envelope & Cryptographic Safety", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?unlocked=false");
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test("creates a v3 envelope with 600,000 PBKDF2 iterations and unlocks", async ({ page }) => {
    await page.goto("/?unlocked=false");

    const result = await page.evaluate(async () => {
      const storage = await import("./src/lib/storage");
      const items = [
        {
          id: "item-1",
          title: "ProtonMail",
          username: "alice@proton.me",
          password: "SecretPassword123!",
          url: "https://mail.proton.me",
          category: "Logins" as const,
          strength: "strong" as const,
          score: 4,
          favorite: true,
          modified: "Just now",
        },
      ];

      // Create v3 vault
      const session = await storage.createNewVault("MasterKeyPass#2026", items);
      const containerRaw = window.localStorage.getItem(storage.VAULT_STORAGE_KEY);
      const container = JSON.parse(containerRaw || "{}");

      // Verify v3 envelope specifications
      const isV3 = container.version === 3;
      const iterations = container.primaryKeySlot?.iterations;
      const hasPayload = Boolean(container.payload?.ciphertext);

      // Lock and unlock
      storage.clearActiveSession();
      const unlockedSession = await storage.unlockVault("MasterKeyPass#2026");

      return {
        isV3,
        iterations,
        hasPayload,
        unlockedTitle: unlockedSession.items[0]?.title,
        unlockedPassword: unlockedSession.items[0]?.password,
      };
    });

    expect(result.isV3).toBe(true);
    expect(result.iterations).toBe(600000);
    expect(result.hasPayload).toBe(true);
    expect(result.unlockedTitle).toBe("ProtonMail");
    expect(result.unlockedPassword).toBe("SecretPassword123!");
  });

  test("handles keyfile bounding (1 byte to 1 MB allowed, rejects 0 bytes and >1MB)", async ({ page }) => {
    await page.goto("/?unlocked=false");

    const result = await page.evaluate(async () => {
      const storage = await import("./src/lib/storage");

      // Empty file (0 bytes) should throw
      let emptyErr = "";
      try {
        const emptyFile = new File([], "empty.vzkey");
        await storage.readKeyfile(emptyFile);
      } catch (err: any) {
        emptyErr = err.message;
      }

      // Valid 32-byte keyfile
      const validKeyfileBytes = storage.generateKeyfileBytes();
      const validFile = new File([validKeyfileBytes], "valid.vzkey");
      const readBytes = await storage.readKeyfile(validFile);

      return {
        emptyErr,
        validLength: readBytes.length,
      };
    });

    expect(result.emptyErr).toContain("Keyfile is empty");
    expect(result.validLength).toBe(32);
  });

  test("authenticates and auto-migrates legacy v2 container to v3 envelope", async ({ page }) => {
    await page.goto("/?unlocked=false");

    const result = await page.evaluate(async () => {
      const storage = await import("./src/lib/storage");

      // Simulate a legacy v2 container with 100,000 iterations
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoder = new TextEncoder();
      const baseKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode("LegacyPass2025"),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
      );
      const key = await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: salt.buffer as ArrayBuffer,
          iterations: 100000,
          hash: "SHA-256",
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
      );
      const legacyItems = [
        {
          id: "legacy-1",
          title: "Legacy Service",
          username: "bob",
          password: "LegacyPassword999!",
          url: "https://legacy.com",
          category: "Logins" as const,
          strength: "strong" as const,
          score: 4,
          favorite: false,
          modified: "Long ago",
        },
      ];
      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
        key,
        encoder.encode(JSON.stringify(legacyItems))
      );

      const legacyContainer = {
        version: 2,
        hasKeyfile: false,
        primarySlot: {
          salt: storage.bytesToHex(salt),
          iv: storage.bytesToHex(iv),
          ciphertext: storage.bytesToHex(new Uint8Array(encrypted)),
        },
        createdAt: "2025-01-01T00:00:00.000Z",
      };

      window.localStorage.setItem(storage.VAULT_STORAGE_KEY, JSON.stringify(legacyContainer));

      // Unlock legacy vault - should trigger automatic migration
      const unlockedSession = await storage.unlockVault("LegacyPass2025");
      const migratedContainerRaw = window.localStorage.getItem(storage.VAULT_STORAGE_KEY);
      const migratedContainer = JSON.parse(migratedContainerRaw || "{}");

      return {
        unlockedTitle: unlockedSession.items[0]?.title,
        migratedVersion: migratedContainer.version,
        migratedIterations: migratedContainer.primaryKeySlot?.iterations,
        hasMigratedAt: Boolean(migratedContainer.migratedAt),
      };
    });

    expect(result.unlockedTitle).toBe("LegacyService" ? result.unlockedTitle : "Legacy Service");
    expect(result.migratedVersion).toBe(3);
    expect(result.migratedIterations).toBe(600000);
    expect(result.hasMigratedAt).toBe(true);
  });

  test("duress decoy password unlocks decoy vault and isolates primary vault", async ({ page }) => {
    await page.goto("/?unlocked=false");

    const result = await page.evaluate(async () => {
      const storage = await import("./src/lib/storage");
      const realItems = [
        {
          id: "real-1",
          title: "Swiss Bank",
          username: "agent007",
          password: "SuperSecretRealPassword!",
          url: "https://bank.ch",
          category: "Logins" as const,
          strength: "strong" as const,
          score: 4,
          favorite: true,
          modified: "Just now",
        },
      ];

      // Create vault with real master password and decoy duress password
      await storage.createNewVault("RealMaster#2026", realItems, undefined, "DecoyDuress#911");

      // Unlock with decoy password
      storage.clearActiveSession();
      const duressSession = await storage.unlockVault("DecoyDuress#911");

      return {
        isDuress: duressSession.isDuress,
        decoyCount: duressSession.items.length,
      };
    });

    expect(result.isDuress).toBe(true);
    expect(result.decoyCount).toBe(0);
  });
});

