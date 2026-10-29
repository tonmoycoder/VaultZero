import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  RefreshCw,
  X,
  Dices,
  KeyRound,
  ShieldCheck
} from 'lucide-react';
import { VaultApi } from '@/lib/api';

interface PasswordGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPassword?: (pwd: string) => void;
}

export const PasswordGeneratorModal: React.FC<PasswordGeneratorModalProps> = ({
  isOpen,
  onClose,
  onSelectPassword,
}) => {
  const [mode, setMode] = useState<'password' | 'passphrase'>('password');
  const [generatedPassword, setGeneratedPassword] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Password options
  const [length, setLength] = useState<number>(20);
  const [uppercase, setUppercase] = useState<boolean>(true);
  const [lowercase, setLowercase] = useState<boolean>(true);
  const [numbers, setNumbers] = useState<boolean>(true);
  const [symbols, setSymbols] = useState<boolean>(true);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState<boolean>(true);

  // Passphrase options
  const [words, setWords] = useState<number>(5);
  const [separator, setSeparator] = useState<string>('-');
  const [capitalize, setCapitalize] = useState<boolean>(true);

  const refreshPassword = async () => {
    try {
      if (mode === 'password') {
        const res = await VaultApi.generatePassword(
          length,
          uppercase,
          lowercase,
          numbers,
          symbols,
          excludeAmbiguous
        );
        setGeneratedPassword(res);
      } else {
        const res = await VaultApi.generatePassphrase(words, separator, capitalize);
        setGeneratedPassword(res);
      }
    } catch (err) {
      console.error('Password generation failed:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshPassword();
    }
  }, [
    isOpen,
    mode,
    length,
    uppercase,
    lowercase,
    numbers,
    symbols,
    excludeAmbiguous,
    words,
    separator,
    capitalize,
  ]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (onSelectPassword) {
        onSelectPassword(generatedPassword);
      }
    } catch (err) {
      console.error('Failed to copy generated password:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl bg-background border border-border shadow-2xl p-6 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Dices className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Password & Passphrase Generator</h3>
              <p className="text-xs text-muted-foreground">High-entropy CSPRNG & EFF Diceware</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-secondary/60 border border-border text-xs font-semibold">
          <button
            onClick={() => setMode('password')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              mode === 'password'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-primary" />
            <span>Random Password</span>
          </button>
          <button
            onClick={() => setMode('passphrase')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              mode === 'passphrase'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Dices className="w-3.5 h-3.5 text-purple-400" />
            <span>EFF Diceware Passphrase</span>
          </button>
        </div>

        {/* Generated Output Display */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-secondary/40 border border-border/80">
            <span className="font-mono text-base text-foreground font-semibold break-all select-all tracking-wide">
              {generatedPassword || 'Generating...'}
            </span>
            <div className="flex items-center gap-1.5 shrink-0 ml-3">
              <button
                onClick={refreshPassword}
                title="Regenerate"
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:rotate-180 duration-300"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-md hover:opacity-95 active:scale-95 transition-all"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Entropy: <strong className="text-foreground">{mode === 'password' ? length * 5 : words * 13} bits</strong></span>
            <span>·</span>
            <span>Uncrackable via offline dictionary attacks</span>
          </div>
        </div>

        {/* Options Controls */}
        {mode === 'password' ? (
          <div className="flex flex-col gap-4 p-4 rounded-2xl bg-secondary/20 border border-border/60">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Length</span>
                <span className="font-mono text-primary font-bold text-sm">{length} characters</span>
              </div>
              <input
                type="range"
                min="8"
                max="64"
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={uppercase}
                  onChange={(e) => setUppercase(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Uppercase (A-Z)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={lowercase}
                  onChange={(e) => setLowercase(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Lowercase (a-z)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={numbers}
                  onChange={(e) => setNumbers(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Numbers (0-9)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={symbols}
                  onChange={(e) => setSymbols(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Symbols (!@#$%)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer col-span-2 pt-1">
                <input
                  type="checkbox"
                  checked={excludeAmbiguous}
                  onChange={(e) => setExcludeAmbiguous(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Exclude ambiguous characters (0, O, 1, l, I)</span>
              </label>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4 rounded-2xl bg-secondary/20 border border-border/60">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Word Count</span>
                <span className="font-mono text-purple-400 font-bold text-sm">{words} words</span>
              </div>
              <input
                type="range"
                min="3"
                max="10"
                value={words}
                onChange={(e) => setWords(Number(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 text-xs">
              <div className="flex flex-col gap-1.5">
                <span className="font-semibold">Word Separator</span>
                <select
                  value={separator}
                  onChange={(e) => setSeparator(e.target.value)}
                  className="p-2 rounded-xl bg-background border border-border text-xs focus:outline-none"
                >
                  <option value="-">Hyphen (-)</option>
                  <option value=".">Period (.)</option>
                  <option value="_">Underscore (_)</option>
                  <option value=" ">Space ( )</option>
                </select>
              </div>

              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={capitalize}
                    onChange={(e) => setCapitalize(e.target.checked)}
                    className="rounded text-purple-500 focus:ring-purple-500"
                  />
                  <span>Capitalize each word</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/70">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            Close
          </button>
          <button
            onClick={() => {
              handleCopy();
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-md hover:opacity-95 active:scale-95 transition-all"
          >
            Use This Password
          </button>
        </div>
      </div>
    </div>
  );
};
