import { MusicNotesSimple, Pause, Play, SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { Tooltip } from "./ui";

/**
 * A tiny offline lofi engine. Everything is synthesised with the Web Audio API,
 * so no audio file is ever downloaded and the vault stays 100% offline.
 */
const PROGRESSION: number[][] = [
  [220.0, 261.63, 329.63, 392.0], // Am9
  [174.61, 220.0, 261.63, 349.23], // Fmaj7
  [196.0, 246.94, 293.66, 349.23], // G7
  [130.81, 164.81, 196.0, 246.94], // Cmaj7
];

const MELODY = [659.25, 587.33, 523.25, 440.0, 493.88, 523.25, 440.0, 392.0];

type Engine = {
  ctx: AudioContext;
  master: GainNode;
  analyser: AnalyserNode;
  stop: () => void;
};

function createEngine(onReady: (engine: Engine) => void) {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  const ctx = new Ctor();

  const master = ctx.createGain();
  master.gain.value = 0;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 128;
  analyser.smoothingTimeConstant = 0.82;

  // Warm, tape-like tone shaping.
  const warmth = ctx.createBiquadFilter();
  warmth.type = "lowpass";
  warmth.frequency.value = 2100;
  warmth.Q.value = 0.6;

  const shelf = ctx.createBiquadFilter();
  shelf.type = "lowshelf";
  shelf.frequency.value = 220;
  shelf.gain.value = 4.5;

  master.connect(warmth);
  warmth.connect(shelf);
  shelf.connect(analyser);
  analyser.connect(ctx.destination);

  // Continuous vinyl hiss.
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i += 1) noiseData[i] = (Math.random() * 2 - 1) * 0.35;
  const vinyl = ctx.createBufferSource();
  vinyl.buffer = noiseBuffer;
  vinyl.loop = true;
  const vinylFilter = ctx.createBiquadFilter();
  vinylFilter.type = "bandpass";
  vinylFilter.frequency.value = 1400;
  const vinylGain = ctx.createGain();
  vinylGain.gain.value = 0.012;
  vinyl.connect(vinylFilter);
  vinylFilter.connect(vinylGain);
  vinylGain.connect(master);
  vinyl.start();

  const bar = 2.4;
  let step = 0;
  let next = ctx.currentTime + 0.12;

  const pad = (time: number, chord: number[]) => {
    chord.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = index === 0 ? "triangle" : "sine";
      osc.frequency.value = freq;
      osc.detune.value = (index % 2 === 0 ? -6 : 7) + Math.random() * 4;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.16 : 0.075, time + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + bar * 0.98);
      osc.connect(gain);
      gain.connect(master);
      osc.start(time);
      osc.stop(time + bar);
    });
  };

  const kick = (time: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(126, time);
    osc.frequency.exponentialRampToValueAtTime(44, time + 0.14);
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
    osc.connect(gain);
    gain.connect(master);
    osc.start(time);
    osc.stop(time + 0.32);
  };

  const hat = (time: number) => {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.09, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(time, Math.random(), 0.1);
  };

  const note = (time: number, freq: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.08, time + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.85);
    osc.connect(gain);
    gain.connect(master);
    osc.start(time);
    osc.stop(time + 0.9);
  };

  const scheduler = window.setInterval(() => {
    while (next < ctx.currentTime + 0.6) {
      const chord = PROGRESSION[step % PROGRESSION.length];
      pad(next, chord);
      kick(next);
      kick(next + bar * 0.5);
      hat(next + bar * 0.25);
      hat(next + bar * 0.75);
      if (step % 2 === 0) note(next + bar * 0.5, MELODY[step % MELODY.length]);
      if (Math.random() > 0.55) note(next + bar * 0.75, MELODY[(step + 3) % MELODY.length] / 2);
      next += bar;
      step += 1;
    }
  }, 220);

  const engine: Engine = {
    ctx,
    master,
    analyser,
    stop: () => {
      window.clearInterval(scheduler);
      try { vinyl.stop(); } catch { /* already stopped */ }
      void ctx.close();
    },
  };
  onReady(engine);
  return engine;
}


