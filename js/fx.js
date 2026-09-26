'use strict';
/* =========================================================
   FX — визуальные эффекты: частицы, конфетти, летящие числа
   ========================================================= */

const FX = (() => {
  let bgCanvas, bgCtx, particles = [], bgRAF = null;
  let confCanvas, confCtx, confParticles = [], confRAF = null;
  let mouse = { x: 0.5, y: 0.5 };

  const reduce = () => State.s.reduceMotion;

  function cssVar(name, fallback) {
    const v = getComputedStyle(document.body).getPropertyValue(name).trim();
    return v || fallback;
  }

  /* ================= ФОНОВЫЕ ЧАСТИЦЫ ================= */
  function initBackground(canvas) {
    bgCanvas = canvas;
    bgCtx = canvas.getContext('2d');
    resizeBg();
    window.addEventListener('resize', resizeBg);
    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX / window.innerWidth;
      mouse.y = e.clientY / window.innerHeight;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopBg(); else startBg();
    });
    seedParticles();
    startBg();
  }

  function resizeBg() {
    if (!bgCanvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    bgCanvas.width = window.innerWidth * dpr;
    bgCanvas.height = window.innerHeight * dpr;
    bgCanvas.style.width = window.innerWidth + 'px';
    bgCanvas.style.height = window.innerHeight + 'px';
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedParticles();
  }

  function seedParticles() {
    const area = window.innerWidth * window.innerHeight;
    const count = Math.max(18, Math.min(70, Math.round(area / 26000)));
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 3.2 + 0.8,
        vx: (Math.random() - 0.5) * 0.22,
        vy: -Math.random() * 0.3 - 0.06,
        depth: Math.random() * 0.8 + 0.2,
        alpha: Math.random() * 0.45 + 0.15,
        hueShift: Math.random(),
        sprite: Math.floor(Math.random() * 3),
      });
    }
  }

  function startBg() {
    if (bgRAF || !bgCtx) return;
    const loop = () => {
      // свёрнутая вкладка не должна тратить кадры на фон, который не видно
      if (document.hidden) { bgRAF = null; return; }
      drawBg();
      bgRAF = requestAnimationFrame(loop);
    };
    loop();
  }
  function stopBg() {
    if (bgRAF) cancelAnimationFrame(bgRAF);
    bgRAF = null;
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !State.s.reduceMotion) startBg();
    });
  }

  /* Свечение частиц раньше рисовалось через shadowBlur — это полноценное
     размытие по гауссу на каждую частицу каждый кадр, самая дорогая
     операция в canvas. Плюс цвета читались из CSS 60 раз в секунду, что
     заставляло браузер пересчитывать стили. Теперь свечение — заранее
     нарисованный спрайт, а цвета кэшируются до смены темы. */
  const SPRITE = 48;
  let sprites = null;
  let spriteKey = '';

  function buildSprites() {
    const colors = [cssVar('--accent', '#7c3aed'), cssVar('--accent2', '#06b6d4'), cssVar('--accent3', '#f59e0b')];
    const key = colors.join('|');
    if (sprites && key === spriteKey) return sprites;
    spriteKey = key;
    sprites = colors.map((color) => {
      const c = document.createElement('canvas');
      c.width = c.height = SPRITE;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
      grad.addColorStop(0, color);
      grad.addColorStop(0.28, color);
      grad.addColorStop(1, 'transparent');
      g.fillStyle = grad;
      g.fillRect(0, 0, SPRITE, SPRITE);
      return c;
    });
    return sprites;
  }

  /* цвета берём заново только когда сменилась тема или палитра */
  function invalidateSprites() { sprites = null; spriteKey = ''; }

  function drawBg() {
    const w = window.innerWidth, h = window.innerHeight;
    bgCtx.clearRect(0, 0, w, h);
    const sp = buildSprites();
    const still = reduce();
    const mx = (mouse.x - 0.5) * 40;
    const my = (mouse.y - 0.5) * 30;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!still) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
      }
      const size = p.r * 7;
      bgCtx.globalAlpha = p.alpha * (still ? 0.6 : 1);
      bgCtx.drawImage(sp[p.sprite], p.x + mx * p.depth - size / 2, p.y + my * p.depth - size / 2, size, size);
    }
    bgCtx.globalAlpha = 1;
  }

  /* ================= КОНФЕТТИ ================= */
  function initConfetti(canvas) {
    confCanvas = canvas;
    confCtx = canvas.getContext('2d');
    resizeConf();
    window.addEventListener('resize', resizeConf);
  }
  function resizeConf() {
    if (!confCanvas) return;
    confCanvas.width = window.innerWidth;
    confCanvas.height = window.innerHeight;
  }

  const CONFETTI_COLORS = ['#7c3aed', '#06b6d4', '#f59e0b', '#22c55e', '#ef4444', '#ec4899', '#eab308'];

  function confetti(x, y, count = 60, opts = {}) {
    if (reduce() || !confCtx) return;
    // обычный режим — спокойнее: праздник есть, салюта на полэкрана нет
    if (State.s.mode !== 'adhd') count = Math.max(6, Math.round(count * 0.35));
    for (let i = 0; i < count; i++) {
      confParticles.push({
        x, y,
        vx: (Math.random() - 0.5) * (opts.spread || 10),
        vy: Math.random() * -(opts.power || 11) - 2,
        size: Math.random() * 7 + 4,
        color: opts.colors ? opts.colors[Math.floor(Math.random() * opts.colors.length)] : CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rot: Math.random() * 360,
        vr: (Math.random() - 0.5) * 24,
        life: 1,
        decay: 0.006 + Math.random() * 0.009,
        shape: opts.shape || (Math.random() < 0.5 ? 'rect' : 'circle'),
        text: opts.text,
      });
    }
    if (!confRAF) runConfetti();
  }

  function runConfetti() {
    const step = () => {
      confCtx.clearRect(0, 0, confCanvas.width, confCanvas.height);
      for (const p of confParticles) {
        p.vy += 0.26;
        p.vx *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= p.decay;
      }
      confParticles = confParticles.filter((p) => p.life > 0 && p.y < confCanvas.height + 60);
      for (const p of confParticles) {
        confCtx.save();
        confCtx.globalAlpha = Math.max(0, p.life);
        confCtx.translate(p.x, p.y);
        confCtx.rotate((p.rot * Math.PI) / 180);
        if (p.text) {
          confCtx.font = `${p.size * 2.4}px serif`;
          confCtx.textAlign = 'center';
          confCtx.fillText(p.text, 0, 0);
        } else {
          confCtx.fillStyle = p.color;
          if (p.shape === 'rect') confCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.62);
          else { confCtx.beginPath(); confCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2); confCtx.fill(); }
        }
        confCtx.restore();
      }
      if (confParticles.length) confRAF = requestAnimationFrame(step);
      else { confRAF = null; confCtx.clearRect(0, 0, confCanvas.width, confCanvas.height); }
    };
    confRAF = requestAnimationFrame(step);
  }

  function confettiFrom(el, count = 45, opts) {
    if (!el) { confetti(window.innerWidth / 2, window.innerHeight / 3, count, opts); return; }
    const r = el.getBoundingClientRect();
    confetti(r.left + r.width / 2, r.top + r.height / 2, count, opts);
  }

  function coinRain(count = 40) {
    if (reduce() || !confCtx) return;
    for (let i = 0; i < count; i++) {
      confParticles.push({
        x: Math.random() * window.innerWidth,
        y: -30 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 2,
        vy: Math.random() * 3 + 2,
        size: Math.random() * 6 + 8,
        color: '#f59e0b',
        rot: Math.random() * 360,
        vr: (Math.random() - 0.5) * 10,
        life: 1,
        decay: 0.004,
        shape: 'circle',
        text: '🪙',
      });
    }
    if (!confRAF) runConfetti();
  }

  function fireworks(bursts = 6) {
    if (reduce()) return;
    if (State.s.mode !== 'adhd') bursts = Math.ceil(bursts / 2);
    for (let i = 0; i < bursts; i++) {
      setTimeout(() => {
        confetti(
          window.innerWidth * (0.15 + Math.random() * 0.7),
          window.innerHeight * (0.15 + Math.random() * 0.45),
          70, { power: 9, spread: 14 }
        );
      }, i * 260);
    }
  }

  /* ================= ЛЕТЯЩИЙ ТЕКСТ ================= */
  function floatText(el, text, cls = '') {
    if (reduce() || !el) return;
    const r = el.getBoundingClientRect();
    const node = document.createElement('div');
    node.className = `float-text ${cls}`;
    node.textContent = text;
    node.style.left = `${r.left + r.width / 2}px`;
    node.style.top = `${r.top}px`;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 1300);
  }

  /* ================= ПОЛЁТ К ЦЕЛИ (монетки/XP) ================= */
  function flyTo(fromEl, toSelector, emoji = '🪙', count = 5) {
    if (reduce() || !fromEl) return;
    const target = document.querySelector(toSelector);
    if (!target) return;
    const from = fromEl.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      const node = document.createElement('div');
      node.className = 'fly-token';
      node.textContent = emoji;
      node.style.left = `${from.left + from.width / 2}px`;
      node.style.top = `${from.top + from.height / 2}px`;
      document.body.appendChild(node);
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      const delay = i * 70;
      requestAnimationFrame(() => {
        setTimeout(() => {
          node.style.transform = `translate(${dx}px, ${dy}px) scale(0.4)`;
          node.style.opacity = '0.2';
        }, delay);
      });
      setTimeout(() => node.remove(), 900 + delay);
    }
  }

  /* ================= ТРЯСКА ================= */
  function shake(el) {
    if (reduce() || !el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 600);
  }

  function pulse(el) {
    if (reduce() || !el) return;
    el.classList.remove('pulse-once');
    void el.offsetWidth;
    el.classList.add('pulse-once');
    setTimeout(() => el.classList.remove('pulse-once'), 700);
  }

  /* ================= ВИБРАЦИЯ ================= */
  function vibrate(pattern) {
    if (!State.s.haptics) return;
    if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
  }

  return {
    initBackground, initConfetti, confetti, confettiFrom, coinRain, fireworks, invalidateSprites,
    floatText, flyTo, shake, pulse, vibrate, seedParticles,
  };
})();
