import {
  ArrowRight,
  CheckCircle,
  DownloadSimple,
  Eye,
  EyeSlash,
  FileCode,
  Fingerprint,
  FirstAidKit,
  Key,
  LockKey,
  LockSimple,
  ShieldCheck,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { hapticSuccess } from "./Tactile";
import { Logo, Tooltip } from "./ui";
import { APP_VERSION } from "../lib/version";
import VaultRecoveryModal from "./VaultRecoveryModal";
import {
  checkVaultConfiguredAsync,
  createNewVault,
  downloadKeyfile,
  generateKeyfileBytes,
  getStoredVaultContainer,
  initialItems,
  isVaultConfigured,
  readKeyfile,
  t,
  unlockVault,
  type Language,
  type UnlockedSession,
} from "../lib/vault";
import {
  clearQuickUnlock,
  enrollQuickUnlock,
  isQuickUnlockAvailable,
  quickUnlock,
} from "../lib/quickUnlock";

export default function LockScreen({
  onUnlocked,
  onEmergency,
  lang = "en",
}: {
  onUnlocked: (session: UnlockedSession) => void;
  onEmergency: () => void;
  lang?: Language;
}) {
  const [isSetup, setIsSetup] = useState(() => !isVaultConfigured());
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [duressPassword, setDuressPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [keyfileBytes, setKeyfileBytes] = useState<Uint8Array | null>(null);
  const [keyfileName, setKeyfileName] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickAvailable, setQuickAvailable] = useState(() => isQuickUnlockAvailable());
  const [enableQuickUnlock, setEnableQuickUnlock] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [profileName, setProfileName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("vaultzero_username") || "";
    }
    return "";
  });

  // V-90: an explicit user choice wins over the asynchronous native probe.
  const manualModeRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    checkVaultConfiguredAsync().then((configured) => {
      // Both directions matter: a stale marker must send a fresh install
      // BACK to Setup, not only a found .pmv file to Unlock.
      if (mounted && !manualModeRef.current) {
        setIsSetup(!configured);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleProfileUpdate = () => {
      if (typeof window !== "undefined") {
        setProfileName(localStorage.getItem("vaultzero_username") || "");
      }
    };
    window.addEventListener("vaultzero_profile_updated", handleProfileUpdate);
    return () => window.removeEventListener("vaultzero_profile_updated", handleProfileUpdate);
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const container = getStoredVaultContainer();
  const requiresKeyfile = container?.hasKeyfile ?? false;

  useEffect(() => {
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 400);
    setQuickAvailable(isQuickUnlockAvailable());
    return () => window.clearTimeout(timeout);
  }, [isSetup]);

  // Keyfile generation (32 CSPRNG bytes)
  const handleGenerateKeyfile = () => {
    const bytes = generateKeyfileBytes();
    setKeyfileBytes(bytes);
    setKeyfileName("vaultzero.vzkey");
    downloadKeyfile(bytes, "vaultzero.vzkey");
    hapticSuccess();
    setError("");
  };

  // Keyfile file picker
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const bytes = await readKeyfile(file);
      setKeyfileBytes(bytes);
      setKeyfileName(file.name);
      setError("");
      hapticSuccess();
    } catch {
      setError(lang === "bn" ? "কি-ফাইল রিড করতে ব্যর্থ হয়েছে।" : "Failed to read .vzkey file.");
    }
  };

  // Password strength calculation
  const calculateStrength = (pwd: string) => {
    if (!pwd) return { label: "", score: 0, color: "var(--border)" };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { label: t(lang, "weak"), score: 1, color: "var(--danger)" };
    if (score <= 3) return { label: t(lang, "toReview"), score: 2, color: "var(--warning)" };
    return { label: t(lang, "strong"), score: 4, color: "var(--success)" };
  };

  const strength = calculateStrength(password);

  const handleUnlock = async (pwdToUse?: string) => {
    setError("");
    const pwd = pwdToUse ?? password;
    if (!pwd.trim()) {
      setError(lang === "bn" ? "মাস্টার পাসওয়ার্ড লিখুন।" : "Enter your master password.");
      return;
    }
    if (requiresKeyfile && !keyfileBytes) {
      setError(
        lang === "bn"
          ? "এই ভল্টটির জন্য .vzkey কি-ফাইল আবশ্যক।"
          : "This vault requires your .vzkey hardware keyfile."
      );
      return;
    }

    setLoading(true);
    try {
      const session = await unlockVault(pwd, keyfileBytes ?? undefined);
      // V-50: enrolment is opt-in and real. If this platform has no
      // authenticator the call simply returns false and quick unlock stays
      // unavailable — no fake success and no hardcoded fallback password.
      if (enableQuickUnlock) void enrollQuickUnlock(pwd);
      hapticSuccess();
      onUnlocked(session);
    } catch (err: any) {
      setError(err?.message || (lang === "bn" ? "পাসওয়ার্ড ভুল হয়েছে।" : "Incorrect credentials."));
      hapticSuccess();
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!password || password.length < 6) {
      setError(lang === "bn" ? "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।" : "Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError(lang === "bn" ? "দুটো পাসওয়ার্ড মিলছে না।" : "Passwords do not match.");
      return;
    }

    setLoading(true);
    // A newly created vault has a different master password; any enrolment
    // from a previous vault must not linger in memory.
    clearQuickUnlock();
    try {
      const session = await createNewVault(
        password,
        initialItems,
        keyfileBytes ?? undefined,
        duressPassword.trim() || undefined
      );
      if (enableQuickUnlock) void enrollQuickUnlock(password);
      hapticSuccess();
      onUnlocked(session);
    } catch (err: any) {
      setError(err?.safeMessage || err?.message || (lang === "bn" ? "ভল্ট তৈরিতে সমস্যা হয়েছে।" : "Failed to create vault."));
    } finally {
      setLoading(false);
    }
  };

  /**
   * V-50: real WebAuthn-gated quick unlock. `quickUnlock()` verifies a
   * platform-authenticator assertion (challenge, origin, ECDSA signature)
   * before releasing the wrapped master password. Failures are fail-closed:
   * the user is asked for the master password, never unlocked with a demo
   * credential.
   */
  const handleQuickUnlock = async () => {
    if (!isQuickUnlockAvailable()) {
      setError(lang === "bn"
        ? "এই সেশনে দ্রুত আনলক নেই। মাস্টার পাসওয়ার্ড দিন।"
        : "Quick unlock is not enrolled in this session. Enter your master password.");
      return;
    }
    setError("");
    setQuickBusy(true);
    try {
      const pwd = await quickUnlock();
      if (!pwd) {
        setError(lang === "bn"
          ? "বায়োমেট্রিক যাচাই ব্যর্থ বা বাতিল। মাস্টার পাসওয়ার্ড দিন।"
          : "Biometric check failed or was cancelled. Enter your master password.");
        return;
      }
      const session = await unlockVault(pwd, keyfileBytes ?? undefined);
      hapticSuccess();
      onUnlocked(session);
    } catch {
      setError(lang === "bn"
        ? "দ্রুত আনলক ব্যর্থ। মাস্টার পাসওয়ার্ড দিন।"
        : "Quick unlock failed. Enter your master password.");
    } finally {
      setQuickBusy(false);
    }
  };

  return (
    <div
      className="mobile-safe-top fixed inset-0 z-[300] flex items-center justify-center overflow-y-auto px-4 py-8 animate-fade"
      style={{
        background:
          "radial-gradient(ellipse 70% 60% at 50% 0%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 62%), var(--app-base)",
        paddingBottom: "max(calc(2rem + var(--safe-bottom)), 32px)",
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
        className="glass-strong animate-modal relative z-10 my-auto w-full max-w-[430px] overflow-hidden rounded-[30px] p-6 sm:p-7 shadow-2xl"
        style={{ background: "color-mix(in srgb, var(--glass-strong) 92%, transparent)" }}
      >
        <div className="relative flex flex-col items-center text-center">
          <div className="relative">
            <Logo size={60} />
            <span
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--glass-solid)] text-white shadow-lg"
              style={{ background: "var(--accent)" }}
            >
              <LockKey size={11} weight="fill" />
            </span>
          </div>

          <p className="mt-3.5 flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-[0.2em] text-faint">
            <Sparkle size={9} weight="fill" style={{ color: "var(--accent)" }} /> VaultZero · Zero-Knowledge Gate
          </p>
          <h1 className="mt-1.5 font-display text-[24px] font-semibold tracking-[-0.035em] text-main sm:text-[26px]">
            {isSetup
              ? t(lang, "setupTitle")
              : (() => {
                  const name = profileName.trim() || (lang === "bn" ? "ভল্ট ওনার" : "Vault Owner");
                  return lang === "bn" ? `স্বাগতম, ${name}।` : `Welcome back, ${name}.`;
                })()}
          </h1>
          <p className="mt-1 max-w-[320px] text-[10px] leading-relaxed text-muted">
            {isSetup ? t(lang, "setupSubtitle") : t(lang, "unlockSubtitle")}
          </p>

          <div className="mt-4 flex w-full items-center justify-center gap-2">
            {[
              { label: "Argon2id", icon: Key },
              { label: "XChaCha20", icon: ShieldCheck },
              { label: "100% Offline", icon: LockKey },
            ].map((chip) => (
              <span
                key={chip.label}
                className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[7.5px] font-semibold text-muted"
                style={{ borderColor: "var(--border-soft)", background: "var(--glass-soft)" }}
              >
                <chip.icon size={9} weight="duotone" /> {chip.label}
              </span>
            ))}
          </div>

          {/* Form */}
          <form
            onSubmit={isSetup ? handleSetup : (e) => { e.preventDefault(); handleUnlock(); }}
            className="mt-5 w-full space-y-3"
          >
            {/* Master Password Input */}
            <div
              className="input-shell flex h-[46px] items-center gap-2.5 rounded-[14px] px-3"
              style={error ? { borderColor: "var(--danger)", boxShadow: "0 0 0 3px var(--danger-soft)" } : undefined}
            >
              <Key size={15} weight="duotone" className="shrink-0 text-faint" />
              <input
                ref={inputRef}
                type={revealed ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder={t(lang, "masterPassword")}
                className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-main outline-none placeholder:font-sans placeholder:text-faint"
                aria-label={t(lang, "masterPassword")}
                disabled={loading}
              />
              <Tooltip label={revealed ? t(lang, "hide") : t(lang, "reveal")}>
                <button
                  type="button"
                  onClick={() => setRevealed((v) => !v)}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-faint transition-colors hover:bg-[var(--hover)] hover:text-main"
                  aria-label={revealed ? "Hide master password" : "Show master password"}
                >
                  {revealed ? <EyeSlash size={13} /> : <Eye size={13} />}
                </button>
              </Tooltip>
            </div>

            {/* Password strength meter in setup mode */}
            {isSetup && password.length > 0 && (
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4].map((step) => (
                    <span
                      key={step}
                      className="h-1.5 w-6 rounded-full transition-all duration-300"
                      style={{
                        background: step <= strength.score ? strength.color : "var(--border-soft)",
                      }}
                    />
                  ))}
                </div>
                <span className="text-[8.5px] font-semibold" style={{ color: strength.color }}>
                  {strength.label}
                </span>
              </div>
            )}

            {/* Confirm Password (Setup mode) */}
            {isSetup && (
              <div className="input-shell flex h-[46px] items-center gap-2.5 rounded-[14px] px-3">
                <ShieldCheck size={15} weight="duotone" className="shrink-0 text-faint" />
                <input
                  type={revealed ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError("");
                  }}
                  placeholder={t(lang, "confirmPassword")}
                  className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-main outline-none placeholder:font-sans placeholder:text-faint"
                  aria-label={t(lang, "confirmPassword")}
                  disabled={loading}
                />
              </div>
            )}

            {/* Duress / Decoy Password (Setup mode) */}
            {isSetup && (
              <div className="rounded-[14px] border border-dashed border-[var(--border-soft)] p-2.5 text-left">
                <div className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.1em] text-muted">
                  <WarningCircle size={11} weight="duotone" className="text-warning" />
                  {t(lang, "duressPasswordOptional")}
                </div>
                <p className="mt-0.5 text-[7.5px] text-faint">{t(lang, "duressHint")}</p>
                <input
                  type={revealed ? "text" : "password"}
                  value={duressPassword}
                  onChange={(e) => setDuressPassword(e.target.value)}
                  placeholder="Duress decoy password (optional)"
                  className="mt-1.5 w-full rounded-[10px] border border-[var(--border-soft)] bg-[var(--glass-input)] px-2.5 py-1.5 font-mono text-[10.5px] text-main outline-none"
                />
              </div>
            )}

            {/* Keyfile Controls */}
            <div className="space-y-1.5 pt-0.5">
              <input
                ref={fileInputRef}
                type="file"
                accept=".vzkey,application/octet-stream"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex items-center gap-2">
                {isSetup && (
                  <button
                    type="button"
                    onClick={handleGenerateKeyfile}
                    className="secondary-button flex h-[35px] flex-1 items-center justify-center gap-1.5 rounded-[11px] text-[9.5px] font-semibold"
                  >
                    <DownloadSimple size={12} weight="bold" />
                    {t(lang, "generateKeyfile")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="secondary-button flex h-[35px] flex-1 items-center justify-center gap-1.5 rounded-[11px] text-[9.5px] font-semibold"
                >
                  <FileCode size={12} weight="duotone" />
                  {keyfileName ? keyfileName : t(lang, "attachKeyfile")}
                </button>
              </div>
              {keyfileName && (
                <div className="flex items-center justify-center gap-1.5 text-[8px] font-medium text-success">
                  <CheckCircle size={10} weight="fill" />
                  {t(lang, "keyfileAttached")}: {keyfileName} (32-bytes CSPRNG)
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <p className="flex items-start gap-1 px-1 text-left text-[8.5px] font-medium text-danger animate-rise">
                <WarningCircle size={12} className="mt-px shrink-0" /> {error}
              </p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="primary-button relative mt-2 flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-[16px] px-6 py-3.5 text-[12px] font-semibold shadow-md transition-all active:scale-[0.985] disabled:opacity-80"
            >
              {loading ? (
                <div className="flex w-full items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                  <span>{isSetup ? "Sealing vault with Argon2id…" : "Deriving vault key…"}</span>
                </div>
              ) : (
                <div className="flex w-full items-center justify-center gap-2">
                  <LockSimple size={16} weight="bold" className="shrink-0" />
                  <span>{isSetup ? t(lang, "createVaultBtn") : t(lang, "unlockVaultBtn")}</span>
                  <ArrowRight size={15} weight="bold" className="shrink-0 opacity-80" />
                </div>
              )}
            </button>
          </form>

          {/* Master Password Recovery Action */}
          {!isSetup && (
            <div className="mt-3.5 flex justify-center">
              <button
                type="button"
                onClick={() => setShowRecovery(true)}
                className="rounded-lg px-2.5 py-1 text-[10px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent-soft)] hover:underline"
              >
                {lang === "bn" ? "পাসওয়ার্ড ভুলে গেছেন? ভল্ট রিকভার করুন" : "Forgot master password? Recover vault"}
              </button>
            </div>
          )}

          {/* V-50: real WebAuthn quick unlock — no simulation, no fallback password. */}
          <div className="my-2.5 flex w-full items-center gap-2">
            <span className="h-px flex-1" style={{ background: "var(--border-soft)" }} />
            <span className="text-[7.5px] font-semibold uppercase tracking-[0.14em] text-faint">or</span>
            <span className="h-px flex-1" style={{ background: "var(--border-soft)" }} />
          </div>

          <label className="mb-2 flex w-full cursor-pointer items-start gap-2 text-[9px] leading-relaxed text-muted">
            <input
              type="checkbox"
              checked={enableQuickUnlock}
              onChange={(event) => setEnableQuickUnlock(event.target.checked)}
              className="mt-0.5 h-3 w-3 shrink-0 accent-[var(--accent)]"
              aria-label="Enable quick unlock for this session"
            />
            <span>
              {lang === "bn"
                ? "আনলকের পর এই সেশনের জন্য ডিভাইস বায়োমেট্রিক দ্রুত আনলক চালু করুন (ঐচ্ছিক)।"
                : "Enable device biometric quick unlock for this session after unlocking (optional)."}
            </span>
          </label>

          {quickAvailable ? (
            <button
              type="button"
              onClick={handleQuickUnlock}
              disabled={loading || quickBusy}
              className="secondary-button flex min-h-[46px] w-full items-center justify-center gap-3 rounded-[15px] px-6 py-3 text-[11px] font-semibold"
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full"
                style={{
                  color: "var(--accent)",
                  background: "var(--accent-soft)",
                  animation: quickBusy ? "glow-pulse .7s ease-in-out infinite" : undefined,
                }}
              >
                <Fingerprint size={14} weight="duotone" />
              </span>
              {quickBusy
                ? (lang === "bn" ? "ডিভাইস যাচাই করা হচ্ছে…" : "Verifying with your device…")
                : (lang === "bn" ? "দ্রুত আনলক (ডিভাইস বায়োমেট্রিক)" : "Quick unlock (device biometric)")}
            </button>
          ) : (
            <p className="rounded-[12px] border border-dashed px-3 py-2 text-center text-[8.5px] leading-relaxed text-faint" style={{ borderColor: "var(--border-soft)" }}>
              {lang === "bn"
                ? "এই সেশনে দ্রুত আনলক এখনো নেই। উপরের অপশনটি চেক করে মাস্টার পাসওয়ার্ড দিয়ে আনলক করলে ডিভাইসে প্ল্যাটফর্ম অথেনটিকেটর থাকলে এটি চালু হবে।"
                : "Quick unlock is not enrolled yet. Tick the option above and unlock with your master password; it appears here when a platform authenticator is available."}
            </p>
          )}

          {/* V-53: the old "switch to setup if testing" toggle could overwrite
              an existing vault container. Only offer a setup/unlock switch
              when no vault is actually configured. */}
          {(isSetup || !isVaultConfigured()) && (
            <div className="mt-3 flex items-center justify-center gap-2 text-[8.5px] text-muted">
              <button
                type="button"
                onClick={() => {
                  manualModeRef.current = true;
                  setIsSetup((v) => !v);
                  setError("");
                }}
                className="hover:text-main underline decoration-dotted transition-colors font-medium"
              >
                {isSetup
                  ? (lang === "bn" ? "আগে থেকেই ভল্ট আছে? আনলক করুন" : "Already have a vault? Switch to unlock")
                  : (lang === "bn" ? "নতুন ভল্ট তৈরি করতে চান? সেটআপ করুন" : "Need a fresh vault? Switch to setup")}
              </button>
            </div>
          )}

          <div className="mt-3 flex w-full items-center justify-between gap-2 border-t pt-3" style={{ borderColor: "var(--border-soft)" }}>
            <button
              type="button"
              onClick={onEmergency}
              className="flex items-center gap-1.5 text-[8.5px] font-medium text-muted transition-colors hover:text-main"
            >
              <FirstAidKit size={12} weight="duotone" /> {t(lang, "emergencyKit")}
            </button>
            <span className="flex items-center gap-1.5 font-mono text-[7.5px] text-faint">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--success)", boxShadow: "0 0 5px var(--success)" }} />
              AIR-GAPPED · v{APP_VERSION}
            </span>
          </div>
        </div>
      </div>

      {showRecovery && (
        <VaultRecoveryModal
          onClose={() => setShowRecovery(false)}
          onRecovered={(sess) => {
            setShowRecovery(false);
            onUnlocked(sess);
          }}
          onResetVault={() => {
            setShowRecovery(false);
            setIsSetup(true);
            setPassword("");
            setConfirmPassword("");
            setError("");
          }}
          lang={lang}
        />
      )}
    </div>
  );
}