let shared: Engine | null = null;
let state = { playing: false, muted: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function ensureEngine() {
  if (!shared) shared = createEngine((created) => { shared = created; });
  return shared;
}

function startAudio(onFail?: () => void) {
  const engine = ensureEngine();
  if (!engine) { onFail?.(); return; }
  void engine.ctx.resume().then(() => {
    engine.master.gain.cancelScheduledValues(engine.ctx.currentTime);
    engine.master.gain.linearRampToValueAtTime(state.muted ? 0.0001 : 0.34, engine.ctx.currentTime + 1.1);
    state = { ...state, playing: true };
    emit();
  }).catch(() => onFail?.());
}

function pauseAudio() {
  if (!shared) return;
  shared.master.gain.cancelScheduledValues(shared.ctx.currentTime);
  shared.master.gain.linearRampToValueAtTime(0.0001, shared.ctx.currentTime + 0.35);
  const engine = shared;
  window.setTimeout(() => { if (shared === engine) void engine.ctx.suspend(); }, 400);
  state = { ...state, playing: false };
  emit();
}

function disposeAudio() {
  shared?.stop();
  shared = null;
  state = { ...state, playing: false };
  emit();
}

function toggleMute() {
  state = { ...state, muted: !state.muted };
  if (shared) {
    shared.master.gain.cancelScheduledValues(shared.ctx.currentTime);
    shared.master.gain.linearRampToValueAtTime(state.muted ? 0.0001 : 0.34, shared.ctx.currentTime + 0.25);
  }
  emit();
}

function useAudioState() {
  const [, force] = useState(0);
  useEffect(() => {
    const listener = () => force((value) => value + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return state;
}

export default function LofiPlayer({
  active,
  onNotify,
  compact = false,
}: {
  active: boolean;
  onNotify?: (message: string) => void;
  compact?: boolean;
}) {
  const { playing, muted } = useAudioState();
  const frameRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !shared) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) {
      frameRef.current = window.requestAnimationFrame(draw);
      return;
    }
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const data = new Uint8Array(shared.analyser.frequencyBinCount);
    shared.analyser.getByteFrequencyData(data);

    const bars = 14;
    const gap = 2;
    const barWidth = (width - gap * (bars - 1)) / bars;
    for (let i = 0; i < bars; i += 1) {
      const slice = data[Math.floor((i / bars) * (data.length * 0.55)) + 1] ?? 0;
      const barHeight = Math.max(2, Math.max(slice / 255, 0.05) * height);
      const y = height - barHeight;
      const gradient = context.createLinearGradient(0, y, 0, height);
      gradient.addColorStop(0, "rgba(255, 210, 155, 0.96)");
      gradient.addColorStop(1, "rgba(231, 134, 108, 0.6)");
      context.fillStyle = gradient;
      context.beginPath();
      context.roundRect(i * (barWidth + gap), y, barWidth, barHeight, barWidth / 2);
      context.fill();
    }
    frameRef.current = window.requestAnimationFrame(draw);
  }, []);

  // Zen mode is always entered by a click, so playback is allowed to start.
  useEffect(() => {
    if (active) startAudio(() => onNotify?.("Tap play to start the soundscape"));
    else disposeAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!active || !playing) {
      window.cancelAnimationFrame(frameRef.current);
      return;
    }
    frameRef.current = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frameRef.current);
  }, [active, playing, draw]);

  if (!active) return null;

  return (
    <div className={cn("lofi-player", compact && "is-compact")} data-testid="lofi-player" data-playing={playing}>
      <Tooltip label={playing ? "Pause lofi" : "Play lofi"}>
        <button
          onClick={() => (playing ? pauseAudio() : startAudio())}
          className="lofi-play"
          aria-label={playing ? "Pause lofi soundscape" : "Play lofi soundscape"}
          aria-pressed={playing}
        >
          {playing ? <Pause size={13} weight="fill" /> : <Play size={13} weight="fill" />}
        </button>
      </Tooltip>

      <div className="lofi-meta">
        {!compact && (
          <span className="lofi-title">
            <MusicNotesSimple size={10} weight="fill" />
            Zen soundscape
          </span>
        )}
        <canvas ref={canvasRef} className={cn("lofi-visualizer", !playing && "is-idle")} aria-hidden="true" />
      </div>

      <Tooltip label={muted ? "Unmute" : "Mute"}>
        <button
          onClick={toggleMute}
          className="lofi-mute"
          aria-label={muted ? "Unmute lofi soundscape" : "Mute lofi soundscape"}
          aria-pressed={muted}
        >
          {muted ? <SpeakerSlash size={12} weight="duotone" /> : <SpeakerHigh size={12} weight="duotone" />}
        </button>
      </Tooltip>
    </div>
  );
}
