import React, { useState } from 'react';
import {
  Scan,
  X,
  Sparkles,
  Check,
  AlertCircle,
  Smartphone,
  ArrowRight
} from 'lucide-react';
import type { Entry, OcrParsedResult } from '@/types/vault';
import { VaultApi } from '@/lib/api';

interface OcrSnippingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCredentialExtracted: (entry: Partial<Entry>) => void;
}

export const OcrSnippingModal: React.FC<OcrSnippingModalProps> = ({
  isOpen,
  onClose,
  onCredentialExtracted,
}) => {
  const [inputText, setInputText] = useState<string>('');
  const [parsed, setParsed] = useState<OcrParsedResult | null>(null);
  const [passwordState, setPasswordState] = useState<string>('');

  const handleParse = async (textToParse: string) => {
    if (!textToParse.trim()) return;
    try {
      const res = await VaultApi.classifyOcr(textToParse);
      setParsed(res);
      setPasswordState(res.password || '');
    } catch (err) {
      console.error('OCR parsing failed:', err);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    if (text) {
      setInputText(text);
      handleParse(text);
    }
  };

  const handleSwapChar = (position: number, replacement: string) => {
    if (!passwordState) return;
    const chars = passwordState.split('');
    if (position < chars.length) {
      chars[position] = replacement;
      setPasswordState(chars.join(''));
    }
  };

  const handleApplyToVault = () => {
    if (!parsed) return;
    onCredentialExtracted({
      title: parsed.title || 'Scanned Credential',
      url: parsed.url || '',
      username: parsed.username || '',
      email: parsed.email || '',
      password: passwordState || '',
      totp_config: parsed.totp_secret
        ? {
            secret: parsed.totp_secret,
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
          }
        : null,
      recovery_codes: parsed.recovery_codes.map((c) => ({ code: c, used: false })),
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto no-scrollbar rounded-3xl bg-background border border-border shadow-2xl p-6 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">
                Offline OCR & Credential Classifier
              </h3>
              <p className="text-xs text-muted-foreground">
                Paste screenshot text (Ctrl+V) or snipped credentials to auto-classify fields
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

        {/* Input Text Area */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-foreground">
            Screenshot OCR Text / QR Payload
          </label>
          <textarea
            rows={4}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onPaste={handlePaste}
            placeholder="Paste text directly, or press Ctrl+V with copied credentials or otpauth:// QR URI..."
            className="w-full p-3 rounded-2xl bg-secondary/40 border border-border focus:border-primary focus:outline-none text-xs font-mono resize-none"
          />
          <div className="flex justify-end">
            <button
              onClick={() => handleParse(inputText)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Parse & Classify</span>
            </button>
          </div>
        </div>

        {/* Parsed Classification Screen */}
        {parsed && (
          <div className="flex flex-col gap-4 p-5 rounded-3xl bg-secondary/30 border border-border/80">
            <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>Auto-Detected Credentials</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-background border border-border">
                <span className="text-muted-foreground font-semibold">Title / Service</span>
                <span className="font-medium text-foreground">{parsed.title || 'Unknown'}</span>
              </div>

              <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-background border border-border">
                <span className="text-muted-foreground font-semibold">Website URL</span>
                <span className="font-mono text-foreground truncate">{parsed.url || 'None'}</span>
              </div>

              <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-background border border-border">
                <span className="text-muted-foreground font-semibold">Username</span>
                <span className="font-mono text-foreground">{parsed.username || 'None'}</span>
              </div>

              <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-background border border-border">
                <span className="text-muted-foreground font-semibold">Email</span>
                <span className="font-mono text-foreground">{parsed.email || 'None'}</span>
              </div>
            </div>

            {/* Password with Ambiguous Character Disambiguation */}
            {passwordState && (
              <div className="flex flex-col gap-2 p-3 rounded-2xl bg-background border border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Extracted Password</span>
                  <span className="font-mono text-muted-foreground">{passwordState.length} chars</span>
                </div>
                <div className="p-2.5 rounded-xl bg-secondary/40 font-mono text-sm tracking-wider text-foreground select-all">
                  {passwordState}
                </div>

                {/* Ambiguous character swap pills */}
                {parsed.ambiguous_characters.length > 0 && (
                  <div className="flex flex-col gap-1.5 pt-1 text-xs">
                    <span className="text-amber-500 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Potential OCR Character Ambiguities:</span>
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {parsed.ambiguous_characters.map((amb, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs font-mono"
                        >
                          <span>Pos {amb.position + 1} ({amb.original_char}) ➔</span>
                          {amb.alternatives.map((alt) => (
                            <button
                              key={alt}
                              onClick={() => handleSwapChar(amb.position, alt)}
                              className="px-1.5 py-0.5 rounded bg-background hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold"
                            >
                              {alt}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Extracted TOTP */}
            {parsed.totp_secret && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold text-cyan-400">2FA Secret Detected:</span>
                <span className="font-mono text-foreground">{parsed.totp_secret}</span>
              </div>
            )}

            {/* Extracted Recovery Codes */}
            {parsed.recovery_codes.length > 0 && (
              <div className="flex flex-col gap-1.5 text-xs">
                <span className="font-semibold text-muted-foreground">Recovery Codes:</span>
                <div className="flex flex-wrap gap-1.5">
                  {parsed.recovery_codes.map((rc, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-background border border-border font-mono text-[11px]"
                    >
                      {rc}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/70">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            Cancel
          </button>
          <button
            disabled={!parsed}
            onClick={handleApplyToVault}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-md hover:opacity-95 active:scale-95 transition-all disabled:opacity-40"
          >
            <span>Review & Save to Vault</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
