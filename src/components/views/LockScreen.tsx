import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  FileKey,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';
import { VaultApi } from '@/lib/api';

interface LockScreenProps {
  onUnlocked: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlocked }) => {
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [duressPassword, setDuressPassword] = useState<string>('');
  const [showDuressSetup, setShowDuressSetup] = useState<boolean>(false);
  const [keyfileName, setKeyfileName] = useState<string | null>(null);
  const [keyfileContent, setKeyfileContent] = useState<string | undefined>(undefined);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleKeyfileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setKeyfileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        setKeyfileContent(reader.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isCreating) {
        if (password.length < 4) {
          throw new Error('Master password must be at least 4 characters');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        await VaultApi.createVault(
          password,
          keyfileContent,
          duressPassword.trim() ? duressPassword.trim() : undefined
        );
      } else {
        await VaultApi.unlock(password, keyfileContent);
      }
      onUnlocked();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-2xl">
      <div className="w-full max-w-md p-8 rounded-3xl bg-card border border-border/80 shadow-2xl flex flex-col gap-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-black text-xl shadow-lg shadow-primary/25">
            {isCreating ? <Sparkles className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {isCreating ? 'Initialize New Vault' : 'VaultZero'}
          </h2>
          <p className="text-xs text-muted-foreground font-mono">
            {isCreating
              ? 'Zero-Knowledge Argon2id + XChaCha20-Poly1305'
              : 'Enter your master credentials to decrypt local storage'}
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Unlock / Create Form */}
        <form onSubmit={handleUnlock} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">
              Master Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter master password"
                className="w-full p-3 pr-10 rounded-xl bg-secondary/50 border border-border focus:border-primary focus:outline-none text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isCreating && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">
                Confirm Master Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm master password"
                className="w-full p-3 rounded-xl bg-secondary/50 border border-border focus:border-primary focus:outline-none text-sm font-mono"
              />
            </div>
          )}

          {/* Optional Keyfile Upload */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border text-xs">
            <div className="flex items-center gap-2 truncate">
              <FileKey className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate text-muted-foreground">
                {keyfileName ? keyfileName : 'Optional Keyfile'}
              </span>
            </div>
            <label className="cursor-pointer text-xs font-semibold text-primary hover:underline shrink-0">
              Browse
              <input
                type="file"
                onChange={handleKeyfileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Optional Duress Password Setup */}
          {isCreating && (
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDuressSetup(!showDuressSetup)}
                className="text-xs text-amber-500 font-semibold hover:underline text-left"
              >
                {showDuressSetup ? 'Hide Decoy Duress Vault' : '+ Configure Coercion / Decoy Duress Password'}
              </button>

              {showDuressSetup && (
                <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                  <label className="font-semibold text-amber-500">
                    Secondary Duress Password (Decoy)
                  </label>
                  <input
                    type="password"
                    value={duressPassword}
                    onChange={(e) => setDuressPassword(e.target.value)}
                    placeholder="Unlocks a convincing fake vault under duress"
                    className="p-2.5 rounded-lg bg-background border border-amber-500/30 text-xs font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Entering this password at unlock presents an isolated empty or decoy vault to protect your real vault in physical extortion scenarios.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/25 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? (
              <span>Calibrating Argon2id...</span>
            ) : isCreating ? (
              <>
                <span>Create & Encrypt Vault</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4" />
                <span>Decrypt & Unlock Vault</span>
              </>
            )}
          </button>
        </form>

        {/* Toggle between Create & Unlock */}
        <div className="flex items-center justify-center pt-2 border-t border-border/70 text-xs text-muted-foreground">
          {isCreating ? (
            <button
              onClick={() => {
                setIsCreating(false);
                setError(null);
              }}
              className="hover:text-foreground font-medium underline underline-offset-4"
            >
              Already have a vault? Unlock existing vault
            </button>
          ) : (
            <button
              onClick={() => {
                setIsCreating(true);
                setError(null);
              }}
              className="hover:text-foreground font-medium underline underline-offset-4"
            >
              First time? Create a new encrypted vault
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
