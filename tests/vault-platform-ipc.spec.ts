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
      expect(vErr.safeMessage).toContain("Native runtime is not active");
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

