import {
  FileText,
  UploadSimple,
  CheckCircle,
  WarningCircle,
  LockSimple,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import { useState, useRef, type ChangeEvent, type DragEvent } from "react";
import {
  processCsvData,
  MAX_CSV_FILE_SIZE,
  type CsvImportResult,
} from "../lib/csv";
import type { Language, VaultItem } from "../lib/vault";
import { Modal } from "./ui";

interface CsvImportModalProps {
  onClose: () => void;
  onImport: (items: VaultItem[]) => void;
  onNotify: (msg: string) => void;
  lang?: Language;
}

export function CsvImportModal({
  onClose,
  onImport,
  onNotify,
  lang = "en",
}: CsvImportModalProps) {
  const [csvResult, setCsvResult] = useState<CsvImportResult | null>(null);
  const [hasHeaders, setHasHeaders] = useState(true);
  const [rawText, setRawText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError(null);
    if (file.size > MAX_CSV_FILE_SIZE) {
      setError(
        lang === "bn"
          ? `ফাইলের আকার ৮ মেগাবাইটের বেশি (${(file.size / 1024 / 1024).toFixed(1)} MB)`
          : `File size exceeds 8 MiB limit (${(file.size / 1024 / 1024).toFixed(1)} MB)`
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || "";
      setRawText(text);
      setFileName(file.name);
      try {
        const result = processCsvData(text, { hasHeader: hasHeaders });
        setCsvResult(result);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    };
    reader.onerror = () => {
      setError(lang === "bn" ? "ফাইল পড়তে সমস্যা হয়েছে" : "Failed to read file");
    };
    reader.readAsText(file);
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const toggleHeaderOption = (checked: boolean) => {
    setHasHeaders(checked);
    if (rawText) {
      try {
        const result = processCsvData(rawText, { hasHeader: checked });
        setCsvResult(result);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  };

  const commitImport = () => {
    if (!csvResult || csvResult.items.length === 0) return;
    onImport(csvResult.items);
    onNotify(
      lang === "bn"
        ? `${csvResult.items.length} টি অ্যাকাউন্ট সফলভাবে ভল্টে যোগ করা হয়েছে`
        : `Successfully imported ${csvResult.items.length} items into vault`
    );
    onClose();
  };

  return (
    <Modal
      onClose={onClose}
      title={lang === "bn" ? "CSV ইম্পোর্ট" : "CSV Import"}
      subtitle={
        lang === "bn"
          ? "Chrome, Bitwarden, LastPass বা যেকোনো পাসওয়ার্ড ফাইল থেকে নিরাপদে অফলাইনে ইম্পোর্ট করুন।"
          : "Import from Chrome, Bitwarden, LastPass, or any generic CSV entirely offline."
      }
      icon={<FileText size={20} weight="duotone" />}
      width="max-w-[680px]"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="hidden items-center gap-1.5 text-[8.5px] text-faint sm:flex">
            <LockSimple size={11} weight="duotone" />
            {lang === "bn"
              ? "সম্পূর্ণ অফলাইন প্রসেসিং — ডেটা বাইরে যায় না"
              : "100% offline — zero data leaves this device"}
          </span>
          <div className="flex w-full justify-end gap-2.5 sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="secondary-button h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-[11px] font-semibold"
            >
              {lang === "bn" ? "বাতিল" : "Cancel"}
            </button>
            {csvResult && csvResult.items.length > 0 && (
              <button
                type="button"
                onClick={commitImport}
                className="primary-button flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-5 text-[11px] font-semibold shadow-md shadow-[var(--accent-glow)]"
              >
                <CheckCircle size={14} weight="bold" />
                {lang === "bn"
                  ? `${csvResult.items.length} টি আইটেম যোগ করুন`
                  : `Import ${csvResult.items.length} items`}
              </button>
            )}
          </div>
        </div>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt"
        className="hidden"
        onChange={onFileInputChange}
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-[14px] border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-[10px] text-[var(--danger)]">
          <WarningCircle size={16} weight="fill" />
          <span>{error}</span>
        </div>
      )}

      {!csvResult ? (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-[20px] border-2 border-dashed p-6 text-center transition-all ${
            isDragging
              ? "border-[var(--accent)] bg-[var(--glass-strong)]"
              : "border-[var(--border-soft)] hover:border-[var(--accent)] hover:bg-[var(--glass-soft)]"
          }`}
        >
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--glass-solid)] text-[var(--accent)] shadow-md">
            <UploadSimple size={26} weight="duotone" />
          </div>
          <p className="text-[12px] font-bold text-main">
            {lang === "bn" ? "CSV ফাইল ড্র্যাগ করুন বা ক্লিক করুন" : "Drop CSV file here or click to browse"}
          </p>
          <p className="mt-1 text-[9px] text-faint">
            {lang === "bn"
              ? "Chrome, Bitwarden, 1Password, LastPass ইত্যাদি সমর্থিত (সর্বোচ্চ ৮ MB, ১০,০০০ রো)"
              : "Supports Chrome, Bitwarden, 1Password, LastPass & generic CSV (Max 8 MiB, 10,000 rows)"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[var(--border-soft)] bg-[var(--glass-soft)] p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--accent)] text-white">
                <FileText size={18} weight="bold" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-main">{fileName}</p>
                <p className="text-[8.5px] text-faint">
                  {csvResult.totalRows} {lang === "bn" ? "টি রো পাওয়া গেছে" : "rows found"} · Delimiter:{" "}
                  <span className="font-mono">{csvResult.delimiter === "\t" ? "TAB" : csvResult.delimiter}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-1.5 text-[9.5px] text-main">
                <input
                  type="checkbox"
                  checked={hasHeaders}
                  onChange={(e) => toggleHeaderOption(e.target.checked)}
                  className="rounded border-[var(--border)]"
                />
                <span>{lang === "bn" ? "প্রথম লাইনে হেডার আছে" : "First row is header"}</span>
              </label>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="secondary-button flex h-7 items-center gap-1 rounded-full px-2.5 text-[9px]"
              >
                <ArrowsClockwise size={12} />
                {lang === "bn" ? "অন্য ফাইল" : "Change file"}
              </button>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-faint">
                {lang === "bn" ? "প্রিভিউ (প্রথম ৫টি আইটেম)" : "Preview (First 5 items)"}
              </span>
              <span className="text-[8.5px] text-faint">
                {lang === "bn"
                  ? "অতিরিক্ত কলামগুলো স্বয়ংক্রিয়ভাবে নোটে সংরক্ষিত হবে"
                  : "Unmapped columns are preserved in notes losslessly"}
              </span>
            </div>

            <div className="thin-scrollbar max-h-[260px] overflow-x-auto overflow-y-auto rounded-[14px] border border-[var(--border-soft)] bg-[var(--glass-solid)]">
              <table className="w-full text-left text-[9px]">
                <thead className="sticky top-0 border-b border-[var(--border-soft)] bg-[var(--glass-solid)] text-[8.5px] font-bold uppercase text-faint">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">{lang === "bn" ? "শিরোনাম" : "Title"}</th>
                    <th className="p-2">{lang === "bn" ? "ইউজারনেম / ইমেইল" : "Username"}</th>
                    <th className="p-2">{lang === "bn" ? "পাসওয়ার্ড" : "Password"}</th>
                    <th className="p-2">URL</th>
                    <th className="p-2">{lang === "bn" ? "সংরক্ষিত মেটাডেটা" : "Preserved"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-soft)]">
                  {csvResult.preview.map((row) => (
                    <tr key={row.index} className="hover:bg-[var(--glass-soft)]">
                      <td className="p-2 font-mono text-faint">{row.index + 1}</td>
                      <td className="p-2 font-semibold text-main">{row.mapped.title}</td>
                      <td className="p-2 font-mono text-faint">{row.mapped.username || "—"}</td>
                      <td className="p-2 font-mono text-faint">••••••••</td>
                      <td className="max-w-[140px] truncate p-2 font-mono text-faint">{row.mapped.url || "—"}</td>
                      <td className="p-2">
                        {Object.keys(row.mapped.unmappedFields).length > 0 ? (
                          <span className="rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[7.5px] font-bold text-[var(--accent)]">
                            +{Object.keys(row.mapped.unmappedFields).length} cols
                          </span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
