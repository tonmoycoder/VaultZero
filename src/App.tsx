import { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { Header } from '@/components/header/Header';
import { BentoGridView } from '@/components/views/BentoGridView';
import { SplitInspectorView } from '@/components/views/SplitInspectorView';
import { SecurityCenterView } from '@/components/views/SecurityCenterView';
import { AuthenticatorView } from '@/components/views/AuthenticatorView';
import { P2PSyncView } from '@/components/views/P2PSyncView';
import { EntryModal } from '@/components/views/EntryModal';
import { PasswordGeneratorModal } from '@/components/views/PasswordGeneratorModal';
import { CommandPalette } from '@/components/views/CommandPalette';
import { LockScreen } from '@/components/views/LockScreen';
import { MobileNav } from '@/components/views/MobileNav';
import { OcrSnippingModal } from '@/components/views/OcrSnippingModal';
import { ExportShredModal } from '@/components/views/ExportShredModal';
import { EmergencyRecoveryKitModal } from '@/components/views/EmergencyRecoveryKitModal';
import { DitheringShader } from '@/components/ui/dithering-shader';
import { lofiAudio } from '@/lib/lofi-audio';
import { VaultApi } from '@/lib/api';
import { ShieldCheck, Clock, Scissors, FileText } from 'lucide-react';
import type {
  BrandInfo,
  Category,
  DomainGroup,
  Entry,
  EntrySummary,
  SecurityAuditReport,
  VaultStatus,
} from '@/types/vault';

export function App() {
  // Vault state
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);
  const [entries, setEntries] = useState<EntrySummary[]>([]);
  const [brands, setBrands] = useState<BrandInfo[]>([]);
  const [domainGroups, setDomainGroups] = useState<DomainGroup[]>([]);
  const [auditReport, setAuditReport] = useState<SecurityAuditReport | null>(null);

  // View & Filter states
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All' | 'Favorites'>('All');
  const [activeView, setActiveView] = useState<'entries' | 'security' | 'p2p' | 'generator' | 'totp'>('entries');
  const [viewMode, setViewMode] = useState<'grid' | 'split'>('grid');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBrandSlug, setSelectedBrandSlug] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'compromised' | 'reused' | 'weak'>('all');
  const [selectedEntry, setSelectedEntry] = useState<EntrySummary | null>(null);

  // Modals
  const [isEntryModalOpen, setIsEntryModalOpen] = useState<boolean>(false);
  const [entryToEdit, setEntryToEdit] = useState<EntrySummary | null>(null);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isOcrOpen, setIsOcrOpen] = useState<boolean>(false);
  const [isExportShredOpen, setIsExportShredOpen] = useState<boolean>(false);
  const [isEmergencyKitOpen, setIsEmergencyKitOpen] = useState<boolean>(false);

  // Protected Clipboard 12s Auto-Clear state
  const [clipboardCount, setClipboardCount] = useState<number>(0);

  // Screen Capture Protection
  const [screenProtection, setScreenProtection] = useState<boolean>(false);

  // Cozy Lofi / Zen Mode
  const [lofiActive, setLofiActive] = useState<boolean>(false);

  const refreshVault = async () => {
    try {
      const status = await VaultApi.getStatus();
      setVaultStatus(status);

      if (status.is_unlocked) {
        const [loadedEntries, loadedBrands, loadedGroups, loadedAudit] = await Promise.all([
          VaultApi.listEntries(),
          VaultApi.getBrands(),
          VaultApi.getDomainGroups(),
          VaultApi.getSecurityAudit(),
        ]);
        setEntries(loadedEntries);
        setBrands(loadedBrands);
        setDomainGroups(loadedGroups);
        setAuditReport(loadedAudit);

        if (loadedEntries.length > 0 && !selectedEntry) {
          setSelectedEntry(loadedEntries[0]);
        }
      }
    } catch (err) {
      console.error('Failed to refresh vault state:', err);
    }
  };

  useEffect(() => {
    refreshVault();
  }, []);

  // 12s Clipboard Auto-Clear Timer Loop
  useEffect(() => {
    let interval: number;
    if (clipboardCount > 0) {
      interval = window.setInterval(() => {
        setClipboardCount((prev) => {
          if (prev <= 1) {
            navigator.clipboard.writeText('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [clipboardCount]);

  // Global Keyboard Shortcuts (Ctrl+L, Ctrl+K, Ctrl+Shift+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        handleLockVault();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setIsOcrOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLockVault = async () => {
    try {
      await VaultApi.lock();
      await refreshVault();
      setSelectedEntry(null);
    } catch (err) {
      console.error('Failed to lock vault:', err);
    }
  };

  const handleToggleLofi = () => {
    const nextState = !lofiActive;
    setLofiActive(nextState);
    if (nextState) {
      lofiAudio.start();
    } else {
      lofiAudio.stop();
    }
  };

  const handleToggleScreenProtection = async () => {
    const next = !screenProtection;
    try {
      await VaultApi.setScreenProtection(next);
      setScreenProtection(next);
    } catch (err) {
      console.error('Failed to toggle screen capture protection:', err);
    }
  };

  const handleAddNew = () => {
    setEntryToEdit(null);
    setIsEntryModalOpen(true);
  };

  const handleEditEntry = (entry: EntrySummary) => {
    setEntryToEdit(entry);
    setIsEntryModalOpen(true);
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      await VaultApi.deleteEntry(entryId);
      await refreshVault();
      if (selectedEntry?.id === entryId) {
        setSelectedEntry(null);
      }
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };

  // Filter and search entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Category filter
      if (selectedCategory === 'Favorites' && !entry.favorite) return false;
      if (selectedCategory !== 'All' && selectedCategory !== 'Favorites' && entry.category !== selectedCategory) {
        return false;
      }

      // Brand filter
      if (selectedBrandSlug && entry.brand_icon_slug !== selectedBrandSlug) {
        return false;
      }

      // Security filter
      if (selectedFilter === 'compromised' && !auditReport?.compromised_ids.includes(entry.id)) {
        return false;
      }
      if (selectedFilter === 'reused' && !auditReport?.reused_ids.includes(entry.id)) {
        return false;
      }
      if (selectedFilter === 'weak' && !auditReport?.weak_ids.includes(entry.id)) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = entry.title.toLowerCase().includes(q);
        const matchUser = entry.username.toLowerCase().includes(q);
        const matchUrl = entry.url.toLowerCase().includes(q);
        const matchTags = entry.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchUser && !matchUrl && !matchTags) return false;
      }

      return true;
    });
  }, [entries, selectedCategory, selectedBrandSlug, selectedFilter, searchQuery, auditReport]);

  if (!vaultStatus) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-mono">Initializing Zero-Trust Enclave...</p>
        </div>
      </div>
    );
  }

  // If vault is locked, render LockScreen
  if (!vaultStatus.is_unlocked) {
    return (
      <LockScreen
        onUnlocked={() => {
          refreshVault();
        }}
      />
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground relative overflow-hidden select-none">
      {/* Optional Cozy Lofi CRT Scanline & Grain Shader Background */}
      {lofiActive && (
        <div className="absolute inset-0 z-0 pointer-events-none opacity-45">
          <DitheringShader />
        </div>
      )}

      {/* Main App Container */}
      <div
        className={`relative z-10 w-full h-full flex overflow-hidden transition-all duration-300 ${
          lofiActive ? 'backdrop-blur-2xl bg-slate-950/75 border-white/10' : ''
        }`}
      >
        {/* Left Sidebar (Desktop Only) */}
        <div className="hidden md:flex">
          <Sidebar
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            activeView={activeView}
            onSelectView={setActiveView}
            entries={entries}
            onAddNew={handleAddNew}
            onOpenGenerator={() => setIsGeneratorOpen(true)}
            onOpenEmergencyKit={() => setIsEmergencyKitOpen(true)}
            onLockVault={handleLockVault}
            isDuress={vaultStatus.is_duress}
          />
        </div>

        {/* Center Content Workspace */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden pb-16 md:pb-0">
          <Header
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            lofiActive={lofiActive}
            onToggleLofi={handleToggleLofi}
            onLockVault={handleLockVault}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onAddNew={handleAddNew}
            brands={brands}
            selectedBrandSlug={selectedBrandSlug}
            onSelectBrandSlug={setSelectedBrandSlug}
            auditReport={auditReport}
            selectedFilter={selectedFilter}
            onSelectFilter={setSelectedFilter}
          />

          {/* Top Quick Actions Bar for Phase 4: OCR, Export & Anti-Spy */}
          <div className="flex items-center justify-between px-6 py-2 bg-secondary/20 border-b border-border/50 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsOcrOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/60 transition-all"
              >
                <Scissors className="w-3.5 h-3.5 text-cyan-400" />
                <span>OCR Snipping Tool (Ctrl+Shift+S)</span>
              </button>

              <button
                onClick={() => setIsExportShredOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/60 transition-all"
              >
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span>Export & DoD Shredder</span>
              </button>
            </div>

            <button
              onClick={handleToggleScreenProtection}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border transition-all ${
                screenProtection
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 font-semibold'
                  : 'bg-secondary/40 border-border/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Anti-Screen Recording: {screenProtection ? 'ACTIVE' : 'OFF'}</span>
            </button>
          </div>

          {/* Dynamic View Panels */}
          {activeView === 'entries' && (
            <>
              {viewMode === 'grid' ? (
                <BentoGridView
                  entries={filteredEntries}
                  brands={brands}
                  domainGroups={domainGroups}
                  onSelectEntry={(entry) => {
                    setSelectedEntry(entry);
                    setViewMode('split');
                  }}
                  onEditEntry={handleEditEntry}
                />
              ) : (
                <SplitInspectorView
                  entries={filteredEntries}
                  selectedEntry={selectedEntry}
                  onSelectEntry={setSelectedEntry}
                  brands={brands}
                  onEditEntry={handleEditEntry}
                  onDeleteEntry={handleDeleteEntry}
                />
              )}
            </>
          )}

          {activeView === 'security' && (
            <SecurityCenterView
              auditReport={auditReport}
              entries={entries}
              brands={brands}
              onSelectEntry={(entry) => {
                setSelectedEntry(entry);
                setActiveView('entries');
                setViewMode('split');
              }}
              onRefreshAudit={refreshVault}
            />
          )}

          {activeView === 'totp' && (
            <AuthenticatorView
              entries={entries}
              brands={brands}
              onAddNew={handleAddNew}
              onSelectEntry={(entry) => {
                setSelectedEntry(entry);
                setActiveView('entries');
                setViewMode('split');
              }}
            />
          )}

          {activeView === 'generator' && (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="w-full max-w-lg">
                <PasswordGeneratorModal
                  isOpen={true}
                  onClose={() => setActiveView('entries')}
                />
              </div>
            </div>
          )}

          {activeView === 'p2p' && <P2PSyncView />}
        </div>
      </div>

      {/* 12s Protected Clipboard Countdown Toast */}
      {clipboardCount > 0 && (
        <div className="fixed bottom-20 right-6 z-50 flex items-center gap-3 p-3.5 rounded-2xl bg-slate-900 border border-primary/40 text-white shadow-2xl animate-in slide-in-from-bottom duration-300">
          <Clock className="w-5 h-5 text-primary animate-pulse" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-foreground">Protected Clipboard</span>
            <span className="text-[11px] font-mono text-muted-foreground">
              Auto-clearing in <strong className="text-primary">{clipboardCount}s</strong>
            </span>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation (< 768px) */}
      <MobileNav activeView={activeView} onSelectView={setActiveView} />

      {/* Modals & Dialogs */}
      <EntryModal
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        entryToEdit={entryToEdit}
        brands={brands}
        onSaved={() => refreshVault()}
        onOpenGenerator={() => setIsGeneratorOpen(true)}
      />

      <PasswordGeneratorModal
        isOpen={isGeneratorOpen && activeView !== 'generator'}
        onClose={() => setIsGeneratorOpen(false)}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        entries={entries}
        onSelectEntry={(entry) => {
          setSelectedEntry(entry);
          setActiveView('entries');
          setViewMode('split');
        }}
        onOpenGenerator={() => setIsGeneratorOpen(true)}
        onOpenSecurity={() => setActiveView('security')}
        onToggleLofi={handleToggleLofi}
        onLockVault={handleLockVault}
      />

      <OcrSnippingModal
        isOpen={isOcrOpen}
        onClose={() => setIsOcrOpen(false)}
        onCredentialExtracted={(_data: Partial<Entry>) => {
          setIsEntryModalOpen(true);
        }}
      />

      <ExportShredModal
        isOpen={isExportShredOpen}
        onClose={() => setIsExportShredOpen(false)}
        onImportComplete={() => refreshVault()}
      />

      <EmergencyRecoveryKitModal
        isOpen={isEmergencyKitOpen}
        onClose={() => setIsEmergencyKitOpen(false)}
        vaultStatus={vaultStatus}
      />
    </div>
  );
}

export default App;
