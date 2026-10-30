import { Check, Copy, NotePencil, Password, User, Globe, Tag, Sparkle } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { hapticSuccess } from "./Tactile";
import type { Language } from "../lib/vault";

export type OcrField = "title" | "username" | "password" | "url" | "note";

interface OcrCopyPadProps {
  rawText: string;
  onTextChange?: (text: string) => void;
  onAssign?: (field: OcrField, value: string) => void;
  onNotify?: (message: string) => void;
  lang?: Language;
  className?: string;
}

export default function OcrCopyPad({
  rawText,
  onTextChange,
  onAssign,
  onNotify,
  lang = "en",
  className,
}: OcrCopyPadProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeChipMenu, setActiveChipMenu] = useState<number | null>(null);

  const lines = useMemo(() => {
    return rawText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }, [rawText]);

  const copyToClipboard = async (text: string, index?: number) => {
    try {
      await navigator.clipboard.writeText(text);
      hapticSuccess();
      if (index !== undefined) {
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
      }
      onNotify?.(lang === "bn" ? "ক্লিপবোর্ডে কপি করা হয়েছে" : "Copied to clipboard");
    } catch {
      onNotify?.(lang === "bn" ? "কপি করতে ব্যর্থ হয়েছে" : "Failed to copy");
    }
  };

  const handleAssign = (field: OcrField, value: string) => {
    if (onAssign) {
      onAssign(field, value);
      hapticSuccess();
      setActiveChipMenu(null);
      const labels: Record<OcrField, string> = {
        title: lang === "bn" ? "শিরোনাম" : "Title",
        username: lang === "bn" ? "ইউজারনেম" : "Username",
        password: lang === "bn" ? "পাসওয়ার্ড" : "Password",
        url: lang === "bn" ? "ওয়েবসাইট" : "Website",
        note: lang === "bn" ? "নোট" : "Note",
      };
      onNotify?.(
        lang === "bn"
          ? `${labels[field]} ঘরে বসানো হয়েছে`
          : `Assigned to ${labels[field]}`
      );
    }
  };

  return (
    <div
      className={cn(
        "ocr-copy-pad rounded-[16px] border border-[var(--border-soft)] p-3 text-left",
        "bg-[var(--glass-soft)] backdrop-blur-md",
        className
      )}
    >
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border-soft)] mb-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkle size={13} weight="fill" className="text-accent" />
          <h4 className="text-[11px] font-semibold tracking-[-0.01em] text-main">
            {lang === "bn"
              ? "ওসিআর টেক্সট ও কপি-ফিলাপ প্যাড (Copy & Assign Pad)"
              : "Extracted OCR Text (Copy & Assign Pad)"}
          </h4>
        </div>
        <button
          type="button"
          onClick={() => copyToClipboard(rawText)}
          className="secondary-button flex h-6 items-center gap-1 rounded-full px-2 text-[9px] font-medium"
        >
          <Copy size={10} />
          {lang === "bn" ? "সব কপি করুন" : "Copy full text"}
        </button>
      </div>

      <div className="relative mb-3">
        <textarea
          value={rawText}
          onChange={(e) => onTextChange?.(e.target.value)}
          rows={3}
          aria-label={lang === "bn" ? "ওসিআর এডিটেবল টেক্সট" : "OCR editable text"}
          placeholder={lang === "bn" ? "ওসিআর থেকে প্রাপ্ত টেক্সট..." : "Raw extracted text..."}
          className="w-full resize-none rounded-[10px] border border-[var(--border-soft)] bg-black/10 dark:bg-black/25 px-2.5 py-1.5 font-mono text-[10px] leading-relaxed text-main focus:border-accent focus:outline-none"
        />
        <span className="absolute bottom-1.5 right-2 text-[8px] text-faint">
          {rawText.length} {lang === "bn" ? "অক্ষর" : "chars"}
        </span>
      </div>

      <div>
        <p className="mb-1.5 text-[8.5px] font-semibold uppercase tracking-wider text-faint">
          {lang === "bn"
            ? "শনাক্তকৃত লাইন / ক্লিকেবল চিপস (ক্লিক করে কপি বা অ্যাসাইন করুন):"
            : "Detected lines & chips (Click to copy or assign to field):"}
        </p>

        <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1 thin-scrollbar">
          {lines.map((line, idx) => {
            const isCopied = copiedIndex === idx;
            const isMenuOpen = activeChipMenu === idx;
            return (
              <div key={idx} className="relative inline-flex items-center">
                <button
                  type="button"
                  onClick={() => copyToClipboard(line, idx)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9.5px] font-medium transition-all",
                    isCopied
                      ? "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]"
                      : "border-[var(--border)] bg-[var(--glass)] text-main hover:border-accent/40 hover:bg-[var(--glass-strong)]"
                  )}
                >
                  {isCopied ? <Check size={10} weight="bold" /> : <Copy size={10} className="opacity-70" />}
                  <span className="max-w-[200px] truncate">{line}</span>
                </button>

                {onAssign && (
                  <button
                    type="button"
                    onClick={() => setActiveChipMenu(isMenuOpen ? null : idx)}
                    className="ml-1 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--glass-soft)] text-[8px] text-faint hover:text-main"
                    title={lang === "bn" ? "ফিল্ডে অ্যাসাইন করুন" : "Assign to field"}
                  >
                    +
                  </button>
                )}

                {isMenuOpen && onAssign && (
                  <div className="absolute left-0 top-full z-50 mt-1 flex flex-col gap-0.5 rounded-[12px] border border-[var(--border)] bg-[var(--card-bg,rgba(25,25,35,0.95))] p-1 shadow-2xl backdrop-blur-xl">
                    <button
                      type="button"
                      onClick={() => handleAssign("title", line)}
                      className="flex items-center gap-1.5 rounded-[8px] px-2 py-1 text-[9px] text-main hover:bg-white/10"
                    >
                      <Tag size={10} /> {lang === "bn" ? "Title (শিরোনাম)" : "Title"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAssign("username", line)}
                      className="flex items-center gap-1.5 rounded-[8px] px-2 py-1 text-[9px] text-main hover:bg-white/10"
                    >
                      <User size={10} /> {lang === "bn" ? "Username (ইউজার)" : "Username"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAssign("password", line)}
                      className="flex items-center gap-1.5 rounded-[8px] px-2 py-1 text-[9px] text-main hover:bg-white/10"
                    >
                      <Password size={10} /> {lang === "bn" ? "Password (পাসওয়ার্ড)" : "Password"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAssign("url", line)}
                      className="flex items-center gap-1.5 rounded-[8px] px-2 py-1 text-[9px] text-main hover:bg-white/10"
                    >
                      <Globe size={10} /> {lang === "bn" ? "Website (ওয়েবসাইট)" : "Website"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAssign("note", line)}
                      className="flex items-center gap-1.5 rounded-[8px] px-2 py-1 text-[9px] text-main hover:bg-white/10"
                    >
                      <NotePencil size={10} /> {lang === "bn" ? "Note (নোট)" : "Note"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
