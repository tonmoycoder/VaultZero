import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  UploadCloud,
  Sparkles,
  Check,
  QrCode,
  ArrowRight
} from 'lucide-react';
import type { Entry } from '@/types/vault';
import { useI18n } from '@/lib/i18n';
import jsQR from 'jsqr';
import { createWorker } from 'tesseract.js';

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
  const { t, lang } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanStatusText, setScanStatusText] = useState<string>('');
  const [qrCodeDetected, setQrCodeDetected] = useState<string | null>(null);

  // Extracted Fields State
  const [title, setTitle] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [totpSecret, setTotpSecret] = useState<string>('');
  const [rawText, setRawText] = useState<string>('');

  // Listen to Global Clipboard Paste (Ctrl+V) when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            processImageFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImagePreview(result);
      runOcrAndQr(result);
    };
    reader.readAsDataURL(file);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const runOcrAndQr = async (imageSrc: string) => {
    setIsScanning(true);
    setScanProgress(10);
    setScanStatusText(lang === 'bn' ? 'ছবি লোড হচ্ছে...' : 'Loading image...');
    setQrCodeDetected(null);

    // 1. Scan for QR code using jsQR on HTMLImageElement
    const img = new Image();
    img.src = imageSrc;
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        setQrCodeDetected(code.data);
        // Check if QR is an otpauth:// URL
        if (code.data.startsWith('otpauth://')) {
          try {
            const parsedUrl = new URL(code.data);
            const secret = parsedUrl.searchParams.get('secret');
            if (secret) setTotpSecret(secret);
            const issuer = parsedUrl.searchParams.get('issuer') || parsedUrl.pathname.split(':')[0];
            if (issuer) setTitle(decodeURIComponent(issuer).replace(/^\//, ''));
          } catch {}
        }
      }
    }

    setScanProgress(30);
    setScanStatusText(lang === 'bn' ? 'টেক্সট রিকগনিশন শুরু হচ্ছে...' : 'Initializing OCR engine...');

    // 2. Perform Real Tesseract.js OCR
    try {
      const worker = await createWorker('eng');
      setScanProgress(50);
      setScanStatusText(lang === 'bn' ? 'OCR মডেল চলছে...' : 'Scanning text layers...');

      const ret = await worker.recognize(imageSrc);
      const text = ret.data.text;
      setRawText(text);
      await worker.terminate();

      setScanProgress(90);
      setScanStatusText(lang === 'bn' ? 'ক্রেডেনশিয়াল পার্সিং হচ্ছে...' : 'Parsing credentials...');

      parseExtractedText(text);
      setScanProgress(100);
    } catch (err) {
      console.error('Tesseract OCR error:', err);
      setScanStatusText(lang === 'bn' ? 'OCR সম্পন্ন হয়েছে' : 'OCR finished');
    } finally {
      setIsScanning(false);
    }
  };

  const parseExtractedText = (text: string) => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    // Regex extractors
    const urlRegex = /(https?:\/\/[^\s]+|www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/i;
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;

    let foundUrl = '';
    let foundEmail = '';
    let foundUser = '';
    let foundPass = '';
    let foundTitle = '';

    for (const line of lines) {
      if (!foundUrl && urlRegex.test(line)) {
        foundUrl = line.match(urlRegex)?.[0] || '';
      }
      if (!foundEmail && emailRegex.test(line)) {
        foundEmail = line.match(emailRegex)?.[0] || '';
      }
      if (/password[:=\s]/i.test(line) && !foundPass) {
        const parts = line.split(/password[:=\s]+/i);
        if (parts[1]) foundPass = parts[1].trim();
      }
      if (/(username|user|login)[:=\s]/i.test(line) && !foundUser) {
        const parts = line.split(/(username|user|login)[:=\s]+/i);
        if (parts[2]) foundUser = parts[2].trim();
      }
    }

    // Default title from domain
    if (foundUrl) {
      try {
        const hostname = new URL(foundUrl.startsWith('http') ? foundUrl : 'https://' + foundUrl).hostname;
        foundTitle = hostname.replace('www.', '').split('.')[0];
        foundTitle = foundTitle.charAt(0).toUpperCase() + foundTitle.slice(1);
      } catch {}
    }

    if (foundTitle) setTitle(foundTitle);
    if (foundUrl) setUrl(foundUrl);
    if (foundEmail) setEmail(foundEmail);
    if (foundUser) setUsername(foundUser);
    if (foundPass) setPassword(foundPass);
  };

  const handleSaveToVault = () => {
    onCredentialExtracted({
      title: title || 'Scanned Account',
      url: url || '',
      username: username || '',
      email: email || '',
      password: password || '',
      notes: rawText ? `[OCR Scanned Raw Text]:\n${rawText}` : '',
      totp_config: totpSecret ? { secret: totpSecret, algorithm: 'SHA1', digits: 6, period: 30 } : null,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto no-scrollbar rounded-3xl bg-background border border-border shadow-2xl p-6 flex flex-col gap-5 text-foreground">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">{t.ocrTitle}</h3>
              <p className="text-xs text-muted-foreground">{t.ocrSubtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drag & Drop Area + Paste Hint */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
            imagePreview
              ? 'border-primary/40 bg-primary/5'
              : 'border-border/80 hover:border-primary hover:bg-secondary/40'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                processImageFile(e.target.files[0]);
              }
            }}
            accept="image/*"
            className="hidden"
          />

          {imagePreview ? (
            <div className="flex flex-col items-center gap-3 w-full">
              <img
                src={imagePreview}
                alt="OCR Snippet"
                className="max-h-48 rounded-xl object-contain border border-border/60 shadow-md"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{lang === 'bn' ? 'ছবি আপলোড হয়েছে • অন্য ছবি দিতে ক্লিক বা পেস্ট করুন' : 'Image loaded • Click or paste to replace'}</span>
              </p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-2xl bg-secondary/80 flex items-center justify-center text-primary shadow-inner">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-foreground text-center">{t.ocrDropzone}</p>
              <p className="text-xs text-muted-foreground text-center">{t.ocrOrBrowse}</p>
              <div className="mt-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[11px] font-mono">
                {t.ocrPasteHint}
              </div>
            </>
          )}
        </div>

        {/* Scan Progress Bar */}
        {isScanning && (
          <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-secondary/40 border border-border/60 animate-pulse">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-cyan-400">{scanStatusText}</span>
              <span className="font-bold">{scanProgress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden">
              <div
                style={{ width: `${scanProgress}%` }}
                className="h-full bg-gradient-to-r from-cyan-500 to-primary transition-all duration-300"
              />
            </div>
          </div>
        )}

        {/* QR Code Detected Notification */}
        {qrCodeDetected && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
            <QrCode className="w-4 h-4 shrink-0" />
            <div className="truncate flex-1">
              <strong>{lang === 'bn' ? '2FA কিউআর কোড শনাক্ত হয়েছে:' : '2FA QR Code Detected:'}</strong>{' '}
              <span className="font-mono">{totpSecret || qrCodeDetected}</span>
            </div>
          </div>
        )}

        {/* Editable Extracted Fields */}
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t.ocrDetectedData}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Title / Service</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. GitHub"
                className="w-full mt-1 px-3 py-1.5 rounded-xl bg-secondary/50 border border-border/80 focus:border-primary text-xs font-medium"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Website URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com"
                className="w-full mt-1 px-3 py-1.5 rounded-xl bg-secondary/50 border border-border/80 focus:border-primary text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="octocat"
                className="w-full mt-1 px-3 py-1.5 rounded-xl bg-secondary/50 border border-border/80 focus:border-primary text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full mt-1 px-3 py-1.5 rounded-xl bg-secondary/50 border border-border/80 focus:border-primary text-xs font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-medium text-muted-foreground">Detected Password</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="P@ssw0rd123"
                className="w-full mt-1 px-3 py-1.5 rounded-xl bg-secondary/50 border border-border/80 focus:border-primary text-xs font-mono text-primary font-bold"
              />
            </div>

            {totpSecret && (
              <div className="sm:col-span-2">
                <label className="text-[11px] font-medium text-emerald-400">2FA TOTP Secret Key</label>
                <input
                  type="text"
                  value={totpSecret}
                  onChange={(e) => setTotpSecret(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-400 font-bold"
                />
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/70">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground transition-all"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleSaveToVault}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-md hover:opacity-95 active:scale-95 transition-all"
          >
            <span>{t.ocrSaveToVault}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
