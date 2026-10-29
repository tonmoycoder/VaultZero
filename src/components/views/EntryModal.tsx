import React, { useState, useEffect } from 'react';
import {
  X,
  Eye,
  EyeOff,
  Dices,
  Plus,
  Trash2,
  Star,
  Smartphone
} from 'lucide-react';
import type {
  BrandInfo,
  Category,
  Entry,
  EntrySecretPayload,
  EntrySummary,
  RecoveryCode,
} from '@/types/vault';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { VaultApi } from '@/lib/api';

interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entryToEdit?: EntrySummary | null;
  brands: BrandInfo[];
  onSaved: (summary: EntrySummary) => void;
  onOpenGenerator: () => void;
}

export const EntryModal: React.FC<EntryModalProps> = ({
  isOpen,
  onClose,
  entryToEdit,
  brands,
  onSaved,
  onOpenGenerator,
}) => {
  const [title, setTitle] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [category, setCategory] = useState<Category>('Logins');
  const [notes, setNotes] = useState<string>('');
  const [favorite, setFavorite] = useState<boolean>(false);
  const [totpSecret, setTotpSecret] = useState<string>('');
  const [recoveryCodes, setRecoveryCodes] = useState<RecoveryCode[]>([]);
  const [newCodeInput, setNewCodeInput] = useState<string>('');

  // Auto-detected Brand
  const [detectedBrand, setDetectedBrand] = useState<BrandInfo | null>(null);

  useEffect(() => {
    if (entryToEdit) {
      setTitle(entryToEdit.title);
      setUrl(entryToEdit.url);
      setUsername(entryToEdit.username);
      setEmail(entryToEdit.email);
      setCategory(entryToEdit.category);
      setFavorite(entryToEdit.favorite);

      VaultApi.revealSecret(entryToEdit.id)
        .then((sec: EntrySecretPayload) => {
          setPassword(sec.password);
          setNotes(sec.notes);
          setRecoveryCodes(sec.recovery_codes || []);
        })
        .catch((err) => console.error(err));
    } else {
      setTitle('');
      setUrl('');
      setUsername('');
      setEmail('');
      setPassword('');
      setCategory('Logins');
      setNotes('');
      setFavorite(false);
      setTotpSecret('');
      setRecoveryCodes([]);
    }
  }, [entryToEdit, isOpen]);

  // Brand detection based on Title or URL
  useEffect(() => {
    const text = `${title} ${url}`.toLowerCase();
    const match = brands.find((b) =>
      b.domain_keywords.some((kw) => text.includes(kw.toLowerCase())) ||
      text.includes(b.slug)
    );
    setDetectedBrand(match || null);
  }, [title, url, brands]);

  const handleAddRecoveryCode = () => {
    if (!newCodeInput.trim()) return;
    setRecoveryCodes([...recoveryCodes, { code: newCodeInput.trim(), used: false }]);
    setNewCodeInput('');
  };

  const handleRemoveRecoveryCode = (idx: number) => {
    setRecoveryCodes(recoveryCodes.filter((_, i) => i !== idx));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const entryId = entryToEdit ? entryToEdit.id : crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    const fullEntry: Entry = {
      id: entryId,
      title: title.trim(),
      url: url.trim(),
      username: username.trim(),
      email: email.trim(),
      password: password,
      notes: notes.trim(),
      folder_id: null,
      category,
      tags: [],
      favorite,
      brand_color: detectedBrand?.brand_color || null,
      brand_icon_slug: detectedBrand?.slug || null,
      custom_icon_base64: null,
      totp_config: totpSecret.trim()
        ? {
            secret: totpSecret.trim().replace(/\s/g, '').toUpperCase(),
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
          }
        : null,
      recovery_codes: recoveryCodes,
      last_autofill: null,
      created_at: entryToEdit ? entryToEdit.created_at : now,
      updated_at: now,
      password_history: [],
      hlc_timestamp: Date.now() * 1000,
      device_id: 'local-desktop',
      is_deleted: false,
    };

    try {
      const summary = await VaultApi.upsertEntry(fullEntry);
      onSaved(summary);
      onClose();
    } catch (err) {
      console.error('Failed to save entry:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto no-scrollbar rounded-3xl bg-background border border-border shadow-2xl p-6 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/70">
          <div className="flex items-center gap-3">
            <BrandAvatar
              brand={detectedBrand}
              name={title || 'New Item'}
              brandColor={detectedBrand?.brand_color}
              size="lg"
            />
            <div>
              <h3 className="font-bold text-lg text-foreground">
                {entryToEdit ? 'Edit Credential' : 'Create New Credential'}
              </h3>
              <p className="text-xs text-muted-foreground font-mono">
                {detectedBrand ? `Detected: ${detectedBrand.name}` : 'Local encrypted storage'}
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

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* Category Selector */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 text-xs">
            {(['Logins', 'Bookmarks', 'Safenotes', 'Identities', 'Payments'] as Category[]).map(
              (cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full font-medium shrink-0 border transition-all ${
                    category === cat
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-secondary/50 text-muted-foreground hover:text-foreground border-border/70'
                  }`}
                >
                  {cat}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => setFavorite(!favorite)}
              className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                favorite
                  ? 'bg-amber-500/10 border-amber-500 text-amber-500 font-semibold'
                  : 'bg-secondary/50 border-border text-muted-foreground'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${favorite ? 'fill-current' : ''}`} />
              <span>Favorite</span>
            </button>
          </div>

          {/* Title & Website */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">Service Name / Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. GitHub, Google, Amazon..."
                className="p-2.5 rounded-xl bg-secondary/40 border border-border focus:border-primary focus:outline-none text-sm font-medium"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">Website URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/login"
                className="p-2.5 rounded-xl bg-secondary/40 border border-border focus:border-primary focus:outline-none text-sm font-mono"
              />
            </div>
          </div>

          {/* Username & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="johndoe"
                className="p-2.5 rounded-xl bg-secondary/40 border border-border focus:border-primary focus:outline-none text-sm font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="p-2.5 rounded-xl bg-secondary/40 border border-border focus:border-primary focus:outline-none text-sm font-mono"
              />
            </div>
          </div>

          {/* Password with inline generator trigger */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">Password</label>
              <button
                type="button"
                onClick={onOpenGenerator}
                className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
              >
                <Dices className="w-3.5 h-3.5" />
                <span>Open Generator</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter or generate a strong password"
                className="w-full p-2.5 pr-20 rounded-xl bg-secondary/40 border border-border focus:border-primary focus:outline-none text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 2FA/TOTP Secret */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-cyan-500" />
              <span>2FA / TOTP Authenticator Key (Base32)</span>
            </label>
            <input
              type="text"
              value={totpSecret}
              onChange={(e) => setTotpSecret(e.target.value)}
              placeholder="e.g. JBSWY3DPEHPK3PXP or otpauth://totp/..."
              className="p-2.5 rounded-xl bg-secondary/40 border border-border focus:border-primary focus:outline-none text-sm font-mono uppercase"
            />
          </div>

          {/* Dynamic Recovery Codes List */}
          <div className="flex flex-col gap-2 p-4 rounded-2xl bg-secondary/30 border border-border">
            <span className="text-xs font-semibold text-foreground">
              Emergency Backup / Recovery Codes
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newCodeInput}
                onChange={(e) => setNewCodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddRecoveryCode();
                  }
                }}
                placeholder="Enter recovery code (e.g. 1A2B-3C4D)"
                className="flex-1 p-2 rounded-xl bg-background border border-border text-xs font-mono"
              />
              <button
                type="button"
                onClick={handleAddRecoveryCode}
                className="px-3 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Code</span>
              </button>
            </div>

            {recoveryCodes.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {recoveryCodes.map((rc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-background border border-border text-xs font-mono"
                  >
                    <span>{rc.code}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRecoveryCode(idx)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Secure Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Encrypted Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Store API tokens, security question answers, or pin codes..."
              className="p-2.5 rounded-xl bg-secondary/40 border border-border focus:border-primary focus:outline-none text-sm font-mono resize-none"
            />
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/70">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-md hover:opacity-95 active:scale-95 transition-all"
            >
              Save to Vault
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
