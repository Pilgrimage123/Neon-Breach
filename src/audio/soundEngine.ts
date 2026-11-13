const MUTE_KEY = 'neon_breach_muted_v1';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(next: boolean): void {
    this.muted = next;
    try {
      localStorage.setItem(MUTE_KEY, next ? '1' : '0');
    } catch {
      // Ignore storage failures
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    gainLevel: number,
    delay = 0,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainLevel, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playClick(): void {
    this.playTone(680, 480, 0.05, 'triangle', 0.05);
  }

  public playHover(): void {
    this.playTone(940, 1020, 0.035, 'sine', 0.022);
  }

  public playSlash(surge = false): void {
    const jitter = 0.94 + Math.random() * 0.12;
    this.playTone(460 * jitter, 140, 0.16, 'sawtooth', 0.09);
    this.playTone(920 * jitter, 280, 0.12, 'triangle', 0.06, 0.02);
    if (surge) {
      this.playTone(1320, 320, 0.24, 'sawtooth', 0.08, 0.05);
    }
  }

  public playShield(surge = false): void {
    this.playTone(320, 520, 0.18, 'sine', 0.08);
    this.playTone(480, 760, 0.2, 'triangle', 0.06, 0.03);
    if (surge) {
      this.playTone(640, 960, 0.24, 'sine', 0.07, 0.07);
    }
  }

  public playUpgrade(surge = false): void {
    const notes = surge ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
    notes.forEach((n, idx) => {
      this.playTone(n, n * 1.02, 0.14, 'triangle', 0.065, idx * 0.055);
    });
  }

  public playOverdrive(): void {
    this.playTone(180, 55, 0.35, 'sawtooth', 0.12);
    this.playTone(440, 880, 0.28, 'triangle', 0.09, 0.04);
    this.playTone(660, 1320, 0.32, 'sine', 0.07, 0.08);
  }

  public playEnemyHit(): void {
    this.playTone(190, 72, 0.14, 'square', 0.07);
    this.playTone(120, 55, 0.16, 'sawtooth', 0.05, 0.02);
  }

  public playAcidSpit(): void {
    this.playTone(540, 210, 0.18, 'sawtooth', 0.06);
    this.playTone(380, 160, 0.15, 'triangle', 0.05, 0.04);
  }

  public playEnemyArmor(): void {
    this.playTone(260, 340, 0.12, 'square', 0.045);
  }

  public playVictory(): void {
    const chord = [440, 554.37, 659.25, 880];
    chord.forEach((f, idx) => {
      this.playTone(f, f, 0.34, 'triangle', 0.07, idx * 0.08);
    });
  }

  public playDefeat(): void {
    const notes = [330, 277.18, 220, 146.83];
    notes.forEach((f, idx) => {
      this.playTone(f, f * 0.92, 0.28, 'sawtooth', 0.06, idx * 0.1);
    });
  }
}

export const soundEngine = new SoundEngine();
