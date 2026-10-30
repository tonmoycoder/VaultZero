import React, { useState, useMemo } from 'react';
import {
  Search,
  LayoutGrid,
  Columns,
  Sparkles,
  Lock,
  Plus,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Sun,
  Moon,
  Headphones,
  Globe,
  DownloadCloud
} from 'lucide-react';
import type { EntrySummary, SecurityAuditReport } from '@/types/vault';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { extractPublicDomain, getBrandNameFromDomain } from '@/lib/brand-fetcher';
import { useI18n } from '@/lib/i18n';
import { ZenAudioController } from '@/components/ui/ZenAudioController';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  viewMode: 'grid' | 'split';
  onViewModeChange: (m: 'grid' | 'split') => void;
  lofiActive: boolean;
  onToggleLofi: () => void;
  onLockVault: () => void;
  onOpenCommandPalette: () => void;
  onAddNew: () => void;
  entries: EntrySummary[];
  selectedBrandKey: string | null;
  onSelectBrandKey: (key: string | null) => void;
  auditReport: SecurityAuditReport | null;
  selectedFilter: 'all' | 'compromised' | 'reused' | 'weak';
  onSelectFilter: (f: 'all' | 'compromised' | 'reused' | 'weak') => void;
  currentTheme: 'light' | 'dark' | 'zen';
  onThemeChange: (t: 'light' | 'dark' | 'zen') => void;
  onOpenUpdateModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  lofiActive,
  onToggleLofi,
  onLockVault,
  onOpenCommandPalette,
  onAddNew,
  entries,
  selectedBrandKey,
  onSelectBrandKey,
  auditReport,
  selectedFilter,
  onSelectFilter,
  currentTheme,
  onThemeChange,
  onOpenUpdateModal,
}) => {
  const { t, lang, setLang } = useI18n();
  const [isZenPopoverOpen, setIsZenPopoverOpen] = useState<boolean>(false);

  // 100% Dynamic Vault-Driven Brand Extractor
  const dynamicBrands = useMemo(() => {
    const map = new Map<string, { key: string; name: string; domain: string | null; count: number }>();
    for (const entry of entries) {
      if (entry.is_deleted) continue;
      const pubDomain = extractPublicDomain(entry.url || entry.domain || '');
      if (pubDomain) {
        const brandName = getBrandNameFromDomain(pubDomain);
        const existing = map.get(pubDomain);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(pubDomain, {
            key: pubDomain,
            name: brandName,
            domain: pubDomain,
            count: 1,
          });
        }
      } else if (entry.title) {
        const key = entry.title.trim().toLowerCase();
        const existing = map.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(key, {
            key,
            name: entry.title.trim(),
            domain: null,
            count: 1,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [entries]);

  const totalActiveEntries = entries.filter((e) => !e.is_deleted).length;

  const totalIssues =
    (auditReport?.compromised_count || 0) +
    (auditReport?.reused_count || 0) +
    (auditReport?.weak_count || 0);

  const compPct = totalIssues > 0 ? ((auditReport?.compromised_count || 0) / totalIssues) * 100 : 0;
  const reusedPct = totalIssues > 0 ? ((auditReport?.reused_count || 0) / totalIssues) * 100 : 0;
  const weakPct = totalIssues > 0 ? ((auditReport?.weak_count || 0) / totalIssues) * 100 : 0;

  return (
    <header className="flex flex-col gap-3 px-6 py-3.5 border-b border-border/70 bg-background/80 backdrop-blur-2xl sticky top-0 z-30 transition-colors">
      {/* Top Controls Row */}
      <div className="flex items-center justify-between gap-3">
        {/* Search Bar with Ctrl+K trigger */}
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full pl-10 pr-20 py-2 rounded-xl bg-secondary/50 hover:bg-secondary/70 focus:bg-background border border-border/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all"
          />
          <button
            onClick={onOpenCommandPalette}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-background/90 border border-border text-[11px] font-mono text-muted-foreground shadow-sm hover:text-foreground transition-colors"
          >
            ⌘K
          </button>
        </div>

        {/* Right Action Icons & Controls */}
        <div className="flex items-center gap-2 relative">
          {/* Add New Button */}
          <button
            onClick={onAddNew}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md hover:opacity-95 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{t.newItem}</span>
          </button>

          {/* Bilingual Language Switcher (বাংলা | EN) */}
          <button
            onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            title={lang === 'bn' ? 'Switch to English' : 'বাংলায় পরিবর্তন করুন'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-secondary/60 hover:bg-secondary border border-border/70 text-xs font-semibold text-foreground transition-all shadow-sm"
          >
            <Globe className="w-3.5 h-3.5 text-primary" />
            <span>{lang === 'bn' ? 'বাংলা' : 'EN'}</span>
          </button>

          {/* Theme Switcher: Light | Dark | Zen Lofi */}
          <div className="flex items-center p-1 rounded-xl bg-secondary/60 border border-border/70">
            <button
              onClick={() => onThemeChange('light')}
              title={t.themeLight}
              className={`p-1.5 rounded-lg transition-all ${
                currentTheme === 'light'
                  ? 'bg-amber-100 text-amber-700 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onThemeChange('dark')}
              title={t.themeDark}
              className={`p-1.5 rounded-lg transition-all ${
                currentTheme === 'dark'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onThemeChange('zen')}
              title={t.themeZen}
              className={`p-1.5 rounded-lg transition-all ${
                currentTheme === 'zen'
                  ? 'bg-amber-500/30 text-amber-300 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Headphones className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Cozy Zen Lofi Audio Controller Button */}
          <div className="relative">
            <button
              onClick={() => setIsZenPopoverOpen(!isZenPopoverOpen)}
              title={t.zenMode}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                lofiActive
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm shadow-amber-500/10'
                  : 'bg-secondary/40 border-border/70 text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${lofiActive ? 'animate-pulse text-amber-400' : ''}`} />
              <span className="hidden sm:inline">{t.zenMode}</span>
            </button>

            {/* Zen Audio Floating Popover */}
            <ZenAudioController
              isOpen={isZenPopoverOpen}
              onClose={() => setIsZenPopoverOpen(false)}
              isZenActive={lofiActive}
              onToggleZen={onToggleLofi}
            />
          </div>

          {/* Grid vs Split View Toggle */}
          <div className="flex items-center bg-secondary/50 p-1 rounded-xl border border-border/70">
            <button
              onClick={() => onViewModeChange('grid')}
              title="Bento Grid View"
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onViewModeChange('split')}
              title="Split Inspector View"
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'split'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Auto-Updater Check Button */}
          {onOpenUpdateModal && (
            <button
              onClick={onOpenUpdateModal}
              title={t.checkUpdates}
              className="p-1.5 rounded-xl bg-secondary/40 border border-border/70 text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-all"
            >
              <DownloadCloud className="w-3.5 h-3.5 text-primary" />
            </button>
          )}

          {/* Lock Vault */}
          <button
            onClick={onLockVault}
            title={t.lockVault + ' (Ctrl+L)'}
            className="p-1.5 rounded-xl bg-secondary/40 border border-border/70 text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/10 transition-all"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 100% Dynamic Vault-Driven Brand Bar (Hardcoded list completely removed) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
        <button
          onClick={() => onSelectBrandKey(null)}
          className={`px-3 py-1 rounded-full font-medium shrink-0 transition-all ${
            selectedBrandKey === null
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/60'
          }`}
        >
          {t.allBrands} ({totalActiveEntries})
        </button>

        {dynamicBrands.map((b) => {
          const isSelected = selectedBrandKey === b.key;
          return (
            <button
              key={b.key}
              onClick={() => onSelectBrandKey(isSelected ? null : b.key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium shrink-0 border transition-all ${
                isSelected
                  ? 'bg-primary/20 border-primary text-primary font-bold shadow-sm'
                  : 'bg-secondary/40 hover:bg-secondary/80 border-border/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              <BrandAvatar
                domain={b.domain}
                name={b.name}
                size="sm"
                className="w-4 h-4 rounded-full text-[9px]"
              />
              <span>{b.name}</span>
              <span className="text-[10px] opacity-75 font-mono">({b.count})</span>
            </button>
          );
        })}
      </div>

      {/* Defender-Style Interactive Security Health Bar */}
      {auditReport && auditReport.total_entries > 0 && (
        <div className="flex flex-col gap-2 p-2.5 rounded-2xl bg-secondary/25 border border-border/60 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${auditReport.overall_security_score > 75 ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                {t.securityScore}
              </span>
              <span className="text-muted-foreground">· {t.auditPassed}</span>
            </div>
            <div className="text-xs font-mono font-bold text-foreground">
              {auditReport.overall_security_score}%
            </div>
          </div>

          {/* Proportional 3-Color Bar */}
          <div className="w-full h-1.5 rounded-full bg-muted/60 overflow-hidden flex shadow-inner">
            {totalIssues === 0 ? (
              <div className="h-full w-full bg-emerald-500" />
            ) : (
              <>
                {compPct > 0 && (
                  <div
                    style={{ width: `${compPct}%` }}
                    className="h-full bg-red-500 transition-all duration-500"
                  />
                )}
                {reusedPct > 0 && (
                  <div
                    style={{ width: `${reusedPct}%` }}
                    className="h-full bg-purple-500 transition-all duration-500"
                  />
                )}
                {weakPct > 0 && (
                  <div
                    style={{ width: `${weakPct}%` }}
                    className="h-full bg-amber-500 transition-all duration-500"
                  />
                )}
              </>
            )}
          </div>

          {/* Interactive Stat Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
            {auditReport.compromised_count > 0 && (
              <button
                onClick={() => onSelectFilter(selectedFilter === 'compromised' ? 'all' : 'compromised')}
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-[11px] transition-all ${
                  selectedFilter === 'compromised'
                    ? 'bg-red-500/25 border-red-500 text-red-400 font-bold'
                    : 'bg-red-500/10 border-red-500/20 text-red-400/90 hover:bg-red-500/20'
                }`}
              >
                <ShieldAlert className="w-3 h-3 text-red-500" />
                <span>
                  <strong>{auditReport.compromised_count}</strong> {t.compromisedCount}
                </span>
              </button>
            )}

            {auditReport.reused_count > 0 && (
              <button
                onClick={() => onSelectFilter(selectedFilter === 'reused' ? 'all' : 'reused')}
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-[11px] transition-all ${
                  selectedFilter === 'reused'
                    ? 'bg-purple-500/25 border-purple-500 text-purple-400 font-bold'
                    : 'bg-purple-500/10 border-purple-500/20 text-purple-400/90 hover:bg-purple-500/20'
                }`}
              >
                <RefreshCw className="w-3 h-3 text-purple-400" />
                <span>
                  <strong>{auditReport.reused_count}</strong> {t.reusedCount}
                </span>
              </button>
            )}

            {auditReport.weak_count > 0 && (
              <button
                onClick={() => onSelectFilter(selectedFilter === 'weak' ? 'all' : 'weak')}
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-[11px] transition-all ${
                  selectedFilter === 'weak'
                    ? 'bg-amber-500/25 border-amber-500 text-amber-400 font-bold'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400/90 hover:bg-amber-500/20'
                }`}
              >
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>
                  <strong>{auditReport.weak_count}</strong> {t.weakCount}
                </span>
              </button>
            )}

            {selectedFilter !== 'all' && (
              <button
                onClick={() => onSelectFilter('all')}
                className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 ml-auto"
              >
                {t.clearFilters}
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
