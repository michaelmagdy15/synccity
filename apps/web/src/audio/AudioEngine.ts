/**
 * SyncCity Synthesized Web Audio Engine
 * Zero external audio assets required. Synthesizes real-time engine sounds,
 * tire screeching, countdown beeps, checkpoint pass chimes, and door clunks.
 * Unlocks automatically on first touch/click per iOS Safari policy.
 */

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isUnlocked: boolean = false;

  // Engine sound nodes
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private isEngineRunning: boolean = false;

  // Tire screech nodes
  private tireNoiseNode: AudioBufferSourceNode | null = null;
  private tireNoiseBuffer: AudioBuffer | null = null;
  private tireGain: GainNode | null = null;
  private tireFilter: BiquadFilterNode | null = null;

  constructor() {
    // Lazy AudioContext initialization on first user interaction
    const unlockHandler = () => {
      this.unlock();
      window.removeEventListener('touchstart', unlockHandler);
      window.removeEventListener('touchend', unlockHandler);
      window.removeEventListener('click', unlockHandler);
      window.removeEventListener('keydown', unlockHandler);
    };

    window.addEventListener('touchstart', unlockHandler, { passive: true });
    window.addEventListener('touchend', unlockHandler, { passive: true });
    window.addEventListener('click', unlockHandler, { passive: true });
    window.addEventListener('keydown', unlockHandler, { passive: true });
  }

  public unlock(): void {
    if (this.isUnlocked && this.ctx && this.ctx.state === 'running') return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }

      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      this.createTireNoiseBuffer();
      this.isUnlocked = true;
    } catch (e) {
      console.warn('[AudioEngine] Could not initialize Web Audio:', e);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopEngine();
      if (this.tireGain) this.tireGain.gain.value = 0;
    }
    return this.isMuted;
  }

  public get muted(): boolean {
    return this.isMuted;
  }

  // --- Engine Sound Synthesis ---
  public startEngine(): void {
    if (!this.ctx || this.isMuted || this.isEngineRunning) return;

    try {
      const now = this.ctx.currentTime;

      // Dual sawtooth + square oscillators for rich retro arcade combustion tone
      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc1.frequency.setValueAtTime(45, now);

      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'square';
      this.engineOsc2.frequency.setValueAtTime(90, now);

      this.engineSubOsc = this.ctx.createOscillator();
      this.engineSubOsc.type = 'triangle';
      this.engineSubOsc.frequency.setValueAtTime(22.5, now);

      // Lowpass filter to muffle idle rumble and open up with throttle
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(280, now);
      this.engineFilter.Q.setValueAtTime(3.5, now);

      // Master engine gain
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.001, now);
      this.engineGain.gain.exponentialRampToValueAtTime(0.18, now + 0.15);

      this.engineOsc1.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineSubOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc1.start(now);
      this.engineOsc2.start(now);
      this.engineSubOsc.start(now);

      this.isEngineRunning = true;
    } catch (e) {
      console.warn('[AudioEngine] startEngine error:', e);
    }
  }

  public updateEngine(speedKmh: number, throttle: number): void {
    if (!this.isEngineRunning || !this.ctx || !this.engineOsc1 || !this.engineFilter || !this.engineGain) return;
    if (this.isMuted) return;

    const absSpeed = Math.abs(speedKmh);
    const speedRatio = Math.min(1, absSpeed / 90); // 0 to 1
    const throttleBoost = Math.max(0, throttle) * 0.4;

    // Pitch: 45Hz idle -> 240Hz top speed
    const baseFreq = 48 + speedRatio * 180 + throttleBoost * 40;
    const filterFreq = 300 + speedRatio * 1200 + throttleBoost * 800;
    const targetGain = 0.14 + speedRatio * 0.12 + throttleBoost * 0.08;

    const now = this.ctx.currentTime;
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.05);
    if (this.engineOsc2) this.engineOsc2.frequency.setTargetAtTime(baseFreq * 2, now, 0.05);
    if (this.engineSubOsc) this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.05);
    this.engineFilter.frequency.setTargetAtTime(filterFreq, now, 0.08);
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.05);
  }

  public stopEngine(): void {
    if (!this.isEngineRunning) return;
    try {
      if (this.ctx && this.engineGain) {
        const now = this.ctx.currentTime;
        this.engineGain.gain.linearRampToValueAtTime(0.001, now + 0.1);
        setTimeout(() => {
          this.engineOsc1?.stop();
          this.engineOsc2?.stop();
          this.engineSubOsc?.stop();
          this.engineOsc1?.disconnect();
          this.engineOsc2?.disconnect();
          this.engineSubOsc?.disconnect();
          this.isEngineRunning = false;
        }, 120);
      } else {
        this.isEngineRunning = false;
      }
    } catch {
      this.isEngineRunning = false;
    }
  }

  // --- Tire Screech Synthesis ---
  private createTireNoiseBuffer(): void {
    if (!this.ctx) return;
    // 2 seconds of looping white noise
    const bufferSize = this.ctx.sampleRate * 2;
    this.tireNoiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.tireNoiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  public updateTireScreech(isDriftingOrBraking: boolean, intensity: number): void {
    if (!this.ctx || this.isMuted) return;

    if (!this.tireNoiseNode && isDriftingOrBraking && this.tireNoiseBuffer) {
      try {
        const now = this.ctx.currentTime;
        this.tireNoiseNode = this.ctx.createBufferSource();
        this.tireNoiseNode.buffer = this.tireNoiseBuffer;
        this.tireNoiseNode.loop = true;

        this.tireFilter = this.ctx.createBiquadFilter();
        this.tireFilter.type = 'bandpass';
        this.tireFilter.frequency.setValueAtTime(1400, now);
        this.tireFilter.Q.setValueAtTime(6.0, now);

        this.tireGain = this.ctx.createGain();
        this.tireGain.gain.setValueAtTime(0.001, now);

        this.tireNoiseNode.connect(this.tireFilter);
        this.tireFilter.connect(this.tireGain);
        this.tireGain.connect(this.ctx.destination);

        this.tireNoiseNode.start(now);
      } catch (e) {
        console.warn('[AudioEngine] tire screech start error:', e);
      }
    }

    if (this.tireGain && this.ctx) {
      const now = this.ctx.currentTime;
      const targetGain = isDriftingOrBraking ? Math.min(0.22, intensity * 0.22) : 0.0001;
      this.tireGain.gain.setTargetAtTime(targetGain, now, 0.06);
    }
  }

  // --- Sound FX: Countdown Beep ---
  public playCountdownBeep(isFinalGo: boolean): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = isFinalGo ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(isFinalGo ? 880 : 440, now); // A5 for GO, A4 for 3-2-1

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.35, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (isFinalGo ? 0.6 : 0.25));

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + (isFinalGo ? 0.65 : 0.3));
    } catch {}
  }

  // --- Sound FX: Checkpoint Gate Pass ---
  public playCheckpointChime(): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch {}
  }

  // --- Sound FX: Lap Complete Fanfare ---
  public playLapFanfare(): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio
      notes.forEach((freq, i) => {
        const now = this.ctx!.currentTime + i * 0.08;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now);
        osc.stop(now + 0.35);
      });
    } catch {}
  }

  // --- Sound FX: Vehicle Door Enter/Exit Clunk ---
  public playDoorClunk(): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch {}
  }
}
