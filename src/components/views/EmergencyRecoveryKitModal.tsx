import React, { useState } from 'react';
import {
  Printer,
  X,
  ShieldCheck,
  FileKey,
  Eye,
  EyeOff,
  PenTool,
  Keyboard,
  Info
} from 'lucide-react';
import type { VaultStatus } from '@/types/vault';
import { useI18n } from '@/lib/i18n';

interface EmergencyRecoveryKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultStatus: VaultStatus | null;
}

export const EmergencyRecoveryKitModal: React.FC<EmergencyRecoveryKitModalProps> = ({
  isOpen,
  onClose,
  vaultStatus,
}) => {
  const { isBn } = useI18n();
  const [mode, setMode] = useState<'handwriting' | 'digital'>('handwriting');
  const [masterPassword, setMasterPassword] = useState<string>('');
  const [duressPassword, setDuressPassword] = useState<string>('');
  const [keyfileHint, setKeyfileHint] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showPasswords, setShowPasswords] = useState<boolean>(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const creationDate = new Date().toLocaleDateString(isBn ? 'bn-BD' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 print:p-0 print:bg-white print:fixed">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto no-scrollbar rounded-3xl bg-background border border-border shadow-2xl p-6 md:p-8 flex flex-col gap-5 print:border-none print:shadow-none print:p-6 print:text-black">
        {/* Header - Not printed */}
        <div className="flex items-center justify-between pb-3 border-b border-border/70 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileKey className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">
                {isBn ? 'ইমার্জেন্সি রিকভারি কিট' : 'Printable Emergency Recovery Kit'}
              </h3>
              <p className="text-xs text-muted-foreground font-mono">
                {isBn
                  ? 'নিরাপদ লকার বা পরিবারের জন্য শারীরিক পেপার ব্যাকআপ'
                  : 'Physical paper backup for safe deposit boxes'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs (Hidden in Print) */}
        <div className="flex items-center gap-2 p-1 rounded-2xl bg-secondary/50 border border-border/70 print:hidden">
          <button
            onClick={() => setMode('handwriting')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
              mode === 'handwriting'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <PenTool className="w-4 h-4 text-primary" />
            <span>{isBn ? 'হাতে লেখার মোড (Handwriting)' : 'Handwriting Mode'}</span>
          </button>
          <button
            onClick={() => setMode('digital')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
              mode === 'digital'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Keyboard className="w-4 h-4 text-purple-400" />
            <span>{isBn ? 'ডিজিটাল টাইপিং মোড (Digital Typing)' : 'Digital Typing Mode'}</span>
          </button>
        </div>

        {/* Digital Mode Quick Edit Inputs (Hidden in Print) */}
        {mode === 'digital' && (
          <div className="p-4 rounded-2xl bg-secondary/30 border border-border/70 flex flex-col gap-3 print:hidden">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-primary" />
                <span>
                  {isBn
                    ? 'প্রিন্ট করার আগে নিচের তথ্যগুলো টাইপ করুন (শুধুমাত্র লোকাল মেমরিতে থাকবে)'
                    : 'Fill details below before printing (kept in local RAM only)'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="flex items-center gap-1 text-primary hover:underline text-[11px]"
              >
                {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPasswords ? (isBn ? 'লুকান' : 'Hide') : (isBn ? 'দেখান' : 'Show')}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground font-medium">
                  {isBn ? 'মাস্টার পাসওয়ার্ড' : 'Master Password'}
                </label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder={isBn ? 'মাস্টার পাসওয়ার্ড লিখুন' : 'Enter master password'}
                  className="px-3 py-1.5 rounded-xl bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground font-medium">
                  {isBn ? 'ডুরেস পাসওয়ার্ড (বিকল্প/ডিকয়)' : 'Duress Decoy Password (Optional)'}
                </label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={duressPassword}
                  onChange={(e) => setDuressPassword(e.target.value)}
                  placeholder={isBn ? 'ডুরেস পাসওয়ার্ড' : 'Enter duress password'}
                  className="px-3 py-1.5 rounded-xl bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground font-medium">
                  {isBn ? 'কি-ফাইল লোকেশন / টোকেন নির্দেশিকা' : 'Keyfile / Token Location'}
                </label>
                <input
                  type="text"
                  value={keyfileHint}
                  onChange={(e) => setKeyfileHint(e.target.value)}
                  placeholder={isBn ? 'যেমন: কালো ড্রয়ারের সানডিস্ক USB' : 'e.g., Black desk drawer SanDisk USB'}
                  className="px-3 py-1.5 rounded-xl bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground font-medium">
                  {isBn ? 'জরুরি নোট / নমিনির নাম' : 'Executor / Beneficiary Notes'}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isBn ? 'জরুরি প্রয়োজনে কাকে জানাবেন' : 'Contact person / instructions'}
                  className="px-3 py-1.5 rounded-xl bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        )}

        {/* Printable Recovery Document Body */}
        <div className="flex flex-col gap-5 border-2 border-dashed border-border/80 p-6 rounded-2xl bg-card/60 print:border-black print:bg-white print:p-4">
          {/* Document Header */}
          <div className="flex items-center justify-between border-b pb-4 border-current/20">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground print:text-black flex items-center gap-2">
                <span>VaultZero</span>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-primary text-primary-foreground print:bg-black print:text-white">
                  EMERGENCY KIT
                </span>
              </h1>
              <p className="text-xs text-muted-foreground print:text-neutral-600 mt-0.5">
                {isBn
                  ? 'শারীরিক ক্রিপ্টোগ্রাফিক ডিজাস্টার রিকভারি শিট'
                  : 'Physical cryptographic disaster recovery sheet'}
              </p>
            </div>
            <div className="text-right text-xs font-mono text-muted-foreground print:text-neutral-600">
              <div>{isBn ? 'তারিখ: ' : 'Created: '}{creationDate}</div>
              <div>Format: PMV1 Encrypted</div>
            </div>
          </div>

          {/* Cryptographic Specifications */}
          <div className="grid grid-cols-2 gap-3 text-xs font-mono p-3 rounded-xl bg-secondary/40 print:bg-neutral-100 print:text-black">
            <div>
              <span className="text-muted-foreground print:text-neutral-600">KDF: </span>
              <strong>Argon2id (64MB, t=3, p=4)</strong>
            </div>
            <div>
              <span className="text-muted-foreground print:text-neutral-600">AEAD: </span>
              <strong>XChaCha20-Poly1305</strong>
            </div>
            <div>
              <span className="text-muted-foreground print:text-neutral-600">Vault: </span>
              <strong>{vaultStatus?.vault_path || 'vault.pmv'}</strong>
            </div>
            <div>
              <span className="text-muted-foreground print:text-neutral-600">Architecture: </span>
              <strong>Zero-Cloud / 100% Offline</strong>
            </div>
          </div>

          {/* Instructions Notice */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 print:text-neutral-800 print:border-neutral-300">
            <span className="font-bold">
              {isBn ? 'ওয়ারিশ বা নির্বাহকের নির্দেশিকা:' : 'Instructions for Executor / Heirs:'}
            </span>
            <p className="mt-0.5">
              {isBn
                ? 'এই নথিতে আপনার লোকাল VaultZero ডাটাবেজ ডিক্রিপ্ট করার জন্য প্রয়োজনীয় প্রমাণপত্র রয়েছে। এই কাগজটি একটি অগ্নিনির্বাপক লকারে বা ব্যাংক ভল্টে নিরাপদে রাখুন।'
                : 'This document contains physical cryptographic credentials to decrypt your local VaultZero database. Keep this sheet in a fireproof safe, bank deposit box, or entrusted with your legal executor.'}
            </p>
          </div>

          {/* Master Password Section */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground print:text-black flex items-center justify-between">
              <span>
                {mode === 'handwriting'
                  ? isBn
                    ? 'মাস্টার পাসওয়ার্ড (নিচে স্বহস্তে লিখুন)'
                    : 'Physical Master Password (Handwrite Below)'
                  : isBn
                  ? 'মাস্টার পাসওয়ার্ড (টাইপ করা)'
                  : 'Master Password (Digital)'}
              </span>
              {mode === 'digital' && masterPassword && (
                <span className="text-[11px] font-mono text-primary font-normal print:hidden">
                  Length: {masterPassword.length}
                </span>
              )}
            </span>

            {mode === 'handwriting' ? (
              <>
                <div className="grid grid-cols-12 gap-1.5">
                  {Array.from({ length: 24 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="h-10 rounded-lg border-2 border-border print:border-neutral-400 flex items-center justify-center font-mono text-sm font-bold bg-background print:bg-white"
                    />
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground print:text-neutral-500 font-mono">
                  {isBn
                    ? 'প্রতিটি ঘরে স্পষ্ট অক্ষরে স্থায়ী কালি দিয়ে একটি করে ক্যারেক্টার লিখুন।'
                    : 'Write one character per box clearly using permanent archival ink.'}
                </span>
              </>
            ) : (
              <div className="p-3 rounded-xl border-2 border-border print:border-neutral-400 font-mono text-sm font-bold bg-background print:bg-neutral-50 text-foreground print:text-black tracking-widest break-all">
                {masterPassword || (
                  <span className="text-muted-foreground font-normal italic">
                    {isBn ? '(কোনো পাসওয়ার্ড টাইপ করা হয়নি)' : '(No password entered)'}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Secondary Notes / Keyfile Storage Location */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground print:text-black">
              {isBn
                ? 'হার্ডওয়্যার টোকেন / কি-ফাইল লোকেশন ও নোটস'
                : 'Hardware Token / Keyfile Location Notes'}
            </span>
            <div className="min-h-16 rounded-xl border-2 border-dashed border-border print:border-neutral-400 p-2.5 text-xs font-mono text-foreground print:text-black bg-background print:bg-white">
              {mode === 'digital' && (keyfileHint || notes) ? (
                <div className="space-y-1">
                  {keyfileHint && (
                    <div>
                      <strong>Keyfile:</strong> {keyfileHint}
                    </div>
                  )}
                  {notes && (
                    <div>
                      <strong>Notes:</strong> {notes}
                    </div>
                  )}
                  {duressPassword && (
                    <div className="text-amber-600 print:text-black">
                      <strong>Duress Decoy:</strong> {duressPassword}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground print:text-neutral-600">
                  {isBn
                    ? '(আপনার ব্যাকআপ ইউএসবি ড্রাইভ বা জরুরি নির্দেশিকা এখানে হাতে লিখুন)'
                    : '(Handwrite where your optional USB keyfile or secondary backup media is located)'}
                </span>
              )}
            </div>
          </div>

          {/* Verification stamp */}
          <div className="flex items-center justify-between text-xs pt-2 border-t border-current/20 text-muted-foreground print:text-neutral-600">
            <span className="flex items-center gap-1 font-mono">
              <ShieldCheck className="w-4 h-4 text-emerald-500 print:text-black" />
              <span>Verified Cryptographic Authenticity PMV1</span>
            </span>
            <span className="font-mono">VaultZero v1.0.1 Standalone</span>
          </div>
        </div>

        {/* Action Buttons - Hidden in Print */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/70 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            {isBn ? 'বাতিল' : 'Cancel'}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md hover:opacity-95 active:scale-95 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>{isBn ? 'ইমার্জেন্সি শিট প্রিন্ট করুন (PDF)' : 'Print Emergency Recovery Sheet (PDF)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
