import { test, expect } from "@playwright/test";
import {
  isNativeRuntime,
  invokeNativeCommand,
  type VaultError,
} from "../src/lib/platform";

test.describe("WP-08: Fail-Closed IPC & Runtime Boundaries", () => {
  test("fails closed in standard browser runtime", async () => {
    expect(isNativeRuntime()).toBe(false);

    try {
      await invokeNativeCommand("unlock_vault", { password: "SecretPassword123" });
      expect.unreachable("Should have thrown UNSUPPORTED error");
    } catch (err: unknown) {
      const vErr = err as VaultError;
      expect(vErr.code).toBe("UNSUPPORTED");
      expect(vErr.retryable).toBe(false);
      /*
       * SECURITY (V-26): the message is a fixed, user-safe string. It
       * names the runtime boundary without exposing any internal detail,
       * and it tells the user where the feature *is* available.
       */
      expect(vErr.safeMessage).toMatch(/browser/i);
      expect(vErr.safeMessage).toMatch(/app/i);
      expect(vErr.safeMessage).not.toMatch(/tauri|__TAURI_INTERNALS__|invoke/i);
    }
  });

  test("never leaks raw passwords or credentials in error messages", async () => {
    try {
      await invokeNativeCommand("some_cmd", { secret: "TOP_SECRET_PLAINTEXT" });
    } catch (err: unknown) {
      const vErr = err as VaultError;
      expect(vErr.safeMessage).not.toContain("TOP_SECRET_PLAINTEXT");
    }
  });
});

