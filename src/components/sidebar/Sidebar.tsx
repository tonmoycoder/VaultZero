import React, { useState } from 'react';
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
  Dices,
  Trash2,
  Check,
  X
} from 'lucide-react';
import type { Category, EntrySummary, Folder } from '@/types/vault';
import { useI18n } from '@/lib/i18n';

interface SidebarProps {
  selectedCategory: Category | 'All' | 'Favorites';
  onSelectCategory: (cat: Category | 'All' | 'Favorites') => void;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  folders: Folder[];
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  activeView: 'entries' | 'security' | 'p2p' | 'generator' | 'totp';
  onSelectView: (view: 'entries' | 'security' | 'p2p' | 'generator' | 'totp') => void;
  entries: EntrySummary[];
  onAddNew: () => void;
  onOpenGenerator: () => void;
  onOpenEmergencyKit: () => void;
  onLockVault: () => void;
  isDuress: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedCategory,
  onSelectCategory,
  selectedFolderId,
  onSelectFolder,
  folders,
  onCreateFolder,
  onDeleteFolder,
  activeView,
  onSelectView,
  entries,
  onAddNew,
  onOpenGenerator,
  onOpenEmergencyKit,
  onLockVault,
  isDuress,
}) => {
  const { t, lang } = useI18n();
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');

  const getCategoryCount = (cat: Category | 'All' | 'Favorites') => {
    if (cat === 'All') return entries.filter((e) => !e.is_deleted).length;
    if (cat === 'Favorites') return entries.filter((e) => !e.is_deleted && e.favorite).length;
    return entries.filter((e) => !e.is_deleted && e.category === cat).length;
  };

  const getFolderCount = (folderId: string) => {
    return entries.filter((e) => !e.is_deleted && e.folder_id === folderId).length;
  };

  const navCategories: Array<{
    id: Category | 'All' | 'Favorites';
    name: string;
    icon: React.ElementType;
  }> = [
    { id: 'All', name: t.allItems, icon: KeyRound },
    { id: 'Favorites', name: t.favorites, icon: Star },
    { id: 'Logins', name: t.logins, icon: UserCheck },
    { id: 'Bookmarks', name: t.bookmarks, icon: Bookmark },
    { id: 'Safenotes', name: t.safeNotes, icon: FileText },
    { id: 'Identities', name: t.identities, icon: Compass },
    { id: 'Payments', name: t.payments, icon: CreditCard },
  ];

  const handleCreateFolderSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  return (
    <aside className="w-64 border-r border-border/70 bg-card/60 backdrop-blur-2xl flex flex-col justify-between shrink-0 h-screen select-none transition-colors">
      <div className="flex flex-col gap-3 p-4 overflow-y-auto no-scrollbar">
        {/* Brand Header with Official Logo */}
        <div className="flex items-center justify-between px-2 pt-1 pb-1">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="VaultZero Logo"
              className="w-8 h-8 rounded-xl object-contain shadow-md shadow-primary/20"
              onError={(e) => {
                // Fallback to stylized mark if image fails
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
            <div>
              <h1 className="font-bold text-sm tracking-tight text-foreground flex items-center gap-1.5">
                VaultZero
                {isDuress && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.2 rounded font-mono font-semibold">
                    DECOY
                  </span>
                )}
              </h1>
              <p className="text-[10px] text-muted-foreground font-mono">100% Zero-Cloud</p>
            </div>
          </div>
        </div>

        {/* Primary Add New Action */}
        <button
          onClick={onAddNew}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md hover:opacity-95 active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>{t.newItem}</span>
        </button>

        {/* Vault Categories Navigation */}
        <div className="flex flex-col gap-0.5 pt-1">
          <span className="px-2 text-[10px] font-bold tracking-wider uppercase text-muted-foreground/80">
            {lang === 'bn' ? 'ক্যাটাগরি' : 'Vault Categories'}
          </span>
          {navCategories.map((item) => {
            const Icon = item.icon;
            const count = getCategoryCount(item.id);
            const isSelected = activeView === 'entries' && selectedFolderId === null && selectedCategory === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectView('entries');
                  onSelectFolder(null);
                  onSelectCategory(item.id);
                }}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-primary/15 text-primary border border-primary/25 font-bold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span>{item.name}</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background/80 text-muted-foreground font-mono">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Folders Management Section (Dynamic & Interactive) */}
        <div className="flex flex-col gap-0.5 pt-2">
          <div className="flex items-center justify-between px-2 pb-1">
            <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground/80">
              {t.folders}
            </span>
            <button
              onClick={() => setIsCreatingFolder(!isCreatingFolder)}
              title={t.createFolder}
              className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Inline New Folder Input */}
          {isCreatingFolder && (
            <form onSubmit={handleCreateFolderSubmit} className="flex items-center gap-1 px-1 mb-1 animate-in fade-in duration-150">
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={t.newFolderPlaceholder}
                className="flex-1 px-2 py-1 text-xs rounded-lg bg-secondary/80 border border-primary focus:outline-none text-foreground font-medium"
              />
              <button
                type="submit"
                className="p-1 rounded bg-primary text-primary-foreground hover:opacity-90"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingFolder(false);
                  setNewFolderName('');
                }}
                className="p-1 rounded bg-secondary text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </form>
          )}

          {folders.map((folder) => {
            const count = getFolderCount(folder.id);
            const isSelected = activeView === 'entries' && selectedFolderId === folder.id;
            return (
              <div
                key={folder.id}
                onClick={() => {
                  onSelectView('entries');
                  onSelectFolder(isSelected ? null : folder.id);
                }}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FolderOpen className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-400' : 'text-amber-500/70'}`} />
                  <span className="truncate">{folder.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background/80 font-mono text-muted-foreground">
                    {count}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(t.deleteFolderConfirm)) {
                        onDeleteFolder(folder.id);
                      }
                    }}
                    title={t.delete}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive rounded transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tools & Security Navigation */}
        <div className="flex flex-col gap-0.5 pt-2">
          <span className="px-2 text-[10px] font-bold tracking-wider uppercase text-muted-foreground/80">
            {lang === 'bn' ? 'টুলস ও নিরাপত্তা' : 'Tools & Security'}
          </span>

          <button
            onClick={() => onSelectView('generator')}
            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeView === 'generator'
                ? 'bg-secondary text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}
          >
            <Dices className="w-3.5 h-3.5 text-purple-400" />
            <span>{t.passwordGenerator}</span>
          </button>

          <button
            onClick={() => onSelectView('totp')}
            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeView === 'totp'
                ? 'bg-secondary text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t.authenticator}</span>
          </button>

          <button
            onClick={() => onSelectView('security')}
            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeView === 'security'
                ? 'bg-secondary text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t.securityCenter}</span>
          </button>

          <button
            onClick={() => onSelectView('p2p')}
            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeView === 'p2p'
                ? 'bg-secondary text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-blue-400" />
            <span>{t.p2pSync}</span>
          </button>

          <button
            onClick={onOpenEmergencyKit}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
          >
            <FileKey className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.emergencyKit}</span>
          </button>
        </div>
      </div>

      {/* Bottom Sticky Actions */}
      <div className="p-3 border-t border-border/70 flex flex-col gap-2 bg-background/50 backdrop-blur-md">
        <button
          onClick={onOpenGenerator}
          className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl bg-secondary/80 hover:bg-secondary text-foreground text-xs font-semibold border border-border/70 transition-all shadow-sm"
        >
          <FileKey className="w-3.5 h-3.5 text-primary" />
          <span>{t.passwordGenerator}</span>
        </button>

        <button
          onClick={onLockVault}
          className="w-full flex items-center justify-center gap-1.5 py-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>{t.lockVault} (Ctrl+L)</span>
        </button>
      </div>
    </aside>
  );
};
