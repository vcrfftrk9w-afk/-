/* Мелкие помощники. Никаких зависимостей — приложение должно открываться с диска. */
(function (root) {
  'use strict';

  var M = root.Most || (root.Most = {});

  /* sealed — сборка, у которой в самом файле стоит запрет на сетевые запросы.
     downloads — можно ли отдавать файл на скачивание (в некоторых оболочках нельзя). */
  M.env = root.MOST_ENV || { downloads: true, sealed: true };
  M.screens = M.screens || {};

  /* h('div', {class:'x'}, ['текст', h('b', null, 'жирно')]) */
  function h(tag, props, children) {
    var el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else if (k === 'value') el.value = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      });
    }
    add(el, children);
    return el;
  }

  function add(el, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) {
      child.forEach(function (c) { add(el, c); });
    } else if (child.nodeType) {
      el.appendChild(child);
    } else {
      el.appendChild(document.createTextNode(String(child)));
    }
  }

  M.h = h;

  M.clear = function (el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  };

  M.uid = function () {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  };

  M.clamp = function (n, lo, hi) { return Math.min(hi, Math.max(lo, n)); };

  /* plural(3, 'шаг', 'шага', 'шагов') */
  M.plural = function (n, one, few, many) {
    var a = Math.abs(n) % 100;
    var b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  };

  M.minutes = function (n) {
    if (n >= 60 && n % 60 === 0) {
      var hrs = n / 60;
      return hrs + ' ' + M.plural(hrs, 'час', 'часа', 'часов');
    }
    if (n > 60) return Math.round(n / 60 * 10) / 10 + ' ч';
    return n + ' ' + M.plural(n, 'минута', 'минуты', 'минут');
  };

  M.hoursWord = function (n) {
    var rounded = Math.round(n * 10) / 10;
    return rounded + ' ' + M.plural(Math.round(rounded), 'час', 'часа', 'часов');
  };

  /* «3 недели назад», без единого восклицательного знака */
  M.since = function (ts) {
    if (!ts) return '';
    var days = Math.floor((Date.now() - ts) / 86400000);
    if (days <= 0) return 'сегодня';
    if (days === 1) return 'вчера';
    if (days < 7) return days + ' ' + M.plural(days, 'день', 'дня', 'дней') + ' назад';
    var weeks = Math.round(days / 7);
    if (days < 60) return weeks + ' ' + M.plural(weeks, 'неделю', 'недели', 'недель') + ' назад';
    var months = Math.round(days / 30);
    return months + ' ' + M.plural(months, 'месяц', 'месяца', 'месяцев') + ' назад';
  };

  M.dateShort = function (ts) {
    var d = new Date(ts);
    var months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    return d.getDate() + ' ' + months[d.getMonth()];
  };

  M.trim = function (s, n) {
    s = String(s || '').trim();
    return s.length > n ? s.slice(0, n - 1).trim() + '…' : s;
  };

  /* Копирование без сети и без сторонних библиотек. */
  M.copy = function (text, btn) {
    var done = function () {
      if (!btn) return;
      var was = btn.textContent;
      btn.textContent = 'Скопировано';
      setTimeout(function () { btn.textContent = was; }, 1600);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); });
        return;
      }
    } catch (e) { /* ниже */ }
    fallback(text, done);
  };

  function fallback(text, done) {
    var ta = h('textarea', { 'aria-hidden': 'true' });
    ta.value = text;
    ta.className = 'code';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* ну и ладно */ }
    document.body.removeChild(ta);
  }

  M.download = function (filename, text) {
    if (!M.env.downloads) return false;
    try {
      var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = h('a', { href: url, download: filename });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      return true;
    } catch (e) {
      return false;
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = M;
})(typeof window !== 'undefined' ? window : globalThis);
