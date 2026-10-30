import {
  ArrowRight,
  Eye,
  EyeSlash,
  Fingerprint,
  FirstAidKit,
  Key,
  LockKey,
  ShieldCheck,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { hapticSuccess } from "./Tactile";
import { Logo, Tooltip } from "./ui";

export default function LockScreen({
  onUnlock,
  onEmergency,
}: {
  onUnlock: () => void;
  onEmergency: () => void;
}) {
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 500);
    return () => window.clearTimeout(timeout);
  }, []);

  const unlock = (method: "password" | "biometric") => {
    setError("");
    setUnlocking(true);
    if (method === "biometric") setBiometric(true);
    hapticSuccess();
    window.setTimeout(() => {
      setUnlocking(false);
      setBiometric(false);
      onUnlock();
    }, 950);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!password.trim()) {
      setError("Enter your master password to open the vault.");
      hapticSuccess();
      return;
    }
    unlock("password");
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center overflow-hidden px-4 py-8 animate-fade"
      style={{
        background:
          "radial-gradient(ellipse 70% 60% at 50% 0%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 62%), var(--app-base)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="VaultZero is locked"
    >
      <div
        aria-hidden
        className="ambient"
        style={{ position: "absolute", zIndex: 0, inset: 0, opacity: 1 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[12%] top-[-18%] h-[460px] w-[460px] rounded-full opacity-40 blur-[110px]"
        style={{ background: "var(--orb-2)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-[20%] -right-[10%] h-[440px] w-[440px] rounded-full opacity-35 blur-[120px]"
        style={{ background: "var(--orb-1)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[18%] bottom-[8%] h-[320px] w-[320px] rounded-full opacity-30 blur-[100px]"
        style={{ background: "var(--orb-4)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border opacity-30"
        style={{ borderColor: "var(--accent)", maskImage: "radial-gradient(circle, black, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 animate-[spin-slow_26s_linear_infinite] rounded-full border border-dashed opacity-25"
        style={{ borderColor: "var(--accent)" }}
      />

      <div
        className="glass-strong animate-modal relative z-10 w-full max-w-[400px] overflow-hidden rounded-[30px] p-6 sm:p-7"
        style={{ background: "color-mix(in srgb, var(--glass-strong) 90%, transparent)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full opacity-30 blur-3xl"
          style={{ background: "var(--orb-2)" }}
        />
        <div className="relative flex flex-col items-center text-center">
          <div className="relative">
            <Logo size={62} />
            <span
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--glass-solid)] text-white shadow-lg"
              style={{ background: "var(--accent)" }}
            >
              <LockKey size={11} weight="fill" />
            </span>
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.24em] text-faint">
            <Sparkle size={9} weight="fill" style={{ color: "var(--accent)" }} /> VaultZero · Local vault
          </p>
          <h1 className="mt-2 font-display text-[27px] font-semibold tracking-[-0.04em] text-main">Welcome back, Ayaan.</h1>
          <p className="mt-1.5 max-w-[280px] text-[10px] leading-relaxed text-muted">
            Your secrets are sealed on this device. Nothing has left your Mac.
          </p>

          <div className="mt-5 flex w-full items-center justify-center gap-2">
            {[
              { label: "Argon2id", icon: Key },
              { label: "XChaCha20", icon: ShieldCheck },
              { label: "100% offline", icon: LockKey },
            ].map((chip) => (
              <span
                key={chip.label}
                className="flex items-center gap-1 rounded-full border px-2 py-1 text-[7px] font-semibold text-muted"
                style={{ borderColor: "var(--border-soft)", background: "var(--glass-soft)" }}
              >
                <chip.icon size={9} weight="duotone" /> {chip.label}
              </span>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 w-full">
            <div
              className="input-shell flex h-[46px] items-center gap-2.5 rounded-[14px] px-3"
              style={error ? { borderColor: "var(--danger)", boxShadow: "0 0 0 3px var(--danger-soft)" } : undefined}
            >
              <Key size={15} weight="duotone" className="shrink-0 text-faint" />
              <input
                ref={inputRef}
                type={revealed ? "text" : "password"}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                placeholder="Master password"
                className="min-w-0 flex-1 bg-transparent font-mono text-[11.5px] text-main outline-none placeholder:font-sans placeholder:text-faint"
                aria-label="Master password"
                aria-invalid={Boolean(error)}
                disabled={unlocking}
              />
              <Tooltip label={revealed ? "Hide" : "Show"}>
                <button
                  type="button"
                  onClick={() => setRevealed((value) => !value)}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-faint transition-colors hover:bg-[var(--hover)] hover:text-main"
                  aria-label={revealed ? "Hide master password" : "Show master password"}
                >
                  {revealed ? <EyeSlash size={12} /> : <Eye size={12} />}
                </button>
              </Tooltip>
            </div>
            {error && (
              <p className="mt-1.5 flex items-start gap-1 px-1 text-left text-[8px] font-medium" style={{ color: "var(--danger)" }}>
                <WarningCircle size={10} className="mt-px shrink-0" /> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={unlocking}
              className="primary-button mt-2.5 flex h-[43px] w-full items-center justify-center gap-2 rounded-[13px] text-[11px] font-semibold disabled:opacity-90"
            >
              {unlocking && !biometric ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                  Deriving vault key…
                </>
              ) : (
                <>
                  <LockKey size={14} weight="bold" /> Unlock vault
                  <ArrowRight size={13} weight="bold" className="ml-auto mr-0.5 opacity-70" />
                </>
              )}
            </button>
          </form>

          <div className="my-3 flex w-full items-center gap-2">
            <span className="h-px flex-1" style={{ background: "var(--border-soft)" }} />
            <span className="text-[7px] font-semibold uppercase tracking-[0.14em] text-faint">or</span>
            <span className="h-px flex-1" style={{ background: "var(--border-soft)" }} />
          </div>

          <button
            onClick={() => unlock("biometric")}
            disabled={unlocking}
            className="secondary-button flex h-[41px] w-full items-center justify-center gap-2 rounded-[13px] text-[10.5px] font-semibold"
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full"
              style={{
                color: "var(--accent)",
                background: "var(--accent-soft)",
                animation: biometric ? "glow-pulse .7s ease-in-out infinite" : undefined,
              }}
            >
              <Fingerprint size={14} weight="duotone" />
            </span>
            {biometric ? "Scanning with Touch ID…" : "Unlock with Touch ID"}
          </button>

          <div className="mt-4 flex w-full items-center justify-between gap-2 border-t pt-3" style={{ borderColor: "var(--border-soft)" }}>
            <button
              onClick={onEmergency}
              className="flex items-center gap-1.5 text-[8px] font-medium text-muted transition-colors hover:text-main"
            >
              <FirstAidKit size={11} weight="duotone" /> Emergency kit
            </button>
            <span className="flex items-center gap-1.5 font-mono text-[7px] text-faint">
              <span className="h-1 w-1 rounded-full" style={{ background: "var(--success)", boxShadow: "0 0 5px var(--success)" }} />
              AIR-GAPPED
            </span>
          </div>
        </div>
      </div>

      <p className="absolute bottom-5 left-1/2 w-full -translate-x-1/2 px-4 text-center text-[8px] text-faint">
        Demo unlock · any password opens the prototype. VaultZero never stores your master password.
      </p>
    </div>
  );
}
