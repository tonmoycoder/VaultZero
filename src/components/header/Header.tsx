import React from 'react';
import {
  Search,
  LayoutGrid,
  Columns,
  Sparkles,
  Lock,
  Volume2,
  VolumeX,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Plus
} from 'lucide-react';
import type { BrandInfo, SecurityAuditReport } from '@/types/vault';
import { BrandAvatar } from '@/components/ui/BrandAvatar';

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
  brands: BrandInfo[];
  selectedBrandSlug: string | null;
  onSelectBrandSlug: (slug: string | null) => void;
  auditReport: SecurityAuditReport | null;
  selectedFilter: 'all' | 'compromised' | 'reused' | 'weak';
  onSelectFilter: (f: 'all' | 'compromised' | 'reused' | 'weak') => void;
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
  brands,
  selectedBrandSlug,
  onSelectBrandSlug,
  auditReport,
  selectedFilter,
  onSelectFilter,
}) => {
  // Compute proportional percentages for 3-color health bar
  const totalIssues = (auditReport?.compromised_count || 0) +
    (auditReport?.reused_count || 0) +
    (auditReport?.weak_count || 0);

  const compPct = totalIssues > 0 ? ((auditReport?.compromised_count || 0) / totalIssues) * 100 : 0;
  const reusedPct = totalIssues > 0 ? ((auditReport?.reused_count || 0) / totalIssues) * 100 : 0;
  const weakPct = totalIssues > 0 ? ((auditReport?.weak_count || 0) / totalIssues) * 100 : 0;

  return (
    <header className="flex flex-col gap-3 px-6 py-4 border-b border-border/60 bg-background/80 backdrop-blur-xl sticky top-0 z-30 transition-colors">
      {/* Top Action Row */}
      <div className="flex items-center justify-between gap-4">
        {/* Search Bar with Ctrl+K trigger */}
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search credentials, usernames, websites, or tags..."
            className="w-full pl-10 pr-20 py-2 rounded-xl bg-secondary/50 hover:bg-secondary/70 focus:bg-background border border-border/80 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all"
          />
          <button
            onClick={onOpenCommandPalette}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-background/90 border border-border text-[11px] font-mono text-muted-foreground shadow-sm hover:text-foreground transition-colors"
          >
            ⌘K / Ctrl+K
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Add New Button */}
          <button
            onClick={onAddNew}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm shadow-md hover:opacity-95 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add New</span>
          </button>

          {/* Cozy Lofi Mode Toggle */}
          <button
            onClick={onToggleLofi}
            title={lofiActive ? 'Turn off Cozy Lofi Mode' : 'Turn on Cozy Lofi Zen Mode'}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
              lofiActive
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 shadow-sm shadow-amber-500/10'
                : 'bg-secondary/40 border-border/80 text-muted-foreground hover:text-foreground hover:bg-secondary/70'
            }`}
          >
            <Sparkles className={`w-4 h-4 ${lofiActive ? 'animate-pulse text-amber-400' : ''}`} />
            <span className="hidden sm:inline">Zen Mode</span>
            {lofiActive ? (
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 opacity-50" />
            )}
          </button>

          {/* Grid vs Split View Toggle */}
          <div className="flex items-center bg-secondary/50 p-1 rounded-xl border border-border/80">
            <button
              onClick={() => onViewModeChange('grid')}
              title="Brand Bento Grid View"
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('split')}
              title="Split-Pane Inspector View"
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'split'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Columns className="w-4 h-4" />
            </button>
          </div>

          {/* Lock Vault */}
          <button
            onClick={onLockVault}
            title="Lock Vault (Ctrl+L)"
            className="p-2 rounded-xl bg-secondary/40 border border-border/80 text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/10 transition-all"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Brand Quick-Filter Pill Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
        <button
          onClick={() => onSelectBrandSlug(null)}
          className={`px-3 py-1.5 rounded-full font-medium shrink-0 transition-all ${
            selectedBrandSlug === null
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/60'
          }`}
        >
          All Brands
        </button>
        {brands.map((b) => {
          const isSelected = selectedBrandSlug === b.slug;
          return (
            <button
              key={b.slug}
              onClick={() => onSelectBrandSlug(isSelected ? null : b.slug)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-medium shrink-0 border transition-all ${
                isSelected
                  ? 'bg-primary/15 border-primary text-primary shadow-sm'
                  : 'bg-secondary/40 hover:bg-secondary/80 border-border/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              <BrandAvatar brand={b} size="sm" className="w-4 h-4 rounded-full text-[9px]" />
              <span>{b.name}</span>
            </button>
          );
        })}
      </div>

      {/* Defender-Style 3-Color Security Health Bar */}
      {auditReport && auditReport.total_entries > 0 && (
        <div className="flex flex-col gap-2 p-3 rounded-2xl bg-secondary/30 border border-border/70 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Security Health
              </span>
              <span className="text-muted-foreground">· Last checked just now</span>
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              Score: <span className="font-bold text-foreground">{auditReport.overall_security_score}%</span>
            </div>
          </div>

          {/* Proportional 3-Color Bar */}
          <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden flex shadow-inner">
            {totalIssues === 0 ? (
              <div className="h-full w-full bg-emerald-500" title="All passwords safe" />
            ) : (
              <>
                {compPct > 0 && (
                  <div
                    style={{ width: `${compPct}%` }}
                    className="h-full bg-red-500 transition-all duration-500"
                    title={`Compromised: ${auditReport.compromised_count}`}
                  />
                )}
                {reusedPct > 0 && (
                  <div
                    style={{ width: `${reusedPct}%` }}
                    className="h-full bg-purple-500 transition-all duration-500"
                    title={`Reused: ${auditReport.reused_count}`}
                  />
                )}
                {weakPct > 0 && (
                  <div
                    style={{ width: `${weakPct}%` }}
                    className="h-full bg-amber-500 transition-all duration-500"
                    title={`Weak: ${auditReport.weak_count}`}
                  />
                )}
              </>
            )}
          </div>

          {/* Interactive Stat Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <button
              onClick={() => onSelectFilter(selectedFilter === 'compromised' ? 'all' : 'compromised')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                selectedFilter === 'compromised'
                  ? 'bg-red-500/20 border-red-500 text-red-400 font-medium'
                  : 'bg-red-500/10 border-red-500/20 text-red-400/90 hover:bg-red-500/20'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
              <span>
                <strong>{auditReport.compromised_count}</strong> compromised passwords
              </span>
            </button>

            <button
              onClick={() => onSelectFilter(selectedFilter === 'reused' ? 'all' : 'reused')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                selectedFilter === 'reused'
                  ? 'bg-purple-500/20 border-purple-500 text-purple-400 font-medium'
                  : 'bg-purple-500/10 border-purple-500/20 text-purple-400/90 hover:bg-purple-500/20'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
              <span>
                <strong>{auditReport.reused_count}</strong> reused passwords
              </span>
            </button>

            <button
              onClick={() => onSelectFilter(selectedFilter === 'weak' ? 'all' : 'weak')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                selectedFilter === 'weak'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400 font-medium'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400/90 hover:bg-amber-500/20'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>
                <strong>{auditReport.weak_count}</strong> weak passwords
              </span>
            </button>

            {selectedFilter !== 'all' && (
              <button
                onClick={() => onSelectFilter('all')}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 ml-auto"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

