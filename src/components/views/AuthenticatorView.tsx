import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Copy,
  Check,
  Search,
  Plus,
} from 'lucide-react';
import type { BrandInfo, EntrySummary, TotpResponse } from '@/types/vault';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { VaultApi } from '@/lib/api';

interface AuthenticatorViewProps {
  entries: EntrySummary[];
  brands: BrandInfo[];
  onAddNew: () => void;
  onSelectEntry: (entry: EntrySummary) => void;
}

export const AuthenticatorView: React.FC<AuthenticatorViewProps> = ({
  entries,
  brands,
  onAddNew,
  onSelectEntry,
}) => {
  const [totpCodes, setTotpCodes] = useState<Record<string, TotpResponse>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState<string>('');

  const totpEntries = entries.filter((e) => e.has_totp);

  const filtered = totpEntries.filter(
    (e) =>
      e.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
      e.username.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const fetchAllTotp = () => {
    for (const e of totpEntries) {
      VaultApi.getTotp(e.id)
        .then((res) => {
          setTotpCodes((prev) => ({ ...prev, [e.id]: res }));
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    fetchAllTotp();
    const interval = window.setInterval(fetchAllTotp, 1000);
    return () => clearInterval(interval);
  }, [totpEntries.length]);

  const handleCopy = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const getBrand = (entry: EntrySummary) => {
    return brands.find((b) => b.slug === entry.brand_icon_slug || entry.domain.includes(b.slug));
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Smartphone className="w-6 h-6 text-cyan-400" />
            <span>Built-in 2FA Authenticator</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            RFC 6238 time-based one-time passcodes generated 100% offline.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter 2FA accounts..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-secondary/50 border border-border text-xs focus:outline-none"
            />
          </div>
          <button
            onClick={onAddNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add 2FA</span>
          </button>
        </div>
      </div>

      {/* Grid of 2FA Cards */}
      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
          <Smartphone className="w-12 h-12 mb-3 opacity-30 stroke-[1.5]" />
          <h3 className="text-base font-semibold text-foreground">No 2FA Accounts Configured</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Add a TOTP authenticator secret or paste an otpauth:// URL to any login to see 30s security codes here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((entry) => {
            const totp = totpCodes[entry.id];
            const remaining = totp?.remaining_seconds || 30;
            const code = totp?.code || '------';
            const brand = getBrand(entry);

            return (
              <div
                key={entry.id}
                onClick={() => onSelectEntry(entry)}
                className="p-5 rounded-3xl bg-secondary/30 hover:bg-secondary/50 border border-border/80 cursor-pointer transition-all flex flex-col justify-between gap-4 shadow-sm hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <BrandAvatar brand={brand} name={entry.title} size="md" />
                    <div>
                      <h4 className="font-bold text-sm text-foreground truncate">{entry.title}</h4>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {entry.username || entry.email || 'Account'}
                      </p>
                    </div>
                  </div>

                  {/* Circular Timer Ring */}
                  <div className="relative w-9 h-9 flex items-center justify-center shrink-0">
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
                        className="text-cyan-400 stroke-current transition-all duration-1000 ease-linear"
                        strokeWidth="3.5"
                        strokeDasharray={94.25}
                        strokeDashoffset={94.25 * (1 - remaining / 30)}
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                    <span className="absolute font-mono text-[10px] font-bold text-foreground">
                      {remaining}
                    </span>
                  </div>
                </div>

                {/* Big TOTP Code */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-background border border-cyan-500/20">
                  <span className="font-mono text-2xl font-bold tracking-widest text-cyan-400 select-all">
                    {code.slice(0, 3)} {code.slice(3)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(code, entry.id);
                    }}
                    className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground transition-all"
                    title="Copy 2FA Code"
                  >
                    {copiedId === entry.id ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
