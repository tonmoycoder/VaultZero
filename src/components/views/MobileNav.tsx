import React from 'react';
import {
  KeyRound,
  Smartphone,
  Dices,
  ShieldCheck,
  Radio
} from 'lucide-react';

interface MobileNavProps {
  activeView: 'entries' | 'security' | 'p2p' | 'generator' | 'totp';
  onSelectView: (view: 'entries' | 'security' | 'p2p' | 'generator' | 'totp') => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activeView, onSelectView }) => {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-background/95 backdrop-blur-xl border-t border-border flex items-center justify-around px-2 z-40 select-none shadow-lg">
      <button
        onClick={() => onSelectView('entries')}
        className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all ${
          activeView === 'entries' ? 'text-primary font-bold' : 'text-muted-foreground'
        }`}
      >
        <KeyRound className="w-5 h-5" />
        <span className="text-[10px]">Vault</span>
      </button>

      <button
        onClick={() => onSelectView('totp')}
        className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all ${
          activeView === 'totp' ? 'text-cyan-400 font-bold' : 'text-muted-foreground'
        }`}
      >
        <Smartphone className="w-5 h-5" />
        <span className="text-[10px]">2FA</span>
      </button>

      <button
        onClick={() => onSelectView('generator')}
        className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all ${
          activeView === 'generator' ? 'text-purple-400 font-bold' : 'text-muted-foreground'
        }`}
      >
        <Dices className="w-5 h-5" />
        <span className="text-[10px]">Generate</span>
      </button>

      <button
        onClick={() => onSelectView('p2p')}
        className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all ${
          activeView === 'p2p' ? 'text-blue-400 font-bold' : 'text-muted-foreground'
        }`}
      >
        <Radio className="w-5 h-5" />
        <span className="text-[10px]">P2P Sync</span>
      </button>

      <button
        onClick={() => onSelectView('security')}
        className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all ${
          activeView === 'security' ? 'text-emerald-400 font-bold' : 'text-muted-foreground'
        }`}
      >
        <ShieldCheck className="w-5 h-5" />
        <span className="text-[10px]">Security</span>
      </button>
    </nav>
  );
};

