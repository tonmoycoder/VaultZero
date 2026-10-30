import React, { useState, useEffect } from 'react';
import { lofiAudio } from '@/lib/lofi-audio';
import { Volume2, VolumeX, Music, Radio, Play, Pause, Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface ZenAudioControllerProps {
  isOpen: boolean;
  onClose: () => void;
  isZenActive: boolean;
  onToggleZen: () => void;
}

export const ZenAudioController: React.FC<ZenAudioControllerProps> = ({
  isOpen,
  onClose,
  isZenActive,
  onToggleZen,
}) => {
  const { lang } = useI18n();
  const [source, setSource] = useState<'offline' | 'youtube'>('offline');
  const [isPlaying, setIsPlaying] = useState<boolean>(isZenActive);
  const [volume, setVolume] = useState<number>(80);

  useEffect(() => {
    setIsPlaying(isZenActive);
  }, [isZenActive]);

  const handleTogglePlay = () => {
    if (!isPlaying) {
      if (source === 'offline') {
        lofiAudio.setVolume(volume / 100);
        lofiAudio.start();
      }
      setIsPlaying(true);
      if (!isZenActive) onToggleZen();
    } else {
      if (source === 'offline') {
        lofiAudio.stop();
      }
      setIsPlaying(false);
      if (isZenActive) onToggleZen();
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    lofiAudio.setVolume(newVol / 100);
  };

  const handleSourceChange = (newSource: 'offline' | 'youtube') => {
    if (source === 'offline') {
      lofiAudio.stop();
    }
    setSource(newSource);
    if (isPlaying) {
      if (newSource === 'offline') {
        lofiAudio.setVolume(volume / 100);
        lofiAudio.start();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl bg-slate-900/90 dark:bg-slate-950/95 backdrop-blur-2xl border border-primary/30 p-4 shadow-2xl text-foreground animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between pb-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 animate-spin-slow" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">
              {lang === 'bn' ? 'জেন লোফি অডিও প্লেয়ার' : 'Zen Lofi Audio Lounge'}
            </h4>
            <p className="text-[10px] text-muted-foreground font-mono">
              {isPlaying
                ? (lang === 'bn' ? 'মিউজিক চলছে • ফোকাস মোড' : 'Playing • Focus Soundscape')
                : (lang === 'bn' ? 'অডিও থামানো আছে' : 'Paused')}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-xs px-2 py-0.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>

      {/* Audio Source Selector */}
      <div className="grid grid-cols-2 gap-1.5 my-3 p-1 rounded-xl bg-background/50 border border-border/50 text-[11px]">
        <button
          onClick={() => handleSourceChange('offline')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium transition-all ${
            source === 'offline'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Music className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? 'অফলাইন রোডস' : 'Offline Lofi'}</span>
        </button>
        <button
          onClick={() => handleSourceChange('youtube')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium transition-all ${
            source === 'youtube'
              ? 'bg-rose-500 text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>YouTube Stream</span>
        </button>
      </div>

      {/* Embedded Stream or Synthesizer Details */}
      {source === 'youtube' ? (
        <div className="my-2 rounded-xl overflow-hidden border border-border/50 bg-black aspect-video relative">
          <iframe
            src={`https://www.youtube.com/embed/ztVV54sPOns?autoplay=${isPlaying ? 1 : 0}&enablejsapi=1`}
            title="Lofi Girl Chill Beats"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            className="w-full h-full"
          />
        </div>
      ) : (
        <div className="my-3 p-2.5 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Animated Equalizer Waves */}
            <div className="flex items-end gap-0.5 h-4">
              <span className={`w-1 bg-primary rounded-full ${isPlaying ? 'animate-pulse h-4' : 'h-1'}`} />
              <span className={`w-1 bg-primary/80 rounded-full ${isPlaying ? 'animate-bounce h-3' : 'h-2'}`} />
              <span className={`w-1 bg-primary rounded-full ${isPlaying ? 'animate-pulse h-4' : 'h-1.5'}`} />
              <span className={`w-1 bg-primary/70 rounded-full ${isPlaying ? 'animate-bounce h-2' : 'h-1'}`} />
            </div>
            <span className="text-[11px] font-mono text-primary font-medium">
              Rhodes 7th/9th + Rain
            </span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold">
            100% Offline
          </span>
        </div>
      )}

      {/* Volume & Master Playback Controls */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
        <div className="flex items-center gap-2">
          {volume === 0 ? (
            <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-primary" />
          )}
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="flex-1 accent-primary h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-[10px] font-mono w-7 text-right text-muted-foreground">
            {volume}%
          </span>
        </div>

        <button
          onClick={handleTogglePlay}
          className={`w-full py-2 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-md ${
            isPlaying
              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>{lang === 'bn' ? 'মিউজিক থামান' : 'Pause Lofi Soundscape'}</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{lang === 'bn' ? 'লোফি চালু করুন' : 'Start Cozy Lofi'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
