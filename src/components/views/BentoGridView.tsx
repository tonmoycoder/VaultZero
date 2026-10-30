import React, { useState } from 'react';
import {
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Star,
  KeyRound,
  Sparkles,
  Smartphone,
  Plus,
  RotateCcw
} from 'lucide-react';
import type { BrandInfo, DomainGroup, EntrySummary } from '@/types/vault';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { VaultApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

interface BentoGridViewProps {
  entries: EntrySummary[];
  brands: BrandInfo[];
  domainGroups: DomainGroup[];
  onSelectEntry: (entry: EntrySummary) => void;
  onEditEntry: (entry: EntrySummary) => void;
  onAddNew?: () => void;
  onClearFilter?: () => void;
}

export const BentoGridView: React.FC<BentoGridViewProps> = ({
  entries,
  brands,
  domainGroups,
  onSelectEntry,
  onAddNew,
  onClearFilter,
}) => {
  const { isBn } = useI18n();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [useFullBrandFill, setUseFullBrandFill] = useState<boolean>(true);

  const getBrandForEntry = (entry: EntrySummary): BrandInfo | undefined => {
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

  const getDomainCount = (domain: string): number => {
    const grp = domainGroups.find((g) => g.domain === domain);
    return grp ? grp.count : 1;
  };

  const handleCopySecret = async (e: React.MouseEvent, entryId: string) => {
    e.stopPropagation();
    try {
      const secret = await VaultApi.revealSecret(entryId);
      await navigator.clipboard.writeText(secret.password);
      setCopiedId(`pwd-${entryId}`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy password:', err);
    }
  };

  const handleCopyUsername = async (e: React.MouseEvent, username: string, entryId: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(username);
      setCopiedId(`user-${entryId}`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy username:', err);
    }
  };

  const handleCopyTotp = async (e: React.MouseEvent, entryId: string) => {
    e.stopPropagation();
    try {
      const totp = await VaultApi.getTotp(entryId);
      await navigator.clipboard.writeText(totp.code);
      setCopiedId(`totp-${entryId}`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy TOTP:', err);
    }
  };

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
        <div className="relative group max-w-md w-full p-8 rounded-3xl bg-card/60 backdrop-blur-2xl border border-white/10 dark:border-white/5 shadow-2xl flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary/20 via-primary/10 to-transparent border border-primary/30 flex items-center justify-center text-primary shadow-inner">
            <KeyRound className="w-8 h-8 stroke-[1.75]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">
              {isBn ? 'কোনো এন্ট্রি পাওয়া যায়নি' : 'No Credentials Found'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              {isBn
                ? 'আপনার বর্তমান ফিল্টার বা সার্চের সাথে মিলে এমন কোনো অ্যাকাউন্ট ভল্টে নেই।'
                : 'No items match your active search, brand, category, or security filter.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 pt-2 w-full">
            {onAddNew && (
              <button
                onClick={onAddNew}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md hover:opacity-95 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>{isBn ? '+ আইটেম যোগ করুন' : '+ Add Item Here'}</span>
              </button>
            )}
            {onClearFilter && (
              <button
                onClick={onClearFilter}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-secondary/80 hover:bg-secondary text-foreground text-xs font-semibold border border-border/70 hover:border-border active:scale-95 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{isBn ? 'ফিল্টার ক্লিয়ার' : 'Clear Filters'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
      {/* View Options Bar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-mono">
          Showing {entries.length} items
        </span>
        <button
          onClick={() => setUseFullBrandFill(!useFullBrandFill)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/60 transition-all"
        >
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>{useFullBrandFill ? 'Switch to Minimalist Cards' : 'Switch to Brand Color Cards'}</span>
        </button>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {entries.map((entry) => {
          const brand = getBrandForEntry(entry);
          const domainCount = getDomainCount(entry.domain);
          const brandBg = entry.brand_color || brand?.brand_color || '#3b82f6';
          const isWhiteCard = !useFullBrandFill;

          return (
            <div
              key={entry.id}
              onClick={() => onSelectEntry(entry)}
              className={`group relative rounded-2xl p-4.5 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border ${
                isWhiteCard
                  ? 'bg-card hover:bg-card/90 border-border/70 text-card-foreground shadow-sm'
                  : 'border-white/10 text-white shadow-md'
              }`}
              style={
                !isWhiteCard
                  ? {
                      backgroundColor: brandBg,
                      backgroundImage: `radial-gradient(circle at 90% 10%, rgba(255,255,255,0.18), transparent 60%)`,
                    }
                  : {}
              }
            >
              {/* Card Header: Brand Icon + Badges */}
              <div className="flex items-start justify-between gap-3">
                <BrandAvatar
                  brand={brand}
                  name={entry.title}
                  brandColor={isWhiteCard ? brandBg : 'rgba(255,255,255,0.2)'}
                  size="md"
                  className={!isWhiteCard ? 'ring-2 ring-white/30 text-white' : ''}
                />

                <div className="flex flex-col items-end gap-1">
                  {domainCount > 1 && (
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-medium ${
                        isWhiteCard
                          ? 'bg-secondary text-muted-foreground'
                          : 'bg-black/25 text-white/90 backdrop-blur-sm'
                      }`}
                    >
                      {domainCount} accounts
                    </span>
                  )}
                  {entry.favorite && (
                    <Star
                      className={`w-3.5 h-3.5 fill-current ${
                        isWhiteCard ? 'text-amber-500' : 'text-amber-300'
                      }`}
                    />
                  )}
                </div>
              </div>

              {/* Card Title & Credentials Info */}
              <div className="mt-3.5">
                <h3 className="font-bold text-base tracking-tight truncate leading-tight">
                  {entry.title}
                </h3>
                <p
                  className={`text-xs truncate font-mono mt-0.5 ${
                    isWhiteCard ? 'text-muted-foreground' : 'text-white/80'
                  }`}
                >
                  {entry.username || entry.email || 'No username'}
                </p>
              </div>

              {/* Security & Feature Badges */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-current/10 text-[11px]">
                {entry.has_totp && (
                  <span
                    className={`flex items-center gap-1 font-mono px-1.5 py-0.5 rounded ${
                      isWhiteCard
                        ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                        : 'bg-black/20 text-white'
                    }`}
                  >
                    <Smartphone className="w-3 h-3" />
                    2FA
                  </span>
                )}
                {entry.recovery_codes_count > 0 && (
                  <span
                    className={`font-mono px-1.5 py-0.5 rounded ${
                      isWhiteCard ? 'bg-secondary text-muted-foreground' : 'bg-black/20 text-white/90'
                    }`}
                  >
                    {entry.recovery_codes_count} recovery
                  </span>
                )}
                <span
                  className={`ml-auto flex items-center gap-1 text-[10px] ${
                    isWhiteCard ? 'text-muted-foreground' : 'text-white/70'
                  }`}
                >
                  <ShieldCheck className="w-3 h-3" />
                  Secured
                </span>
              </div>

              {/* Hover Quick Action Buttons */}
              <div
                className={`absolute inset-x-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-between gap-1.5 p-1 rounded-xl backdrop-blur-xl shadow-lg ${
                  isWhiteCard ? 'bg-background/95 border border-border' : 'bg-black/70 text-white'
                }`}
              >
                <button
                  onClick={(e) => handleCopyUsername(e, entry.username, entry.id)}
                  title="Copy Username"
                  className="flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 hover:bg-white/20 transition-colors"
                >
                  {copiedId === `user-${entry.id}` ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline text-[11px]">User</span>
                </button>

                <button
                  onClick={(e) => handleCopySecret(e, entry.id)}
                  title="Copy Password"
                  className="flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 hover:bg-white/20 transition-colors"
                >
                  {copiedId === `pwd-${entry.id}` ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <KeyRound className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline text-[11px]">Pass</span>
                </button>

                {entry.has_totp && (
                  <button
                    onClick={(e) => handleCopyTotp(e, entry.id)}
                    title="Copy 2FA Code"
                    className="py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 hover:bg-white/20 transition-colors"
                  >
                    {copiedId === `totp-${entry.id}` ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Smartphone className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}

                {entry.url && (
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="Open Website"
                    className="p-1.5 rounded-lg text-xs hover:bg-white/20 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

