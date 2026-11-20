const MUTE_KEY = 'neon_breach_muted_v1';

export type HapticKind = 'select' | 'surge' | 'invalid' | 'commit';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private hapticsEnabled: boolean = true;

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

  public setHapticsEnabled(next: boolean): void {
    this.hapticsEnabled = next;
  }

  /**
   * Cross-platform Haptic Feedback ("Third Sense" on Mobile + DOM attribute trace for testing).
   * - 'select': Crisp 12ms single tap when selecting a valid tile or node
   * - 'surge': Double-pulse [14, 32, 24]ms when hovering/selecting a matching Stack Surge
   * - 'invalid': Rough buzz [38, 24, 48]ms for jammed tiles or invalid placements
   * - 'commit': Heavy impact [24, 28, 52]ms on turn resolution or Overdrive
   */
  public triggerHaptic(kind: HapticKind): void {
    if (typeof document !== 'undefined' && document.body) {
      document.body.dataset.lastHaptic = kind;
    }
    if (!this.hapticsEnabled) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        if (kind === 'select') navigator.vibrate(12);
        else if (kind === 'surge') navigator.vibrate([14, 32, 24]);
        else if (kind === 'invalid') navigator.vibrate([38, 24, 48]);
        else if (kind === 'commit') navigator.vibrate([24, 28, 52]);
      } catch {
        // Ignore on desktop browsers blocking vibration API
      }
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
    this.triggerHaptic('select');
    this.playTone(680, 480, 0.05, 'triangle', 0.05);
  }

  public playHover(isSurge = false): void {
    this.triggerHaptic(isSurge ? 'surge' : 'select');
    this.playTone(isSurge ? 1080 : 940, isSurge ? 1320 : 1020, 0.035, 'sine', 0.024);
  }

  public playInvalidBuzz(): void {
    this.triggerHaptic('invalid');
    this.playTone(155, 110, 0.11, 'sawtooth', 0.055);
    this.playTone(135, 92, 0.12, 'square', 0.045, 0.05);
  }

  public playSlash(surge = false): void {
    this.triggerHaptic('commit');
    const jitter = 0.94 + Math.random() * 0.12;
    this.playTone(460 * jitter, 140, 0.16, 'sawtooth', 0.09);
    this.playTone(920 * jitter, 280, 0.12, 'triangle', 0.06, 0.02);
    if (surge) {
      this.playTone(1320, 320, 0.24, 'sawtooth', 0.08, 0.05);
    }
  }

  public playShield(surge = false): void {
    this.triggerHaptic('commit');
    this.playTone(320, 520, 0.18, 'sine', 0.08);
    this.playTone(480, 760, 0.2, 'triangle', 0.06, 0.03);
    if (surge) {
      this.playTone(640, 960, 0.24, 'sine', 0.07, 0.07);
    }
  }

  public playDodgeWhoosh(): void {
    this.triggerHaptic('select');
    // Fluid upward vault air-slice (Beat 1: 0.00..0.23s)
    this.playTone(980, 330, 0.18, 'triangle', 0.06);
    this.playTone(1400, 620, 0.14, 'sine', 0.04, 0.03);
    // Extended neon power-slide synth skid shimmer (Beats 2-3: 0.23..0.67s)
    this.playTone(580, 1020, 0.24, 'sine', 0.036, 0.23);
    this.playTone(760, 440, 0.18, 'triangle', 0.028, 0.46);
    // Crisp 3-point landing deck tap (Beat 4: 0.67s)
    this.playTone(210, 84, 0.11, 'triangle', 0.048, 0.67);
  }

  public playUpgrade(surge = false): void {
    this.triggerHaptic('commit');
    const notes = surge ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
    notes.forEach((n, idx) => {
      this.playTone(n, n * 1.02, 0.14, 'triangle', 0.065, idx * 0.055);
    });
  }

  public playOverdrive(): void {
    this.triggerHaptic('commit');
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

  public playShieldPipCrack(): void {
    this.playTone(1240, 620, 0.11, 'triangle', 0.075);
    this.playTone(1680, 420, 0.14, 'sine', 0.06, 0.025);
  }

  public playBioBurst(): void {
    this.playTone(210, 58, 0.24, 'sawtooth', 0.095);
    this.playTone(420, 115, 0.19, 'triangle', 0.07, 0.03);
  }

  public playRetaliateSpike(): void {
    this.playTone(760, 190, 0.13, 'sawtooth', 0.08);
    this.playTone(340, 110, 0.14, 'square', 0.06, 0.02);
  }

  public playEnemyCharge(): void {
    this.playTone(220, 580, 0.22, 'sine', 0.055);
    this.playTone(330, 740, 0.18, 'triangle', 0.045, 0.04);
  }

  public playTelegraphPing(): void {
    this.playTone(740, 980, 0.14, 'sine', 0.045);
    this.playTone(1180, 1180, 0.09, 'triangle', 0.03, 0.06);
  }

  public playDropArrival(): void {
    this.playTone(280, 95, 0.22, 'sawtooth', 0.065);
    this.playTone(520, 240, 0.16, 'triangle', 0.05, 0.03);
  }

  public playOverheatWarning(): void {
    this.playTone(440, 310, 0.18, 'sawtooth', 0.055);
    this.playTone(440, 310, 0.18, 'sawtooth', 0.045, 0.12);
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
