export class GameFeedback {
  constructor() {
    this.enabled = true;
    this.context = null;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    return this.enabled;
  }

  async unlock() {
    if (!this.enabled) return;
    const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContext) return;
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") await this.context.resume();
  }

  play(type) {
    if (!this.enabled || !this.context) return;
    const profiles = {
      shot: [130, 0.045, "square", 0.12],
      hit: [620, 0.12, "sine", 0.09],
      miss: [95, 0.18, "sawtooth", 0.06],
      clear: [820, 0.28, "triangle", 0.08],
    };
    const profile = profiles[type];
    if (!profile) return;
    const [frequency, duration, shape, gainValue] = profile;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = shape;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.72), now + duration);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  vibrate(pattern = 20) {
    if (this.enabled) globalThis.navigator?.vibrate?.(pattern);
  }
}
