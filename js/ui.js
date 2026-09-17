'use strict';
/* =========================================================
   UI — вспомогательные утилиты интерфейса
   ========================================================= */

const UI = (() => {

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  /* ---------- форматирование чисел ---------- */
  function fmt(n) {
    const v = Math.floor(n);
    return v.toLocaleString('ru-RU');
  }
  function fmtShort(n) {
    const v = Math.floor(n);
    if (v >= 1e9) return (v / 1e9).toFixed(v >= 1e10 ? 0 : 1).replace('.', ',') + ' млрд';
    if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace('.', ',') + ' млн';
    if (v >= 1e4) return Math.round(v / 1e3) + 'K';
    return v.toLocaleString('ru-RU');
  }
  /* мелкие значения показываем с десятыми, крупные — сокращённо */
  function fmtSmart(n) {
    if (n > 0 && n < 10) return n.toFixed(1).replace('.', ',');
    if (n >= 100000) return fmtShort(n);
    return fmt(n);
  }
  /* склонение существительных: 1 день, 2 дня, 5 дней */
  function plural(n, one, few, many) {
    const abs = Math.abs(Math.round(n));
    const mod10 = abs % 10;
    const mod100 = abs % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }
  const plur = (n, one, few, many) => `${fmt(n)} ${plural(n, one, few, many)}`;

  function fmtMin(n) {
    const h = Math.floor(n / 60), m = Math.round(n % 60);
    return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
  }

  /* ---------- анимация счётчика ---------- */
  const counters = new WeakMap();
  function countUp(el, value, opts = {}) {
    if (!el) return;
    const format = opts.smart ? fmtSmart : (opts.short ? fmtShort : fmt);
    const from = counters.get(el) ?? value;
    counters.set(el, value);
    if (State.s.reduceMotion || from === value) { el.textContent = format(value); return; }
    const dur = opts.duration || 600;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(from + (value - from) * eased);
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = format(value);
    };
    requestAnimationFrame(tick);
    if (value > from) {
      el.classList.remove('num-flash');
      void el.offsetWidth;
      el.classList.add('num-flash');
    }
  }

  /* ---------- тосты ---------- */
  function toast(message, type = 'default', emoji = '') {
    const root = $('#toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `${emoji ? `<span class="toast-emoji">${emoji}</span>` : ''}<span>${esc(message)}</span>`;
    root.appendChild(el);
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 350);
    }, type === 'level' ? 3400 : 2400);
    while (root.children.length > 3) root.firstChild.remove();
  }

  /* ---------- модалки ---------- */
  function openModal(id) {
    const m = typeof id === 'string' ? $(id) : id;
    if (!m) return;
    m.classList.remove('hidden');
    m.classList.add('modal-open');
    document.body.classList.add('modal-lock');
  }
  function closeModal(id) {
    const m = typeof id === 'string' ? $(id) : id;
    if (!m) return;
    m.classList.add('modal-closing');
    setTimeout(() => {
      m.classList.add('hidden');
      m.classList.remove('modal-open', 'modal-closing');
      if (!$$('.modal:not(.hidden)').length) document.body.classList.remove('modal-lock');
    }, 180);
  }

  /* универсальная модалка с произвольным содержимым */
  function sheet(html, opts = {}) {
    const root = $('#sheet-modal');
    const body = $('#sheet-body');
    body.innerHTML = html;
    root.querySelector('.modal-card').classList.toggle('modal-wide', !!opts.wide);
    openModal(root);
    return body;
  }

  /* подтверждение */
  function confirm(message, opts = {}) {
    return new Promise((resolve) => {
      const body = sheet(`
        <h2>${esc(opts.title || 'Подтверждение')}</h2>
        <p class="muted">${esc(message)}</p>
        <div class="row-end" style="margin-top:18px">
          <button class="btn btn-ghost" data-act="no">Отмена</button>
          <button class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" data-act="yes">${esc(opts.okText || 'Да')}</button>
        </div>
      `);
      body.querySelector('[data-act="no"]').onclick = () => { closeModal('#sheet-modal'); resolve(false); };
      body.querySelector('[data-act="yes"]').onclick = () => { closeModal('#sheet-modal'); resolve(true); };
    });
  }

  /* ---------- 3D наклон карточек ---------- */
  function initTilt(root = document) {
    $$('.tilt', root).forEach((card) => {
      if (card.dataset.tiltBound) return;
      card.dataset.tiltBound = '1';
      card.addEventListener('mousemove', (e) => {
        if (State.s.reduceMotion) return;
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(900px) rotateX(${-py * 5}deg) rotateY(${px * 6}deg) translateY(-3px)`;
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }

  /* ---------- ripple на кнопках ---------- */
  function initRipple() {
    document.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('.btn, .chip, .tab-btn, .sound-tile');
      if (!btn || State.s.reduceMotion) return;
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--rx', `${e.clientX - r.left}px`);
      btn.style.setProperty('--ry', `${e.clientY - r.top}px`);
      btn.classList.remove('rippling');
      void btn.offsetWidth;
      btn.classList.add('rippling');
      setTimeout(() => btn.classList.remove('rippling'), 600);
    });
  }

  /* ---------- сохранение фокуса при перерисовке ---------- */
  function preserveFocus(fn) {
    const el = document.activeElement;
    const keep = el && el.id && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
      ? { id: el.id, value: el.value, start: el.selectionStart, end: el.selectionEnd }
      : null;
    fn();
    if (!keep) return;
    const next = document.getElementById(keep.id);
    if (!next || next === document.activeElement) return;
    if (next.value !== keep.value && next.type !== 'checkbox' && next.type !== 'radio') next.value = keep.value;
    try {
      next.focus({ preventScroll: true });
      if (keep.start != null && next.setSelectionRange) next.setSelectionRange(keep.start, keep.end);
    } catch (e) { /* поля без выделения */ }
  }

  /* ---------- вспомогательное создание элементов ---------- */
  function node(tag, cls, html) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html != null) el.innerHTML = html;
    return el;
  }

  /* ---------- относительное время ---------- */
  function timeAgo(ts) {
    const diff = Math.round((Date.now() - ts) / 1000);
    if (diff < 60) return 'только что';
    if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
    return `${Math.floor(diff / 86400)} дн назад`;
  }

  function hhmm(ts) {
    return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  function dateLabel(key) {
    const d = new Date(key);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }

  const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  return {
    $, $$, esc, fmt, fmtShort, fmtSmart, fmtMin, plural, plur, countUp, toast, openModal, closeModal,
    sheet, confirm, initTilt, initRipple, node, timeAgo, hhmm, dateLabel, WEEKDAYS, preserveFocus,
  };
})();
