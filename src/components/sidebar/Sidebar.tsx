import React from 'react';
import {
  KeyRound,
  ShieldCheck,
  Smartphone,
  FolderOpen,
  Star,
  Plus,
  Lock,
  Compass,
  Bookmark,
  FileText,
  UserCheck,
  CreditCard,
  Radio,
  FileKey,
  Dices
} from 'lucide-react';
import type { Category, EntrySummary } from '@/types/vault';

interface SidebarProps {
  selectedCategory: Category | 'All' | 'Favorites';
  onSelectCategory: (cat: Category | 'All' | 'Favorites') => void;
  activeView: 'entries' | 'security' | 'p2p' | 'generator' | 'totp';
  onSelectView: (view: 'entries' | 'security' | 'p2p' | 'generator' | 'totp') => void;
  entries: EntrySummary[];
  onAddNew: () => void;
  onOpenGenerator: () => void;
  onLockVault: () => void;
  isDuress: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedCategory,
  onSelectCategory,
  activeView,
  onSelectView,
  entries,
  onAddNew,
  onOpenGenerator,
  onLockVault,
  isDuress,
}) => {
  const getCount = (cat: Category | 'All' | 'Favorites') => {
    if (cat === 'All') return entries.length;
    if (cat === 'Favorites') return entries.filter((e) => e.favorite).length;
    return entries.filter((e) => e.category === cat).length;
  };

  const navCategories: Array<{
    id: Category | 'All' | 'Favorites';
    name: string;
    icon: React.ElementType;
  }> = [
    { id: 'All', name: 'All Items', icon: KeyRound },
    { id: 'Favorites', name: 'Favorites', icon: Star },
    { id: 'Logins', name: 'Logins', icon: UserCheck },
    { id: 'Bookmarks', name: 'Bookmarks', icon: Bookmark },
    { id: 'Safenotes', name: 'Safe Notes', icon: FileText },
    { id: 'Identities', name: 'Identities', icon: Compass },
    { id: 'Payments', name: 'Payments', icon: CreditCard },
  ];

  return (
    <aside className="w-64 border-r border-border/70 bg-sidebar/95 backdrop-blur-xl flex flex-col justify-between shrink-0 h-screen select-none transition-colors">
      <div className="flex flex-col gap-4 p-4 overflow-y-auto no-scrollbar">
        {/* Brand / Logo Title */}
        <div className="flex items-center justify-between px-2 pt-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-sm shadow-md shadow-primary/20">
              V0
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-foreground flex items-center gap-1.5">
                VaultZero
                {isDuress && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.2 rounded font-mono font-semibold">
                    DECOY
                  </span>
                )}
              </h1>
              <p className="text-[11px] text-muted-foreground font-mono">100% Zero-Cloud</p>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={onAddNew}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/25 hover:opacity-95 active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add New</span>
        </button>

        {/* Navigation Categories */}
        <div className="flex flex-col gap-1 pt-2">
          <span className="px-2.5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
            Vault Categories
          </span>
          {navCategories.map((item) => {
            const Icon = item.icon;
            const count = getCount(item.id);
            const isSelected = activeView === 'entries' && selectedCategory === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectView('entries');
                  onSelectCategory(item.id);
                }}
                className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-secondary text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span>{item.name}</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-background/80 text-muted-foreground font-mono">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tools & Security Navigation */}
        <div className="flex flex-col gap-1 pt-3">
          <span className="px-2.5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
            Tools & Security
          </span>

          <button
            onClick={() => onSelectView('generator')}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-all ${
              activeView === 'generator'
                ? 'bg-secondary text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            <Dices className="w-4 h-4 text-purple-400" />
            <span>Password Generator</span>
          </button>

          <button
            onClick={() => onSelectView('totp')}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-all ${
              activeView === 'totp'
                ? 'bg-secondary text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span>Authenticator (2FA)</span>
          </button>

          <button
            onClick={() => onSelectView('security')}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-all ${
              activeView === 'security'
                ? 'bg-secondary text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Security Center</span>
          </button>

          <button
            onClick={() => onSelectView('p2p')}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-all ${
              activeView === 'p2p'
                ? 'bg-secondary text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            <Radio className="w-4 h-4 text-blue-400" />
            <span>P2P Sync & Share</span>
          </button>
        </div>

        {/* Labels & Folders */}
        <div className="flex flex-col gap-1 pt-3">
          <span className="px-2.5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
            Folders
          </span>
          <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground rounded-lg hover:bg-secondary/40 cursor-pointer">
            <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>Personal Vault</span>
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground rounded-lg hover:bg-secondary/40 cursor-pointer">
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Work & Infra</span>
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground rounded-lg hover:bg-secondary/40 cursor-pointer">
            <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>Banking & Finance</span>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Quick Launcher */}
      <div className="p-3 border-t border-border/70 flex flex-col gap-2 bg-background/50 backdrop-blur-md">
        <button
          onClick={onOpenGenerator}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-secondary/80 hover:bg-secondary text-foreground text-xs font-semibold border border-border/70 transition-all shadow-sm"
        >
          <FileKey className="w-3.5 h-3.5 text-primary" />
          <span>Generate Password</span>
        </button>

        <button
          onClick={onLockVault}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Lock Vault (Ctrl+L)</span>
        </button>
      </div>
    </aside>
  );
};

