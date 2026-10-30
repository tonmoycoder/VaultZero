// 100% Offline Procedural High-Gain Web Audio Ambient Synthesizer for Cozy Lofi Mode
// Zero external files, zero network requests, pure algorithmic Rhodes piano + rain + soft lofi beats.

class LofiAudioEngine {
  private ctx: AudioContext | null = null;
  private isRunning: boolean = false;
  private chordTimer: number | null = null;
  private rainNode: AudioNode | null = null;
  private musicGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private beatGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private currentChordIndex: number = 0;
  private volume: number = 0.8;

  // Lofi Chord Progression (Rhodes 7th/9th voicings: Dm9 -> G13 -> Cmaj7 -> Am9)
  private chords: number[][] = [
    [146.83, 220.0, 261.63, 329.63, 392.0], // Dm9 (D3, A3, C4, E4, G4)
    [98.0, 196.0, 246.94, 329.63, 440.0],  // G13 (G2, G3, B3, E4, A4)
    [130.81, 196.0, 246.94, 293.66, 392.0], // Cmaj7 (C3, G3, B3, D4, G4)
    [110.0, 164.81, 220.0, 261.63, 329.63], // Am9 (A2, E3, A3, C4, E4)
  ];

  public initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.rainGain.connect(this.masterGain);

      this.beatGain = this.ctx.createGain();
      this.beatGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      this.beatGain.connect(this.masterGain);
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  private playRhodesNote(freq: number, startTime: number, duration: number) {
    if (!this.ctx || !this.musicGain) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, startTime);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 1.002, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, startTime);
    filter.frequency.exponentialRampToValueAtTime(350, startTime + duration);

    // ADSR Envelope
    const noteVolume = 0.28;
    noteGain.gain.setValueAtTime(0.001, startTime);
    noteGain.gain.linearRampToValueAtTime(noteVolume, startTime + 0.06);
    noteGain.gain.exponentialRampToValueAtTime(noteVolume * 0.45, startTime + 0.8);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(noteGain);
    noteGain.connect(this.musicGain);

    osc1.start(startTime);
    osc2.start(startTime);

    osc1.stop(startTime + duration);
    osc2.stop(startTime + duration);
  }

  private playChord(chord: number[]) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const duration = 4.2;

    chord.forEach((freq, i) => {
      const strumOffset = i * 0.045;
      this.playRhodesNote(freq, now + strumOffset, duration);
    });
  }

  private playLofiBeat(now: number) {
    if (!this.ctx || !this.beatGain) return;

    // Sub kick
    const kick = this.ctx.createOscillator();
    const kickGain = this.ctx.createGain();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(110, now);
    kick.frequency.exponentialRampToValueAtTime(40, now + 0.2);

    kickGain.gain.setValueAtTime(0.5, now);
    kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    kick.connect(kickGain);
    kickGain.connect(this.beatGain);
    kick.start(now);
    kick.stop(now + 0.25);
  }

  private startRain() {
    if (!this.ctx || !this.rainGain) return;

    // Pink/Brown noise buffer for organic gentle rainfall
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      output[i] = (b0 + b1 + b2) * 0.12;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, this.ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(this.rainGain);
    whiteNoise.start();

    this.rainNode = whiteNoise;
  }

  private stopRain() {
    if (this.rainNode) {
      try {
        (this.rainNode as AudioBufferSourceNode).stop();
        this.rainNode.disconnect();
      } catch {}
      this.rainNode = null;
    }
  }

  public start() {
    if (this.isRunning) return;
    this.initContext();
    if (!this.ctx) return;

    this.isRunning = true;
    this.startRain();

    // Play first chord immediately
    this.playChord(this.chords[this.currentChordIndex]);
    this.playLofiBeat(this.ctx.currentTime);
    this.currentChordIndex = (this.currentChordIndex + 1) % this.chords.length;

    // Chord cadence every 4.0 seconds
    this.chordTimer = window.setInterval(() => {
      if (!this.isRunning || !this.ctx) return;
      this.playChord(this.chords[this.currentChordIndex]);
      this.playLofiBeat(this.ctx.currentTime);
      this.currentChordIndex = (this.currentChordIndex + 1) % this.chords.length;
    }, 4000);
  }

  public stop() {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.chordTimer !== null) {
      clearInterval(this.chordTimer);
      this.chordTimer = null;
    }

    this.stopRain();
  }

  public toggle(): boolean {
    if (this.isRunning) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }
}

export const lofiAudio = new LofiAudioEngine();
