import {
  ArrowsClockwise,
  DownloadSimple,
  Globe,
  Lightning,
  LockSimple,
  ShieldCheck,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";
import { useState, useEffect } from "react";
import {
  checkReleaseStatus,
  createPreUpdateBackup,
  CURRENT_APP_VERSION,
  type CheckReleaseStatus,
  type UpdateInfo,
} from "../lib/updater";
import { Modal } from "./ui";
import type { Language } from "../lib/vault";

export default function UpdateModal({
  onClose,
  onNotify,
  lang = "en",
  initialInfo = null,
}: {
  onClose: () => void;
  onNotify?: (msg: string) => void;
  lang?: Language;
  initialInfo?: UpdateInfo | null;
}) {
  const [statusState, setStatusState] = useState<CheckReleaseStatus>(() => {
    if (initialInfo) {
      return {
        status: "update_available",
        currentVersion: CURRENT_APP_VERSION,
        remoteVersion: initialInfo.version,
        updateInfo: initialInfo,
      };
    }
    return {
      status: "idle",
      currentVersion: CURRENT_APP_VERSION,
    };
  });

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  const performCheck = async () => {
    setLoading(true);
    try {
      const res = await checkReleaseStatus();
      setStatusState(res);
      if (res.status === "up_to_date") {
        onNotify?.(
          lang === "bn"
            ? `ভল্টজিরো v${CURRENT_APP_VERSION} সম্পূর্ণ আপ-টু-ডেট আছে`
            : `VaultZero v${CURRENT_APP_VERSION} is completely up-to-date`
        );
      } else if (res.status === "update_available") {
        onNotify?.(
          lang === "bn"
            ? `নতুন আপডেট উপলব্ধ: v${res.remoteVersion}`
            : `New update available: v${res.remoteVersion}`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialInfo) {
      performCheck();
    }
  }, []);

  const handleStartUpdate = () => {
    const backupKey = createPreUpdateBackup();
    onNotify?.(
      lang === "bn"
        ? `প্রি-আপডেট নিরাপত্তা ব্যাকআপ সংরক্ষিত: ${backupKey}`
        : `Pre-update safety snapshot saved: ${backupKey}`
    );

    setDownloading(true);
    setProgress(15);

    const int = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(int);
          return 95;
        }
        return prev + 25;
      });
    }, 250);

    setTimeout(() => {
      clearInterval(int);
      setProgress(100);
      setDownloading(false);

      const downloadUrl =
        statusState.updateInfo?.installerAsset?.browser_download_url ||
        statusState.updateInfo?.portableAsset?.browser_download_url ||
        statusState.updateInfo?.androidAsset?.browser_download_url ||
        statusState.updateInfo?.htmlUrl ||
        "https://github.com/tonmoycoder/VaultZero/releases/latest";

      window.open(downloadUrl, "_blank", "noopener,noreferrer");

      onNotify?.(
        lang === "bn"
          ? "আপডেট প্যাকেজ ডাউনলোড হচ্ছে। ইনস্টল শেষে পুনরায় চালু করুন।"
          : "Update package downloaded. Complete installer to apply changes."
      );
    }, 1400);
  };

  return (
    <Modal
      onClose={onClose}
      title={lang === "bn" ? "সফটওয়্যার আপডেট ও ভার্সন চেক" : "Software Update & Version Check"}
      subtitle={
        lang === "bn"
          ? "অফিসিয়াল গিটহাব রিলিজের সাথে ভার্সন মিলিয়ে দেখুন ও নিরাপদ অটোমেটিক আপডেট নিন।"
          : "Verify your installed version against official GitHub releases and safely upgrade."
      }
      icon={<ArrowsClockwise size={20} weight="duotone" />}
      width="max-w-[560px]"
    >
      <div className="space-y-4 pt-1">
        {/* Current Version Status Card */}
        <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--glass-soft)] p-4 text-left">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-[0.14em] text-faint">
              <Sparkle size={11} weight="fill" className="text-accent" />
              {lang === "bn" ? "ইনস্টল্ড ক্লায়েন্ট তথ্য" : "Installed Client Info"}
            </span>
            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 font-mono text-[8px] font-semibold text-accent">
              v{CURRENT_APP_VERSION}
            </span>
          </div>

          <div className="mt-2.5 flex items-baseline justify-between">
            <div>
              <h3 className="font-display text-[17px] font-semibold text-main">
                VaultZero Desktop & Mobile
              </h3>
              <p className="text-[10px] text-muted">ColorOS 17 Living Flow Edition</p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-[8px] font-semibold text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {lang === "bn" ? "অফিসিয়াল চ্যানেল" : "Official Channel"}
              </span>
            </div>
          </div>
        </div>

        {/* Action Button: Check for Updates */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={performCheck}
            disabled={loading || downloading}
            className="secondary-button flex h-9 items-center gap-2 rounded-xl px-4 text-[10.5px] font-semibold"
          >
            <ArrowsClockwise
              size={13}
              weight="bold"
              className={loading ? "animate-spin text-accent" : ""}
            />
            {loading
              ? lang === "bn"
                ? "যাচাই করা হচ্ছে..."
                : "Checking for updates..."
              : lang === "bn"
              ? "🔄 আপডেট চেক করুন (Check Now)"
              : "🔄 Check for Updates"}
          </button>
        </div>

        {/* State 1: Up to Date Card */}
        {statusState.status === "up_to_date" && (
          <div className="rounded-[18px] border border-emerald-500/25 bg-emerald-500/10 p-4 text-left animate-rise">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-500">
                <ShieldCheck size={20} weight="fill" />
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
                  {lang === "bn"
                    ? "✓ আপনার সফটওয়্যারটি সর্বশেষ ভার্সনে আপ-টু-ডেট আছে"
                    : "✓ Your software is completely up-to-date"}
                </h4>
                <p className="mt-1 text-[10px] leading-relaxed text-muted">
                  {lang === "bn"
                    ? `বর্তমানে আপনার সিস্টেমে ইনস্টল করা v${CURRENT_APP_VERSION} ভার্সনটি লেটেস্ট। গিটহাবে নতুন কোনো আপডেট নেই (No updates available)।`
                    : `You are currently running version v${CURRENT_APP_VERSION}. No newer releases are available on GitHub.`}
                </p>
                <div className="mt-2.5 flex items-center gap-2 text-[8px] font-mono text-faint">
                  <Globe size={11} />
                  <span>github.com/tonmoycoder/VaultZero</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* State 2: Update Available Card */}
        {statusState.status === "update_available" && statusState.updateInfo && (
          <div className="rounded-[18px] border border-[var(--accent)] bg-[var(--accent-soft)] p-4 text-left animate-rise">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[8.5px] font-bold text-white shadow-sm">
                  <Lightning size={10} weight="fill" />
                  {lang === "bn" ? "নতুন ভার্সন উপলব্ধ!" : "New Release Available!"}
                </span>
                <h4 className="mt-1.5 font-display text-[15px] font-bold text-main">
                  {statusState.updateInfo.name || `VaultZero v${statusState.remoteVersion}`}
                </h4>
              </div>
              <span className="rounded-full border border-[var(--border-soft)] bg-[var(--glass-soft)] px-2 py-0.5 font-mono text-[8px] font-medium text-muted">
                {statusState.updateInfo.tagName}
              </span>
            </div>

            {/* Release notes summary */}
            {statusState.updateInfo.body && (
              <div className="thin-scrollbar mt-3 max-h-32 overflow-y-auto rounded-xl border border-[var(--border-soft)] bg-[var(--glass-solid)] p-2.5 text-[9px] text-muted">
                <p className="font-semibold text-main mb-1">
                  {lang === "bn" ? "পরিবর্তনের বিবরণী (Release Notes):" : "What's New:"}
                </p>
                <p className="whitespace-pre-wrap leading-relaxed">{statusState.updateInfo.body}</p>
              </div>
            )}

            {/* Progress bar during download */}
            {downloading && (
              <div className="mt-3.5 space-y-1.5">
                <div className="flex justify-between text-[8px] font-semibold text-muted">
                  <span>{lang === "bn" ? "ডাউনলোড ও প্রস্তুতি..." : "Downloading update..."}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border-soft)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Download and update button */}
            <div className="mt-4 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[8px] text-faint">
                <LockSimple size={10} weight="duotone" className="text-success" />
                {lang === "bn"
                  ? "আপডেটের আগে লোকাল ভল্ট স্বয়ংক্রিয় ব্যাকআপ হবে"
                  : "Local vault will be safely backed up automatically"}
              </span>

              <button
                type="button"
                onClick={handleStartUpdate}
                disabled={downloading}
                className="primary-button flex h-9 items-center gap-1.5 rounded-full px-5 text-[11px] font-semibold shadow-md shadow-[var(--accent-glow)]"
              >
                <DownloadSimple size={14} weight="bold" />
                {downloading
                  ? lang === "bn"
                    ? "ডাউনলোড হচ্ছে..."
                    : "Downloading..."
                  : lang === "bn"
                  ? "⚡ অটোমেটিক আপডেট করুন"
                  : "⚡ Download & Update Now"}
              </button>
            </div>
          </div>
        )}

        {/* State 3: Offline / Air-Gapped Notice */}
        {statusState.status === "offline" && (
          <div className="rounded-[18px] border border-amber-500/25 bg-amber-500/10 p-3.5 text-left">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
              <WarningCircle size={15} weight="duotone" className="shrink-0" />
              <span>
                {lang === "bn"
                  ? "অফলাইন / এয়ার-গ্যাপড মোড: রিমোট গিটহাব রিলিজ সার্ভারে সংযোগ স্থাপন করা যায়নি।"
                  : "Offline / Air-gapped network: Cannot reach remote release server."}
              </span>
            </div>
            <p className="mt-1 text-[8.5px] text-muted">
              {lang === "bn"
                ? "ভল্টজিরো ১০০% অফলাইন ও নিরাপদ। ইন্টারনেট সংযোগ থাকলে পুনরায় চেক করতে পারেন।"
                : "VaultZero remains 100% functional and offline. Reconnect if you wish to query latest releases."}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
