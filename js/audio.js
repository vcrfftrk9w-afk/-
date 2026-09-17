'use strict';
/* =========================================================
   SOUND — многослойный генератор фоновых звуков + SFX
   Всё синтезируется на лету через Web Audio API, без файлов.
   ========================================================= */

const Sound = (() => {
  let ctx = null;
  let master = null;      // общий выход эмбиента
  let analyser = null;
  let sfxGain = null;
  let whiteBuf = null;
  let brownBuf = null;
  const layers = {};      // id -> { gain, nodes[], timers[] }
  let masterVolume = 0.6;

  function ready() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = masterVolume;
      analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.3;
      master.connect(analyser);
      analyser.connect(ctx.destination);
      sfxGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  /* ---------- буферы шума ---------- */
  function noiseBuffer(brown) {
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
      else d[i] = w;
    }
    return buf;
  }
  function white() { if (!whiteBuf) whiteBuf = noiseBuffer(false); return whiteBuf; }
  function brown() { if (!brownBuf) brownBuf = noiseBuffer(true); return brownBuf; }

  function noiseSource(brownish) {
    const src = ctx.createBufferSource();
    src.buffer = brownish ? brown() : white();
    src.loop = true;
    src.start();
    return src;
  }

  function lfo(freq, depth, target) {
    const osc = ctx.createOscillator();
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = depth;
    osc.connect(g).connect(target);
    osc.start();
    return [osc, g];
  }

  /* ---------- одиночные всплески (потрескивания, птицы, гром) ---------- */
  function burst({ type = 'noise', freq = 800, dur = 0.12, vol = 0.3, filter = 'bandpass', q = 1, out }) {
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), now + Math.min(0.02, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    let src;
    if (type === 'noise') {
      src = ctx.createBufferSource();
      src.buffer = white();
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = filter;
      f.frequency.value = freq;
      f.Q.value = q;
      src.connect(f).connect(g);
      src.start(now);
      src.stop(now + dur + 0.05);
    } else {
      src = ctx.createOscillator();
      src.type = type;
      src.frequency.setValueAtTime(freq, now);
      if (type === 'sine') src.frequency.exponentialRampToValueAtTime(freq * 1.6, now + dur);
      src.connect(g);
      src.start(now);
      src.stop(now + dur + 0.05);
    }
    g.connect(out || master);
  }

  /* ---------- построение слоёв ---------- */
  function buildLayer(id, gain) {
    const nodes = [];
    const timers = [];
    const add = (...n) => nodes.push(...n);

    if (id === 'white') {
      const src = noiseSource(false);
      const g = ctx.createGain(); g.gain.value = 0.25;
      src.connect(g).connect(gain); add(src, g);

    } else if (id === 'brown') {
      const src = noiseSource(true);
      const g = ctx.createGain(); g.gain.value = 0.5;
      src.connect(g).connect(gain); add(src, g);

    } else if (id === 'rain') {
      const src = noiseSource(false);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.55;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 600;
      const g = ctx.createGain(); g.gain.value = 0.35;
      src.connect(bp).connect(hp).connect(g).connect(gain);
      add(src, bp, hp, g, ...lfo(0.13, 0.07, g.gain));

    } else if (id === 'storm') {
      const src = noiseSource(false);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.5;
      const g = ctx.createGain(); g.gain.value = 0.3;
      src.connect(bp).connect(g).connect(gain);
      add(src, bp, g, ...lfo(0.09, 0.08, g.gain));
      const rumble = () => {
        burst({ type: 'noise', freq: 90 + Math.random() * 120, dur: 1.4 + Math.random(), vol: 0.5, filter: 'lowpass', q: 0.7, out: gain });
        timers.push(setTimeout(rumble, 9000 + Math.random() * 16000));
      };
      timers.push(setTimeout(rumble, 2500 + Math.random() * 6000));

    } else if (id === 'fire') {
      const src = noiseSource(true);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      const g = ctx.createGain(); g.gain.value = 0.45;
      src.connect(lp).connect(g).connect(gain);
      add(src, lp, g, ...lfo(0.3, 0.1, g.gain));
      const crackle = () => {
        burst({ type: 'noise', freq: 1600 + Math.random() * 2600, dur: 0.05 + Math.random() * 0.09, vol: 0.18 + Math.random() * 0.2, filter: 'highpass', q: 1.2, out: gain });
        timers.push(setTimeout(crackle, 120 + Math.random() * 700));
      };
      timers.push(setTimeout(crackle, 300));

    } else if (id === 'forest') {
      const src = noiseSource(false);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.4;
      const g = ctx.createGain(); g.gain.value = 0.22;
      src.connect(bp).connect(g).connect(gain);
      add(src, bp, g, ...lfo(0.07, 0.1, g.gain));
      const bird = () => {
        const f = 1800 + Math.random() * 2200;
        burst({ type: 'sine', freq: f, dur: 0.12 + Math.random() * 0.14, vol: 0.12, out: gain });
        if (Math.random() < 0.5) setTimeout(() => burst({ type: 'sine', freq: f * 1.1, dur: 0.1, vol: 0.1, out: gain }), 180);
        timers.push(setTimeout(bird, 2500 + Math.random() * 9000));
      };
      timers.push(setTimeout(bird, 1500 + Math.random() * 3000));

    } else if (id === 'waves') {
      const src = noiseSource(false);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const g = ctx.createGain(); g.gain.value = 0.18;
      src.connect(lp).connect(g).connect(gain);
      add(src, lp, g, ...lfo(0.12, 0.17, g.gain), ...lfo(0.12, 450, lp.frequency));

    } else if (id === 'cafe') {
      const src = noiseSource(true);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.8;
      const g = ctx.createGain(); g.gain.value = 0.4;
      src.connect(bp).connect(g).connect(gain);
      add(src, bp, g, ...lfo(0.4, 0.12, g.gain));
      const murmur = () => {
        burst({ type: 'noise', freq: 400 + Math.random() * 900, dur: 0.25 + Math.random() * 0.5, vol: 0.12, filter: 'bandpass', q: 3, out: gain });
        timers.push(setTimeout(murmur, 500 + Math.random() * 2200));
      };
      const clink = () => {
        burst({ type: 'triangle', freq: 2200 + Math.random() * 1800, dur: 0.14, vol: 0.06, out: gain });
        timers.push(setTimeout(clink, 6000 + Math.random() * 15000));
      };
      timers.push(setTimeout(murmur, 400), setTimeout(clink, 5000));

    } else if (id === 'fan') {
      const src = noiseSource(true);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      const g = ctx.createGain(); g.gain.value = 0.5;
      src.connect(lp).connect(g).connect(gain);
      const hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 62;
      const humG = ctx.createGain(); humG.gain.value = 0.06;
      hum.connect(humG).connect(gain); hum.start();
      add(src, lp, g, hum, humG, ...lfo(7, 0.05, g.gain));

    } else if (id === 'binaural') {
      [196, 206].forEach((f, i) => {
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = f;
        const g = ctx.createGain(); g.gain.value = 0.17;
        if (ctx.createStereoPanner) {
          const pan = ctx.createStereoPanner(); pan.pan.value = i === 0 ? -1 : 1;
          osc.connect(pan).connect(g).connect(gain); add(pan);
        } else {
          osc.connect(g).connect(gain);
        }
        osc.start(); add(osc, g);
      });

    } else if (id === 'lofi') {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 2;
      const g = ctx.createGain(); g.gain.value = 0.16;
      lp.connect(g).connect(gain);
      [110, 164.81, 220, 277.18].forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = i % 2 === 0 ? 'triangle' : 'sine';
        osc.frequency.value = f;
        osc.detune.value = (Math.random() - 0.5) * 12;
        osc.connect(lp); osc.start(); add(osc);
      });
      add(lp, g, ...lfo(0.05, 420, lp.frequency));

    } else if (id === 'clock') {
      const tick = () => {
        burst({ type: 'noise', freq: 2600, dur: 0.035, vol: 0.35, filter: 'bandpass', q: 6, out: gain });
        timers.push(setTimeout(tick, 1000));
      };
      timers.push(setTimeout(tick, 200));
    }

    return { nodes, timers };
  }

  function stopLayer(id) {
    const L = layers[id];
    if (!L) return;
    L.timers.forEach(clearTimeout);
    L.nodes.forEach((n) => { try { n.stop && n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} });
    try { L.gain.disconnect(); } catch (e) {}
    delete layers[id];
  }

  /* volume: 0..1 */
  function setLayer(id, volume) {
    if (volume > 0 && !ready()) return;
    if (volume <= 0) { stopLayer(id); return; }
    if (!layers[id]) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(master);
      const built = buildLayer(id, gain);
      layers[id] = { gain, nodes: built.nodes, timers: built.timers };
    }
    const g = layers[id].gain.gain;
    const now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(volume, now + 0.4);
  }

  function applyMix(mix) {
    Data.SOUND_LAYERS.forEach((l) => setLayer(l.id, (mix && mix[l.id]) || 0));
  }

  function stopAll() {
    Object.keys(layers).forEach(stopLayer);
  }

  function setMasterVolume(v) {
    masterVolume = v;
    if (master) master.gain.value = v;
  }

  function activeLayers() { return Object.keys(layers); }

  /* ---------- SFX ---------- */
  const PATTERNS = {
    click: [[430, 0.05, 'sine', 0.25]],
    check: [[560, 0.06, 'triangle', 0.3], [820, 0.09, 'triangle', 0.3]],
    coin: [[900, 0.05, 'square', 0.22], [1350, 0.1, 'square', 0.22]],
    success: [[523, 0.08, 'triangle', 0.3], [659, 0.08, 'triangle', 0.3], [784, 0.14, 'triangle', 0.3]],
    levelup: [[523, 0.1, 'sawtooth', 0.22], [659, 0.1, 'sawtooth', 0.22], [784, 0.1, 'sawtooth', 0.22], [1046, 0.24, 'sawtooth', 0.24]],
    fanfare: [[523, 0.12, 'square', 0.2], [784, 0.12, 'square', 0.2], [1046, 0.12, 'square', 0.2], [1318, 0.3, 'square', 0.22]],
    quest: [[700, 0.07, 'triangle', 0.28], [1050, 0.13, 'triangle', 0.28]],
    buy: [[300, 0.06, 'square', 0.2], [600, 0.06, 'square', 0.2], [900, 0.12, 'square', 0.2]],
    pop: [[320, 0.045, 'sine', 0.35]],
    deny: [[170, 0.14, 'sawtooth', 0.22]],
    whoosh: [[240, 0.16, 'sine', 0.2]],
    tick: [[1200, 0.03, 'square', 0.12]],
    start: [[420, 0.07, 'triangle', 0.25], [630, 0.1, 'triangle', 0.25]],
  };

  function sfx(name) {
    if (!State.s.sfx) return;
    if (!ready()) return;
    const seq = PATTERNS[name] || PATTERNS.click;
    let t = ctx.currentTime;
    seq.forEach(([freq, dur, wave, vol]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = wave;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(sfxGain);
      osc.start(t);
      osc.stop(t + dur + 0.03);
      t += dur * 0.6;
    });
  }

  /* ---------- данные для визуализатора ---------- */
  function levels(count) {
    if (!analyser || !Object.keys(layers).length) return null;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const step = Math.max(1, Math.floor(data.length / count));
    const out = [];
    for (let i = 0; i < count; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
      out.push(sum / step / 255);
    }
    return out;
  }

  return { ready, setLayer, applyMix, stopAll, setMasterVolume, activeLayers, sfx, levels };
})();
