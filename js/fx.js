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
      });
    }
  }

  function startBg() {
    if (bgRAF || !bgCtx) return;
    const loop = () => {
      drawBg();
      bgRAF = requestAnimationFrame(loop);
    };
    loop();
  }
  function stopBg() {
    if (bgRAF) cancelAnimationFrame(bgRAF);
    bgRAF = null;
  }

  function drawBg() {
    const w = window.innerWidth, h = window.innerHeight;
    bgCtx.clearRect(0, 0, w, h);
    const c1 = cssVar('--accent', '#7c3aed');
    const c2 = cssVar('--accent2', '#06b6d4');
    const c3 = cssVar('--accent3', '#f59e0b');
    const colors = [c1, c2, c3];
    const still = reduce();

    for (const p of particles) {
      if (!still) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
      }
      const px = p.x + (mouse.x - 0.5) * 40 * p.depth;
      const py = p.y + (mouse.y - 0.5) * 30 * p.depth;
      const color = colors[Math.floor(p.hueShift * colors.length) % colors.length];
      bgCtx.save();
      bgCtx.globalAlpha = p.alpha * (still ? 0.6 : 1);
      bgCtx.fillStyle = color;
      bgCtx.shadowBlur = 12;
      bgCtx.shadowColor = color;
      bgCtx.beginPath();
      bgCtx.arc(px, py, p.r, 0, Math.PI * 2);
      bgCtx.fill();
      bgCtx.restore();
    }
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
    initBackground, initConfetti, confetti, confettiFrom, coinRain, fireworks,
    floatText, flyTo, shake, pulse, vibrate, seedParticles,
  };
})();
