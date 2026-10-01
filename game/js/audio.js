'use strict';
// Синтезированные звуки: без файлов, всё собирается из шума и осцилляторов.

const Sound = {
  ctx: null, master: null, noise: null, muted: false, wind: null,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // ветер
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
    const g = this.ctx.createGain(); g.gain.value = 0.035;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
    this.wind = { f, g };
  },

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  },

  windLevel(v) { if (this.wind) this.wind.g.gain.setTargetAtTime(v, this.ctx.currentTime, 1.5); },

  burst(t, dur, vol, type, freq, q = 1, sweepTo) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },
  tone(t, dur, vol, type, f0, f1) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + dur + 0.02);
  },

  // vol — 0..1, уже с учётом расстояния
  play(name, vol = 1) {
    if (!this.ctx || this.muted || vol < 0.03) return;
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain(); g.gain.value = vol; g.connect(this.master);
    this.out = g;
    switch (name) {
      case 'wood': this.tone(t, 0.12, 0.5, 'triangle', 170, 70); this.burst(t, 0.09, 0.35, 'bandpass', 900, 2); break;
      case 'stone': this.burst(t, 0.08, 0.5, 'highpass', 2500, 1); this.tone(t, 0.06, 0.25, 'square', 820, 400); break;
      case 'flesh': this.burst(t, 0.12, 0.5, 'lowpass', 700, 1); this.tone(t, 0.1, 0.2, 'sine', 140, 60); break;
      case 'swing': this.burst(t, 0.16, 0.18, 'bandpass', 600, 1.5, 2400); break;
      case 'gun': this.burst(t, 0.32, 0.9, 'lowpass', 3000, 0.7, 300); this.tone(t, 0.12, 0.5, 'sine', 160, 45); break;
      case 'shotgun': this.burst(t, 0.5, 1, 'lowpass', 2200, 0.7, 180); this.tone(t, 0.2, 0.6, 'sine', 120, 35); break;
      case 'bow': this.tone(t, 0.18, 0.35, 'triangle', 320, 120); this.burst(t, 0.1, 0.15, 'bandpass', 1600, 3); break;
      case 'npcgun': this.burst(t, 0.28, 0.6, 'lowpass', 2000, 0.7, 260); break;
      case 'pickup': this.tone(t, 0.09, 0.22, 'sine', 620, 940); break;
      case 'craft': this.tone(t, 0.07, 0.2, 'square', 440); this.tone(t + 0.08, 0.1, 0.2, 'square', 660); break;
      case 'hurt': this.tone(t, 0.22, 0.35, 'sawtooth', 220, 90); this.burst(t, 0.15, 0.3, 'lowpass', 900); break;
      case 'door': this.tone(t, 0.18, 0.4, 'triangle', 110, 60); this.burst(t, 0.1, 0.2, 'lowpass', 500); break;
      case 'build': this.tone(t, 0.08, 0.4, 'triangle', 200, 120); this.tone(t + 0.1, 0.08, 0.35, 'triangle', 220, 130); break;
      case 'eat': for (let i = 0; i < 3; i++) this.burst(t + i * 0.09, 0.06, 0.3, 'bandpass', 1800, 2); break;
      case 'drink': for (let i = 0; i < 3; i++) this.tone(t + i * 0.1, 0.08, 0.2, 'sine', 300 + i * 40, 500); break;
      case 'reload': this.burst(t, 0.05, 0.3, 'highpass', 3000); this.burst(t + 0.25, 0.05, 0.35, 'highpass', 2500); break;
      case 'empty': this.tone(t, 0.04, 0.2, 'square', 1200, 900); break;
      case 'break': this.burst(t, 0.35, 0.6, 'lowpass', 1400, 0.8, 200); this.tone(t, 0.2, 0.3, 'triangle', 90, 50); break;
      case 'click': this.tone(t, 0.04, 0.15, 'square', 900); break;
      case 'growl': this.tone(t, 0.45, 0.3, 'sawtooth', 90, 70); this.burst(t, 0.4, 0.2, 'lowpass', 400); break;
      case 'death': this.tone(t, 0.9, 0.4, 'sawtooth', 180, 40); break;
      case 'plane': this.tone(t, 3, 0.25, 'sawtooth', 70, 60); this.burst(t, 3, 0.25, 'lowpass', 300); break;
      case 'alert': this.tone(t, 0.15, 0.3, 'square', 520); this.tone(t + 0.18, 0.2, 0.3, 'square', 390); break;
    }
  },
};
