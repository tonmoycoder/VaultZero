import React, { useState } from 'react';
import {
  Download,
  Upload,
  Trash2,
  X,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';
import { VaultApi } from '@/lib/api';
import type { ImportPreview } from '@/types/vault';

interface ExportShredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export const ExportShredModal: React.FC<ExportShredModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'shred'>('export');

  // Export state
  const [exportFormat, setExportFormat] = useState<'csv' | 'markdown' | 'json'>('csv');

  // Import state
  const [csvContent, setCsvContent] = useState<string>('');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);

  // Shred state
  const [shredPath, setShredPath] = useState<string>('');
  const [shredSuccess, setShredSuccess] = useState<boolean>(false);
  const [shredError, setShredError] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      const data = await VaultApi.exportVault(exportFormat);

      // Download file to browser/disk
      const blob = new Blob([data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vaultzero-export.${exportFormat === 'markdown' ? 'md' : exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handlePreviewImport = async () => {
    if (!csvContent.trim()) return;
    try {
      const preview = await VaultApi.importCsv(csvContent);
      setImportPreview(preview);
    } catch (err) {
      console.error('Import preview failed:', err);
    }
  };

  const handleConfirmImport = () => {
    onImportComplete();
    onClose();
  };

  const handleShred = async () => {
    if (!shredPath.trim()) return;
    setShredError(null);
    setShredSuccess(false);
    try {
      await VaultApi.shredFile(shredPath.trim());
      setShredSuccess(true);
      setShredPath('');
    } catch (err: unknown) {
      setShredError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-3xl bg-background border border-border shadow-2xl p-6 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">
                Backup, Export & Secure Shredder
              </h3>
              <p className="text-xs text-muted-foreground font-mono">
                DoD 5220.22-M 3-Pass Overwrite & Sanitized Formats
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

        {/* Tabs */}
        <div className="grid grid-cols-3 p-1 rounded-xl bg-secondary/60 border border-border text-xs font-semibold">
          <button
            onClick={() => setActiveTab('export')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'export'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'import'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
          </button>
          <button
            onClick={() => setActiveTab('shred')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'shred'
                ? 'bg-destructive/15 text-destructive shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>DoD Shredder</span>
          </button>
        </div>

        {/* Tab 1: Export */}
        {activeTab === 'export' && (
          <div className="flex flex-col gap-4">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Security Notice:</span> Plaintext exports contain decrypted passwords. Store in air-gapped media and shred with the DoD shredder when finished.
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-foreground">Select Format</span>
              <div className="grid grid-cols-3 gap-2 text-xs font-medium">
                {(['csv', 'markdown', 'json'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setExportFormat(fmt)}
                    className={`py-2.5 rounded-xl border text-center transition-all ${
                      exportFormat === fmt
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm font-bold'
                        : 'bg-secondary/40 border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {exportFormat === 'csv' && 'Sanitized against Excel DDE Formula Injection (=, +, -, @ neutralized).'}
                {exportFormat === 'markdown' && 'Grouped summary with masked ||password|| spoiler tags.'}
                {exportFormat === 'json' && 'Raw structured JSON schema matching standard vault backups.'}
              </p>
            </div>

            <button
              onClick={handleExport}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md hover:opacity-95 active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download Sanitized {exportFormat.toUpperCase()} Export</span>
            </button>
          </div>
        )}

        {/* Tab 2: Import */}
        {activeTab === 'import' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">
                Paste CSV Content (Browser, Bitwarden, or 1Password export)
              </label>
              <textarea
                rows={5}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder="title,url,username,password&#10;Google,https://accounts.google.com,me@gmail.com,secret123"
                className="p-3 rounded-2xl bg-secondary/40 border border-border text-xs font-mono resize-none focus:outline-none"
              />
            </div>

            <button
              onClick={handlePreviewImport}
              className="py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border"
            >
              Analyze & Check Duplicates
            </button>

            {importPreview && (
              <div className="flex flex-col gap-2 p-4 rounded-2xl bg-secondary/30 border border-border text-xs">
                <span className="font-semibold text-foreground">Import Summary</span>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span>Found: <strong className="text-foreground">{importPreview.total_parsed}</strong></span>
                  <span>New: <strong className="text-emerald-500">{importPreview.new_entries.length}</strong></span>
                  <span>Duplicates: <strong className="text-amber-500">{importPreview.duplicate_count}</strong></span>
                </div>
                <button
                  onClick={handleConfirmImport}
                  className="mt-2 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-sm hover:opacity-95"
                >
                  Import {importPreview.new_entries.length} New Credentials
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: DoD 3-Pass File Shredder */}
        {activeTab === 'shred' && (
          <div className="flex flex-col gap-4">
            <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Permanent Destruction (DoD 5220.22-M):</span> Files are overwritten with 0x00, 0xFF, and CSPRNG bytes, then truncated and deleted. This action CANNOT be undone!
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">File Path to Shred</label>
              <input
                type="text"
                value={shredPath}
                onChange={(e) => setShredPath(e.target.value)}
                placeholder="C:\Users\...\exported_passwords.csv"
                className="p-2.5 rounded-xl bg-secondary/40 border border-border text-xs font-mono focus:outline-none"
              />
            </div>

            {shredSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>File successfully overwritten (3 passes) and permanently wiped.</span>
              </div>
            )}

            {shredError && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
                {shredError}
              </div>
            )}

            <button
              onClick={handleShred}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-destructive text-destructive-foreground font-semibold text-xs shadow-md hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Perform DoD 3-Pass Secure Wipe</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
