import React from 'react';
import {
  Printer,
  X,
  ShieldCheck,
  FileKey
} from 'lucide-react';
import type { VaultStatus } from '@/types/vault';

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
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const creationDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200 print:p-0 print:bg-white print:fixed">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto no-scrollbar rounded-3xl bg-background border border-border shadow-2xl p-8 flex flex-col gap-6 print:border-none print:shadow-none print:p-6 print:text-black">
        {/* Header - Not printed */}
        <div className="flex items-center justify-between pb-3 border-b border-border/70 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileKey className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">
                Printable Emergency Recovery Kit
              </h3>
              <p className="text-xs text-muted-foreground font-mono">
                Physical paper backup for safe deposit boxes
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

        {/* Printable Recovery Document Body */}
        <div className="flex flex-col gap-6 border-2 border-dashed border-border/80 p-6 rounded-2xl bg-card/60 print:border-black print:bg-white print:p-4">
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
                Physical cryptographic disaster recovery sheet
              </p>
            </div>
            <div className="text-right text-xs font-mono text-muted-foreground print:text-neutral-600">
              <div>Created: {creationDate}</div>
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
              <span className="text-muted-foreground print:text-neutral-600">Vault Path: </span>
              <strong>{vaultStatus?.vault_path || 'local-vault.pmv'}</strong>
            </div>
            <div>
              <span className="text-muted-foreground print:text-neutral-600">Architecture: </span>
              <strong>Zero-Cloud / Local-First</strong>
            </div>
          </div>

          {/* Instructions Notice */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 print:text-neutral-800 print:border-neutral-300">
            <span className="font-bold">Instructions for Executor / Heirs:</span>
            <p className="mt-0.5">
              This document contains the physical cryptographic credentials to decrypt your local VaultZero database. Keep this sheet in a fireproof safe, bank deposit box, or entrusted with your legal executor.
            </p>
          </div>

          {/* Physical Master Password Write-in Boxes */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground print:text-black">
              Physical Master Password (Handwrite Below)
            </span>
            <div className="grid grid-cols-12 gap-1.5">
              {Array.from({ length: 24 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-10 rounded-lg border-2 border-border print:border-neutral-400 flex items-center justify-center font-mono text-sm font-bold bg-background print:bg-white"
                />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground print:text-neutral-500 font-mono">
              Write one character per box clearly using permanent archival ink.
            </span>
          </div>

          {/* Secondary Notes / Keyfile Storage Location */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground print:text-black">
              Hardware Token / Keyfile Location Notes
            </span>
            <div className="h-16 rounded-xl border-2 border-dashed border-border print:border-neutral-400 p-2 text-xs font-mono text-muted-foreground print:text-neutral-600 bg-background print:bg-white">
              (Handwrite where your optional USB keyfile or secondary backup media is located)
            </div>
          </div>

          {/* Verification stamp */}
          <div className="flex items-center justify-between text-xs pt-2 border-t border-current/20 text-muted-foreground print:text-neutral-600">
            <span className="flex items-center gap-1 font-mono">
              <ShieldCheck className="w-4 h-4 text-emerald-500 print:text-black" />
              Verified Cryptographic Authenticity PMV1
            </span>
            <span className="font-mono">VaultZero Standalone v1.0.0</span>
          </div>
        </div>

        {/* Action Buttons - Hidden in Print */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/70 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md hover:opacity-95 active:scale-95 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print Emergency Recovery Sheet (PDF)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
