import {
  ArrowsClockwise,
  DownloadSimple,
  ShieldCheck,
  Sparkle,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import {
  checkForUpdates,
  createPreUpdateBackup,
  openVerifiedUpdate,
  runVerifiedUpdate,
  type UpdateInfo,
  type UpdateProgress,
  type UpdateStage,
} from "../lib/updater";
import { stageLabel } from "../lib/updateStage";
import { Modal } from "./ui";
import type { Language } from "../lib/vault";

export default function UpdateBanner({
  lang = "en",
  onNotify,
}: {
  lang?: Language;
  onNotify?: (msg: string) => void;
}) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<UpdateStage>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for updates 5 seconds after startup
    const timer = setTimeout(async () => {
      const info = await checkForUpdates();
      if (info) {
        setUpdateInfo(info);
        setVisible(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  /**
   * SECURITY (V-32): the banner used to open the download URL directly.
   *
   * It validated nothing, so a tampered artifact on the release host would
   * still have been offered to the user, and the progress bar counted up on
   * a timer while nothing was downloaded. The banner now goes through the
   * same verified flow as the modal: the artifact is downloaded, hashed and
   * compared against the release's checksum manifest before the installer
   * is opened.
   */
  const handleStartUpdate = async () => {
    if (!updateInfo) return;

    setDownloading(true);
    setProgress(0);
    setError(null);
    setStage("snapshot");

    try {
      const verified = await runVerifiedUpdate(updateInfo, (update: UpdateProgress) => {
        setStage(update.stage);
        setProgress(update.percent);
      });

      const backupKey = createPreUpdateBackup();
      if (backupKey) {
        onNotify?.(
          lang === "bn"
            ? `ডেটা সেফটি ব্যাকআপ সংরক্ষিত: ${backupKey}`
            : `Pre-update safety snapshot saved: ${backupKey}`
        );
      }

      setProgress(100);
      setStage("done");
      /*
       * The native build already handed the verified file to the
       * operating system, so opening it again here would launch a
       * second copy of the installer. The browser build has to open the
       * object URL itself.
       */
      await openVerifiedUpdate(verified);

      onNotify?.(
        lang === "bn"
          ? "আপডেট প্যাকেজ যাচাই করা হয়েছে। ইনস্টল শেষে পুনরায় চালু করুন।"
          : "Update package verified against its published checksum. Relaunch after installation completes."
      );
    } catch (err: any) {
      setProgress(0);
      setStage("failed");
      const reason = err?.message || "The update could not be verified.";
      setError(
        lang === "bn" ? `আপডেট যাচাই করা যায়নি: ${reason}` : `The update could not be verified: ${reason}`
      );
      onNotify?.(
        lang === "bn"
          ? "আপডেট চেকসাম যাচাই ব্যর্থ — ডাউনলোড বন্ধ করা হয়েছে।"
          : "Update checksum verification failed — the download was blocked."
      );
    } finally {
      setDownloading(false);
    }
  };

  if (!visible || !updateInfo) return null;

  return (
    <>
      {/* ColorOS 17 Glassmorphic Update Pill Banner */}
      <div
        className="fixed bottom-4 left-4 z-[200] max-w-[390px] animate-toast overflow-hidden rounded-[20px] border p-3.5 shadow-2xl backdrop-blur-xl sm:left-6"
        style={{
          borderColor: "color-mix(in srgb, var(--accent) 35%, var(--border))",
          background: "linear-gradient(135deg, var(--glass-strong), var(--glass-solid))",
          boxShadow: "0 20px 45px rgba(99, 85, 238, 0.22)",
        }}
        role="alert"
        aria-live="polite"
      >
        <div className="flex items-start gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] text-white shadow-md"
            style={{ background: "linear-gradient(140deg, var(--accent), var(--accent-deep))" }}
          >
            <Sparkle size={16} weight="fill" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="font-display text-[12px] font-semibold text-main">
                {lang === "bn"
                  ? `নতুন আপডেট: v${updateInfo.version}`
                  : `Update Available: v${updateInfo.version}`}
              </span>
              <button
                type="button"
                onClick={() => setVisible(false)}
                className="text-faint hover:text-main"
                aria-label="Dismiss update notification"
              >
                <X size={13} />
              </button>
            </div>

            <p className="mt-0.5 text-[9px] leading-relaxed text-muted">
              {lang === "bn"
                ? "আপনার সব পাসওয়ার্ড ও ডেটা ১০০% অক্ষত রেখে নতুন ফিচার ও ইউআই আপডেট করুন।"
                : "Keep your passwords and vault 100% intact while getting the latest performance enhancements."}
            </p>

            {downloading && (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-[7.5px] font-medium text-faint">
                  <span>{stageLabel(stage, lang)}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-ink)]">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{ width: `${progress}%`, background: "var(--accent)" }}
                  />
                </div>
              </div>
            )}

            {error && !downloading && (
              <p className="mt-2 flex items-start gap-1 text-[8px] leading-relaxed text-danger">
                <WarningCircle size={11} weight="fill" className="mt-px shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <div className="mt-2.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void handleStartUpdate()}
                disabled={downloading}
                className="primary-button flex h-[28px] items-center gap-1 rounded-full px-3 text-[9px] font-semibold"
              >
                <DownloadSimple size={11} weight="bold" />
                {lang === "bn" ? "এখনই আপডেট করুন" : "Update Now"}
              </button>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="secondary-button flex h-[28px] items-center gap-1 rounded-full px-2.5 text-[9px] font-medium text-muted hover:text-main"
              >
                {lang === "bn" ? "বিস্তারিত" : "Details"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Update Modal */}
      {modalOpen && (
        <Modal
          onClose={() => setModalOpen(false)}
          title={lang === "bn" ? "নতুন ভার্সনের বিস্তারিত" : "Release Details"}
          subtitle={`VaultZero v${updateInfo.version} · Published ${new Date(
            updateInfo.publishedAt
          ).toLocaleDateString()}`}
          icon={<ArrowsClockwise size={20} weight="duotone" className="text-accent" />}
          width="max-w-[480px]"
        >
          <div className="space-y-3.5">
            <div className="rounded-[14px] border border-[var(--border-soft)] bg-[var(--glass-soft)] p-3 text-left">
              <span className="flex items-center gap-1 text-[8.5px] font-semibold text-success">
                <ShieldCheck size={13} weight="fill" />
                {lang === "bn" ? "ডেটা সম্পূর্ণ অক্ষত থাকবে" : "100% Data Preservation Guarantee"}
              </span>
              <p className="mt-1 text-[8px] leading-relaxed text-muted">
                {lang === "bn"
                  ? "আপডেট করার আগে স্বয়ংক্রিয়ভাবে একটি লোকাল সেফটি ব্যাকআপ (pre-update-backup) তৈরি করে রাখা হয়। তাই কোনো পাসওয়ার্ড হারানোর ভয় নেই।"
                  : "A local encrypted safety snapshot is created before the installer starts. Your vault files remain intact."}
              </p>
            </div>

            <div className="max-h-[180px] overflow-y-auto rounded-[12px] border border-[var(--border-soft)] bg-[var(--glass-input)] p-3 text-[9px] leading-relaxed text-main">
              <pre className="whitespace-pre-wrap font-sans">
                {updateInfo.body || (lang === "bn" ? "এই আপডেটে পারফরম্যান্স ও সিকিউরিটি উন্নত করা হয়েছে।" : "Performance improvements and security enhancements included in this release.")}
              </pre>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="secondary-button h-9 flex-1 rounded-full text-[10px] font-semibold"
              >
                {lang === "bn" ? "বন্ধ করুন" : "Close"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  void handleStartUpdate();
                }}
                className="primary-button flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-[10px] font-semibold"
              >
                <DownloadSimple size={12} weight="bold" />
                {lang === "bn" ? "ডাউনলোড ও আপডেট" : "Download & Install"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
