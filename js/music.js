'use strict';
/* =========================================================
   MUSIC — генеративная музыка на Web Audio
   Аккорды, бас, пэд, арпеджио, барабаны, винил — всё синтезируется
   в реальном времени. Каждый «трек» — новый сид: паттерны не повторяются.
   ========================================================= */

const Music = (() => {

  /* ---------- станции ---------- */
  const STATIONS = [
    {
      id: 'lofi', emoji: '🎧', name: 'Lo-fi Chill', desc: 'Тёплый бит для рутины и учёбы',
      bpm: 74, swing: 0.18, root: 57, // A
      prog: [[0, 'm9'], [5, 'maj7'], [3, 'maj7'], [7, '7']],
      drums: 'lofi', pad: 0.055, bass: 0.13, pluck: 0.4, vinyl: true, filter: 1400,
    },
    {
      id: 'deep', emoji: '🌊', name: 'Глубокий фокус', desc: 'Без битов — только ровный поток',
      bpm: 58, swing: 0, root: 50, // D
      prog: [[0, 'm9'], [0, 'm9'], [5, 'maj7'], [3, 'maj7']],
      drums: false, pad: 0.075, bass: 0.1, pluck: 0.12, filter: 900, drone: true,
    },
    {
      id: 'energy', emoji: '⚡', name: 'Энергия', desc: 'Разогнать мозг, когда всё тормозит',
      bpm: 100, swing: 0.05, root: 55, // G
      prog: [[0, 'maj7'], [9, 'm7'], [2, '7'], [7, 'maj7']],
      drums: 'four', pad: 0.045, bass: 0.15, pluck: 0.55, arp: true, filter: 2200,
    },
    {
      id: 'space', emoji: '🌌', name: 'Космос', desc: 'Дроны и простор без ритма',
      bpm: 48, swing: 0, root: 45, // A низкая
      prog: [[0, 'm9'], [7, 'sus'], [5, 'maj7'], [10, 'maj7']],
      drums: false, pad: 0.085, bass: 0.09, pluck: 0.08, filter: 700, drone: true, wide: true,
    },
    {
      id: 'piano', emoji: '🎹', name: 'Пианино и дождь', desc: 'Капли и мягкие клавиши',
      bpm: 66, swing: 0.1, root: 60, // C
      prog: [[0, 'maj7'], [9, 'm7'], [5, 'maj7'], [7, 'sus']],
      drums: false, pad: 0.04, bass: 0.1, pluck: 0.5, piano: true, rain: true, filter: 2600,
    },
    {
      id: 'gamma', emoji: '🧠', name: 'Гамма 40 Гц', desc: 'Бинауральный ритм + ровный пульс',
      bpm: 60, swing: 0, root: 52, // E
      prog: [[0, 'sus'], [0, 'sus'], [5, 'sus'], [5, 'sus']],
      drums: 'pulse', pad: 0.06, bass: 0.1, pluck: 0.06, binaural: 40, filter: 800,
    },
    {
      id: 'sleep', emoji: '🌙', name: 'Засыпание', desc: 'Всё медленнее и тише',
      bpm: 46, swing: 0, root: 48, // C низкая
      prog: [[0, 'maj7'], [5, 'maj7'], [3, 'm9'], [7, 'sus']],
      drums: false, pad: 0.08, bass: 0.07, pluck: 0.1, filter: 600, drone: true, soft: true,
    },
  ];

  const CHORDS = {
    maj7: [0, 4, 7, 11],
    m7: [0, 3, 7, 10],
    m9: [0, 3, 7, 10, 14],
    7: [0, 4, 7, 10],
    sus: [0, 5, 7, 12],
  };

  /* ---------- состояние движка ---------- */
  let ctx = null;
  let bus = null;         // общий выход музыки
  let padBus, plucksBus, drumBus, bassBus, delayNode, delayFb;
  let vinylNodes = [];
  let binauralNodes = [];
  let playing = false;
  let stationId = 'lofi';
  let volume = 0.5;
  let bpmOverride = null;
  let seed = Date.now() % 100000;
  let rnd = mulberry32(seed);
  let step = 0;
  let nextTime = 0;
  let timer = null;
  let sleepTimer = null;
  let sleepEndsAt = 0;
  let minuteTimer = null;
  let onTick = null;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const station = () => STATIONS.find((s) => s.id === stationId) || STATIONS[0];
  const bpm = () => bpmOverride || station().bpm;
  const noteFreq = (n) => 440 * Math.pow(2, (n - 69) / 12);

  /* ---------- шина и эффекты ---------- */
  function buildBus() {
    if (bus) return true;
    ctx = Sound.context();
    if (!ctx) return false;
    bus = Sound.createBus(volume);

    delayNode = ctx.createDelay(1.2);
    delayFb = ctx.createGain();
    delayFb.gain.value = 0.3;
    const delayWet = ctx.createGain();
    delayWet.gain.value = 0.32;
    delayNode.connect(delayFb).connect(delayNode);
    delayNode.connect(delayWet).connect(bus);

    padBus = ctx.createGain(); padBus.gain.value = 1; padBus.connect(bus);
    bassBus = ctx.createGain(); bassBus.gain.value = 1; bassBus.connect(bus);
    drumBus = ctx.createGain(); drumBus.gain.value = 1; drumBus.connect(bus);
    plucksBus = ctx.createGain(); plucksBus.gain.value = 1;
    plucksBus.connect(bus);
    plucksBus.connect(delayNode);
    return true;
  }

  function noiseBuffer(seconds = 2) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  let sharedNoise = null;
  function noise() { if (!sharedNoise) sharedNoise = noiseBuffer(2); return sharedNoise; }

  /* ---------- инструменты ---------- */
  function env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function playPad(t, notes, dur, st) {
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(st.filter * 0.5, t);
    f.frequency.linearRampToValueAtTime(st.filter, t + dur * 0.6);
    f.Q.value = 0.7;
    env(g, t, st.pad, dur * 0.35, dur * 0.7);
    f.connect(g).connect(padBus);

    notes.forEach((n, i) => {
      const osc = ctx.createOscillator();
      osc.type = st.soft || st.drone ? 'sine' : 'sawtooth';
      osc.frequency.value = noteFreq(n);
      osc.detune.value = (i % 2 ? 6 : -6) + (rnd() - 0.5) * 8;
      osc.connect(f);
      osc.start(t);
      osc.stop(t + dur + 0.6);
      if (st.wide && ctx.createStereoPanner) {
        const pan = ctx.createStereoPanner();
        pan.pan.value = (i / Math.max(1, notes.length - 1)) * 1.6 - 0.8;
        osc.disconnect();
        osc.connect(pan).connect(f);
      }
    });
  }

  function playBass(t, n, dur, st) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(noteFreq(n), t);
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(noteFreq(n - 12), t);
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    env(g, t, st.bass, 0.03, dur);
    osc.connect(f); sub.connect(f);
    f.connect(g).connect(bassBus);
    osc.start(t); osc.stop(t + dur + 0.1);
    sub.start(t); sub.stop(t + dur + 0.1);
  }

  function playPluck(t, n, st, vel = 1) {
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(st.filter * 1.6, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(300, st.filter * 0.45), t + 0.5);
    const peak = (st.piano ? 0.12 : 0.09) * vel;
    env(g, t, peak, 0.008, st.piano ? 1.5 : 0.8);
    f.connect(g).connect(plucksBus);

    const osc = ctx.createOscillator();
    osc.type = st.piano ? 'triangle' : 'sine';
    osc.frequency.value = noteFreq(n);
    osc.connect(f);
    osc.start(t); osc.stop(t + 2);

    const harm = ctx.createOscillator();
    harm.type = 'sine';
    harm.frequency.value = noteFreq(n + 12);
    const hg = ctx.createGain();
    hg.gain.value = 0.25;
    harm.connect(hg).connect(f);
    harm.start(t); harm.stop(t + 1.2);
  }

  function playKick(t) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.14);
    const g = ctx.createGain();
    env(g, t, 0.5, 0.005, 0.28);
    osc.connect(g).connect(drumBus);
    osc.start(t); osc.stop(t + 0.4);
  }

  function playSnare(t, soft) {
    const src = ctx.createBufferSource();
    src.buffer = noise();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = soft ? 1400 : 1900;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    env(g, t, soft ? 0.12 : 0.22, 0.004, soft ? 0.12 : 0.18);
    src.connect(bp).connect(g).connect(drumBus);
    src.start(t); src.stop(t + 0.3);

    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(190, t);
    const bg = ctx.createGain();
    env(bg, t, 0.08, 0.004, 0.1);
    body.connect(bg).connect(drumBus);
    body.start(t); body.stop(t + 0.2);
  }

  function playHat(t, open) {
    const src = ctx.createBufferSource();
    src.buffer = noise();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7200;
    const g = ctx.createGain();
    env(g, t, open ? 0.06 : 0.04, 0.003, open ? 0.22 : 0.05);
    src.connect(hp).connect(g).connect(drumBus);
    src.start(t); src.stop(t + 0.35);
  }

  function playPulse(t) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 180;
    const g = ctx.createGain();
    env(g, t, 0.12, 0.02, 0.25);
    osc.connect(g).connect(drumBus);
    osc.start(t); osc.stop(t + 0.4);
  }

  /* ---------- винил и бинауральный слой ---------- */
  function startVinyl() {
    stopVinyl();
    const src = ctx.createBufferSource();
    src.buffer = noise();
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000;
    const g = ctx.createGain();
    g.gain.value = 0.012;
    src.connect(hp).connect(g).connect(bus);
    src.start();
    vinylNodes.push(src, hp, g);

    const crackle = () => {
      if (!playing) return;
      const t = ctx.currentTime;
      const s = ctx.createBufferSource();
      s.buffer = noise();
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 2200 + Math.random() * 3000; f.Q.value = 3;
      const cg = ctx.createGain();
      env(cg, t, 0.035 + Math.random() * 0.05, 0.002, 0.03);
      s.connect(f).connect(cg).connect(bus);
      s.start(t); s.stop(t + 0.1);
      vinylTimer = setTimeout(crackle, 120 + Math.random() * 900);
    };
    vinylTimer = setTimeout(crackle, 400);
  }
  let vinylTimer = null;

  function stopVinyl() {
    clearTimeout(vinylTimer);
    vinylNodes.forEach((n) => { try { n.stop && n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} });
    vinylNodes = [];
  }

  function startBinaural(beat) {
    stopBinaural();
    const base = 180;
    [base, base + beat].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.05;
      if (ctx.createStereoPanner) {
        const pan = ctx.createStereoPanner();
        pan.pan.value = i === 0 ? -1 : 1;
        osc.connect(pan).connect(g).connect(bus);
        binauralNodes.push(pan);
      } else {
        osc.connect(g).connect(bus);
      }
      osc.start();
      binauralNodes.push(osc, g);
    });
  }
  function stopBinaural() {
    binauralNodes.forEach((n) => { try { n.stop && n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} });
    binauralNodes = [];
  }

  /* ---------- секвенсор ---------- */
  function chordNotes(st, barIndex) {
    const [offset, type] = st.prog[barIndex % st.prog.length];
    const intervals = CHORDS[type] || CHORDS.maj7;
    return intervals.map((i) => st.root + offset + i);
  }

  function scaleNotes(st, barIndex) {
    const notes = chordNotes(st, barIndex);
    const extra = notes.map((n) => n + 12);
    return notes.concat(extra);
  }

  function scheduleStep(s, t) {
    const st = station();
    const bar = Math.floor(s / 16);
    const inBar = s % 16;
    const beat = Math.floor(inBar / 4);
    const spb = 60 / bpm();

    // пэд — в начале такта
    if (inBar === 0 && st.pad) {
      playPad(t, chordNotes(st, bar), spb * 4, st);
    }

    // бас
    if (st.bass) {
      const root = st.root + st.prog[bar % st.prog.length][0] - 12;
      if (st.drone) { if (inBar === 0) playBass(t, root, spb * 4, st); }
      else if (inBar === 0 || inBar === 8) playBass(t, root, spb * 1.6, st);
      else if (inBar === 11 && rnd() < 0.4) playBass(t, root + 7, spb * 0.6, st);
    }

    // барабаны
    if (st.drums === 'lofi') {
      if (inBar === 0 || inBar === 10) playKick(t);
      if (inBar === 4 || inBar === 12) playSnare(t, true);
      if (inBar % 2 === 0 && rnd() < 0.85) playHat(t, inBar === 14);
    } else if (st.drums === 'four') {
      if (inBar % 4 === 0) playKick(t);
      if (inBar === 4 || inBar === 12) playSnare(t);
      if (inBar % 2 === 1) playHat(t, false);
      if (inBar === 14 && rnd() < 0.5) playHat(t, true);
    } else if (st.drums === 'pulse') {
      if (inBar % 8 === 0) playPulse(t);
    }

    // мелодия/арпеджио
    const notes = scaleNotes(st, bar);
    if (st.arp) {
      if (inBar % 2 === 0) {
        const n = notes[(s / 2 + bar) % notes.length];
        playPluck(t, n, st, 0.85);
      }
    } else if (st.pluck && rnd() < st.pluck * (inBar % 4 === 0 ? 0.9 : 0.28)) {
      const n = notes[Math.floor(rnd() * notes.length)];
      playPluck(t, n + (rnd() < 0.25 ? 12 : 0), st, 0.7 + rnd() * 0.3);
    }
  }

  function scheduler() {
    if (!playing) return;
    const spb = 60 / bpm();
    const stepDur = spb / 4;
    const st = station();
    while (nextTime < ctx.currentTime + 0.25) {
      const swing = st.swing && step % 2 === 1 ? stepDur * st.swing : 0;
      scheduleStep(step, nextTime + swing);
      nextTime += stepDur;
      step = (step + 1) % (16 * 64);
    }
  }

  /* ---------- управление ---------- */
  function play(id) {
    Sound.ready();
    if (!buildBus()) return false;
    if (id && id !== stationId) { stationId = id; step = 0; }
    if (playing) { applyStationExtras(); return true; }
    playing = true;
    step = 0;
    rnd = mulberry32(seed);
    nextTime = ctx.currentTime + 0.12;
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.2);
    timer = setInterval(scheduler, 25);
    Sound.setExternalActive(true);
    applyStationExtras();
    startMinuteCounter();
    notify();
    return true;
  }

  let autoRain = false;
  function applyStationExtras() {
    const st = station();
    stopVinyl();
    stopBinaural();
    if (st.vinyl) startVinyl();
    if (st.binaural) startBinaural(st.binaural);
    if (st.rain && !State.s.soundMix.rain) {
      Sound.setLayer('rain', 0.35);
      autoRain = true;
    } else if (autoRain && !st.rain) {
      Sound.setLayer('rain', 0);
      autoRain = false;
    }
  }

  function stop(fadeSeconds = 0.8) {
    if (!playing) return;
    playing = false;
    Sound.setExternalActive(false);
    clearInterval(timer);
    stopMinuteCounter();
    clearTimeout(sleepTimer);
    sleepEndsAt = 0;
    const t = ctx.currentTime;
    try {
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0.0001, t + fadeSeconds);
    } catch (e) { /* контекст мог закрыться */ }
    setTimeout(() => {
      stopVinyl();
      stopBinaural();
      if (autoRain) { Sound.setLayer('rain', 0); autoRain = false; }
    }, fadeSeconds * 1000 + 50);
    notify();
  }

  function toggle(id) {
    if (playing && (!id || id === stationId)) { stop(); return false; }
    play(id);
    return true;
  }

  function setStation(id) {
    const wasPlaying = playing;
    stationId = id;
    step = 0;
    if (wasPlaying) { applyStationExtras(); notify(); }
    else play(id);
  }

  function reseed() {
    seed = Math.floor(Math.random() * 1e6);
    rnd = mulberry32(seed);
    step = 0;
    notify();
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (bus && playing) {
      const t = ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setTargetAtTime(volume, t, 0.1);
    }
  }

  function setBpm(v) { bpmOverride = v || null; notify(); }

  /* сон-таймер: плавно гасит музыку через N минут */
  function setSleep(minutes) {
    clearTimeout(sleepTimer);
    if (!minutes) { sleepEndsAt = 0; notify(); return; }
    sleepEndsAt = Date.now() + minutes * 60000;
    sleepTimer = setTimeout(() => {
      stop(20);
      UI.toast('Музыка выключена по таймеру 🌙', 'default', '🌙');
    }, minutes * 60000);
    notify();
  }
  function sleepLeft() {
    if (!sleepEndsAt) return 0;
    return Math.max(0, Math.round((sleepEndsAt - Date.now()) / 1000));
  }

  /* ---------- счётчик прослушанных минут ---------- */
  function startMinuteCounter() {
    stopMinuteCounter();
    minuteTimer = setInterval(() => {
      State.s.totals.musicMinutes = (State.s.totals.musicMinutes || 0) + 1;
      State.save();
    }, 60000);
  }
  function stopMinuteCounter() { clearInterval(minuteTimer); minuteTimer = null; }

  function onChange(fn) { onTick = fn; }
  function notify() { if (onTick) onTick(); }

  return {
    STATIONS,
    play, stop, toggle, setStation, reseed, setVolume, setBpm, setSleep, sleepLeft, onChange,
    get playing() { return playing; },
    get stationId() { return stationId; },
    get station() { return station(); },
    get volume() { return volume; },
    get bpm() { return bpm(); },
    get seed() { return seed; },
  };
})();
