/* =========================================================================
 * SoundManager — synthesized placeholder SFX via Web Audio (no asset files).
 * Reusable: register named sounds as small synth recipes, play by name.
 * ========================================================================= */
class SoundManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.recipes = {
      shoot:     () => this._blip(520, 220, 0.09, 'triangle', 0.35),
      pop:       () => this._blip(660, 880, 0.10, 'sine', 0.30, true),
      explosion: () => this._noiseBurst(0.28, 0.5),
      click:     () => this._blip(440, 620, 0.06, 'square', 0.25),
      swap:      () => this._blip(380, 720, 0.08, 'sine', 0.28),
      impact:    () => this._blip(300, 520, 0.06, 'sine', 0.22, true),
      fall:      () => this._blip(300, 170, 0.14, 'sine', 0.18),
      star:      () => this._blip(880, 1320, 0.12, 'triangle', 0.30, true),
      combo:     () => this._arpeggio([659, 784, 988, 1319], 0.07, 'triangle', 0.26),
      victory:   () => this._arpeggio([523, 659, 784, 1047], 0.12, 'triangle'),
      failure:   () => this._arpeggio([392, 349, 294, 220], 0.16, 'sawtooth', 0.22),
    };
    this._pitch = 1;
  }

  _ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
  }

  resume() { this._ensure(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.6; return this.muted; }

  play(name, pitch = 1) {
    if (this.muted) return;
    this._ensure();
    if (!this.ctx) return;
    this._pitch = pitch || 1;
    const recipe = this.recipes[name];
    if (recipe) recipe();
    this._pitch = 1;
  }

  _blip(f0, f1, dur, type = 'sine', gain = 0.3, up = false) {
    const t = this.ctx.currentTime;
    const k = this._pitch || 1;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime((up ? f0 : f1) * k, t);
    osc.frequency.exponentialRampToValueAtTime((up ? f1 : f0) * k, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  _noiseBurst(dur, gain = 0.4) {
    const t = this.ctx.currentTime;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource(); src.buffer = buffer;
    const g = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.setValueAtTime(1800, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur);
  }

  _arpeggio(freqs, step, type = 'triangle', gain = 0.28) {
    const k = this._pitch || 1;
    freqs.forEach((f, i) => {
      const t = this.ctx.currentTime + i * step;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(f * k, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + step * 1.6);
      osc.connect(g); g.connect(this.master);
      osc.start(t); osc.stop(t + step * 1.7);
    });
  }
}
