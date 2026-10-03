/* Общие элементы интерфейса: уведомления, окна, перевод слова при наведении, конфетти, звуки, озвучка. */
(function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function el(tag, attrs, html) {
    const e = document.createElement(tag);
    if (attrs) for (const k of Object.keys(attrs)) e.setAttribute(k, attrs[k]);
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  // — уведомления —
  function toast(html, kind, ms) {
    let box = $('#toasts');
    if (!box) { box = el('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.appendChild(box); }
    const t = el('div', { class: 'toast ' + (kind || '') }, html);
    box.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, ms || 3200);
  }

  // — окна —
  function modal(html, opts) {
    opts = opts || {};
    const back = el('div', { class: 'modal-back', role: 'dialog', 'aria-modal': 'true' });
    const box = el('div', { class: 'modal ' + (opts.cls || '') }, html);
    back.appendChild(box);
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add('show'));
    const close = (val) => {
      back.classList.remove('show');
      setTimeout(() => back.remove(), 250);
      document.removeEventListener('keydown', onKey);
      opts.onClose && opts.onClose(val);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    back.addEventListener('click', (e) => { if (e.target === back && !opts.sticky) close(); });
    $$('[data-close]', box).forEach((b) => b.addEventListener('click', () => close(b.dataset.close)));
    const first = $('button.primary', box) || $('button', box);
    if (first) setTimeout(() => first.focus(), 50);
    return { box, close };
  }

  function confirmBox(text, yes, no) {
    return new Promise((resolve) => {
      modal(`<p class="modal-text">${text}</p><div class="modal-btns"><button class="btn" data-close="no">${no || 'Отмена'}</button>` +
        `<button class="btn primary" data-close="yes">${yes || 'Да'}</button></div>`, { onClose: (v) => resolve(v === 'yes') });
    });
  }

  // — перевод английского слова: наведение мышью или касание —
  let tip = null;
  let tipFor = null;
  function showTip(target) {
    const w = target.dataset.w;
    const g = window.glossLookup(w);
    if (!g) return;
    if (!tip) { tip = el('div', { class: 'gtip', role: 'tooltip' }); document.body.appendChild(tip); }
    tip.innerHTML = `<div class="gt-top"><b>${esc(g.word)}</b> <span class="gt-say">[${esc(g.say)}]</span>` +
      `<button class="gt-speak" type="button" title="Послушать произношение" aria-label="Послушать">🔊</button></div>` +
      `<div class="gt-ru">${esc(g.ru)}</div>${g.what ? `<div class="gt-what">${esc(g.what)}</div>` : ''}`;
    tip.querySelector('.gt-speak').onclick = (e) => { e.stopPropagation(); sayEnglish(g.word); };
    tip.classList.add('show');
    const r = target.getBoundingClientRect();
    const tw = Math.min(300, window.innerWidth - 24);
    tip.style.width = tw + 'px';
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.max(12, Math.min(window.innerWidth - tw - 12, left));
    tip.style.left = left + 'px';
    const th = tip.offsetHeight;
    const top = r.top - th - 8 < 8 ? r.bottom + 8 : r.top - th - 8;
    tip.style.top = (top + window.scrollY) + 'px';
    tipFor = target;
  }
  function hideTip() { if (tip) tip.classList.remove('show'); tipFor = null; }
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest && e.target.closest('.gw');
    if (t && t !== tipFor && matchMedia('(hover: hover)').matches) showTip(t);
    else if (!t && tipFor && !(e.target.closest && e.target.closest('.gtip'))) hideTip();
  });
  document.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('.gw');
    if (t) { e.preventDefault(); if (tipFor === t) hideTip(); else showTip(t); return; }
    if (!(e.target.closest && e.target.closest('.gtip'))) hideTip();
  });
  window.addEventListener('scroll', () => { if (tipFor && matchMedia('(hover: hover)').matches) hideTip(); }, { passive: true });

  // — звуки (синтезируются, файлов не нужно) —
  let ac = null;
  function beep(notes) {
    if (!window.Store || !Store.s.settings.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      let t = ac.currentTime;
      for (const [freq, dur, type] of notes) {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = type || 'triangle';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(ac.destination);
        o.start(t); o.stop(t + dur + 0.02);
        t += dur * 0.85;
      }
    } catch (e) {}
  }
  const sounds = {
    win: () => beep([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.3]]),
    ok: () => beep([[660, 0.08], [880, 0.14]]),
    fail: () => beep([[300, 0.12, 'sine'], [220, 0.2, 'sine']]),
    click: () => beep([[880, 0.04, 'sine']]),
    level: () => beep([[392, 0.1], [523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.12], [1319, 0.35]])
  };

  // — конфетти —
  function confetti(n) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = el('canvas', { class: 'confetti' });
    document.body.appendChild(c);
    const W = c.width = window.innerWidth, H = c.height = window.innerHeight;
    const g = c.getContext('2d');
    const colors = ['#ffd166', '#06d6a0', '#ef476f', '#118ab2', '#a78bfa', '#f78c6b'];
    const parts = Array.from({ length: n || 140 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35,
      vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4,
      s: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      c: colors[(Math.random() * colors.length) | 0]
    }));
    let frames = 0;
    (function step() {
      g.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore();
      }
      if (++frames < 150) requestAnimationFrame(step); else c.remove();
    })();
  }

  // — озвучка —
  function voices() { try { return speechSynthesis.getVoices(); } catch (e) { return []; } }
  function sayEnglish(word) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word.replace(/([a-z])([A-Z])/g, '$1 $2'));
      u.lang = 'en-US';
      const v = voices().find((x) => /^en(-|_)US/i.test(x.lang)) || voices().find((x) => /^en/i.test(x.lang));
      if (v) u.voice = v;
      u.rate = 0.85;
      speechSynthesis.speak(u);
    } catch (e) { toast('Озвучка не поддерживается этим браузером', 'warn'); }
  }
  function sayRussian(text, onEnd) {
    try {
      speechSynthesis.cancel();
      const chunks = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*/g) || [text];
      const v = voices().find((x) => /^ru/i.test(x.lang));
      chunks.forEach((ch, k) => {
        const u = new SpeechSynthesisUtterance(ch);
        u.lang = 'ru-RU';
        if (v) u.voice = v;
        if (k === chunks.length - 1 && onEnd) u.onend = onEnd;
        speechSynthesis.speak(u);
      });
      return true;
    } catch (e) { toast('Озвучка не поддерживается этим браузером', 'warn'); return false; }
  }
  function stopSpeech() { try { speechSynthesis.cancel(); } catch (e) {} }

  window.UI = { $, $$, el, esc, toast, modal, confirmBox, sounds, confetti, sayEnglish, sayRussian, stopSpeech, hideTip };
})();
