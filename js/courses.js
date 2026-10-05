'use strict';
/* =========================================================
   COURSES — вкладка «🎓 Курсы» (третье окно рядом с «Мои дела»).

   Курс — дни по порядку, по одному уроку в календарный день.
   Урок — шаги: видео прямо внутри (YouTube), пазлы, аудирование,
   тест, тренировка с таймером, замер результата, дела-чекбоксы.
   Шаги открываются по очереди, как в English Galaxy.
   Урок дня сам встаёт задачей в «Всё остальное» (на выбранное время)
   и будильником в APK. «Мои дела» курсы не трогают.
   Обещание курса проверяется итоговой проверкой: не сдал —
   курс добавляет дни повторения и проверяет снова.
   ========================================================= */

const Courses = (() => {
  const { $ } = UI;
  const C = CourseData;
  const ORDER = [1, 2, 3, 4, 5, 6, 0];

  /* ---------- состояние ---------- */
  const today = () => State.todayKey();
  const S = () => {
    const s = State.s.learn || (State.s.learn = { active: [], courses: {} });
    if (!Array.isArray(s.active)) s.active = [];
    if (!s.courses) s.courses = {};
    return s;
  };
  function cs(id) {
    const s = S();
    const st = s.courses[id] || null;
    const c = st && C.byId(id);
    if (c && c.path) c.path.migrate(st); // старый 30-дневный английский → путь A0 → C1
    return st;
  }
  const total = (c, st) => (c.path ? Infinity : c.days + ((st && st.extra) || 0));
  const doneDays = (st) => Object.keys(st.done || {}).length;
  const doneToday = (st) => Object.values(st.done || {}).includes(today());
  const isActive = (id) => S().active.includes(id);
  const pct = (c, st) => (c.path ? c.path.pct(st) : Math.min(100, Math.round((doneDays(st) / total(c, st)) * 100)));
  function streak(st) {
    const set = new Set(Object.values(st.done || {}));
    let n = 0;
    const d = new Date();
    if (!set.has(State.dateKey(d))) d.setDate(d.getDate() - 1);
    while (set.has(State.dateKey(d))) { n += 1; d.setDate(d.getDate() - 1); }
    return n;
  }
  // у английского день — не номер, а место на пути (уровень, урок, часть, повторение, экзамен)
  const dayOf = (c, st, n) => (c.path && st ? c.path.today(st) : c.day(n, { days: total(c, st) }));
  const minutesOf = (c, st) => (c.path && st ? c.path.minutes(st) : c.minutes);
  const dayLabel = (c, st) => (c.path ? c.path.label(st) : `урок ${st.day}`);
  function levelChip(c, st) {
    const L = c.path && c.path.confirmedLevel(st);
    return L ? `Уровень ${L.id} ✓ · ` : '';
  }

  /* ---------- куда смотрим ---------- */
  let view = { name: 'home' };
  let exState = null; // идущее упражнение
  let videoHidden = false;

  /* ---------- маленькие детали ---------- */
  const esc = (s) => UI.esc(String(s == null ? '' : s));
  function ring(p, size, stroke, label, cls) {
    const r = (size - stroke) / 2;
    const len = 2 * Math.PI * r;
    return `<span class="cr-ring ${cls || ''}" style="width:${size}px;height:${size}px">
      <svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle class="bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
      <circle class="fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${len}" stroke-dashoffset="${len * (1 - Math.max(0, Math.min(100, p)) / 100)}"/></svg>
      <b>${label != null ? label : `${Math.round(p)}<small>%</small>`}</b></span>`;
  }
  const grad = (c) => `background:linear-gradient(135deg, ${c.grad[0]}, ${c.grad[1]})`;
  const shuffle = (arr, seed) => {
    const a = arr.slice();
    let x = seed || 7;
    for (let i = a.length - 1; i > 0; i -= 1) { x = (x * 9301 + 49297) % 233280; const j = Math.floor((x / 233280) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const norm = (s) => String(s).toLowerCase().replace(/[.?!,;:«»"—]/g, ' ').replace(/’/g, "'").replace(/\s+/g, ' ').trim();
  const plural = (n, one, few, many) => { const a = n % 10; const b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; };
  const hasAI = () => typeof window !== 'undefined' && !!window.claude && typeof window.claude.use === 'function' && typeof Coach !== 'undefined' && !!Coach.getSample;

  /* ---------- урок дня в «Всё остальное» ---------- */
  function ensureTasks() {
    if (!State.s.onboarded || typeof Screens === 'undefined' || !Screens.tasks) return;
    const k = today();
    S().active.forEach((id) => {
      const c = C.byId(id);
      const st = cs(id);
      if (!c || !st || st.finished || doneToday(st)) return;
      if (st.taskDay === k && State.s.tasks.some((t) => t.id === st.taskId)) return;
      // вчерашний несделанный урок не копим — он и так ждёт сегодня
      State.s.tasks = State.s.tasks.filter((t) => !(t.courseId === id && !t.done && t.due && t.due < k));
      Screens.tasks.add(`🎓 ${c.short}: ${dayLabel(c, st)}`, c.cat, 'mid', false, { due: k, at: st.time, estimate: minutesOf(c, st), silent: true });
      const t = State.s.tasks[0];
      if (t) { t.courseId = id; st.taskId = t.id; st.taskDay = k; }
    });
  }

  /* будильники для APK: урок дня в выбранное время */
  function alarms() {
    const out = [];
    S().active.forEach((id) => {
      const c = C.byId(id);
      const st = cs(id);
      if (!c || !st || st.finished || st.alarm === false) return;
      ORDER.forEach((dow) => out.push({ dow, min: st.time, title: `🎓 ${c.short}: урок дня`, text: `${minutesOf(c, st)} минут — и день засчитан.` }));
    });
    return out;
  }
  const syncAlarms = () => { if (typeof Remind !== 'undefined' && Remind.syncAlarms) Remind.syncAlarms(); };

  /* ---------- старт и сброс ---------- */
  function start(id, time, opts) {
    const s = S();
    const c = C.byId(id);
    s.courses[id] = { started: today(), day: 1, done: {}, prog: {}, metrics: {}, extra: 0, time: time == null ? 18 * 60 : time, alarm: true, video: {}, vid: {}, finished: null, failed: false };
    if (c && c.path) s.courses[id].path = c.path.init(opts);
    if (!s.active.includes(id)) s.active.push(id);
    State.commit();
    ensureTasks();
    syncAlarms();
    Sound.sfx('fanfare');
    FX.fireworks(2);
    UI.toast('Курс начат! Урок дня уже в ежедневнике', 'success', '🎓');
  }
  function reset(id) {
    const s = S();
    delete s.courses[id];
    s.active = s.active.filter((x) => x !== id);
    State.s.tasks = State.s.tasks.filter((t) => !(t.courseId === id && !t.done));
    State.commit();
    syncAlarms();
  }

  /* ---------- главная вкладки ---------- */
  function homeHTML() {
    const s = S();
    const act = s.active.map((id) => C.byId(id)).filter(Boolean);
    const rest = C.COURSES.filter((c) => !s.active.includes(c.id));
    const activeCard = (c) => {
      const st = cs(c.id);
      const tdone = doneToday(st);
      const p = pct(c, st);
      const fin = !!st.finished;
      const run = streak(st);
      return `
        <div class="cr-active" style="${grad(c)}">
          <button class="cr-active-top" data-cr-open="${c.id}">
            <span class="cr-emoji">${c.emoji}</span>
            <span class="cr-active-txt"><b>${esc(c.title)}</b><small>${fin ? '🏆 Курс пройден' : c.path ? `${levelChip(c, st)}${esc(c.path.label(st))}` : `День ${Math.min(st.day, total(c, st))} из ${total(c, st)}`}${run ? ` · 🔥 ${run}` : ''}</small></span>
            ${ring(p, 58, 6, null, 'light')}
          </button>
          ${fin ? `<button class="cr-go done" data-cr-open="${c.id}">🏆 Посмотреть результат</button>`
            : tdone ? `<button class="cr-go done" data-cr-open="${c.id}">✓ Сегодня пройдено — завтра ${esc(dayLabel(c, st))}</button>`
              : `<button class="cr-go" data-cr-lesson="${c.id}">▶ Урок дня · ${minutesOf(c, st)} мин</button>`}
        </div>`;
    };
    const catCard = (c) => `
      <button class="cr-cat" data-cr-open="${c.id}">
        <span class="cr-cat-ico" style="${grad(c)}">${c.emoji}</span>
        <span class="cr-cat-txt"><b>${esc(c.title)}</b><small>${esc(c.tag)}</small>
          <span class="cr-chips">${c.path ? '<i>6 уровней</i><i>экзамены</i>' : `<i>${c.days} дней</i>`}<i>${c.minutes} мин/день</i><i>${esc(c.level)}</i></span></span>

        <span class="cr-arrow">→</span>
      </button>`;
    return `
      <div class="cr">
        <header class="cr-hero">
          <h2>🎓 Курсы</h2>
          <p>С нуля до результата: каждый день один урок — видео, практика и проверка. Урок сам встаёт в ежедневник и будильник.</p>
        </header>
        ${act.length ? `<h4 class="cr-sec">Мои курсы</h4><div class="cr-actives">${act.map(activeCard).join('')}</div>` : ''}
        <h4 class="cr-sec">${act.length ? 'Ещё можно научиться' : 'Чему научиться?'}</h4>
        <div class="cr-cats">${rest.map(catCard).join('') || '<p class="muted small">Ты взялся за все курсы. Сильно!</p>'}</div>
        <p class="cr-foot muted small">«Мои дела» курсы не трогают: уроки идут в «Всё остальное» и в будильник.</p>
      </div>`;
  }

  /* ---------- страница курса ---------- */
  function courseHTML(c) {
    const st = cs(c.id);
    const T = st ? total(c, st) : c.days;
    const header = `
      <header class="cr-head" style="${grad(c)}">
        <button class="cr-back" data-cr-home aria-label="Назад к курсам">←</button>
        ${st ? ring(pct(c, st), 64, 6, null, 'light') : `<span class="cr-head-emoji">${c.emoji}</span>`}
        ${st && streak(st) ? `<span class="cr-fire">🔥 ${streak(st)}</span>` : '<span></span>'}
      </header>`;
    const promise = `
      <div class="cr-promise">
        <b>🤝 Обещание курса</b>
        <p>${esc(c.promise)}</p>
        <ul>${c.outcomes.map((o) => `<li>✓ ${esc(o)}</li>`).join('')}</ul>
        <p class="cr-guarantee">Как это гарантируется: ${c.guarantee ? esc(c.guarantee) : `курс не засчитывается, пока ты не сдашь итоговую проверку. Не получилось — курс сам добавит ${c.review ? `${c.review} дней повторения` : 'время'} и проверит ещё раз. Пропустил день — ничего не сгорает, курс подождёт.`}</p>
        ${c.honest ? `<p class="cr-honest">${esc(c.honest)}</p>` : ''}
      </div>`;
    const pathStart = c.path ? `
          <div class="en-start">
            <span class="cr-field-l">С чего начать?</span>
            <label class="en-opt"><input type="radio" name="en-start" value="zero" checked><span><b>С нуля</b><small>Урок 1 уровня A0 — всё по порядку</small></span></label>
            <label class="en-opt"><input type="radio" name="en-start" value="place"><span><b>Определить мой уровень</b><small>Тест на 10 минут — начнёшь с подходящего уровня</small></span></label>
            <span class="cr-field-l">Сколько видео в день?</span>
            <div class="en-mins">${[20, 30, 45].map((m) => `<button type="button" class="chip ${m === 30 ? 'active' : ''}" data-en-pick="${m}">${m} мин</button>`).join('')}</div>
          </div>` : '';
    if (!st) {
      return `${header}
        <div class="cr-sheet">
          <h2 class="cr-title">${c.emoji} ${esc(c.title)}</h2>
          <p class="muted">${esc(c.about)}</p>
          <div class="cr-chips big">${c.path ? '<i>🪜 6 уровней · 300 уроков</i>' : `<i>📅 ${c.days} дней</i>`}<i>⏱ ${c.path ? '~30–60' : c.minutes} мин в день</i><i>📈 ${esc(c.level)}</i></div>
          ${promise}
          ${pathStart}
          ${c.safety ? `<div class="cr-safety"><b>⚠️ Безопасность</b><p>${esc(c.safety)}</p></div>` : ''}
          <label class="cr-field"><span>Во сколько заниматься? Урок встанет в ежедневник и будильник</span>
            <input type="time" id="cr-time" value="18:00"></label>
          ${c.gate ? `<label class="cr-gate"><input type="checkbox" id="cr-gate"><span>${esc(c.gate)}</span></label>` : ''}
          <p class="acc-err" id="cr-err" role="alert"></p>
          <button class="btn btn-primary btn-lg btn-block cr-start" data-cr-start="${c.id}">Начать курс</button>
        </div>`;
    }
    const n = Math.min(st.day, T);
    const tdone = doneToday(st);
    const D = dayOf(c, st, n);
    // карта: недели по 7 дней
    const weeks = [];
    for (let w = 0; !c.path && w * 7 < T; w += 1) {
      const cells = [];
      for (let d = w * 7 + 1; d <= Math.min(T, w * 7 + 7); d += 1) {
        const dd = dayOf(c, st, d);
        const ok = !!st.done[d];
        const cur = d === n && !st.finished;
        cells.push(`<span class="cr-d ${ok ? 'ok' : ''} ${cur ? 'now' : ''} ${dd.check ? 'chk' : ''}" title="День ${d}: ${esc(dd.title)}">${ok ? '✓' : dd.check ? '🏁' : d}</span>`);
      }
      weeks.push(`<div class="cr-week"><small>Неделя ${w + 1}</small><div class="cr-days">${cells.join('')}</div></div>`);
    }
    // замеры
    const metricRows = Object.keys(st.metrics || {}).map((key) => {
      const arr = st.metrics[key];
      if (!arr || !arr.length) return '';
      const best = Math.max(...arr.map((x) => x.v));
      const last = arr[arr.length - 1].v;
      return `<div class="cr-metric"><span>${esc(arr[arr.length - 1].title || key)}</span><b>${last}${esc(arr[arr.length - 1].unit || '')}</b><small>лучшее: ${best}</small></div>`;
    }).join('');
    return `${header}
      <div class="cr-sheet">
        <h2 class="cr-title">${c.emoji} ${esc(c.title)}</h2>
        <p class="muted">${st.finished ? '🏆 Курс пройден! Обещание выполнено.' : c.path ? `Занимаешься ${doneDays(st)} ${plural(doneDays(st), 'день', 'дня', 'дней')} · путь до C1 пройден на ${pct(c, st)}%` : `День ${n} из ${T}${st.extra ? ` · +${st.extra} дней повторения` : ''}`}</p>
        ${view.celebrate && !st.finished ? `<div class="cr-win">🎉 ${view.msg ? esc(view.msg) : `День ${view.celebrate} пройден!`} +25 опыта.</div>` : ''}
        ${st.finished ? `<div class="cr-win">🏆 Ты прошёл курс «${esc(c.title)}» и сдал проверку.</div>`
          : `<button class="cr-today" data-cr-lesson="${c.id}" ${tdone ? 'disabled' : ''}>
              <span><small>${tdone ? 'Сегодня пройдено ✓' : c.path ? `Сегодня · ${esc(c.path.label(st))}` : `Сегодня · день ${n}`}</small><b>${esc(tdone ? `Завтра: ${dayOf(c, st, st.day).title}` : D.title)}</b><em>${esc(tdone ? 'Возвращайся завтра — урок уже ждёт' : D.sub)}</em></span>
              <i>${tdone ? '✓' : '▶'}</i></button>`}
        ${metricRows ? `<h4 class="cr-sec">📈 Твой прогресс</h4><div class="cr-metrics">${metricRows}</div>` : ''}
        ${c.path ? c.path.pageHTML(st, esc) : `<h4 class="cr-sec">🗺 Путь</h4>
        <div class="cr-map">${weeks.join('')}</div>`}
        ${c.path && hasAI() ? `<button class="btn btn-primary btn-block en-tutor" id="en-tutor">💬 Поговорить с ИИ-тренером по-английски</button>` : ''}
        ${promise}

        ${c.safety ? `<div class="cr-safety"><b>⚠️ Безопасность</b><p>${esc(c.safety)}</p></div>` : ''}
        <h4 class="cr-sec">⚙️ Напоминание</h4>
        <div class="cr-settings">
          <label class="cr-field"><span>Время урока</span><input type="time" id="cr-time" value="${Track.hhmm(st.time)}"></label>
          <label class="remind-sw"><input type="checkbox" id="cr-alarm" ${st.alarm !== false ? 'checked' : ''}><span>⏰ Будильник в это время (APK на Android)</span></label>
        </div>
        <button class="btn btn-ghost btn-block cr-reset" id="cr-reset">Начать курс заново</button>
      </div>`;
  }

  /* ---------- урок дня ---------- */
  function stepProg(st, i) { return Math.max(0, Math.min(1, Number((st.prog || {})[i]) || 0)); }
  function lessonPct(st, D) {
    if (!D.steps.length) return 0;
    return Math.round((D.steps.reduce((a, _, i) => a + stepProg(st, i), 0) / D.steps.length) * 100);
  }
  /* шаг открыт, если все прежние шаги (кроме видео) закрыты */
  function unlocked(st, D, i) {
    for (let j = 0; j < i; j += 1) if (D.steps[j].type !== 'video' && stepProg(st, j) < 1) return false;
    return true;
  }

  function videoSrc(v, st) {
    const vid = v.id || (v.lesson && st.vid && st.vid[v.lesson]) || null;
    const saved = v.lesson && st.video && st.video[v.lesson];
    const startAt = saved != null ? Math.max(0, Math.floor(saved) - 5) : (v.start || 0);
    const origin = location.origin && location.origin !== 'null' ? `&origin=${encodeURIComponent(location.origin)}` : '';
    if (vid) {
      return {
        src: `https://www.youtube-nocookie.com/embed/${vid}?rel=0&playsinline=1&enablejsapi=1&start=${startAt}${v.list ? `&list=${v.list}` : ''}${origin}`,
        open: `https://www.youtube.com/watch?v=${vid}${startAt ? `&t=${startAt}s` : ''}${v.list ? `&list=${v.list}` : ''}`,
        startAt,
      };
    }
    return {
      src: `https://www.youtube-nocookie.com/embed/videoseries?list=${v.list}&index=${v.index}&rel=0&playsinline=1&enablejsapi=1${origin}`,
      open: `https://www.youtube.com/playlist?list=${v.list}`,
      startAt: 0,
    };
  }

  function lessonHTML(c) {
    const st = cs(c.id);
    const n = Math.min(st.day, total(c, st));
    const D = dayOf(c, st, n);
    const p = lessonPct(st, D);
    const vi = D.steps.findIndex((s) => s.type === 'video');
    const v = vi >= 0 ? D.steps[vi].video : null;
    const vs = v ? videoSrc(v, st) : null;
    const icon = { video: '🎬', 'puzzle-en': '🧩', 'puzzle-ru': '🧩', listening: '🎧', test: '✍️', session: '⏱', measure: '📏', todo: '✅', speak: '🎤', read: '📖' };
    const rows = D.steps.map((s, i) => {
      const pr = stepProg(st, i);
      const open = unlocked(st, D, i);
      return `
        <li class="cr-step ${pr >= 1 ? 'done' : ''} ${open ? '' : 'locked'}">
          <span class="cr-step-ico">${!open ? '<span class="cr-lock">🔒</span>' : pr >= 1 ? '<span class="cr-ok">✓</span>' : pr > 0 ? ring(pr * 100, 44, 4) : `<span class="cr-step-emoji">${icon[s.type] || '•'}</span>`}</span>
          <span class="cr-step-txt"><b>${esc(s.title)}</b><small>${esc(s.sub || '')}</small></span>
          <button class="cr-step-go" data-cr-step="${i}" ${open ? '' : 'disabled'} aria-label="${esc(s.title)}">→</button>
        </li>`;
    }).join('');
    return `
      <header class="cr-head lesson" style="${grad(c)}">
        <button class="cr-back" data-cr-open="${c.id}" aria-label="Назад к курсу">←</button>
        ${ring(p, 64, 6, null, 'light')}
        <span class="cr-fire">🔥 ${streak(st)}</span>
      </header>
      <div class="cr-sheet lesson">
        <div class="cr-lesson-title"><small>${c.path ? esc(c.path.label(st)) : `День ${n} из ${total(c, st)}`}</small><b>${esc(D.title)}</b></div>
        ${vs ? `
          <div class="cr-video ${videoHidden ? 'hidden' : ''}">
            <iframe id="cr-yt" src="${esc(vs.src)}" title="Видеоурок" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" loading="lazy"></iframe>
          </div>
          <div class="cr-video-links">
            <button class="linkbtn" id="cr-vhide">${videoHidden ? 'Показать видео' : 'Скрыть видео'}</button>
            <a class="linkbtn" href="${esc(vs.open)}" target="_blank" rel="noopener">Открыть в YouTube ↗</a>
          </div>
          <p class="cr-vhint" id="cr-vhint" hidden></p>` : ''}
        ${vs && c.videoNote ? `<p class="muted small cr-vnote">${esc(c.videoNote)}</p>` : ''}
        <ul class="cr-steps">${rows}</ul>
        ${p >= 100 ? `<div class="cr-win">🎉 День ${n} пройден!</div>` : ''}
      </div>`;
  }

  /* ---------- упражнения ---------- */
  function exHTML(c, i) {
    const st = cs(c.id);
    const D = dayOf(c, st, Math.min(st.day, total(c, st)));
    const s = D.steps[i];
    return `
      <header class="cr-head ex" style="${grad(c)}">
        <button class="cr-back" data-cr-lesson="${c.id}" aria-label="Назад к уроку">✕</button>
        <b class="cr-ex-title">${esc(s.title)}</b>
        <span class="cr-ex-count" id="cr-ex-count"></span>
      </header>
      <div class="cr-sheet ex"><div id="cr-ex"></div></div>`;
  }

  function setProg(c, i, v) {
    const st = cs(c.id);
    st.prog = st.prog || {};
    st.prog[i] = Math.max(stepProg(st, i), v);
    State.save();
  }

  /* шаг закрыт — может, весь день закрыт */
  function finishStep(c, i, el, extra) {
    const st = cs(c.id);
    setProg(c, i, 1);
    if (extra && extra.failed) st.failed = true;
    State.save();
    const n = Math.min(st.day, total(c, st));
    const D = dayOf(c, st, n);
    if (D.steps.every((_, j) => stepProg(st, j) >= 1)) { completeDay(c, el); return; }
    // упражнение закрыто — обратно к уроку, следующий шаг уже открыт
    const fromEx = view.name === 'ex';
    if (fromEx) view = { name: 'lesson', id: c.id };
    State.commit(); // у урока это мягкая перерисовка — видео продолжает играть
    if (fromEx) { render(true); window.scrollTo({ top: 0 }); }
  }

  function completeDay(c, el) {
    const st = cs(c.id);
    const n = Math.min(st.day, total(c, st));
    const D = dayOf(c, st, n);
    st.done[n] = today();
    st.prog = {};
    // задача «урок дня» в ежедневнике — тоже закрыта
    const t = State.s.tasks.find((x) => x.id === st.taskId && !x.done);
    if (t) Screens.tasks.complete(t, el || document.body);
    State.addXP(25);
    let msg = `День ${n} пройден! Завтра — следующий урок`;
    const isFinal = D.check === true || D.check === 'final';
    if (c.path) {
      // английский: путь сам решает — следующая часть, урок, экзамен, уровень
      const r = c.path.complete(st, D);
      msg = r.msg;
      if (r.finished) st.finished = today();
    } else if (isFinal) {
      if (st.failed) {
        st.extra = (st.extra || 0) + (c.review || 5);
        msg = `Пока не дотянул до цели — курс добавил ${c.review || 5} дней повторения, потом проверка снова. Так и работает гарантия.`;
      } else {
        st.finished = today();
        msg = `🏆 Курс «${c.title}» пройден! Обещание выполнено.`;
      }
    } else if (D.check) {
      // промежуточная проверка: просто замер, курс идёт дальше
      msg = st.failed ? `Проверка записана. До цели ещё чуть-чуть — к финалу подтянешь, курс как раз на это.` : `Промежуточная цель взята! Идём дальше.`;
    }
    const failedNow = st.failed;
    st.failed = false;
    if (c.path) st.day = n + 1;
    else if (!st.finished) st.day = Math.min(n + 1, total(c, st));
    if (st.finished) { State.s.tasks = State.s.tasks.filter((x) => !(x.courseId === c.id && !x.done)); }
    State.commit();
    syncAlarms();
    Sound.sfx('fanfare');
    FX.fireworks(st.finished ? 6 : 3);
    UI.toast(msg, 'level', st.finished ? '🏆' : failedNow ? '💪' : '🎉');
    view = { name: 'course', id: c.id, celebrate: n, msg: c.path ? msg : null };

    render(true);
    window.scrollTo({ top: 0 });
  }

  /* --- голос: английская фраза вслух --- */
  function sayEn(text, slow) {
    try {
      if (!window.speechSynthesis) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = slow ? 0.6 : 0.9;
      const v = speechSynthesis.getVoices && speechSynthesis.getVoices().find((x) => /^en/i.test(x.lang));
      if (v) u.voice = v;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) { /* без голоса — есть текст */ }
  }
  /* ответ засчитан: курс узнаёт, что повторять и какие темы слабые */
  function itemDone(c, s, item, ok) {
    if (!c.path) return;
    const st = cs(c.id);
    if (s.place) c.path.onPlace(st, item, ok);
    else c.path.onItem(st, s, item, ok);
  }
  /* итог проверки с порогом: кольцо и «сдано / не сдано» */
  function scoreScreen(c, i, s, box, right, N) {
    const score = N ? right / N : 0;
    const passNeed = s.pass || 0;
    const failed = !!(passNeed && score < passNeed);
    box.innerHTML = `
      <div class="cr-ex-body">
        <div class="cr-score ${failed ? 'bad' : ''}">${ring(score * 100, 120, 10, `${Math.round(score * 100)}<small>%</small>`)}</div>
        <p class="cr-q">${failed ? `Нужно ${Math.round(passNeed * 100)}%. Ничего страшного: курс добавит повторение и проверит снова.` : passNeed ? 'Проверка сдана!' : `Верно ${right} из ${N}`}</p>
        <button class="btn btn-primary btn-lg btn-block" id="cr-done">Готово</button>
      </div>`;
    box.querySelector('#cr-done').onclick = () => finishStep(c, i, box, { failed });
  }

  /* --- пазл: собери предложение из слов ---
     В уроке ошибку не засчитывают: фраза уходит в конец и вернётся.
     На экзамене (есть порог) — одна попытка на фразу, в конце процент. */
  function runPuzzle(c, i, s) {
    const box = $('#cr-ex');
    const mode = s.type; // puzzle-en | puzzle-ru | listening
    const exam = !!s.pass;
    const queue = s.items.map((x, k) => ({ x, k }));
    const tried = new Set();
    let solved = 0;
    let answered = 0;
    let right = 0;
    const totalN = s.items.length;
    const count = () => { const el = $('#cr-ex-count'); if (el) el.textContent = `${exam ? answered : solved} из ${totalN}`; };

    function next() {
      count();
      setProg(c, i, (exam ? answered : solved) / totalN * (exam ? 0.99 : 1));
      if (!queue.length) {
        if (exam) scoreScreen(c, i, s, box, right, totalN);
        else finishStep(c, i, box);
        return;
      }
      const { x, k } = queue[0];
      const target = mode === 'puzzle-en' ? x.words : x.ruWords;
      // лишнее слово — из другого предложения, чтобы ответ не угадывался по количеству
      const others = s.items.filter((y) => y !== x).flatMap((y) => (mode === 'puzzle-en' ? y.words : y.ruWords));
      const extra = others.find((w) => !target.map(norm).includes(norm(w)));
      const chips = shuffle(target.concat(extra ? [extra] : []), k + solved * 13 + answered * 7 + 3);
      let picked = []; // индексы фишек по порядку
      let state = '';

      const prompt = mode === 'puzzle-en' ? `<p class="cr-q-label">Переведи на английский</p><p class="cr-q">${esc(x.ru)}</p>`
        : mode === 'puzzle-ru' ? `<p class="cr-q-label">Переведи на русский</p><p class="cr-q en">${esc(x.en)}</p>`
          : `<p class="cr-q-label">Послушай и переведи на русский</p><div class="cr-listen"><button class="cr-speak" id="cr-speak" aria-label="Послушать ещё раз">🔊</button><button class="cr-speak slow" id="cr-slow" aria-label="Медленно">🐢</button></div>`;

      function draw() {
        box.innerHTML = `
          <div class="cr-ex-body ${state}">
            ${exam ? '<p class="cr-exam-tag">🏁 Экзамен — одна попытка</p>' : ''}
            ${prompt}
            <div class="cr-answer" id="cr-answer">${picked.map((j, pos) => `<button class="cr-chip in" data-cr-out="${pos}">${esc(chips[j])}</button>`).join('') || '<span class="muted small">Нажимай на слова ниже</span>'}</div>
            ${state === 'wrong' ? `<p class="cr-right">Правильно: <b>${esc(mode === 'puzzle-en' ? x.en : x.ru)}</b>${mode === 'listening' ? `<br><span class="muted">${esc(x.en)}</span>` : ''}</p>` : ''}
            ${state === 'ok' ? `<p class="cr-right ok">Верно!${mode === 'listening' ? ` <span class="muted">${esc(x.en)}</span>` : ''}</p>` : ''}
            <div class="cr-pool">${chips.map((w, j) => (picked.includes(j) ? `<span class="cr-chip ghost">${esc(w)}</span>` : `<button class="cr-chip" data-cr-in="${j}" ${state ? 'disabled' : ''}>${esc(w)}</button>`)).join('')}</div>
            ${state === 'wrong' ? '<button class="btn btn-primary btn-lg btn-block" id="cr-next">Дальше</button>'
              : state === 'ok' ? '' : `<button class="btn btn-primary btn-lg btn-block" id="cr-check" ${picked.length ? '' : 'disabled'}>Проверить</button>`}
          </div>`;
        if (!state) {
          box.querySelectorAll('[data-cr-in]').forEach((b) => { b.onclick = () => { picked.push(Number(b.dataset.crIn)); Sound.sfx('pop'); draw(); }; });
          box.querySelectorAll('[data-cr-out]').forEach((b) => { b.onclick = () => { picked.splice(Number(b.dataset.crOut), 1); draw(); }; });
          const chk = box.querySelector('#cr-check');
          if (chk) chk.onclick = check;
        }
        const nx = box.querySelector('#cr-next');
        if (nx) nx.onclick = () => { if (exam) queue.shift(); else queue.push(queue.shift()); next(); };
        const sp = box.querySelector('#cr-speak'); if (sp) sp.onclick = () => sayEn(x.en);
        const sl = box.querySelector('#cr-slow'); if (sl) sl.onclick = () => sayEn(x.en, true);
      }
      function check() {
        const got = picked.map((j) => chips[j]);
        // по-русски порядок слов свободный — засчитываем любой; по-английски — только верный
        const ok = mode === 'puzzle-en'
          ? norm(got.join(' ')) === norm(target.join(' '))
          : got.map(norm).sort().join(' ') === target.map(norm).sort().join(' ');
        if (!tried.has(k)) { tried.add(k); itemDone(c, s, x, ok); if (exam) { answered += 1; if (ok) right += 1; } }
        if (ok) {
          Sound.sfx('success');
          queue.shift();
          solved += 1;
          state = 'ok';
          draw();
          if (mode !== 'puzzle-ru') sayEn(x.en);
          setTimeout(next, 1100);
        } else {
          Sound.sfx('deny');
          state = 'wrong';
          draw();
        }
      }
      draw();
      if (mode === 'listening') setTimeout(() => sayEn(x.en), 300);
    }
    next();
  }

  /* --- тест: заполни пропуск --- */
  function runTest(c, i, s) {
    const box = $('#cr-ex');
    let k = 0;
    let right = 0;
    const N = s.items.length;
    const count = () => { const el = $('#cr-ex-count'); if (el) el.textContent = `${k} из ${N}`; };
    function q() {
      count();
      setProg(c, i, (k / N) * 0.99);
      if (k >= N) { scoreScreen(c, i, s, box, right, N); return; }
      const it = s.items[k];
      const opts = shuffle(it.o, k * 7 + 11);
      const parts = it.q.split('___');
      box.innerHTML = `
        <div class="cr-ex-body">
          ${s.place ? `<p class="cr-exam-tag">Вопрос ${k + 1} из ${N} · не знаешь — выбирай наугад</p>` : s.pass ? '<p class="cr-exam-tag">🏁 Экзамен</p>' : ''}
          ${parts.length > 1 ? `<p class="cr-q-label">Заполни пропуск</p>
          <p class="cr-q en">${esc(parts[0])}<span class="cr-gap" id="cr-gap">___</span>${esc(parts[1] || '')}</p>` : `<p class="cr-q-label">Вопрос</p><p class="cr-q">${esc(it.q)}</p>`}
          <div class="cr-opts">${opts.map((o) => `<button class="cr-opt" data-cr-opt="${esc(o)}">${esc(o)}</button>`).join('')}</div>
        </div>`;
      box.querySelectorAll('[data-cr-opt]').forEach((b) => {
        b.onclick = () => {
          const ok = b.dataset.crOpt === it.a;
          box.querySelectorAll('[data-cr-opt]').forEach((x) => { x.disabled = true; if (x.dataset.crOpt === it.a) x.classList.add('right'); });
          if (!ok) b.classList.add('wrong');
          const gapEl = $('#cr-gap');
          if (gapEl) { gapEl.textContent = it.a; gapEl.classList.add(ok ? 'ok' : 'bad'); }
          Sound.sfx(ok ? 'success' : 'deny');
          itemDone(c, s, it, ok);
          if (ok) right += 1;
          k += 1;
          setTimeout(q, ok ? 700 : 1500);
        };
      });
    }
    q();
  }

  /* --- говорение: скажи фразу по-английски вслух ---
     Слушает распознавание речи (в браузере — webkitSpeechRecognition,
     в APK — распознавание Android). Засчитывается, если совпало ≥ 70 % слов.
     Нет микрофона — говоришь вслух, открываешь ответ и честно отмечаешь сам. */
  function speechAPI() {
    return typeof window !== 'undefined' ? (window.webkitSpeechRecognition || window.SpeechRecognition || null) : null;
  }
  function matchScore(said, target) {
    const t = norm(target).split(' ').filter(Boolean);
    const pool = norm(said).split(' ').filter(Boolean);
    let hit = 0;
    t.forEach((w) => { const j = pool.indexOf(w); if (j >= 0) { hit += 1; pool.splice(j, 1); } });
    return t.length ? hit / t.length : 0;
  }
  function runSpeak(c, i, s) {
    const box = $('#cr-ex');
    const exam = !!s.pass;
    const N = s.items.length;
    let k = 0;
    let right = 0;
    let tries = 0;
    let manual = !speechAPI();
    let rec = null;
    const count = () => { const el = $('#cr-ex-count'); if (el) el.textContent = `${k} из ${N}`; };
    function settle(ok, wait) {
      itemDone(c, s, s.items[k], ok);
      if (ok) right += 1;
      k += 1;
      tries = 0;
      setTimeout(q, wait || (ok ? 900 : 200));
    }
    function q(note) {
      count();
      setProg(c, i, (k / N) * 0.99);
      if (k >= N) {
        if (exam) scoreScreen(c, i, s, box, right, N);
        else finishStep(c, i, box);
        return;
      }
      const x = s.items[k];
      box.innerHTML = `
        <div class="cr-ex-body">
          ${exam ? '<p class="cr-exam-tag">🏁 Экзамен — две попытки на фразу</p>' : ''}
          <p class="cr-q-label">Скажи по-английски вслух</p>
          <p class="cr-q">${esc(x.ru)}</p>
          ${manual ? `
            <p class="muted small">Скажи фразу вслух, потом открой ответ и проверь себя честно.</p>
            <div id="cr-sp-ans"></div>
            <button class="btn btn-primary btn-lg btn-block" id="cr-sp-show">Показать ответ</button>`
          : `
            <button class="cr-mic" id="cr-mic" aria-label="Говорить">🎤</button>
            <p class="cr-mic-hint" id="cr-mic-hint">${note ? esc(note) : 'Нажми и скажи фразу'}</p>
            <div id="cr-sp-ans"></div>
            ${exam ? '' : '<button class="linkbtn" id="cr-sp-hint">Подсказка</button>'}
            <button class="linkbtn" id="cr-sp-manual">Нет микрофона — проверю себя сам</button>`}
        </div>`;
      const ans = box.querySelector('#cr-sp-ans');
      const showAnswer = (said, score) => {
        ans.innerHTML = `
          ${said != null ? `<p class="cr-said">Ты сказал: <b>${esc(said || '…')}</b></p>` : ''}
          <p class="cr-right ${score != null && score >= 0.7 ? 'ok' : ''}">${score != null ? (score >= 0.7 ? 'Верно! ' : 'Правильно: ') : ''}<b>${esc(x.en)}</b>
            <button class="cr-speak mini" id="cr-sp-say" aria-label="Послушать">🔊</button></p>`;
        ans.querySelector('#cr-sp-say').onclick = () => sayEn(x.en);
      };
      if (manual) {
        box.querySelector('#cr-sp-show').onclick = () => {
          showAnswer(null, null);
          sayEn(x.en);
          box.querySelector('#cr-sp-show').outerHTML = `<div class="cr-self">
            <button class="btn btn-primary btn-lg" id="cr-sp-ok">Сказал верно ✓</button>
            <button class="btn btn-ghost btn-lg" id="cr-sp-bad">Ошибся</button></div>`;
          box.querySelector('#cr-sp-ok').onclick = () => { Sound.sfx('success'); settle(true); };
          box.querySelector('#cr-sp-bad').onclick = () => { Sound.sfx('deny'); settle(false); };
        };
        return;
      }
      const hintBtn = box.querySelector('#cr-sp-hint');
      if (hintBtn) hintBtn.onclick = () => { hintBtn.outerHTML = `<p class="muted small cr-hint-words">${esc(x.words.slice(0, Math.ceil(x.words.length / 2)).join(' '))} …</p>`; };
      box.querySelector('#cr-sp-manual').onclick = () => { manual = true; if (rec) try { rec.abort(); } catch (e) {} q(); };
      const mic = box.querySelector('#cr-mic');
      const hint = box.querySelector('#cr-mic-hint');
      mic.onclick = () => {
        const API = speechAPI();
        if (!API) { manual = true; q(); return; }
        try {
          rec = new API();
          rec.lang = 'en-US';
          rec.interimResults = false;
          rec.maxAlternatives = 3;
        } catch (e) { manual = true; q(); return; }
        let got = false;
        mic.classList.add('on');
        hint.textContent = 'Слушаю… говори';
        rec.onresult = (ev) => {
          got = true;
          const alts = Array.from((ev.results && ev.results[0]) || []).map((r) => r.transcript);
          const best = alts.reduce((b, t) => (matchScore(t, x.en) > matchScore(b, x.en) ? t : b), alts[0] || '');
          const score = matchScore(best, x.en);
          tries += 1;
          showAnswer(best, score);
          mic.classList.remove('on');
          if (score >= 0.7) { Sound.sfx('success'); mic.disabled = true; hint.textContent = 'Отлично!'; settle(true); return; }
          Sound.sfx('deny');
          if (exam && tries >= 2) { mic.disabled = true; hint.textContent = 'Не засчитано'; settle(false, 1800); return; }
          if (!exam && tries === 1) itemDone(c, s, x, false);
          hint.textContent = exam ? 'Ещё одна попытка — нажми и скажи' : 'Послушай и скажи ещё раз';
          if (!exam && tries >= 3) {
            hint.innerHTML = 'Не выходит — не страшно, фраза вернётся на повторение. <button class="linkbtn" id="cr-sp-skip">Дальше</button>';
            box.querySelector('#cr-sp-skip').onclick = () => { tries = 0; k += 1; q(); };
          }
        };
        rec.onerror = (ev) => {
          mic.classList.remove('on');
          const err = ev && ev.error;
          if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'no-service' || err === 'audio-capture') {
            manual = true;
            q('Микрофон недоступен — проверим себя вручную');
            return;
          }
          hint.textContent = err === 'no-speech' ? 'Ничего не услышал — нажми и скажи погромче' : 'Не расслышал — попробуй ещё раз';
        };
        rec.onend = () => { mic.classList.remove('on'); if (!got && hint.textContent === 'Слушаю… говори') hint.textContent = 'Нажми и скажи фразу'; };
        try { rec.start(); } catch (e) { mic.classList.remove('on'); hint.textContent = 'Нажми ещё раз'; }
      };
    }
    q();
  }

  /* --- тренировка с таймером --- */
  function runSession(c, i, s) {
    const box = $('#cr-ex');
    const sets = s.sets || 1;
    box.innerHTML = `
      <div class="cr-ex-body">
        <ul class="cr-session">${s.session.map((x) => `<li><b>${esc(x.t)}</b><span>${x.sec ? `${x.sec >= 60 ? `${Math.round(x.sec / 60)} мин` : `${x.sec} с`}` : esc(x.reps)}</span><small>${esc(x.how || '')}</small>${x.err ? `<small class="cr-err">⚠️ Частая ошибка: ${esc(x.err)}</small>` : ''}</li>`).join('')}</ul>
        ${sets > 1 ? `<p class="muted small">${sets} круга, между упражнениями — отдых 30 секунд.</p>` : ''}
        <button class="btn btn-primary btn-lg btn-block" id="cr-run">▶ Начать с таймером и голосом</button>
        <button class="btn btn-ghost btn-block" id="cr-self">Сделал сам, без таймера ✓</button>
      </div>`;
    const done = () => finishStep(c, i, box);
    box.querySelector('#cr-self').onclick = done;
    box.querySelector('#cr-run').onclick = () => {
      const steps = [];
      for (let r = 0; r < sets; r += 1) {
        s.session.forEach((x, j) => {
          if (steps.length) steps.push({ kind: 'rest', t: 'Отдых', sec: 30 });
          steps.push({ kind: 'task', t: x.t, sec: x.sec, reps: x.reps, how: x.err ? `${x.how} ⚠️ Не делай так: ${x.err}` : x.how, label: sets > 1 ? `Круг ${r + 1} · ${j + 1}/${s.session.length}` : `${j + 1}/${s.session.length}` });
        });
      }
      if (typeof Coach !== 'undefined' && Coach.runSteps) Coach.runSteps('session', steps, `${c.emoji} ${c.short}`, null, done);
      else done();
    };
  }

  /* --- объяснение простыми словами: карточки по одной --- */
  function runRead(c, i, s) {
    const box = $('#cr-ex');
    let k = 0;
    const N = s.cards.length;
    function draw() {
      const el = $('#cr-ex-count'); if (el) el.textContent = `${k + 1} из ${N}`;
      setProg(c, i, (k / N) * 0.99);
      const [h, t] = s.cards[k];
      box.innerHTML = `
        <div class="cr-ex-body">
          <div class="cr-card"><span class="cr-card-n">${k + 1}</span><b>${esc(h)}</b><p>${esc(t)}</p></div>
          <div class="cr-dots">${s.cards.map((_, j) => `<i class="${j <= k ? 'on' : ''}"></i>`).join('')}</div>
          <button class="btn btn-primary btn-lg btn-block" id="cr-rnext">${k < N - 1 ? 'Дальше →' : 'Понял ✓'}</button>
          ${k > 0 ? '<button class="btn btn-ghost btn-block" id="cr-rback">← Назад</button>' : ''}
        </div>`;
      box.querySelector('#cr-rnext').onclick = () => { Sound.sfx('pop'); if (k < N - 1) { k += 1; draw(); } else finishStep(c, i, box); };
      const back = box.querySelector('#cr-rback');
      if (back) back.onclick = () => { k -= 1; draw(); };
    }
    draw();
  }

  /* --- замер: сколько секунд / раз / денег --- */
  function runMeasure(c, i, s) {
    const box = $('#cr-ex');
    const st = cs(c.id);
    const arr = (st.metrics && st.metrics[s.key]) || [];
    const best = arr.length ? Math.max(...arr.map((x) => x.v)) : null;
    box.innerHTML = `
      <div class="cr-ex-body">
        <p class="cr-q">${esc(s.title)}</p>
        ${s.sub ? `<p class="muted">${esc(s.sub)}</p>` : ''}
        ${s.goal ? `<p class="cr-goal">🎯 Цель: <b>${s.goal} ${esc(s.unit || '')}</b></p>` : ''}
        ${best != null ? `<p class="muted small">Твоё лучшее: ${best} ${esc(s.unit || '')}</p>` : ''}
        <input type="number" inputmode="decimal" min="0" id="cr-num" class="cr-num" placeholder="0">
        <p class="acc-err" id="cr-merr" role="alert"></p>
        <button class="btn btn-primary btn-lg btn-block" id="cr-save">Записать</button>
      </div>`;
    box.querySelector('#cr-save').onclick = () => {
      const v = Number(box.querySelector('#cr-num').value);
      if (!Number.isFinite(v) || box.querySelector('#cr-num').value === '') { box.querySelector('#cr-merr').textContent = 'Впиши число.'; return; }
      st.metrics = st.metrics || {};
      (st.metrics[s.key] = st.metrics[s.key] || []).push({ d: today(), v, title: s.title, unit: s.unit ? ` ${s.unit}` : '' });
      st.metrics[s.key] = st.metrics[s.key].slice(-60);
      const failed = !!(s.goal && v < s.goal);
      if (s.goal && !failed) UI.toast('Цель взята!', 'success', '🎯');
      finishStep(c, i, box, { failed });
    };
  }

  /* --- дела-чекбоксы --- */
  function runTodo(c, i, s) {
    const box = $('#cr-ex');
    const st = cs(c.id);
    const key = `todo${i}`;
    st.prog = st.prog || {};
    const got = new Set(st.prog[key] || []);
    const draw = () => {
      box.innerHTML = `
        <div class="cr-ex-body">
          <ul class="cr-todo">${s.items.map((t, j) => `<li><label><input type="checkbox" data-cr-todo="${j}" ${got.has(j) ? 'checked' : ''}><span>${esc(t)}</span></label></li>`).join('')}</ul>
          <button class="btn btn-primary btn-lg btn-block" id="cr-tdone" ${got.size === s.items.length ? '' : 'disabled'}>Готово</button>
        </div>`;
      box.querySelectorAll('[data-cr-todo]').forEach((b) => {
        b.onchange = () => {
          const j = Number(b.dataset.crTodo);
          if (b.checked) got.add(j); else got.delete(j);
          st.prog[key] = [...got];
          setProg(c, i, got.size / s.items.length);
          Sound.sfx('pop');
          draw();
        };
      });
      box.querySelector('#cr-tdone').onclick = () => finishStep(c, i, box);
    };
    draw();
  }

  /* --- видео как шаг: смотришь в уроке, тут — отметка --- */
  function runVideo(c, i) {
    view = { name: 'lesson', id: c.id };
    videoHidden = false;
    render(true);
    const box = $('#cr-yt');
    if (box) box.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const st = cs(c.id);
    if (stepProg(st, i) < 1) {
      UI.toast('Смотри — отмечу, когда наберётся 20 минут. Или нажми «Посмотрел» ниже', 'default', '🎬');
    }
  }

  /* ---------- YouTube: где остановился и сколько посмотрел ---------- */
  let yt = null; // { c, i, lesson, minutes, last, watched, title }
  function hookVideo(c) {
    const frame = $('#cr-yt');
    if (!frame) { yt = null; return; }
    const st = cs(c.id);
    const n = Math.min(st.day, total(c, st));
    const D = dayOf(c, st, n);
    const i = D.steps.findIndex((s) => s.type === 'video');
    const v = D.steps[i].video;
    yt = { c, i, lesson: v.lesson || null, num: v.num || (typeof v.lesson === 'number' ? v.lesson : null), minutes: v.minutes || 0, last: null, watched: Math.round(stepProg(st, i) * (v.minutes || 0) * 60), saveAt: 0, wrong: false, duration: 0 };
    const hello = () => { try { frame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); } catch (e) {} };
    frame.addEventListener('load', () => { hello(); setTimeout(hello, 600); setTimeout(hello, 2000); });
  }
  function onYT(e) {
    if (!yt) return;
    let host = '';
    try { host = new URL(e.origin).hostname; } catch (err) { return; }
    if (!/(^|\.)youtube(-nocookie)?\.com$/.test(host)) return;
    let d = e.data;
    try { if (typeof d === 'string') d = JSON.parse(d); } catch (err) { return; }
    if (!d || !d.info || (d.event !== 'infoDelivery' && d.event !== 'initialDelivery')) return;
    const info = d.info;
    const st = cs(yt.c.id);
    if (!st) return;
    // видео не тот урок (плейлист открылся не с того места) — предложим переключить
    if (yt.num && info.videoData && info.videoData.title) {
      const m = /Урок\s*(\d+)/i.exec(info.videoData.title);
      const hint = $('#cr-vhint');
      if (m && Number(m[1]) === yt.num && info.videoData.video_id) {
        yt.wrong = false;
        st.vid = st.vid || {};
        if (st.vid[yt.lesson] !== info.videoData.video_id) { st.vid[yt.lesson] = info.videoData.video_id; State.save(); }
        if (hint) hint.hidden = true;
      } else if (m && hint && typeof info.playlistIndex === 'number') {
        yt.wrong = true;
        const target = info.playlistIndex + (yt.num - Number(m[1]));
        hint.hidden = false;
        hint.innerHTML = `Сейчас в плеере урок ${m[1]}, а у тебя урок ${yt.num}. <button class="linkbtn" id="cr-vfix">Включить урок ${yt.num}</button>`;
        const fix = $('#cr-vfix');
        if (fix) fix.onclick = () => { try { $('#cr-yt').contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideoAt', args: [target] }), '*'); } catch (err) {} };
      }
    }
    if (typeof info.duration === 'number' && info.duration > 0 && !yt.wrong) yt.duration = info.duration;
    if (typeof info.currentTime === 'number' && !yt.wrong) {
      const t = info.currentTime;
      // урок досмотрен до конца — у пути завтра следующий урок
      if (yt.c.path && yt.duration > 600 && t >= yt.duration - 45 && !yt.endSeen) {
        yt.endSeen = true;
        yt.c.path.videoEnded(st, yt.lesson);
        State.save();
        UI.toast('Видеоурок досмотрен до конца! Завтра — следующий урок', 'success', '🎬');
      }
      const playing = info.playerState === 1 || info.playerState === undefined;
      if (yt.last != null && playing) {
        const dt = t - yt.last;
        if (dt > 0 && dt < 5) yt.watched += dt;
      }
      yt.last = t;
      if (yt.lesson) { st.video = st.video || {}; st.video[yt.lesson] = Math.floor(t); }
      const goal = (yt.minutes || 0) * 60;
      if (goal) {
        const p = Math.min(1, yt.watched / goal);
        st.prog = st.prog || {};
        if (p > stepProg(st, yt.i)) st.prog[yt.i] = p;
        if (yt.watched >= goal * 0.8 && stepProg(st, yt.i) < 1) {
          UI.toast('Видео на сегодня посмотрено ✓', 'success', '🎬');
          finishStep(yt.c, yt.i, $('#cr-yt'));
          return;
        }
      }
      if (Date.now() - yt.saveAt > 15000) { yt.saveAt = Date.now(); State.save(); }
    }
    if (info.playerState === 0 && !yt.wrong) {
      // урок досмотрен до конца
      if (yt.c.path && !yt.endSeen) { yt.endSeen = true; yt.c.path.videoEnded(st, yt.lesson); State.save(); }
      if (stepProg(st, yt.i) < 1) finishStep(yt.c, yt.i, $('#cr-yt'));
    }
  }
  if (typeof window !== 'undefined') window.addEventListener('message', onYT);

  /* ---------- отрисовка ----------
     Приложение перерисовывает экран после любых сохранений. Идущее упражнение
     и играющее видео при этом не трогаем: упражнение рисует себя само,
     а у урока обновляем только шаги и кольцо, видео остаётся играть. */
  function render(force) {
    const root = $('#courses-root');
    if (!root) return;
    if (view.id && !C.byId(view.id)) view = { name: 'home' };
    const c = view.id ? C.byId(view.id) : null;
    const st = c ? cs(c.id) : null;
    if ((view.name === 'lesson' || view.name === 'ex') && (!st || st.finished || doneToday(st))) view = { name: 'course', id: view.id, celebrate: view.celebrate };
    if (view.name === 'course' && !c) view = { name: 'home' };
    const key = `${view.name}|${view.id || ''}|${view.step == null ? '' : view.step}`;
    if (!force && root.dataset.key === key) {
      if (view.name === 'ex') return;
      if (view.name === 'lesson') { softLesson(root, c); return; }
    }
    root.innerHTML = view.name === 'course' ? courseHTML(c)
      : view.name === 'lesson' ? lessonHTML(c)
        : view.name === 'ex' ? exHTML(c, view.step)
          : homeHTML();
    root.dataset.view = view.name;
    root.dataset.key = key;
    bind(root, c);
    if (view.name === 'lesson') hookVideo(c);
    else yt = null;
    if (view.name === 'ex') {
      const s = dayOf(c, st, Math.min(st.day, total(c, st))).steps[view.step];
      if (s.type === 'test') runTest(c, view.step, s);
      else if (s.type === 'speak') runSpeak(c, view.step, s);
      else if (s.type === 'read') runRead(c, view.step, s);

      else if (s.type === 'session') runSession(c, view.step, s);
      else if (s.type === 'measure') runMeasure(c, view.step, s);
      else if (s.type === 'todo') runTodo(c, view.step, s);
      else runPuzzle(c, view.step, s);
    }
  }

  /* у урока — новые шаги и кольцо, видео не перезагружаем */
  function softLesson(root, c) {
    const tmp = document.createElement('div');
    tmp.innerHTML = lessonHTML(c);
    const pairs = [['.cr-head', '.cr-head'], ['.cr-steps', '.cr-steps'], ['.cr-lesson-title', '.cr-lesson-title']];
    pairs.forEach(([a, b]) => { const from = tmp.querySelector(a); const to = root.querySelector(b); if (from && to) to.replaceWith(from); });
    const win = tmp.querySelector('.cr-win');
    if (win && !root.querySelector('.cr-win')) root.querySelector('.cr-sheet').appendChild(win);
    bind(root, c);
  }

  function bind(root, c) {
    root.querySelectorAll('[data-cr-open]').forEach((b) => { b.onclick = () => { view = { name: 'course', id: b.dataset.crOpen }; Sound.sfx('pop'); render(true); window.scrollTo({ top: 0 }); }; });
    root.querySelectorAll('[data-cr-home]').forEach((b) => { b.onclick = () => { view = { name: 'home' }; render(true); window.scrollTo({ top: 0 }); }; });
    root.querySelectorAll('[data-cr-lesson]').forEach((b) => {
      b.onclick = () => {
        const st = cs(b.dataset.crLesson);
        if (!st || doneToday(st)) return;
        view = { name: 'lesson', id: b.dataset.crLesson };
        Sound.sfx('pop');
        render(true);
        window.scrollTo({ top: 0 });
      };
    });
    root.querySelectorAll('[data-cr-step]').forEach((b) => {
      b.onclick = () => {
        const i = Number(b.dataset.crStep);
        const st = cs(c.id);
        const D = dayOf(c, st, Math.min(st.day, total(c, st)));
        if (!unlocked(st, D, i)) return;
        if (D.steps[i].type === 'video') {
          if (stepProg(st, i) >= 1) { runVideo(c, i); return; }
          // видео: посмотреть в уроке или отметить вручную
          const body = UI.sheet(`
            <div class="plan-ed">
              <h2>🎬 ${esc(D.steps[i].title)}</h2>
              <p class="muted">${esc(D.steps[i].sub || '')}</p>
              <button class="btn btn-primary btn-lg btn-block" id="cr-vwatch">▶ Смотреть</button>
              <button class="btn btn-ghost btn-block" id="cr-vseen">${c.path ? `Посмотрел ${st.path.videoMin} минут ✓` : 'Посмотрел ✓'}</button>
              ${c.path ? '<button class="btn btn-ghost btn-block" id="cr-vend">Досмотрел урок до конца ✓✓</button><p class="muted small">«До конца» — завтра начнётся следующий видеоурок.</p>' : ''}
            </div>`);
          body.querySelector('#cr-vwatch').onclick = () => { UI.closeModal('#sheet-modal'); runVideo(c, i); };
          body.querySelector('#cr-vseen').onclick = () => { UI.closeModal('#sheet-modal'); finishStep(c, i, b); render(true); };
          const vend = body.querySelector('#cr-vend');
          if (vend) vend.onclick = () => { c.path.videoEnded(st, D.steps[i].video.lesson); UI.closeModal('#sheet-modal'); finishStep(c, i, b); render(true); };

          return;
        }
        view = { name: 'ex', id: c.id, step: i };
        Sound.sfx('pop');
        render(true);
        window.scrollTo({ top: 0 });
      };
    });
    const vh = root.querySelector('#cr-vhide');
    if (vh) vh.onclick = () => { videoHidden = !videoHidden; root.querySelector('.cr-video').classList.toggle('hidden', videoHidden); vh.textContent = videoHidden ? 'Показать видео' : 'Скрыть видео'; };
    const startBtn = root.querySelector('[data-cr-start]');
    if (startBtn) {
      startBtn.onclick = () => {
        const gate = root.querySelector('#cr-gate');
        if (gate && !gate.checked) { root.querySelector('#cr-err').textContent = 'Без мягкого покрытия и страхующего этот курс не начинаем — это про твою безопасность.'; return; }
        const tm = Track.parseHHMM(root.querySelector('#cr-time').value);
        const mode = root.querySelector('input[name="en-start"]:checked');
        const mins = root.querySelector('[data-en-pick].active');
        start(c.id, tm == null ? 18 * 60 : tm, { start: mode ? mode.value : 'zero', min: mins ? Number(mins.dataset.enPick) : 30 });
        view = { name: 'course', id: c.id };
        render(true);
      };
    }
    const time = root.querySelector('#cr-time');
    const st = c && cs(c.id);
    if (time && st) {
      time.onchange = () => {
        const tm = Track.parseHHMM(time.value);
        if (tm == null) return;
        st.time = tm;
        const t = State.s.tasks.find((x) => x.id === st.taskId && !x.done);
        if (t) t.at = tm;
        State.commit();
        syncAlarms();
        UI.toast(`Урок теперь в ${Track.hhmm(tm)}`, 'success', '⏰');
      };
    }
    root.querySelectorAll('[data-en-pick]').forEach((b) => {
      b.onclick = () => { root.querySelectorAll('[data-en-pick]').forEach((x) => x.classList.toggle('active', x === b)); Sound.sfx('pop'); };
    });
    root.querySelectorAll('[data-en-min]').forEach((b) => {
      b.onclick = () => {
        c.path.setMinutes(st, Number(b.dataset.enMin));
        const t = State.s.tasks.find((x) => x.id === st.taskId && !x.done);
        if (t) t.estimate = minutesOf(c, st);
        State.commit();
        syncAlarms();
        render(true);
        UI.toast(`Теперь ${b.dataset.enMin} минут видео в день`, 'success', '🎬');
      };
    });
    const exNow = root.querySelector('#en-exam-now');
    if (exNow) {
      let armed = false;
      exNow.onclick = () => {
        if (doneToday(st)) { UI.toast('Сегодня урок уже пройден — экзамен можно завтра', 'default', '🏁'); return; }
        if (!armed) { armed = true; exNow.textContent = 'Экзамен вместо урока сегодня. Не сдашь — вернёшься к урокам. Нажми ещё раз'; return; }
        c.path.examNow(st);
        const t = State.s.tasks.find((x) => x.id === st.taskId && !x.done);
        if (t) t.title = `🎓 ${c.short}: ${dayLabel(c, st)}`;
        State.commit();
        view = { name: 'lesson', id: c.id };
        render(true);
        window.scrollTo({ top: 0 });
      };
    }
    const tutor = root.querySelector('#en-tutor');
    if (tutor) tutor.onclick = () => openTutor(c);
    const al = root.querySelector('#cr-alarm');

    if (al && st) al.onchange = () => { st.alarm = al.checked; State.commit(); syncAlarms(); };
    const rs = root.querySelector('#cr-reset');
    if (rs) {
      let armed = false;
      rs.onclick = () => {
        if (!armed) { armed = true; rs.textContent = 'Точно? Прогресс курса сотрётся — нажми ещё раз'; return; }
        reset(c.id);
        view = { name: 'home' };
        render(true);
      };
    }
  }

  function open(id, name) { view = { name: name || 'course', id }; render(true); }

  /* ---------- разговорный тренер: ИИ в Claude говорит на твоём уровне и исправляет ошибки ---------- */
  function openTutor(c) {
    const st = cs(c.id);
    const lead = { role: 'user', content: c.path.tutorPrompt(st) };
    const turns = [];
    let busy = false;
    const body = UI.sheet(`
      <div class="plan-ed en-chat">
        <h2>💬 Разговор по-английски</h2>
        <p class="muted small">Тренер говорит на твоём уровне, задаёт вопросы и исправляет ошибки (✏️). Пиши или нажми 🎤 и говори.</p>
        <div class="en-chat-log" id="en-log"></div>
        <form class="en-chat-form" id="en-form">
          <input id="en-q" autocomplete="off" placeholder="Напиши по-английски…">
          ${speechAPI() ? '<button type="button" class="cr-speak mini" id="en-mic" aria-label="Говорить">🎤</button>' : ''}
          <button class="btn btn-primary" type="submit">➤</button>
        </form>
      </div>`);
    const log = body.querySelector('#en-log');
    const bubble = (cls, text) => { const d = document.createElement('div'); d.className = `ai-bubble ${cls}`; d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
    async function ask(text) {
      if (busy) return;
      busy = true;
      if (text) { bubble('me', text); turns.push({ role: 'user', content: text }); }
      const bot = bubble('bot', '…');
      try {
        const sample = await Coach.getSample();
        if (!sample) { bot.textContent = 'ИИ-тренер работает, когда приложение открыто в Claude.'; return; }
        const msgs = [lead, { role: 'assistant', content: 'OK.' }].concat(turns.length ? turns.slice(-10) : [{ role: 'user', content: 'Start the conversation with a greeting and one simple question.' }]);
        const { text: out } = await sample(msgs, { cache: false, onText: ({ text: t }) => { bot.textContent = t; log.scrollTop = log.scrollHeight; } });
        bot.textContent = out;
        turns.push({ role: 'assistant', content: out });
        if (!/✏️/.test(out)) sayEn(out.replace(/[^\x20-\x7E]+/g, ' '));
      } catch (e) {
        if (text) turns.pop();
        bot.textContent = (e && e.code === 'rate_limited') ? 'Слишком много сообщений — подожди пару минут.' : 'Не получилось связаться с ИИ. Попробуй ещё раз.';
      } finally { busy = false; }
    }
    body.querySelector('#en-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = body.querySelector('#en-q');
      const t = q.value.trim();
      if (!t) return;
      q.value = '';
      ask(t);
    });
    const mic = body.querySelector('#en-mic');
    if (mic) {
      mic.onclick = () => {
        const API = speechAPI();
        if (!API) return;
        const rec = new API();
        rec.lang = 'en-US';
        mic.classList.add('on');
        rec.onresult = (ev) => { const t = ev.results && ev.results[0] && ev.results[0][0] ? ev.results[0][0].transcript : ''; if (t) ask(t); };
        rec.onend = () => mic.classList.remove('on');
        rec.onerror = () => mic.classList.remove('on');
        try { rec.start(); } catch (e) { mic.classList.remove('on'); }
      };
    }
    ask(null);
  }


  return { render, ensureTasks, alarms, start, reset, open, state: cs, dayOf: (id, n) => { const c = C.byId(id); return dayOf(c, cs(id), n); } };
})();

Screens.courses = { render: () => Courses.render() };
