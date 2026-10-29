import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import type { BrandInfo, EntrySummary, SecurityAuditReport } from '@/types/vault';
import { BrandAvatar } from '@/components/ui/BrandAvatar';

interface SecurityCenterViewProps {
  auditReport: SecurityAuditReport | null;
  entries: EntrySummary[];
  brands: BrandInfo[];
  onSelectEntry: (entry: EntrySummary) => void;
  onRefreshAudit: () => void;
}

export const SecurityCenterView: React.FC<SecurityCenterViewProps> = ({
  auditReport,
  entries,
  brands,
  onSelectEntry,
  onRefreshAudit,
}) => {
  if (!auditReport) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
        <ShieldCheck className="w-12 h-12 mb-3 text-muted-foreground animate-pulse" />
        <h3 className="text-base font-semibold text-foreground">Running Security Audit...</h3>
      </div>
    );
  }

  const compromisedEntries = entries.filter((e) =>
    auditReport.compromised_ids.includes(e.id)
  );
  const reusedEntries = entries.filter((e) =>
    auditReport.reused_ids.includes(e.id)
  );
  const weakEntries = entries.filter((e) =>
    auditReport.weak_ids.includes(e.id)
  );

  const getBrand = (entry: EntrySummary) => {
    return brands.find((b) => b.slug === entry.brand_icon_slug || entry.domain.includes(b.slug));
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 max-w-5xl mx-auto w-full">
      {/* Top Banner & Security Score */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6 rounded-3xl bg-secondary/30 border border-border/80 backdrop-blur-md">
        <div className="flex items-center gap-5">
          <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="15"
                className="text-secondary stroke-current"
                strokeWidth="3.5"
                fill="none"
              />
              <circle
                cx="18"
                cy="18"
                r="15"
                className={`stroke-current transition-all duration-1000 ${
                  auditReport.overall_security_score >= 80
                    ? 'text-emerald-500'
                    : auditReport.overall_security_score >= 50
                    ? 'text-amber-500'
                    : 'text-red-500'
                }`}
                strokeWidth="3.5"
                strokeDasharray={94.25}
                strokeDashoffset={94.25 * (1 - auditReport.overall_security_score / 100)}
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="font-extrabold text-lg font-mono text-foreground leading-none">
                {auditReport.overall_security_score}%
              </span>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">
                Score
              </span>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Offline Vault Security Center
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              Zero-knowledge entropy and credential reuse scanner. All calculations execute 100% in local memory without leaving your computer.
            </p>
          </div>
        </div>

        <button
          onClick={onRefreshAudit}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-md hover:opacity-95 active:scale-95 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Re-Audit Vault</span>
        </button>
      </div>

      {/* 3 Interactive Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Compromised Passwords */}
        <div className="p-5 rounded-3xl bg-red-500/10 border border-red-500/20 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <span className="text-2xl font-mono font-bold text-red-400">
              {auditReport.compromised_count}
            </span>
          </div>
          <div>
            <h4 className="font-bold text-sm text-foreground">Known-Breached Passwords</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Found in universal public data breach lists. Change these immediately!
            </p>
          </div>
        </div>

        {/* Reused Passwords */}
        <div className="p-5 rounded-3xl bg-purple-500/10 border border-purple-500/20 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <RefreshCw className="w-5 h-5" />
            </div>
            <span className="text-2xl font-mono font-bold text-purple-400">
              {auditReport.reused_count}
            </span>
          </div>
          <div>
            <h4 className="font-bold text-sm text-foreground">Reused Passwords</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Used across multiple services. If one site leaks, others are at risk.
            </p>
          </div>
        </div>

        {/* Weak Passwords */}
        <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-2xl font-mono font-bold text-amber-400">
              {auditReport.weak_count}
            </span>
          </div>
          <div>
            <h4 className="font-bold text-sm text-foreground">Weak / Short Passwords</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Less than 8 characters or low entropy. Prone to fast brute-force.
            </p>
          </div>
        </div>
      </div>

      {/* Actionable Remediation List */}
      <div className="flex flex-col gap-4">
        <h3 className="font-bold text-base text-foreground flex items-center gap-2">
          <span>Priority Remediation Items</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary font-mono text-muted-foreground">
            {compromisedEntries.length + reusedEntries.length + weakEntries.length} items
          </span>
        </h3>

        {compromisedEntries.length === 0 && reusedEntries.length === 0 && weakEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 rounded-3xl bg-secondary/20 border border-border text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
            <h4 className="font-semibold text-sm text-foreground">All Clear!</h4>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              Every credential in your vault is unique, strong, and uncompromised.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {compromisedEntries.map((e) => (
              <div
                key={`comp-${e.id}`}
                onClick={() => onSelectEntry(e)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 cursor-pointer hover:bg-red-500/15 transition-all"
              >
                <div className="flex items-center gap-3">
                  <BrandAvatar brand={getBrand(e)} name={e.title} size="md" />
                  <div>
                    <h5 className="font-semibold text-sm text-foreground">{e.title}</h5>
                    <p className="text-xs text-red-400 font-mono">Known breached password</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-red-400">
                  <span>Change Now</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            ))}

            {reusedEntries.map((e) => (
              <div
                key={`reused-${e.id}`}
                onClick={() => onSelectEntry(e)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 cursor-pointer hover:bg-purple-500/15 transition-all"
              >
                <div className="flex items-center gap-3">
                  <BrandAvatar brand={getBrand(e)} name={e.title} size="md" />
                  <div>
                    <h5 className="font-semibold text-sm text-foreground">{e.title}</h5>
                    <p className="text-xs text-purple-400 font-mono">Password reused elsewhere</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-purple-400">
                  <span>Make Unique</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            ))}

            {weakEntries.map((e) => (
              <div
                key={`weak-${e.id}`}
                onClick={() => onSelectEntry(e)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 cursor-pointer hover:bg-amber-500/15 transition-all"
              >
                <div className="flex items-center gap-3">
                  <BrandAvatar brand={getBrand(e)} name={e.title} size="md" />
                  <div>
                    <h5 className="font-semibold text-sm text-foreground">{e.title}</h5>
                    <p className="text-xs text-amber-400 font-mono">Weak / Low entropy password</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                  <span>Strengthen</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
