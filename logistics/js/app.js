/* Логистика PRO — движок приложения: состояние, роутинг, экраны. */
(function () {
  'use strict';

  /* ================= Данные курса ================= */
  const MODS = COURSE.modules;
  const ALL = [];
  MODS.forEach((m, mi) => m.lessons.forEach((l, li) => ALL.push(Object.assign(l, { mod: m, mi, li, gi: ALL.length }))));
  const byId = (id) => ALL.find((l) => l.id === id);

  const LEVELS = [
    [0, 'Новичок', '🐣'], [250, 'Стажёр', '📋'], [650, 'Диспетчер', '📞'], [1200, 'Логист', '🚚'],
    [1900, 'Старший логист', '📦'], [2800, 'Эксперт цепей поставок', '🔗'], [4000, 'Гуру логистики', '👑']
  ];
  const ACH = {
    first: ['🎯', 'Первый шаг', 'Пройти первый урок'],
    perfect: ['💯', 'Отличник', 'Ответить на все вопросы теста без ошибок'],
    module: ['🧩', 'Модуль закрыт', 'Пройти целиком любой модуль'],
    half: ['🌓', 'Экватор', 'Пройти половину курса'],
    all: ['🎓', 'Весь курс', 'Пройти все уроки'],
    streak3: ['🔥', 'В ритме', 'Заниматься 3 дня подряд'],
    streak7: ['⚡', 'Неделя силы', 'Заниматься 7 дней подряд'],
    tools: ['🛠️', 'Практик', 'Попробовать 5 тренажёров'],
    route: ['🗺️', 'Штурман', 'Построить маршрут не хуже алгоритма (±2%)'],
    cards: ['🃏', 'Память логиста', 'Повторить 50 карточек'],
    practice: ['✍️', 'Делом подтверждено', 'Выполнить 10 практических заданий'],
    exam: ['🏆', 'Знаток логистики', 'Сдать финальный экзамен']
  };
  const DAILY_GOAL = 60;
  const PASS = 0.7, EXAM_N = 30, EXAM_PASS = 0.8, EXAM_MIN = 40;

  /* ================= Состояние ================= */
  const KEY = 'logipro_v1';
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const fresh = () => ({ name: '', xp: 0, lessons: {}, ach: {}, streak: { last: '', count: 0, best: 0 }, day: { date: today(), xp: 0 }, exam: { best: 0, passed: false, date: '', id: '' }, cards: {}, cardsSeen: 0, tools: {}, notes: {}, settings: { theme: 'dark', free: false }, vids: {} });
  let S;
  try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = fresh(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* хранилище недоступно — работаем в памяти */ } };
  const L = (id) => (S.lessons[id] = S.lessons[id] || { video: false, best: 0, done: false, practice: false });

  /* ================= Утилиты ================= */
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const plural = (n, a, b, c) => { n = Math.abs(n) % 100; const m = n % 10; return n > 10 && n < 20 ? c : m > 1 && m < 5 ? b : m === 1 ? a : c; };
  const app = $('#app');
  // Внутри чужой страницы (например, ссылки-артефакта) YouTube не встраивается и скачивание файлов запрещено.
  const EMBED = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();

  function level(xp = S.xp) {
    let i = 0; while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++;
    const cur = LEVELS[i], nxt = LEVELS[i + 1];
    return { i, name: cur[1], icon: cur[2], from: cur[0], to: nxt ? nxt[0] : cur[0], pct: nxt ? (xp - cur[0]) / (nxt[0] - cur[0]) : 1, next: nxt && nxt[1] };
  }
  const doneCount = () => ALL.filter((l) => S.lessons[l.id] && S.lessons[l.id].done).length;
  const modDone = (m) => m.lessons.every((l) => S.lessons[l.id] && S.lessons[l.id].done);
  const unlocked = (l) => S.settings.free || l.gi === 0 || (S.lessons[ALL[l.gi - 1].id] || {}).done || (S.lessons[l.id] || {}).done;
  const nextLesson = () => ALL.find((l) => !(S.lessons[l.id] || {}).done);

  /* ================= XP, серия, достижения ================= */
  function touchStreak() {
    const t = today();
    if (S.streak.last === t) return;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const ys = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
    S.streak.count = S.streak.last === ys ? S.streak.count + 1 : 1;
    S.streak.last = t; S.streak.best = Math.max(S.streak.best, S.streak.count);
    if (S.streak.count >= 3) achieve('streak3');
    if (S.streak.count >= 7) achieve('streak7');
  }
  function addXP(n, why) {
    if (S.day.date !== today()) S.day = { date: today(), xp: 0 };
    const before = level().i;
    S.xp += n; S.day.xp += n; touchStreak(); save();
    toast(`+${n} XP · ${why}`, 'xp');
    const after = level();
    if (after.i > before) { setTimeout(() => { toast(`${after.icon} Новый уровень: ${after.name}!`, 'lvl'); confetti(); }, 500); }
    renderTop();
  }
  function achieve(k) {
    if (S.ach[k] || !ACH[k]) return;
    S.ach[k] = today(); save();
    setTimeout(() => toast(`${ACH[k][0]} Достижение: ${ACH[k][1]}`, 'ach'), 900);
  }
  function checkAch() {
    const d = doneCount();
    if (d >= 1) achieve('first');
    if (MODS.some(modDone)) achieve('module');
    if (d >= ALL.length / 2) achieve('half');
    if (d === ALL.length) achieve('all');
    if (Object.keys(S.tools).length >= 5) achieve('tools');
    if (S.cardsSeen >= 50) achieve('cards');
    if (ALL.filter((l) => (S.lessons[l.id] || {}).practice).length >= 10) achieve('practice');
  }

  /* ================= Уведомления и конфетти ================= */
  function toast(msg, kind = '') {
    const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg;
    const box = $('#toasts'); box.appendChild(t); while (box.children.length > 3) box.firstChild.remove(); setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3100);
  }
  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = document.createElement('canvas'); c.className = 'confetti'; document.body.appendChild(c);
    const x = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
    const cols = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
    const ps = Array.from({ length: 140 }, () => ({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.5, vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 4, r: Math.random() * 6.28, s: 5 + Math.random() * 6, c: cols[(Math.random() * cols.length) | 0] }));
    let f = 0;
    (function tick() {
      x.clearRect(0, 0, c.width, c.height);
      ps.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.r += 0.1; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); });
      if (++f < 180) requestAnimationFrame(tick); else c.remove();
    })();
  }

  /* ================= Шапка и навигация ================= */
  function renderTop() {
    const lv = level();
    $('#top-xp').innerHTML = `<span class="lvl" title="Уровень">${lv.icon} ${esc(lv.name)}</span><span class="xpbar"><i style="width:${(lv.pct * 100).toFixed(1)}%"></i></span><b>${S.xp} XP</b>`;
    $('#top-streak').innerHTML = `🔥 ${S.streak.last === today() || isYesterday(S.streak.last) ? S.streak.count : 0}`;
  }
  function isYesterday(d) { const y = new Date(); y.setDate(y.getDate() - 1); return d === y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0'); }
  function setNav(r) { document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === r)); }

  /* ================= Роутер ================= */
  function route() {
    const h = location.hash.replace(/^#\/?/, '').split('/');
    const r = h[0] || 'home';
    if (!S.name && r !== 'welcome') return welcome();
    window.scrollTo(0, 0);
    setNav(r === 'lesson' ? 'course' : r);
    const map = { home, course, lesson: () => lesson(h[1]), tools: () => tools(h[1]), glossary, cards, exam, profile };
    (map[r] || home)();
    renderTop();
  }
  window.addEventListener('hashchange', route);
  // Ссылка на текущий адрес (например, «Ещё раз» в карточках) не вызывает hashchange — перерисовываем сами.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (a && a.getAttribute('href') === location.hash) { e.preventDefault(); route(); }
  });

  /* ================= Приветствие ================= */
  function welcome() {
    setNav('');
    app.innerHTML = `
      <section class="hero welcome">
        <div class="truck-anim" aria-hidden="true">🚛💨</div>
        <h1>Логистика <span class="grad">PRO</span></h1>
        <p class="lead">Курс от нуля до знатока: 8 модулей, ${ALL.length} видеоуроков, тесты, 9 тренажёров, ${GLOSSARY.length} терминов и финальный экзамен с сертификатом.</p>
        <form id="wf" class="card narrow">
          <label class="fld"><span>Как вас зовут? (для сертификата)</span><input id="wn" maxlength="40" required placeholder="Имя и фамилия" autocomplete="name"></label>
          <button class="btn big">Начать обучение 🚀</button>
        </form>
        <div class="feat">
          <div>🎬<b>Видеоуроки</b><span>Лучшие ролики с YouTube</span></div>
          <div>🧠<b>Тесты</b><span>С разбором каждого ответа</span></div>
          <div>🛠️<b>Тренажёры</b><span>EOQ, Incoterms, маршруты</span></div>
          <div>🏆<b>Сертификат</b><span>После экзамена</span></div>
        </div>
      </section>`;
    $('#wf').onsubmit = (e) => { e.preventDefault(); const n = $('#wn').value.trim(); if (!n) return; S.name = n; touchStreak(); save(); location.hash = '#/home'; route(); };
  }

  /* ================= Главная ================= */
  function home() {
    const lv = level(), d = doneCount(), nx = nextLesson();
    if (S.day.date !== today()) S.day = { date: today(), xp: 0 };
    const goal = Math.min(1, S.day.xp / DAILY_GOAL);
    const due = dueCards().length;
    app.innerHTML = `
      <section class="hero">
        <div>
          <p class="muted">С возвращением,</p>
          <h1>${esc(S.name)} 👋</h1>
          <p class="lead">${d === 0 ? 'Начнём путь в логистику! Первый урок — 15 минут.' : d === ALL.length ? 'Курс пройден! Время для экзамена и сертификата.' : `Пройдено ${d} из ${ALL.length} ${plural(ALL.length, 'урока', 'уроков', 'уроков')}. Так держать!`}</p>
          ${nx ? `<a class="btn big" href="#/lesson/${nx.id}">▶ ${d ? 'Продолжить' : 'Начать'}: ${esc(nx.title)}</a>` : `<a class="btn big" href="#/exam">🏆 К экзамену</a>`}
        </div>
        <div class="ring" style="--p:${goal}"><div><b>${S.day.xp}</b><span>/ ${DAILY_GOAL} XP<br>цель дня</span></div></div>
      </section>
      <div class="stats">
        <div class="stat"><b>${lv.icon} ${esc(lv.name)}</b><span>${lv.next ? `до «${esc(lv.next)}» — ${lv.to - S.xp} XP` : 'максимальный уровень!'}</span></div>
        <div class="stat"><b>${Math.round(d / ALL.length * 100)}%</b><span>курса пройдено</span></div>
        <div class="stat"><b>🔥 ${S.streak.count}</b><span>${plural(S.streak.count, 'день', 'дня', 'дней')} подряд (рекорд ${S.streak.best})</span></div>
        <div class="stat"><b>${Object.keys(S.ach).length}/${Object.keys(ACH).length}</b><span>достижений</span></div>
      </div>
      <div class="grid3">
        <a class="tile" href="#/cards"><b>🃏 Карточки</b><span>${due ? `${due} ${plural(due, 'термин ждёт', 'термина ждут', 'терминов ждут')} повторения` : 'Все термины повторены 👍'}</span></a>
        <a class="tile" href="#/tools"><b>🛠️ Тренажёры</b><span>EOQ, Incoterms, хлыст, маршруты…</span></a>
        <a class="tile" href="#/exam"><b>🏆 Экзамен</b><span>${S.exam.passed ? 'Сдан! Сертификат готов' : `${EXAM_N} вопросов, проходной ${EXAM_PASS * 100}%`}</span></a>
      </div>
      <h2>Карта курса</h2>
      ${modList()}`;
  }

  /* ================= Список модулей ================= */
  function modList() {
    return `<div class="mods">${MODS.map((m, mi) => {
      const done = m.lessons.filter((l) => (S.lessons[l.id] || {}).done).length;
      return `<article class="mod" style="--mc:${m.color}">
        <header><span class="micon">${m.icon}</span><div><small>Модуль ${mi + 1}</small><h3>${esc(m.title)}</h3><p>${esc(m.desc)}</p></div><span class="mprog">${done}/${m.lessons.length}</span></header>
        <div class="pbar"><i style="width:${done / m.lessons.length * 100}%"></i></div>
        <ol class="lessons">${m.lessons.map((l) => {
          const st = S.lessons[l.id] || {}, op = unlocked(l);
          return `<li class="${st.done ? 'done' : ''} ${op ? '' : 'locked'}">${op ? `<a href="#/lesson/${l.id}">` : '<span>'}<span class="ls">${st.done ? '✅' : op ? '▶️' : '🔒'}</span><span class="lt">${l.id.replace('-', '.')} ${esc(l.title)}</span><span class="ld">${l.dur}${st.best ? ` · ${Math.round(st.best * 100)}%` : ''}</span>${op ? '</a>' : '</span>'}</li>`;
        }).join('')}</ol></article>`;
    }).join('')}</div>`;
  }
  function course() {
    const d = doneCount();
    app.innerHTML = `
      <div class="pagehead"><h1>📚 Программа курса</h1><p class="muted">${MODS.length} модулей · ${ALL.length} уроков · пройдено ${d}</p>
      <label class="switch"><input type="checkbox" id="free" ${S.settings.free ? 'checked' : ''}><span>Свободный режим — открыть все уроки сразу</span></label></div>
      ${modList()}`;
    $('#free').onchange = (e) => { S.settings.free = e.target.checked; save(); course(); };
  }

  /* ================= Урок ================= */
  let quiz = null;
  function lesson(id) {
    const l = byId(id);
    if (!l) { location.hash = '#/course'; return; }
    if (!unlocked(l)) {
      app.innerHTML = `<div class="card center"><h2>🔒 Урок закрыт</h2><p>Сначала пройдите предыдущий урок: <a href="#/lesson/${ALL[l.gi - 1].id}">${esc(ALL[l.gi - 1].title)}</a>.</p><p class="muted">Или включите «Свободный режим» в <a href="#/course">программе курса</a>.</p></div>`;
      return;
    }
    const st = L(l.id), prev = ALL[l.gi - 1], next = ALL[l.gi + 1];
    quiz = null;
    app.innerHTML = `
      <nav class="crumbs"><a href="#/course">Курс</a> › <span style="color:${l.mod.color}">${l.mod.icon} ${esc(l.mod.title)}</span></nav>
      <h1 class="ltitle">${l.id.replace('-', '.')} ${esc(l.title)} ${st.done ? '<span class="badge ok">Пройден</span>' : ''}</h1>
      <div class="steps">
        <span class="${st.video ? 'ok' : ''}">🎬 Видео</span><span class="${st.read ? 'ok' : ''}">📖 Теория</span><span class="${st.done ? 'ok' : ''}">🧠 Тест</span><span class="${st.practice ? 'ok' : ''}">✍️ Практика</span>
      </div>
      <section class="card" id="vid"></section>
      <section class="card theory"><h2>📖 Теория</h2>${l.theory}
        <div class="keys"><h4>🔑 Главное</h4><ul>${l.keys.map((k) => `<li>${esc(k)}</li>`).join('')}</ul></div>
        ${st.read ? '' : '<button class="btn ghost" id="read">✔ Прочитал(а) теорию (+10 XP)</button>'}
      </section>
      <section class="card" id="quiz"></section>
      <section class="card practice"><h2>✍️ Практика</h2><p>${esc(l.practice)}</p>
        <textarea id="note" rows="4" placeholder="Ваш ответ или заметки к уроку — сохраняются автоматически">${esc(S.notes[l.id] || '')}</textarea>
        ${st.practice ? '<p class="okmsg">✅ Задание выполнено</p>' : '<button class="btn ghost" id="prac">✔ Задание выполнено (+15 XP)</button>'}
      </section>
      <div class="pager">${prev ? `<a class="btn ghost" href="#/lesson/${prev.id}">← ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a class="btn ${st.done ? '' : 'ghost'}" href="#/lesson/${next.id}">${esc(next.title)} →</a>` : '<a class="btn" href="#/exam">🏆 К экзамену →</a>'}</div>`;
    videoBlock(l);
    quizStart(l);
    const rd = $('#read'); if (rd) rd.onclick = () => { st.read = true; addXP(10, 'теория'); lesson(id); };
    const pr = $('#prac'); if (pr) pr.onclick = () => { st.practice = true; addXP(15, 'практика'); checkAch(); lesson(id); };
    let tm; $('#note').oninput = (e) => { clearTimeout(tm); tm = setTimeout(() => { S.notes[l.id] = e.target.value; save(); }, 400); };
  }

  /* ---------- Видео: превью → встроенный плеер; недоступные ролики пропускаются ---------- */
  function videoBlock(l) {
    const box = $('#vid'), st = L(l.id);
    let cur = S.vids[l.id] || 0; if (cur >= l.videos.length) cur = 0;
    const bad = new Set();
    const q = encodeURIComponent(l.search);
    const draw = () => {
      const v = l.videos[cur];
      box.innerHTML = `
        <h2>🎬 Видеоурок</h2>
        ${EMBED ? `<a class="player ext" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener"><span class="playbtn" aria-hidden="true">▶</span><span class="vt">${esc(v.title)}<small>Откроется в YouTube</small></span></a>` : `<div class="player" id="pl">
          <img alt="" src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" id="thumb">
          <button class="playbtn" id="play" aria-label="Смотреть видео">▶</button>
          <div class="vt">${esc(v.title)}</div>
        </div>`}
        <div class="vtabs">${l.videos.map((x, i) => `<button class="chip ${i === cur ? 'on' : ''} ${bad.has(i) ? 'bad' : ''}" data-v="${i}" title="${esc(x.title)}">${i === 0 ? '⭐ Основное' : 'Запасное ' + i}${/\(EN\)/.test(x.title) ? ' · EN' : ''}</button>`).join('')}</div>
        <div class="vlinks">
          <a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">Открыть на YouTube ↗</a>
          <a href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">Ещё видео на YouTube ↗</a>
          <a href="https://rutube.ru/search/?query=${q}" target="_blank" rel="noopener">Rutube ↗</a>
          <a href="https://vkvideo.ru/?q=${q}" target="_blank" rel="noopener">VK Видео ↗</a>
        </div>
        <p class="muted small">Английские ролики (EN) — включите в плеере субтитры ⚙ → Субтитры → Перевести → Русский.</p>
        ${st.video ? '<p class="okmsg">✅ Видео просмотрено</p>' : '<button class="btn ghost" id="watched">✔ Посмотрел(а) видео (+20 XP)</button>'}`;
      const img = $('#thumb');
      if (img) img.onload = () => {
        // У несуществующих или удалённых роликов YouTube отдаёт заглушку 120×90 — переключаемся на запасное видео.
        if (img.naturalWidth <= 120) {
          bad.add(cur);
          const alt = l.videos.findIndex((_, i) => !bad.has(i));
          if (alt >= 0) { toast('Видео недоступно — включаю запасное', ''); cur = alt; draw(); }
          else $('#pl').classList.add('nov');
        }
      };
      if (img) img.onerror = () => $('#pl').classList.add('noimg');
      if (!EMBED) $('#pl').onclick = () => {
        if ($('#pl iframe')) return;
        $('#pl').innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&modestbranding=1&hl=ru&cc_lang_pref=ru" title="${esc(v.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
      };
      box.querySelector('.vtabs').onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; cur = +b.dataset.v; S.vids[l.id] = cur; save(); draw(); };
      const w = $('#watched'); if (w) w.onclick = () => { st.video = true; addXP(20, 'видео'); draw(); lessonSteps(l); };
    };
    draw();
  }
  function lessonSteps(l) {
    const st = L(l.id), el = $('.steps'); if (!el) return;
    el.innerHTML = `<span class="${st.video ? 'ok' : ''}">🎬 Видео</span><span class="${st.read ? 'ok' : ''}">📖 Теория</span><span class="${st.done ? 'ok' : ''}">🧠 Тест</span><span class="${st.practice ? 'ok' : ''}">✍️ Практика</span>`;
  }

  /* ---------- Тест урока ---------- */
  function quizStart(l) {
    const st = L(l.id);
    $('#quiz').innerHTML = `<h2>🧠 Тест · ${l.quiz.length} ${plural(l.quiz.length, 'вопрос', 'вопроса', 'вопросов')}</h2>
      <p class="muted">Нужно ${Math.round(PASS * 100)}% правильных, чтобы пройти урок. ${st.best ? `Ваш лучший результат: <b>${Math.round(st.best * 100)}%</b>.` : ''}</p>
      <button class="btn" id="qgo">${st.best ? 'Пройти ещё раз' : 'Начать тест'}</button>`;
    $('#qgo').onclick = () => {
      quiz = { l, i: 0, ok: 0, qs: shuffle(l.quiz).map((q) => { const ord = shuffle(q.a.map((_, i) => i)); return { q: q.q, e: q.e, a: ord.map((i) => q.a[i]), c: ord.indexOf(q.c) }; }) };
      quizQ();
    };
  }
  function quizQ() {
    const z = quiz, q = z.qs[z.i];
    $('#quiz').innerHTML = `<div class="qhead"><span>Вопрос ${z.i + 1} из ${z.qs.length}</span><span class="qdots">${z.qs.map((_, i) => `<i class="${i < z.i ? 'p' : i === z.i ? 'c' : ''}"></i>`).join('')}</span></div>
      <h3 class="qq">${esc(q.q)}</h3>
      <div class="answers">${q.a.map((a, i) => `<button class="ans" data-i="${i}"><b>${'АБВГД'[i]}</b>${esc(a)}</button>`).join('')}</div>
      <div id="qfb"></div>`;
    $('#quiz').querySelector('.answers').onclick = (e) => {
      const b = e.target.closest('.ans'); if (!b || z.answered) return; z.answered = true;
      const i = +b.dataset.i, right = i === q.c; if (right) z.ok++;
      $('#quiz').querySelectorAll('.ans').forEach((x, j) => { x.disabled = true; if (j === q.c) x.classList.add('right'); else if (j === i) x.classList.add('wrong'); });
      $('#qfb').innerHTML = `<div class="fb ${right ? 'ok' : 'no'}"><b>${right ? '✅ Верно!' : '❌ Неверно.'}</b> ${esc(q.e)}</div><button class="btn" id="qn">${z.i + 1 < z.qs.length ? 'Дальше →' : 'Результат'}</button>`;
      $('#qn').onclick = () => { z.answered = false; z.i++; z.i < z.qs.length ? quizQ() : quizEnd(); };
      $('#qn').focus();
    };
  }
  function quizEnd() {
    const z = quiz, l = z.l, st = L(l.id), sc = z.ok / z.qs.length, wasDone = st.done;
    const pass = sc >= PASS;
    st.best = Math.max(st.best, sc);
    if (pass && !wasDone) { st.done = true; addXP(50 + z.ok * 10, 'урок пройден'); confetti(); }
    if (sc === 1 && !st.perfect) { st.perfect = true; addXP(30, 'тест без ошибок'); achieve('perfect'); }
    save(); checkAch(); lessonSteps(l);
    const next = ALL[l.gi + 1];
    const md = pass && modDone(l.mod) && !wasDone;
    $('#quiz').innerHTML = `<div class="result ${pass ? 'ok' : 'no'}">
      <div class="big">${pass ? (sc === 1 ? '🏆' : '🎉') : '📚'} ${z.ok} / ${z.qs.length}</div>
      <p>${pass ? (sc === 1 ? 'Идеально! Вы настоящий логист.' : 'Отлично, урок пройден!') : `Нужно хотя бы ${Math.ceil(PASS * z.qs.length)} правильных. Перечитайте теорию и попробуйте снова — у вас получится!`}</p>
      ${md ? `<p class="okmsg">🧩 Модуль «${esc(l.mod.title)}» полностью пройден!</p>` : ''}
      <div class="row center">${pass && next ? `<a class="btn" href="#/lesson/${next.id}">Следующий урок →</a>` : ''}${pass && !next ? '<a class="btn" href="#/exam">🏆 К экзамену</a>' : ''}<button class="btn ghost" id="qr">Пройти заново</button></div></div>`;
    $('#qr').onclick = () => quizStart(l);
  }

  /* ================= Тренажёры ================= */
  function tools(id) {
    const t = TOOLS.find((x) => x.id === id);
    if (!t) {
      app.innerHTML = `<div class="pagehead"><h1>🛠️ Тренажёры</h1><p class="muted">Калькуляторы и симуляторы, которыми пользуются настоящие логисты. За каждый новый тренажёр — +10 XP.</p></div>
        <div class="grid3">${TOOLS.map((x) => `<a class="tile tool" href="#/tools/${x.id}"><span class="ticon">${x.icon}</span><b>${esc(x.title)}</b><span>${esc(x.desc)}</span>${S.tools[x.id] ? '<em>✓</em>' : ''}</a>`).join('')}</div>`;
      return;
    }
    app.innerHTML = `<nav class="crumbs"><a href="#/tools">Тренажёры</a> › ${esc(t.title)}</nav><h1>${t.icon} ${esc(t.title)}</h1><section class="card tool-body" id="tb">${t.render()}</section>`;
    t.bind($('#tb'), { achieve: (k) => { achieve(k); } });
    if (!S.tools[t.id]) { S.tools[t.id] = today(); addXP(10, 'новый тренажёр'); checkAch(); }
  }

  /* ================= Глоссарий ================= */
  function glossary() {
    app.innerHTML = `<div class="pagehead"><h1>📖 Словарь логиста</h1><p class="muted">${GLOSSARY.length} терминов. Учите их в <a href="#/cards">карточках</a>.</p>
      <input class="search" id="gs" placeholder="🔎 Поиск: FOB, кросс-докинг, OTIF…" autocomplete="off"></div><div id="gl" class="gloss"></div>`;
    const draw = (f) => {
      f = f.trim().toLowerCase();
      const items = GLOSSARY.filter(([t, d]) => !f || t.toLowerCase().includes(f) || d.toLowerCase().includes(f)).sort((a, b) => a[0].localeCompare(b[0], 'ru'));
      $('#gl').innerHTML = items.length ? items.map(([t, d]) => `<div class="term"><b>${esc(t)}</b><span>${esc(d)}</span></div>`).join('') : '<p class="muted">Ничего не найдено.</p>';
    };
    $('#gs').oninput = (e) => draw(e.target.value); draw('');
  }

  /* ================= Карточки (интервальное повторение по Лейтнеру) ================= */
  const BOX_DAYS = [0, 1, 3, 7, 16, 35];
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function dueCards() { const t = today(); return GLOSSARY.filter(([k]) => !S.cards[k] || S.cards[k].due <= t); }
  function cards() {
    const due = shuffle(dueCards()).slice(0, 20);
    const learned = Object.values(S.cards).filter((c) => c.box >= 3).length;
    if (!due.length) {
      app.innerHTML = `<div class="card center"><h1>🃏 Все карточки повторены!</h1><p>Выучено (коробка 3+): <b>${learned}</b> из ${GLOSSARY.length}. Возвращайтесь завтра — интервальное повторение работает лучше зубрёжки.</p><a class="btn" href="#/home">На главную</a></div>`;
      return;
    }
    let i = 0, know = 0;
    const show = () => {
      if (i >= due.length) {
        app.innerHTML = `<div class="card center"><h1>🎉 Сессия завершена</h1><p>Знал(а) сразу: <b>${know}</b> из ${due.length}.</p><div class="row center"><a class="btn" href="#/cards">Ещё раз</a><a class="btn ghost" href="#/home">На главную</a></div></div>`;
        if (know) addXP(Math.min(40, know * 2), 'карточки'); checkAch(); return;
      }
      const [t, d] = due[i], flipFront = Math.random() < 0.5;
      app.innerHTML = `<div class="pagehead"><h1>🃏 Карточки</h1><p class="muted">${i + 1} / ${due.length} · выучено ${learned} из ${GLOSSARY.length}</p></div>
        <div class="flash" id="fc" tabindex="0"><div class="fin"><div class="face front">${flipFront ? `<small>Что это?</small><b>${esc(t)}</b>` : `<small>Какой термин?</small><p>${esc(d)}</p>`}</div><div class="face back"><b>${esc(t)}</b><p>${esc(d)}</p></div></div></div>
        <p class="muted center small">Нажмите на карточку, чтобы перевернуть</p>
        <div class="row center" id="fbtn" hidden><button class="btn no" id="dn">😕 Не помню</button><button class="btn" id="kn">😎 Знаю</button></div>`;
      const fc = $('#fc'); const flip = () => { fc.classList.add('flipped'); $('#fbtn').hidden = false; };
      fc.onclick = flip; fc.onkeydown = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } };
      const mark = (ok) => { const c = S.cards[t] || { box: 0 }; c.box = ok ? Math.min(5, c.box + 1) : 0; c.due = addDays(BOX_DAYS[c.box]); S.cards[t] = c; S.cardsSeen++; if (ok) know++; save(); i++; show(); };
      $('#kn').onclick = () => mark(true); $('#dn').onclick = () => mark(false);
    };
    show();
  }

  /* ================= Финальный экзамен ================= */
  let ex = null, exTimer = null;
  function exam() {
    clearInterval(exTimer);
    const d = doneCount(), ready = d === ALL.length || S.settings.free;
    app.innerHTML = `<div class="pagehead"><h1>🏆 Финальный экзамен</h1></div>
      <section class="card center">
        ${S.exam.passed ? `<p class="okmsg">✅ Экзамен сдан ${esc(S.exam.date)} с результатом ${Math.round(S.exam.best * 100)}%</p><canvas id="cert" width="1600" height="1130" hidden></canvas><img id="certimg" alt="Сертификат «Знаток логистики»"><p class="muted small">На телефоне: нажмите и удерживайте сертификат → «Сохранить изображение».</p><div class="row center">${EMBED ? '' : '<button class="btn" id="dl">⬇ Скачать сертификат (PNG)</button>'}<button class="btn ghost" id="again">Пересдать для рекорда</button></div>` :
        `<p class="lead">${EXAM_N} случайных вопросов по всему курсу · ${EXAM_MIN} минут · проходной балл ${EXAM_PASS * 100}%</p>
        <p>После сдачи вы получите именной сертификат <b>«Знаток логистики»</b> и +500 XP.</p>
        ${ready ? '<button class="btn big" id="go">Начать экзамен</button>' : `<p class="warn">Сначала пройдите все уроки: ${d} из ${ALL.length}.</p><div class="pbar"><i style="width:${d / ALL.length * 100}%"></i></div><p class="muted small">Или включите свободный режим в <a href="#/course">программе курса</a>.</p>`}
        ${S.exam.best ? `<p class="muted">Лучшая попытка: ${Math.round(S.exam.best * 100)}%</p>` : ''}`}
      </section>`;
    if (S.exam.passed) { drawCert($('#cert')); $('#certimg').src = $('#cert').toDataURL('image/png'); if ($('#dl')) $('#dl').onclick = () => { const a = document.createElement('a'); a.download = 'sertifikat-logistika.png'; a.href = $('#cert').toDataURL('image/png'); a.click(); }; $('#again').onclick = examGo; }
    const g = $('#go'); if (g) g.onclick = examGo;
  }
  function examGo() {
    const pool = ALL.flatMap((l) => l.quiz.map((q) => Object.assign({ from: l.title }, q))).concat(COURSE.examExtra.map((q) => Object.assign({ from: 'Итоговые вопросы' }, q)));
    ex = { qs: shuffle(pool).slice(0, EXAM_N).map((q) => { const ord = shuffle(q.a.map((_, i) => i)); return { q: q.q, e: q.e, from: q.from, a: ord.map((i) => q.a[i]), c: ord.indexOf(q.c) }; }), ans: [], i: 0, end: Date.now() + EXAM_MIN * 60000 };
    exTimer = setInterval(() => { const t = $('#etime'); if (!t) return clearInterval(exTimer); const s = Math.max(0, Math.round((ex.end - Date.now()) / 1000)); t.textContent = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; if (!s) examEnd(); }, 1000);
    examQ();
  }
  function examQ() {
    const q = ex.qs[ex.i];
    app.innerHTML = `<section class="card"><div class="qhead"><span>Экзамен · вопрос ${ex.i + 1} / ${ex.qs.length}</span><span id="etime">⏱</span></div>
      <div class="pbar"><i style="width:${ex.i / ex.qs.length * 100}%"></i></div>
      <h3 class="qq">${esc(q.q)}</h3>
      <div class="answers">${q.a.map((a, i) => `<button class="ans" data-i="${i}"><b>${'АБВГД'[i]}</b>${esc(a)}</button>`).join('')}</div></section>`;
    app.querySelector('.answers').onclick = (e) => { const b = e.target.closest('.ans'); if (!b) return; ex.ans[ex.i] = +b.dataset.i; ex.i++; ex.i < ex.qs.length ? examQ() : examEnd(); };
  }
  function examEnd() {
    clearInterval(exTimer);
    if (!ex) return;
    const ok = ex.qs.filter((q, i) => ex.ans[i] === q.c).length, sc = ok / ex.qs.length, pass = sc >= EXAM_PASS;
    S.exam.best = Math.max(S.exam.best, sc);
    if (pass && !S.exam.passed) { S.exam.passed = true; S.exam.date = new Date().toLocaleDateString('ru-RU'); S.exam.id = 'LP-' + Date.now().toString(36).toUpperCase().slice(-6) + '-' + Math.random().toString(36).slice(2, 5).toUpperCase(); addXP(500, 'экзамен сдан'); achieve('exam'); confetti(); }
    save();
    const wrong = ex.qs.map((q, i) => ({ q, i })).filter(({ q, i }) => ex.ans[i] !== q.c);
    app.innerHTML = `<section class="card center result ${pass ? 'ok' : 'no'}"><div class="big">${pass ? '🏆' : '📚'} ${ok} / ${ex.qs.length} (${Math.round(sc * 100)}%)</div>
      <p class="lead">${pass ? `Поздравляем, ${esc(S.name)}! Вы — знаток логистики!` : `Нужно ${EXAM_PASS * 100}%. Повторите темы с ошибками и попробуйте снова.`}</p>
      <div class="row center">${pass ? '<a class="btn" href="#/exam">🎓 Мой сертификат</a>' : '<button class="btn" id="re">Пересдать</button>'}<a class="btn ghost" href="#/home">На главную</a></div></section>
      ${wrong.length ? `<section class="card"><h2>Разбор ошибок</h2>${wrong.map(({ q, i }) => `<div class="review"><b>${esc(q.q)}</b><p>Ваш ответ: <span class="bad">${ex.ans[i] != null ? esc(q.a[ex.ans[i]]) : '— (не успели)'}</span><br>Правильно: <span class="good">${esc(q.a[q.c])}</span></p><p class="muted small">${esc(q.e)} · Тема: ${esc(q.from)}</p></div>`).join('')}</section>` : ''}`;
    const r = $('#re'); if (r) r.onclick = examGo;
    ex = null;
  }
  function drawCert(c) {
    const x = c.getContext('2d'), W = c.width, H = c.height;
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0f172a'); g.addColorStop(1, '#1e293b');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const b = x.createLinearGradient(0, 0, W, 0); b.addColorStop(0, '#3b82f6'); b.addColorStop(0.5, '#8b5cf6'); b.addColorStop(1, '#f59e0b');
    x.strokeStyle = b; x.lineWidth = 18; x.strokeRect(40, 40, W - 80, H - 80);
    x.strokeStyle = 'rgba(255,255,255,.15)'; x.lineWidth = 2; x.strokeRect(75, 75, W - 150, H - 150);
    x.textAlign = 'center'; x.fillStyle = '#fff';
    x.font = '110px serif'; x.fillText('🚛', W / 2, 230);
    x.font = 'bold 84px Georgia, serif'; x.fillText('СЕРТИФИКАТ', W / 2, 360);
    x.font = '32px system-ui, sans-serif'; x.fillStyle = '#94a3b8'; x.fillText('настоящим подтверждается, что', W / 2, 440);
    x.font = 'bold 72px Georgia, serif'; x.fillStyle = b; let nm = S.name; while (x.measureText(nm).width > W - 300 && nm.length > 3) nm = nm.slice(0, -2) + '…'; x.fillText(nm, W / 2, 540);
    x.fillStyle = '#e2e8f0'; x.font = '34px system-ui, sans-serif';
    x.fillText('успешно освоил(а) курс «Логистика PRO: от новичка до знатока»', W / 2, 630);
    x.fillText(`${MODS.length} модулей · ${ALL.length} уроков · финальный экзамен — ${Math.round(S.exam.best * 100)}%`, W / 2, 685);
    x.font = 'bold 54px Georgia, serif'; x.fillStyle = '#f59e0b'; x.fillText('🏆 ЗНАТОК ЛОГИСТИКИ 🏆', W / 2, 800);
    x.font = '28px system-ui, sans-serif'; x.fillStyle = '#94a3b8';
    x.fillText(`Дата: ${S.exam.date}`, W / 2 - 360, 960); x.fillText(`№ ${S.exam.id}`, W / 2 + 360, 960);
    x.fillText('Транспорт · Склад · Запасы · ВЭД · Incoterms · SCM · KPI · Lean', W / 2, 1030);
  }

  /* ================= Профиль ================= */
  function profile() {
    const lv = level();
    app.innerHTML = `<div class="pagehead"><h1>👤 Профиль</h1></div>
      <section class="card prof"><div class="avatar">${lv.icon}</div><div><h2>${esc(S.name)}</h2><p>${esc(lv.name)} · ${S.xp} XP</p><div class="pbar"><i style="width:${lv.pct * 100}%"></i></div><p class="muted small">${lv.next ? `До уровня «${esc(lv.next)}» — ${lv.to - S.xp} XP` : 'Максимальный уровень'}</p></div></section>
      <h2>Уровни</h2><div class="levels">${LEVELS.map((l, i) => `<div class="${i <= lv.i ? 'on' : ''}"><span>${l[2]}</span><b>${l[1]}</b><small>${l[0]} XP</small></div>`).join('')}</div>
      <h2>Достижения</h2><div class="achs">${Object.entries(ACH).map(([k, a]) => `<div class="ach ${S.ach[k] ? 'on' : ''}"><span>${a[0]}</span><b>${a[1]}</b><small>${a[2]}</small></div>`).join('')}</div>
      <h2>Настройки</h2>
      <section class="card">
        <label class="fld"><span>Имя для сертификата</span><input id="pn" maxlength="40" value="${esc(S.name)}"></label>
        <label class="switch"><input type="checkbox" id="pt" ${S.settings.theme === 'light' ? 'checked' : ''}><span>Светлая тема</span></label>
        <label class="switch"><input type="checkbox" id="pf" ${S.settings.free ? 'checked' : ''}><span>Свободный режим (все уроки открыты)</span></label>
        <div class="row"><button class="btn ghost" id="exp">${EMBED ? '📋 Скопировать прогресс' : '⬇ Сохранить прогресс в файл'}</button><label class="btn ghost" ${EMBED ? 'hidden' : ''}>⬆ Загрузить из файла<input type="file" id="imp" accept=".json" hidden></label><button class="btn no" id="rst">Сбросить всё</button></div>
        <textarea id="expbox" rows="3" hidden readonly aria-label="Прогресс в виде текста"></textarea>
        <div id="rstok" class="row" hidden><span class="warn">Удалить весь прогресс? Это нельзя отменить.</span><button class="btn no" id="rsty">Да, удалить</button><button class="btn ghost" id="rstn">Отмена</button></div>
      </section>`;
    $('#pn').onchange = (e) => { const v = e.target.value.trim(); if (v) { S.name = v; save(); toast('Имя сохранено'); } };
    $('#pt').onchange = (e) => { S.settings.theme = e.target.checked ? 'light' : 'dark'; save(); theme(); };
    $('#pf').onchange = (e) => { S.settings.free = e.target.checked; save(); };
    $('#exp').onclick = () => {
      if (EMBED) { const t = $('#expbox'); t.hidden = false; t.value = JSON.stringify(S); t.select(); try { navigator.clipboard.writeText(t.value).then(() => toast('Прогресс скопирован'), () => {}); } catch (er) { /* выделенный текст можно скопировать вручную */ } return; }
      const a = document.createElement('a'); a.download = 'logistika-progress.json'; a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' })); a.click(); };
    $('#imp').onchange = (e) => { const f = e.target.files[0]; if (!f) return; f.text().then((t) => { try { const d = JSON.parse(t); if (typeof d !== 'object' || !d || typeof d.xp !== 'number') throw 0; S = Object.assign(fresh(), d); save(); theme(); toast('Прогресс загружен'); route(); } catch (er) { toast('Не удалось прочитать файл'); } }); };
    $('#rst').onclick = () => { $('#rstok').hidden = false; };
    $('#rstn').onclick = () => { $('#rstok').hidden = true; };
    $('#rsty').onclick = () => { S = fresh(); save(); location.hash = '#/'; route(); };
  }

  /* ================= Запуск ================= */
  function theme() { document.documentElement.dataset.theme = S.settings.theme; }
  theme(); route();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  window.LogiPro = { state: () => S, all: ALL, addXP };
})();
