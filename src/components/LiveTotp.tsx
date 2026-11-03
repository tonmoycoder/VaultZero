import { memo, useEffect, useState } from "react";
import { generateTotp, isValidTotpSecret, resolveTotpConfig } from "../lib/totp";

/**
 * V-60 — a real, live TOTP code.
 *
 * `VaultItem.totp` holds the Base32/otpauth setup secret. Every place that
 * displays a "code" must compute it from that secret with the RFC 6238
 * engine, instead of printing the secret itself (or a hardcoded demo code).
 * The code is recomputed on each 30-second period boundary and never logged.
 */
export function useLiveTotpCode(secret: string | undefined | null): string {
  const [code, setCode] = useState("");
  useEffect(() => {
    if (!isValidTotpSecret(secret)) { setCode(""); return; }
    let cancelled = false;
    let timer: number | undefined;
    const update = async () => {
      try {
        const result = await generateTotp(resolveTotpConfig(secret as string));
        if (!cancelled) setCode(result.code);
      } catch {
        if (!cancelled) setCode("");
      }
      if (!cancelled) {
        const secondsToNext = 30 - (Math.floor(Date.now() / 1000) % 30);
        timer = window.setTimeout(update, secondsToNext * 1000 + 60);
      }
    };
    void update();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [secret]);
  return code;
}

export const LiveTotpCode = memo(function LiveTotpCode({
  secret,
  className = "font-mono text-[14px] font-semibold tracking-[0.09em] text-main",
}: {
  secret: string | undefined;
  className?: string;
}) {
  const code = useLiveTotpCode(secret);
  return <span className={className}>{code || "••• •••"}</span>;
});
