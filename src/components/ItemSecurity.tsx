import {
  ArrowRight,
  Check,
  Fingerprint,
  Lightning,
  LockSimple,
  Password,
  ShieldCheck,
  ShieldWarning,
  WarningCircle,
} from "@phosphor-icons/react";
import { useState } from "react";
import type { VaultItem } from "../lib/vault";
import {
  calculatePasswordAnatomy,
  checkPasswordBreach,
  type BreachCheckResult,
} from "../lib/breachScanner";

export default function ItemSecurity({
  item,
  onGenerate,
  onAuthenticator,
}: {
  item: VaultItem;
  onGenerate: () => void;
  onAuthenticator: () => void;
}) {
  const [breachResult, setBreachResult] = useState<BreachCheckResult | null>(null);
  const [scanning, setScanning] = useState(false);

  const anatomy = calculatePasswordAnatomy(item.password);

  const checks = [
    {
      label: "At least 12 characters",
      pass: item.password.length >= 12,
      detail: `${item.password.length} characters in this password`,
    },
    {
      label: "Uppercase and lowercase",
      pass: /[a-z]/.test(item.password) && /[A-Z]/.test(item.password),
      detail: "A mix of letter cases",
    },
    {
      label: "Includes a number",
      pass: /\d/.test(item.password),
      detail: "Adds numeric randomness",
    },
    {
      label: "Includes a special character",
      pass: /[^A-Za-z0-9]/.test(item.password),
      detail: "Symbols make dictionary attacks impractical",
    },
  ];
  const passed = checks.filter((check) => check.pass).length;

  const handleBreachScan = async () => {
    setScanning(true);
    try {
      const res = await checkPasswordBreach(item.password, "en");
      setBreachResult(res);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="inspector-security thin-scrollbar overflow-y-auto overflow-x-hidden min-h-0 flex-1 px-3 pb-4 pt-1 space-y-4 max-w-full box-border">
      <div className="security-item-heading">
        <span className="security-emblem">
          <ShieldCheck size={25} weight="duotone" />
        </span>
        <h3>Password checkup</h3>
        <p>Zero-knowledge entropy & security analysis for {item.title}.</p>
      </div>

      {/* Anatomy & Crack Time Card */}
      <div className="rounded-[16px] border border-[var(--border-soft)] bg-[var(--glass-soft)] p-3 text-left">
        <div className="flex items-center justify-between text-[9px] font-semibold text-muted">
          <span className="flex items-center gap-1">
            <Lightning size={12} weight="fill" className="text-accent" />
            Entropy & Crack Time
          </span>
          <span className="font-mono text-accent">{anatomy.entropyBits} bits</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <div>
            <p className="text-[12px] font-bold text-main">{anatomy.crackTimeHuman}</p>
            <p className="text-[7.5px] text-faint">to crack at 10B guesses/sec</p>
          </div>
          <div className="text-right">
            <p className="font-display text-[14px] font-bold text-main">{anatomy.score}%</p>
            <p className="text-[7.5px] text-faint">Security score</p>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1">
          {[
            { label: `${anatomy.length} chars`, active: anatomy.length >= 12 },
            { label: "A-Z", active: anatomy.hasUpper },
            { label: "a-z", active: anatomy.hasLower },
            { label: "0-9", active: anatomy.hasDigits },
            { label: "!@#", active: anatomy.hasSymbols },
          ].map((pill) => (
            <span
              key={pill.label}
              className={`rounded-md px-1.5 py-0.5 text-[7px] font-bold uppercase ${
                pill.active
                  ? "bg-[var(--success-soft)] text-success"
                  : "bg-[var(--glass-input)] text-faint"
              }`}
            >
              {pill.label}
            </span>
          ))}
        </div>
      </div>

      {/* Zero-Knowledge Breach Scanner Button & Result */}
      <div className="rounded-[16px] border border-[var(--border-soft)] bg-[var(--glass-soft)] p-3 text-left">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-muted">
            <LockSimple size={12} weight="duotone" className="text-accent" />
            Zero-Knowledge Breach Scanner
          </span>
          {breachResult && (
            <span
              className={`rounded-full px-2 py-0.5 text-[7px] font-bold uppercase ${
                breachResult.breached
                  ? "bg-[var(--danger-soft)] text-danger"
                  : "bg-[var(--success-soft)] text-success"
              }`}
            >
              {breachResult.breached ? "Breached" : "Safe"}
            </span>
          )}
        </div>

        {breachResult ? (
          <div className="mt-2.5 space-y-1.5">
            <div
              className={`rounded-[12px] p-2 text-[8.5px] leading-relaxed ${
                breachResult.breached
                  ? "border border-[var(--danger)]/30 bg-[var(--danger-soft)] text-danger font-semibold"
                  : "border border-[var(--success)]/30 bg-[var(--success-soft)] text-success"
              }`}
            >
              {breachResult.breached
                ? `⚠️ Exposed ${breachResult.count.toLocaleString()} times in public data breaches! Rotate immediately.`
                : `✅ 0 matches found across 1B+ HIBP records (Prefix: ${breachResult.sha1Prefix}•••).`}
            </div>
            <div className="rounded-[10px] bg-white/5 border border-white/10 p-2 text-[7.5px] text-muted space-y-0.5">
              <p>
                <strong className="text-main">Source:</strong>{" "}
                {breachResult.source.includes("HIBP")
                  ? "HIBP k-Anonymity API (api.pwnedpasswords.com)"
                  : "Offline Built-in Breach Dataset"}
              </p>
              <p>
                <strong className="text-main">Cryptographic Proof:</strong> k-Anonymity Prefix Sent:{" "}
                <span className="font-mono text-accent">SHA1[{breachResult.sha1Prefix}•••••]</span> (Zero-Knowledge)
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-[8px] text-faint">
            Uses k-Anonymity SHA-1 prefix matching via Cloudflare HIBP. Your password never leaves this device.
          </p>
        )}

        <button
          type="button"
          onClick={handleBreachScan}
          disabled={scanning}
          className="secondary-button mt-2.5 flex h-[34px] w-full items-center justify-center gap-1.5 rounded-[10px] text-[9.5px] font-semibold"
        >
          {scanning ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
              <span>Scanning k-Anonymity registry…</span>
            </>
          ) : (
            <>
              <ShieldWarning size={13} weight="duotone" />
              <span>Check against 1B+ compromised leaks</span>
            </>
          )}
        </button>
      </div>

      {/* Local Character Criteria Checks */}
      <div className="rounded-[16px] border border-[var(--border-soft)] bg-[var(--glass-soft)] p-3 text-left">
        <div className="security-check-summary flex items-center justify-between">
          <span className="text-[9px] font-semibold text-muted">
            {passed} of {checks.length} checks passed
          </span>
          <div className="flex gap-1">
            {checks.map((check) => (
              <i
                key={check.label}
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: check.pass ? "var(--success)" : "var(--warning)" }}
              />
            ))}
          </div>
        </div>
        <div className="security-check-list mt-2 space-y-2">
          {checks.map((check) => (
            <div className="security-check flex items-start gap-2" key={check.label}>
              <span className={check.pass ? "text-success" : "text-warning"}>
                {check.pass ? (
                  <Check size={14} weight="bold" />
                ) : (
                  <WarningCircle size={14} weight="duotone" />
                )}
              </span>
              <div>
                <strong className="text-[9px] text-main">{check.label}</strong>
                <p className="text-[7.5px] text-faint">{check.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button className="secondary-button inspector-action" onClick={onGenerate}>
        <Password size={16} weight="duotone" /> Generate a stronger password <ArrowRight size={13} />
      </button>

      <button className="two-factor-check" onClick={onAuthenticator}>
        <Fingerprint size={23} weight="duotone" />
        <span>
          <strong>
            {item.totp ? "Two-factor authentication" : "Add another layer of protection"}
          </strong>
          <small>
            {item.totp
              ? "An authenticator is attached to this item."
              : "Set up an authenticator for this account."}
          </small>
        </span>
        <ArrowRight size={14} />
      </button>
    </div>
  );
}
