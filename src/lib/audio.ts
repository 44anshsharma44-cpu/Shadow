class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume: number = 0.5;

  constructor() {
    // Lazy-initialize audio context on the first user action
  }

  private init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.error('Failed to initialize AudioContext:', e);
    }
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public playPunch() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Fast noise sweep for the glove whoosh
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.1);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(now);

    // Punch impact slap (sine wave pitch drop)
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);

    oscGain.gain.setValueAtTime(0.7, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playHook() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Noise sweep for slightly longer swing
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(320, now);
    filter.frequency.exponentialRampToValueAtTime(70, now + 0.15);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(now);

    // Lower, heavier impact for a hook
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);

    oscGain.gain.setValueAtTime(0.9, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playUppercut() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Rising noise whoosh
    const bufferSize = this.ctx.sampleRate * 0.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(160, now);
    filter.frequency.linearRampToValueAtTime(550, now + 0.1);
    filter.frequency.exponentialRampToValueAtTime(90, now + 0.2);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(now);

    // Dynamic rising bass sub slap
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.18);

    oscGain.gain.setValueAtTime(0.0, now);
    oscGain.gain.linearRampToValueAtTime(1.1, now + 0.04);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playBlock() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // A dull thud for a successful block
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.06);

    oscGain.gain.setValueAtTime(0.5, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

    // High frequency resonance slap
    const res = this.ctx.createOscillator();
    const resGain = this.ctx.createGain();
    res.type = 'sine';
    res.frequency.setValueAtTime(750, now);
    resGain.gain.setValueAtTime(0.15, now);
    resGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    res.connect(resGain);
    resGain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.06);

    res.start(now);
    res.stop(now + 0.03);
  }

  public playBell() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    const gain2 = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // Ring note
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174, now); // Harmonic overtone
    gain2.gain.setValueAtTime(0.2, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc1.connect(gain1);
    gain1.connect(this.masterGain);

    osc2.connect(gain2);
    gain2.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);

    osc1.stop(now + 1.2);
    osc2.stop(now + 0.7);
  }

  public playKnockout() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(30, now + 1.8);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, now);
    filter.frequency.exponentialRampToValueAtTime(50, now + 1.8);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.8);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 1.8);
  }

  public playCrowd() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const duration = 2.0;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Dynamic noise gen
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.0;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.linearRampToValueAtTime(800, now + 0.4);
    filter.frequency.linearRampToValueAtTime(400, now + 2.0);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    source.start(now);
    source.stop(now + 2.0);
  }
}

export const audioManager = typeof window !== 'undefined' ? new AudioManager() : null;
