import React, { useState, useEffect } from 'react';
import {
  Search,
  KeyRound,
  ShieldCheck,
  Dices,
  Sparkles,
  Lock,
  ChevronRight,
  X
} from 'lucide-react';
import type { EntrySummary } from '@/types/vault';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  entries: EntrySummary[];
  onSelectEntry: (entry: EntrySummary) => void;
  onOpenGenerator: () => void;
  onOpenSecurity: () => void;
  onToggleLofi: () => void;
  onLockVault: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  entries,
  onSelectEntry,
  onOpenGenerator,
  onOpenSecurity,
  onToggleLofi,
  onLockVault,
}) => {
  const [query, setQuery] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredEntries = query.trim()
    ? entries.filter(
        (e) =>
          e.title.toLowerCase().includes(query.toLowerCase()) ||
          e.username.toLowerCase().includes(query.toLowerCase()) ||
          e.domain.toLowerCase().includes(query.toLowerCase())
      )
    : entries.slice(0, 8);

  const totalItems = filteredEntries.length + 4; // 4 system actions

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex < filteredEntries.length) {
        onSelectEntry(filteredEntries[selectedIndex]);
        onClose();
      } else {
        const actionIdx = selectedIndex - filteredEntries.length;
        if (actionIdx === 0) onOpenGenerator();
        else if (actionIdx === 1) onOpenSecurity();
        else if (actionIdx === 2) onToggleLofi();
        else if (actionIdx === 3) onLockVault();
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-3xl bg-background border border-border shadow-2xl overflow-hidden flex flex-col">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-border/70 gap-3">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, credentials, or 2FA codes..."
            className="flex-1 bg-transparent border-none focus:outline-none text-sm font-medium text-foreground placeholder:text-muted-foreground"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto no-scrollbar p-2 flex flex-col gap-1">
          {filteredEntries.length > 0 && (
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Credentials
            </div>
          )}

          {filteredEntries.map((entry, idx) => {
            const isSelected = selectedIndex === idx;
            return (
              <div
                key={entry.id}
                onClick={() => {
                  onSelectEntry(entry);
                  onClose();
                }}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground hover:bg-secondary/70'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <KeyRound className="w-4 h-4 shrink-0 opacity-70" />
                  <span className="font-semibold truncate">{entry.title}</span>
                  <span
                    className={`font-mono text-[11px] truncate ${
                      isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                    }`}
                  >
                    {entry.username || entry.domain}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {entry.has_totp && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        isSelected ? 'bg-black/20 text-white' : 'bg-cyan-500/10 text-cyan-500'
                      }`}
                    >
                      2FA
                    </span>
                  )}
                  <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                </div>
              </div>
            );
          })}

          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-2">
            System Actions
          </div>

          <div
            onClick={() => {
              onOpenGenerator();
              onClose();
            }}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs font-medium transition-all ${
              selectedIndex === filteredEntries.length
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground hover:bg-secondary/70'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Dices className="w-4 h-4 text-purple-400" />
              <span>Open Password & Passphrase Generator</span>
            </div>
            <span className="text-[10px] font-mono opacity-60">Generator</span>
          </div>

          <div
            onClick={() => {
              onOpenSecurity();
              onClose();
            }}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs font-medium transition-all ${
              selectedIndex === filteredEntries.length + 1
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground hover:bg-secondary/70'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>View Security Health Audit Report</span>
            </div>
            <span className="text-[10px] font-mono opacity-60">Security</span>
          </div>

          <div
            onClick={() => {
              onToggleLofi();
              onClose();
            }}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs font-medium transition-all ${
              selectedIndex === filteredEntries.length + 2
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground hover:bg-secondary/70'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Toggle Cozy Lofi / Zen Mode (Soundscape)</span>
            </div>
            <span className="text-[10px] font-mono opacity-60">Zen Mode</span>
          </div>

          <div
            onClick={() => {
              onLockVault();
              onClose();
            }}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs font-medium transition-all ${
              selectedIndex === filteredEntries.length + 3
                ? 'bg-destructive text-destructive-foreground'
                : 'text-destructive hover:bg-destructive/10'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4" />
              <span>Lock Vault Now</span>
            </div>
            <span className="text-[10px] font-mono opacity-70">Ctrl+L</span>
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/70 bg-secondary/30 text-[11px] text-muted-foreground font-mono">
          <span>Navigate with ↑ ↓ · Press Enter to select</span>
          <span>Esc to exit</span>
        </div>
      </div>
    </div>
  );
};
