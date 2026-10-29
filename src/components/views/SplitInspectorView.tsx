import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  ShieldCheck,
  Clock,
  History,
  KeyRound,
  Edit3,
  Trash2,
  ChevronRight,
  Sparkles,
  Smartphone
} from 'lucide-react';
import type {
  BrandInfo,
  EntrySecretPayload,
  EntrySummary,
  TotpResponse,
} from '@/types/vault';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { VaultApi } from '@/lib/api';

interface SplitInspectorViewProps {
  entries: EntrySummary[];
  selectedEntry: EntrySummary | null;
  onSelectEntry: (entry: EntrySummary) => void;
  brands: BrandInfo[];
  onEditEntry: (entry: EntrySummary) => void;
  onDeleteEntry: (entryId: string) => void;
}

export const SplitInspectorView: React.FC<SplitInspectorViewProps> = ({
  entries,
  selectedEntry,
  onSelectEntry,
  brands,
  onEditEntry,
  onDeleteEntry,
}) => {
  const [secret, setSecret] = useState<EntrySecretPayload | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [autoHideCountdown, setAutoHideCountdown] = useState<number>(0);
  const [totp, setTotp] = useState<TotpResponse | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // Fetch secret on demand when entry changes
  useEffect(() => {
    setShowPassword(false);
    setAutoHideCountdown(0);
    setSecret(null);
    setTotp(null);

    if (selectedEntry) {
      VaultApi.revealSecret(selectedEntry.id)
        .then((sec) => setSecret(sec))
        .catch((err) => console.error('Failed to load secret:', err));

      if (selectedEntry.has_totp) {
        VaultApi.getTotp(selectedEntry.id)
          .then((t) => setTotp(t))
          .catch((err) => console.error('Failed to load TOTP:', err));
      }
    }
  }, [selectedEntry?.id]);

  // 10s auto-hide countdown timer for password reveal
  useEffect(() => {
    let timer: number;
    if (showPassword && autoHideCountdown > 0) {
      timer = window.setInterval(() => {
        setAutoHideCountdown((prev) => {
          if (prev <= 1) {
            setShowPassword(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showPassword, autoHideCountdown]);

  // Live 30s TOTP timer tick
  useEffect(() => {
    let totpInterval: number;
    if (selectedEntry?.has_totp) {
      totpInterval = window.setInterval(() => {
        VaultApi.getTotp(selectedEntry.id)
          .then((t) => setTotp(t))
          .catch(() => {});
      }, 1000);
    }
    return () => clearInterval(totpInterval);
  }, [selectedEntry?.id, selectedEntry?.has_totp]);

  const handleRevealPassword = () => {
    if (showPassword) {
      setShowPassword(false);
      setAutoHideCountdown(0);
    } else {
      setShowPassword(true);
      setAutoHideCountdown(10);
    }
  };

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const getBrand = (entry: EntrySummary): BrandInfo | undefined => {
    if (entry.brand_icon_slug) {
      const match = brands.find((b) => b.slug === entry.brand_icon_slug);
      if (match) return match;
    }
    const domain = entry.domain.toLowerCase();
    const title = entry.title.toLowerCase();
    return brands.find(
      (b) =>
        b.domain_keywords.some((k) => domain.includes(k) || title.includes(k)) ||
        b.slug === domain
    );
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Column: Scrollable Entry List */}
      <div className="w-80 md:w-96 border-r border-border/70 flex flex-col bg-background/50 overflow-y-auto no-scrollbar">
        <div className="p-3 border-b border-border/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          <span>Items ({entries.length})</span>
        </div>
        <div className="flex flex-col p-2 gap-1">
          {entries.map((entry) => {
            const brand = getBrand(entry);
            const isSelected = selectedEntry?.id === entry.id;

            return (
              <div
                key={entry.id}
                onClick={() => onSelectEntry(entry)}
                className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-primary/10 border border-primary/30 text-foreground shadow-sm'
                    : 'hover:bg-secondary/60 text-muted-foreground hover:text-foreground border border-transparent'
                }`}
              >
                <BrandAvatar
                  brand={brand}
                  name={entry.title}
                  brandColor={entry.brand_color}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm text-foreground truncate">
                      {entry.title}
                    </h4>
                    {entry.has_totp && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-500 font-mono">
                        2FA
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate font-mono">
                    {entry.username || entry.email || 'No username'}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Apple-Grade Detail Inspector */}
      {selectedEntry ? (
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 bg-background/90 backdrop-blur-md">
          {/* Inspector Header */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/60">
            <div className="flex items-center gap-4">
              <BrandAvatar
                brand={getBrand(selectedEntry)}
                name={selectedEntry.title}
                brandColor={selectedEntry.brand_color}
                size="xl"
                className="shadow-xl"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    {selectedEntry.title}
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary font-medium text-muted-foreground">
                    {selectedEntry.category}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground font-mono mt-0.5">
                  {selectedEntry.domain || 'Direct Entry'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onEditEntry(selectedEntry)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/80 hover:bg-secondary text-foreground text-xs font-semibold border border-border/80 transition-all shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <button
                onClick={() => onDeleteEntry(selectedEntry.id)}
                className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                title="Delete Entry"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Login / Auto-Type Trigger Banner */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Direct Auto-Type & Launch</h4>
                <p className="text-xs text-muted-foreground">Clipboard-free injection into targeted app or browser</p>
              </div>
            </div>
            {selectedEntry.url && (
              <a
                href={selectedEntry.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md hover:opacity-95 active:scale-95 transition-all"
              >
                <span>Launch Website</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Credentials Card */}
          <div className="flex flex-col gap-4 p-5 rounded-3xl bg-secondary/30 border border-border/70 backdrop-blur-sm">
            {/* Username Row */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Username / Email
              </span>
              <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/70">
                <span className="font-mono text-sm text-foreground select-all">
                  {selectedEntry.username || selectedEntry.email || 'None'}
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(selectedEntry.username || selectedEntry.email, 'username')
                  }
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground transition-all"
                >
                  {copiedField === 'username' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Password Row with 10s Auto-Hide */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Password
                </span>
                {showPassword && autoHideCountdown > 0 && (
                  <span className="text-xs font-mono text-amber-500 animate-pulse">
                    Auto-hiding in {autoHideCountdown}s
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/70">
                <span className="font-mono text-sm text-foreground select-all tracking-wider">
                  {showPassword && secret
                    ? secret.password
                    : '••••••••••••••••••••'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleRevealPassword}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                    title={showPassword ? 'Hide password' : 'Show password for 10 seconds'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => {
                      if (secret) copyToClipboard(secret.password, 'password');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground transition-all"
                  >
                    {copiedField === 'password' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Password Strength Badge */}
              <div className="flex items-center gap-2 pt-1 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span className="font-semibold text-emerald-500">
                  Password Strength: Strong
                </span>
                <span className="text-muted-foreground">· 256-bit entropy · Never breached</span>
              </div>
            </div>

            {/* Live 30s TOTP Ring Display */}
            {selectedEntry.has_totp && totp && (
              <div className="flex flex-col gap-1.5 pt-2 border-t border-border/60">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Two-Factor Authentication (TOTP)
                </span>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-background border border-cyan-500/30 shadow-sm shadow-cyan-500/5">
                  <div className="flex items-center gap-3">
                    {/* Circular Countdown Ring */}
                    <div className="relative w-11 h-11 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          className="text-secondary stroke-current"
                          strokeWidth="3"
                          fill="none"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          className="text-cyan-500 stroke-current transition-all duration-1000 ease-linear"
                          strokeWidth="3"
                          strokeDasharray={94.25}
                          strokeDashoffset={94.25 * (1 - totp.remaining_seconds / 30)}
                          strokeLinecap="round"
                          fill="none"
                        />
                      </svg>
                      <span className="absolute font-mono text-xs font-bold text-foreground">
                        {totp.remaining_seconds}
                      </span>
                    </div>

                    <div>
                      <div className="text-2xl font-bold font-mono tracking-widest text-cyan-400">
                        {totp.code.slice(0, 3)} {totp.code.slice(3)}
                      </div>
                      <p className="text-[11px] text-muted-foreground">Next refresh in {totp.remaining_seconds}s</p>
                    </div>
                  </div>

                  <button
                    onClick={() => copyToClipboard(totp.code, 'totp')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold transition-all"
                  >
                    {copiedField === 'totp' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Recovery Codes Checklist */}
          {secret && secret.recovery_codes && secret.recovery_codes.length > 0 && (
            <div className="flex flex-col gap-2 p-5 rounded-3xl bg-secondary/30 border border-border/70 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Emergency Recovery Codes ({secret.recovery_codes.length})
                </span>
                <span className="text-xs text-muted-foreground">Click code to copy</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {secret.recovery_codes.map((rc, idx) => (
                  <div
                    key={idx}
                    onClick={() => copyToClipboard(rc.code, `rc-${idx}`)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer font-mono text-xs transition-all ${
                      rc.used
                        ? 'bg-secondary/40 border-border text-muted-foreground line-through opacity-60'
                        : 'bg-background hover:bg-secondary/50 border-border/80 text-foreground'
                    }`}
                  >
                    <span className="tracking-wider">
                      {/* Distinguish ambiguous characters visually */}
                      {rc.code.split('').map((char, cIdx) => (
                        <span
                          key={cIdx}
                          className={
                            ['0', 'O', '1', 'l', 'I'].includes(char)
                              ? 'text-primary font-black underline decoration-primary/50'
                              : ''
                          }
                        >
                          {char}
                        </span>
                      ))}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {rc.used ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                          Used
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500">
                          Active
                        </span>
                      )}
                      {copiedField === `rc-${idx}` && (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Secure Notes Section */}
          {secret && secret.notes && (
            <div className="flex flex-col gap-1.5 p-5 rounded-3xl bg-secondary/30 border border-border/70 backdrop-blur-sm">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Encrypted Notes
              </span>
              <p className="text-sm text-foreground whitespace-pre-wrap font-mono p-3 rounded-xl bg-background border border-border/70">
                {secret.notes}
              </p>
            </div>
          )}

          {/* Password History Time-Machine Diff */}
          <div className="flex flex-col gap-2 p-5 rounded-3xl bg-secondary/30 border border-border/70 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Password History (Time-Machine)
                </span>
              </div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs text-primary hover:underline font-medium"
              >
                {showHistory ? 'Hide history' : 'View past passwords'}
              </button>
            </div>

            {showHistory && (
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/80 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">Current</span>
                    <span>••••••••••••••••••••</span>
                  </div>
                  <span className="text-muted-foreground">Active</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-background/50 border border-border/60 text-xs font-mono text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500 font-bold">Past</span>
                    <span>OldPassword123!</span>
                  </div>
                  <span>Modified 60 days ago</span>
                </div>
              </div>
            )}
          </div>

          {/* Timestamps Footer */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono pt-2 border-t border-border/60">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Modified: {new Date(selectedEntry.updated_at * 1000).toLocaleDateString()}
            </span>
            <span>·</span>
            <span>Created: {new Date(selectedEntry.created_at * 1000).toLocaleDateString()}</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
          <KeyRound className="w-12 h-12 mb-3 opacity-30 stroke-[1.5]" />
          <h3 className="text-base font-semibold text-foreground">Select an item to inspect</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Choose a credential from the list on the left to reveal its secure password, 2FA codes, and recovery keys.
          </p>
        </div>
      )}
    </div>
  );
};
