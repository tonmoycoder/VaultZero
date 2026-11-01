import {
  ArrowRight,
  Archive,
  CheckCircle,
  FileCode,
  LockKey,
  ShieldWarning,
  WarningCircle,
} from "@phosphor-icons/react";
import { useState, useRef, type FormEvent } from "react";
import {
  archiveAndResetVault,
  readKeyfile,
  recoverVaultWithRecoveryKey,
  type Language,
  type UnlockedSession,
} from "../lib/vault";
import { cn } from "../utils/cn";
import { Modal } from "./ui";

interface VaultRecoveryModalProps {
  onClose: () => void;
  onRecovered: (session: UnlockedSession) => void;
  onResetVault: () => void;
  lang?: Language;
}

export default function VaultRecoveryModal({
  onClose,
  onRecovered,
  onResetVault,
  lang = "en",
}: VaultRecoveryModalProps) {
  const [tab, setTab] = useState<"key" | "reset">("key");

  // Recovery Key State
  const [recoveryKey, setRecoveryKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [keyfileBytes, setKeyfileBytes] = useState<Uint8Array | null>(null);
  const [keyfileName, setKeyfileName] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyfileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const bytes = await readKeyfile(file);
      setKeyfileBytes(bytes);
      setKeyfileName(file.name);
      setError("");
    } catch {
      setError(lang === "bn" ? "কি-ফাইল রিড করতে ব্যর্থ হয়েছে।" : "Failed to read .vzkey file.");
    }
  };

  const handleRecoverWithKey = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const cleanKey = recoveryKey.trim().toUpperCase();
    if (!cleanKey) {
      setError(lang === "bn" ? "২৪ অক্ষরের রিকভারি কি দিন।" : "Enter your 24-character recovery key.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError(lang === "bn" ? "নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।" : "New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(lang === "bn" ? "পাসওয়ার্ড দুটি মিলছে না।" : "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const session = await recoverVaultWithRecoveryKey(cleanKey, newPassword, keyfileBytes ?? undefined);
      setSuccess(
        lang === "bn"
          ? "ভল্ট সফলভাবে পুনরুদ্ধার করা হয়েছে! নতুন পাসওয়ার্ড সংরক্ষিত।"
          : "Vault successfully recovered! New master password set."
      );
      setTimeout(() => {
        onRecovered(session);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(
        err?.message ||
          (lang === "bn"
            ? "রিকভারি কি ভুল হয়েছে বা ভল্ট আনর‍্যাপ করা যায়নি।"
            : "Invalid recovery key or unable to unwrap vault.")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetVault = () => {
    const confirmText =
      lang === "bn"
        ? "আপনি কি নিশ্চিতভাবে ভল্ট রিসেট করতে চান? বর্তমান এনক্রিপ্ট করা ডেটা নিরাপদে লোকাল আর্কাইভে জমা থাকবে।"
        : "Are you sure you want to reset your vault? An emergency backup archive will be preserved locally.";
    if (window.confirm(confirmText)) {
      const archiveKey = archiveAndResetVault("user_forgot_password");
      alert(
        lang === "bn"
          ? `ভল্ট রিসেট করা হয়েছে। পূর্বের ডেটা ব্যাকআপ হিসেবে সংরক্ষিত: ${archiveKey}`
          : `Vault reset. Previous container archived as: ${archiveKey}`
      );
      onResetVault();
      onClose();
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={lang === "bn" ? "ভল্ট রিকভারি উইজার্ড" : "Master Password Recovery"}
      subtitle={
        lang === "bn"
          ? "মাস্টার পাসওয়ার্ড ভুলে গেলে নিচে যেকোনো একটি নিরাপদ পদ্ধতি ব্যবহার করুন।"
          : "Recover your vault if you forgot your master password."
      }
      icon={<ShieldWarning size={20} weight="duotone" className="text-accent" />}
      width="max-w-[520px]"
    >
      {/* Recovery Tabs */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-[14px] border border-[var(--border-soft)] bg-[var(--glass-input)] p-1">
        <button
          type="button"
          onClick={() => { setTab("key"); setError(""); }}
          className={cn(
            "h-9 rounded-[10px] text-center text-[11px] font-semibold transition-all whitespace-nowrap",
            tab === "key"
              ? "bg-[var(--glass-strong)] text-main shadow-sm"
              : "text-muted hover:text-main"
          )}
        >
          {lang === "bn" ? "🔑 রিকভারি কি" : "🔑 24-Char Recovery Key"}
        </button>
        <button
          type="button"
          onClick={() => { setTab("reset"); setError(""); }}
          className={cn(
            "h-9 rounded-[10px] text-center text-[11px] font-semibold transition-all whitespace-nowrap",
            tab === "reset"
              ? "bg-[var(--glass-strong)] text-danger shadow-sm"
              : "text-muted hover:text-danger"
          )}
        >
          {lang === "bn" ? "⚠️ নিরাপদ রিসেট" : "⚠️ Fresh Reset"}
        </button>
      </div>

      {tab === "key" && (
        <form onSubmit={handleRecoverWithKey} className="space-y-3">
          <div>
            <label className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.08em] text-faint">
              {lang === "bn" ? "২৪ অক্ষরের রিকভারি কি" : "24-Character Recovery Key"}
            </label>
            <input
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value)}
              placeholder="VZRO-XXXX-XXXX-XXXX-XXXX-XXXX"
              className="field font-mono text-[11px] uppercase tracking-[0.1em]"
              autoFocus
            />
            <p className="mt-1 text-[7.5px] text-muted">
              {lang === "bn"
                ? "ভল্ট সেটআপের সময় দেওয়া ইমার্জেন্সি রিকভারি কি লিখুন।"
                : "Enter the emergency recovery key saved when creating your vault."}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.08em] text-faint">
                {lang === "bn" ? "নতুন মাস্টার পাসওয়ার্ড" : "New Master Password"}
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                className="field text-[11px]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.08em] text-faint">
                {lang === "bn" ? "পাসওয়ার্ড নিশ্চিত করুন" : "Confirm New Password"}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="field text-[11px]"
              />
            </div>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".vzkey"
              className="hidden"
              onChange={handleKeyfileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="secondary-button flex h-[33px] w-full items-center justify-center gap-1.5 rounded-[11px] text-[9.5px] font-medium"
            >
              <FileCode size={13} weight="duotone" />
              {keyfileName ? keyfileName : (lang === "bn" ? "প্রয়োজনে কি-ফাইল সংযুক্ত করুন (.vzkey)" : "Attach Keyfile if required (.vzkey)")}
            </button>
          </div>

          {error && (
            <p className="flex items-center gap-1 text-[8.5px] font-medium text-danger animate-rise">
              <WarningCircle size={12} className="shrink-0" /> {error}
            </p>
          )}

          {success && (
            <p className="flex items-center gap-1 text-[8.5px] font-medium text-success animate-rise">
              <CheckCircle size={12} className="shrink-0" /> {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !recoveryKey.trim() || !newPassword}
            className="primary-button flex h-[40px] w-full items-center justify-center gap-2 rounded-[12px] text-[11px] font-semibold disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                {lang === "bn" ? "ভল্ট ডিক্রিপ্ট ও রিসিল হচ্ছে…" : "Unwrapping & Re-encrypting Vault…"}
              </>
            ) : (
              <>
                <LockKey size={13} weight="bold" />
                {lang === "bn" ? "ভল্ট রিকভার ও আনলক করুন" : "Recover Vault & Set Password"}
                <ArrowRight size={12} weight="bold" className="ml-auto opacity-70" />
              </>
            )}
          </button>
        </form>
      )}

      {tab === "reset" && (
        <div className="space-y-3.5">
          <div className="rounded-[15px] border border-[var(--danger)]/30 bg-[var(--danger-soft)] p-3 text-left">
            <h4 className="flex items-center gap-1.5 text-[11px] font-semibold text-danger">
              <WarningCircle size={15} weight="bold" />
              {lang === "bn" ? "জরুরী ফ্রেশ ভল্ট রিসেট" : "Emergency Fresh Vault Reset"}
            </h4>
            <p className="mt-1 text-[8.5px] leading-relaxed text-muted">
              {lang === "bn"
                ? "যদি আপনার কাছে মাস্টার পাসওয়ার্ড এবং রিকভারি কি কোনোটাই না থাকে, তবে বর্তমান এনক্রিপ্ট করা ফাইলটি একটি ব্যাকআপ আর্কাইভে সংরক্ষণ করে আপনি নতুন ভল্ট সেটআপ করতে পারেন।"
                : "If you have lost both your master password and your recovery key, this creates a clean vault while archiving the old encrypted container in your local storage."}
            </p>
          </div>

          <div className="rounded-[12px] border border-[var(--border-soft)] bg-[var(--glass-soft)] p-2.5 text-[8px] text-faint">
            <span className="flex items-center gap-1 font-semibold text-main">
              <Archive size={12} weight="duotone" className="text-accent" />
              {lang === "bn" ? "ডেটা লস প্রতিরোধ সক্রিয়" : "Zero Accidental Data Loss Guarantee"}
            </span>
            <p className="mt-1 text-muted">
              {lang === "bn"
                ? "রিসেট করার সময় আপনার পুরোনো ভল্ট মোছা হবে না, বরং টাইমস্ট্যাম্প সহ একটি নিরাপদ আর্কাইভে রাখা হবে।"
                : "The encrypted file is archived to vaultzero_archived_<timestamp> before clearing."}
            </p>
          </div>

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="secondary-button h-10 flex-1 whitespace-nowrap rounded-full text-[11px] font-semibold"
            >
              {lang === "bn" ? "বাতিল" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={handleResetVault}
              className="h-10 flex-1 whitespace-nowrap rounded-full bg-[var(--danger)] text-[11px] font-semibold text-white shadow-md transition-opacity hover:opacity-90"
            >
              {lang === "bn" ? "আর্কাইভ ও নিরাপদ রিসেট" : "Archive & Reset Vault"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
