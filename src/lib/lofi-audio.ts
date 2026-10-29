// 100% Offline Procedural Web Audio Ambient Synthesizer for Cozy Lofi Mode
// Zero external files, zero network requests, pure algorithmic soundscape.

class LofiAudioEngine {
  private ctx: AudioContext | null = null;
  private isRunning: boolean = false;
  private chordTimer: number | null = null;
  private rainNode: AudioNode | null = null;
  private musicGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private currentChordIndex: number = 0;

  // Lofi Chord Progression (Rhodes 7th/9th voicings: Dm9 -> G13 -> Cmaj7 -> Am9)
  // Frequencies in Hz
  private chords: number[][] = [
    [146.83, 220.00, 261.63, 329.63, 392.00], // Dm9 (D3, A3, C4, E4, G4)
    [98.00, 196.00, 246.94, 329.63, 440.00],  // G13 (G2, G3, B3, E4, A4)
    [130.81, 196.00, 246.94, 293.66, 392.00], // Cmaj7 (C3, G3, B3, D4, G4)
    [110.00, 164.81, 220.00, 261.63, 329.63], // Am9 (A2, E3, A3, C4, E4)
  ];

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      this.rainGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private playRhodesNote(freq: number, startTime: number, duration: number) {
    if (!this.ctx || !this.musicGain) return;

    // Dual oscillator for warm acoustic-electric Rhodes tone (triangle + sine)
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, startTime);

    osc2.type = 'sine';
    // Subtle detune for warm chorus feel
    osc2.frequency.setValueAtTime(freq * 1.002, startTime);

    // Warm vintage low-pass filter
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(850, startTime);
    filter.frequency.exponentialRampToValueAtTime(320, startTime + duration);

    // Rhodes envelope: quick soft attack, bell bloom, and warm mellow decay
    noteGain.gain.setValueAtTime(0.0001, startTime);
    noteGain.gain.linearRampToValueAtTime(0.12, startTime + 0.05);
    noteGain.gain.exponentialRampToValueAtTime(0.04, startTime + 0.8);
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

  private triggerChord() {
    if (!this.ctx || !this.isRunning) return;

    const chord = this.chords[this.currentChordIndex];
    this.currentChordIndex = (this.currentChordIndex + 1) % this.chords.length;

    const now = this.ctx.currentTime;
    const duration = 5.2;

    // Slight strum delay per note for authentic human keyboard touch
    chord.forEach((freq, idx) => {
      const noteDelay = idx * 0.035;
      this.playRhodesNote(freq, now + noteDelay, duration);
    });
  }

  private createRainSoundscape(): AudioNode {
    if (!this.ctx) throw new Error('No AudioContext');

    // 4 seconds of procedural pink-noise buffer
    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
      b6 = white * 0.115926;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    // Soft rain filter with gentle movement
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, this.ctx.currentTime);

    noiseSource.connect(filter);
    noiseSource.start();
    return filter;
  }

  public start() {
    if (this.isRunning) return;
    this.initContext();
    this.isRunning = true;

    // Start procedural rain
    if (this.ctx && this.rainGain) {
      this.rainNode = this.createRainSoundscape();
      this.rainNode.connect(this.rainGain);
    }

    // Start chord loop
    this.triggerChord();
    this.chordTimer = window.setInterval(() => {
      this.triggerChord();
    }, 5500);
  }

  public stop() {
    this.isRunning = false;
    if (this.chordTimer !== null) {
      clearInterval(this.chordTimer);
      this.chordTimer = null;
    }
    if (this.rainNode) {
      try {
        this.rainNode.disconnect();
      } catch {
        // Safe ignore
      }
      this.rainNode = null;
    }
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

  public isActive(): boolean {
    return this.isRunning;
  }

  public setMasterVolume(val: number) {
    if (this.masterGain && this.ctx) {
      const clamped = Math.max(0, Math.min(1, val));
      this.masterGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
  }
}

export const lofiAudio = new LofiAudioEngine();

