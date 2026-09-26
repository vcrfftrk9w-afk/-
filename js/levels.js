'use strict';
/* =========================================================
   LEVELS — окно «Мои дела» как игра с уровнями.

   Начало — два дела: TikTok «кино» и TikTok «orca». Закрыл ВСЕ
   открытые дела нужное число дней ПОДРЯД — уровень растёт: открывается
   новое дело или старое становится труднее. Пропустил день — счёт
   уровня начинается заново, но открытое не отнимается: дела только
   добавляются или усложняются. После повышения дни считаются с нуля.
   Новые дела начинаются со следующего дня.
   ========================================================= */

const Levels = (() => {
  const { $ } = UI;

  /* ---------- уровни: что нужно и что даёт ---------- */
  // [упражнение, повторы или секунды, как сказать]
  const TRAIN = {
    1: [['Отжимания', '5', '5 отжиманий']],
    2: [['Отжимания', '10', '10 отжиманий'], ['Приседания', '5', '5 приседаний']],
    3: [['Отжимания', '15', '15 отжиманий'], ['Пресс', '5', 'пресс 5'], ['Приседания', '10', '10 приседаний']],
    4: [['Отжимания', '20', '20 отжиманий'], ['Пресс', '10', 'пресс 10'], ['Приседания', '20', '20 приседаний'], ['Планка', 15, 'планка 15 с']],
    5: [['Отжимания', '25', '25 отжиманий'], ['Пресс', '15', 'пресс 15'], ['Приседания', '20', '20 приседаний'], ['Планка', 20, 'планка 20 с']],
  };
  const ENGLISH = { 3: ['1 видео или 10 минут', 10], 4: ['2 видео или 25 минут', 25], 5: ['3 видео или 35 минут', 35] };

  const LEVELS = [
    { need: 0,  name: 'Старт',        adds: ['kino', 'orca'] },
    { need: 2,  name: 'Движение',     adds: ['train'] },
    { need: 4,  name: 'Автор',        adds: ['youtube'], harder: ['train'] },
    { need: 10, name: 'Язык',         adds: ['english'], harder: ['train'] },
    { need: 15, name: 'Тишина',       adds: ['silence'], harder: ['english', 'train'] },
    { need: 20, name: 'Деньги',       adds: ['olx', 'earn'], harder: ['english', 'train'] },
    { need: 25, name: 'Голова',       adds: ['ai'] },
    { need: 30, name: 'Отложенное',   adds: ['video'] },
    { need: 35, name: 'Хозяин дня',   adds: ['backlog'] },
  ];

  /* ---------- дела: как выглядят на уровне lv ---------- */
  const lvOf = (lv, table) => { let best = null; Object.keys(table).map(Number).sort((a, b) => a - b).forEach((k) => { if (lv >= k) best = table[k]; }); return best; };
  const trainText = (lv) => (lvOf(lv, TRAIN) || []).map((x) => x[2]).join(', ');

  const QUESTS = {
    kino:    { emoji: '🎞️', title: () => 'TikTok · кино', sub: () => 'публикация — ровно в это время', link: 'ТТ видео — кино', at: 19 * 60 + 55 },
    orca:    { emoji: '🐋', title: () => 'TikTok · orca', sub: () => 'публикация — ровно в это время', link: 'ТТ видео — orca', at: 21 * 60 },
    train:   { emoji: '💪', title: () => 'Тренировка', sub: (lv) => trainText(lv), link: 'Тренировка' },
    youtube: { emoji: '▶️', title: () => 'YouTube', sub: () => 'снять или смонтировать', link: 'YouTube' },
    english: { emoji: '🇬🇧', title: () => 'Английский', sub: (lv) => (lvOf(lv, ENGLISH) || ['', 0])[0], link: 'Английский' },
    silence: { emoji: '🧘', title: () => '1 минута тишины', sub: () => 'без телефона, просто дыши' },
    olx:     { emoji: '📦', title: () => 'OLX', sub: () => 'торговля: ответить, выложить, обменять', link: 'OLX: объявления и обмены' },
    earn:    { emoji: '💰', title: () => 'Думать над заработком', sub: () => '5 минут: одна идея, как заработать', link: 'Работа над заработком' },
    ai:      { emoji: '🤖', title: () => 'Разбор с ИИ', sub: () => 'узнать, что главное и что делать', link: 'Разбор с ИИ: что получилось и что дальше' },
    video:   { emoji: '🍿', title: () => 'Отложенное видео', sub: () => 'ровно одно, потом одна мысль', link: 'Одно сохранённое видео' },
    backlog: { emoji: '📋', title: () => 'Отложенные дела', sub: () => 'взять одно и закрыть' },
  };

  /* ---------- состояние ---------- */
  const today = () => State.todayKey();
  const addDays = (key, n) => { const d = new Date(key + 'T12:00:00'); d.setDate(d.getDate() + n); return State.dateKey(d); };
  function st() {
    let s = State.s.lvl;
    if (!s || typeof s !== 'object') {
      s = State.s.lvl = { level: 0, from: today(), stageStart: today(), counted: {}, done: {} };
    }
    if (!s.counted) s.counted = {};
    if (!s.done) s.done = {};
    return s;
  }
  /* уровень, который действует в этот день: повышение вступает в силу со следующего */
  const levelOn = (key) => { const s = st(); return key >= s.from ? s.level : Math.max(0, s.level - 1); };
  const questsAt = (lv) => LEVELS.slice(0, lv + 1).reduce((a, L) => a.concat(L.adds), []);

  function isDone(id, key) {
    const k = key || today();
    const s = st();
    if (s.done[k] && s.done[k][id]) return true;
    const q = QUESTS[id];
    return !!(q.link && State.doneTitlesOn(k).has(q.link));
  }

  /* серия: дни подряд, когда закрыто всё открытое, внутри текущего уровня */
  function streak() {
    const s = st();
    let n = 0;
    let k = s.counted[today()] ? today() : addDays(today(), -1);
    while (k >= s.stageStart && s.counted[k]) { n += 1; k = addDays(k, -1); }
    return n;
  }

  /* ---------- отметить дело ---------- */
  function complete(id, el) {
    const k = today();
    const s = st();
    if (isDone(id, k)) return;
    s.done[k] = s.done[k] || {};
    s.done[k][id] = true;
    // то же дело в графике тоже закрываем — опыт и серии идут как обычно
    const q = QUESTS[id];
    const t = q.link && State.s.tasks.find((x) => x.title === q.link && !x.done);
    if (t) Screens.tasks.complete(t, el || document.body);
    else { State.addXP(15); Sound.sfx('success'); FX.confettiFrom(el || document.body, 30); }
    // старые записи о выполненном дольше двух месяцев не храним
    Object.keys(s.done).filter((d) => d < addDays(k, -60)).forEach((d) => delete s.done[d]);
    checkDay();
    State.commit();
  }

  function checkDay() {
    const k = today();
    const s = st();
    if (s.counted[k]) return false;
    const ids = questsAt(levelOn(k));
    if (!ids.every((id) => isDone(id, k))) return false;
    s.counted[k] = levelOn(k) + 1;
    const n = streak();
    const next = LEVELS[s.level + 1];
    if (next && k >= s.from && n >= next.need) {
      s.level += 1;
      s.from = addDays(k, 1);
      s.stageStart = addDays(k, 1);
      setTimeout(() => celebrate(s.level), 700);
    } else {
      setTimeout(() => {
        Sound.sfx('fanfare');
        FX.fireworks(2);
        UI.toast(next ? `День засчитан! ${n} из ${next.need} дней подряд до уровня ${s.level + 2}` : `День засчитан! Серия ${n} дней`, 'level', '✅');
      }, 600);
    }
    return true;
  }

  function celebrate(lv) {
    const L = LEVELS[lv];
    const lines = L.adds.map((id) => `<li>🆕 ${QUESTS[id].emoji} <b>${UI.esc(QUESTS[id].title(lv))}</b><small>${UI.esc(QUESTS[id].sub(lv))}</small></li>`)
      .concat((L.harder || []).map((id) => `<li>⬆️ ${QUESTS[id].emoji} <b>${UI.esc(QUESTS[id].title(lv))} — труднее</b><small>${UI.esc(QUESTS[id].sub(lv))}</small></li>`));
    Sound.sfx('fanfare');
    FX.fireworks(6);
    if (typeof Coach !== 'undefined') Coach.say(`Новый уровень! Уровень ${lv + 1}.`);
    const body = UI.sheet(`
      <div class="lv-up">
        <div class="lv-up-badge">LVL ${lv + 1}</div>
        <h2>Новый уровень: ${UI.esc(L.name)}!</h2>
        <p class="muted">Ты держался ${L.need} ${UI.plural(L.need, 'день', 'дня', 'дней')} подряд. С завтрашнего дня:</p>
        <ul class="lv-up-list">${lines.join('')}</ul>
        <p class="muted small">Ничего не отнимается — только добавляется. Следующий уровень — снова считаем дни с нуля.</p>
        <button class="btn btn-primary btn-lg btn-block" id="lv-ok">Погнали</button>
      </div>`);
    body.querySelector('#lv-ok').onclick = () => UI.closeModal('#sheet-modal');
  }

  /* ---------- ▶ начать: у каждого дела своя короткая сессия ---------- */
  function start(id, el) {
    const lv = levelOn(today());
    const done = () => complete(id, el);
    const run = (steps, title) => Coach.runSteps('session', steps.map((x) => ({ kind: 'task', ...x })), title, null, done);
    if (id === 'kino' || id === 'orca') return run(Coach.SESSIONS[QUESTS[id].link], QUESTS[id].title());
    if (id === 'youtube') return run(Coach.SESSIONS.YouTube, 'YouTube');
    if (id === 'olx') return run(Coach.SESSIONS['OLX: объявления и обмены'], 'OLX');
    if (id === 'ai') { Coach.openAI(null); return undefined; }
    if (id === 'train') {
      const steps = [{ t: 'Разминка: круги руками и шаги на месте', sec: 30, label: 'Разминка' }];
      (lvOf(lv, TRAIN) || []).forEach(([n, r], i) => {
        if (i) steps.push({ kind: 'rest', t: 'Отдых', sec: 30 });
        steps.push(typeof r === 'number' ? { t: n, sec: r, label: 'Держи' } : { t: n, reps: r, label: `Упражнение ${i + 1}` });
      });
      return Coach.runSteps('session', steps.map((x) => ({ kind: x.kind || 'task', ...x })), `Тренировка · уровень ${lv + 1}`, null, () => { Track.workout(5, true); done(); });
    }
    if (id === 'english') { const e = lvOf(lv, ENGLISH) || ['10 минут', 10]; return run([{ t: `Английский: ${e[0]}`, sec: e[1] * 60, how: 'Видео с субтитрами или урок — вслух повторяй фразы.' }], 'Английский'); }
    if (id === 'silence') return run([{ t: 'Тишина. Телефон экраном вниз. Просто дыши', sec: 60 }], 'Минута тишины');
    if (id === 'earn') return run([{ t: 'Подумай: одна идея, как заработать', sec: 300, how: 'Запиши её одной строкой — и один первый шаг.' }], 'Заработок');
    if (id === 'video') return run([{ t: 'Одно отложенное видео — и выйти', sec: 1200, how: 'После — запиши одну мысль или действие.' }], 'Отложенное видео');
    if (id === 'backlog') return run([{ t: 'Возьми одно отложенное дело и закрой', sec: 900 }], 'Отложенные дела');
    return undefined;
  }

  /* ---------- окно ---------- */
  function render() {
    const el = $('#mytasks-root');
    if (!el) return;
    // дело могли закрыть и в «Дне», и через ИИ — засчитываем день и здесь
    if (checkDay()) State.save();
    const k = today();
    const s = st();
    const lv = levelOn(k);
    const ids = questsAt(lv);
    const doneN = ids.filter((id) => isDone(id, k)).length;
    const n = streak();
    const next = LEVELS[s.level + 1];
    const upTomorrow = s.from > k;       // повысился сегодня — новое с завтра
    const now = Track.nowMin();
    const need = next ? next.need : 0;
    const pct = next ? Math.min(100, Math.round((n / need) * 100)) : 100;
    const night = typeof Modes !== 'undefined' && Modes.target().kind === 'sleep';

    const rows = ids.map((id) => {
      const q = QUESTS[id];
      const d = isDone(id, k);
      const late = !d && q.at && now > q.at + 10;
      return `
        <li class="mt-row ${d ? 'done' : ''} ${!d && q.at && now >= q.at - 15 && now <= q.at + 10 ? 'now' : ''}">
          <button class="mt-main" data-lvinfo="${id}"><small class="mt-time">${q.at ? Track.hhmm(q.at) + ' · ' : ''}${d ? 'сделано' : late ? 'время прошло — сделай сейчас' : UI.esc(q.sub(lv))}</small><b>${q.emoji} ${UI.esc(q.title(lv))}</b></button>
          ${d ? '<span class="mt-ok" aria-label="Сделано">✓</span>'
            : `<button class="mt-go" data-lvgo="${id}" aria-label="Начать: ${UI.esc(q.title(lv))}">▶</button>
               <button class="mt-check" data-lvdone="${id}" aria-label="Отметить сделанным"></button>`}
        </li>`;
    }).join('');

    const road = LEVELS.map((L, i) => {
      if (i === 0) return '';
      const state = i <= s.level ? 'open' : i === s.level + 1 ? 'next' : 'lock';
      const detail = (id) => (id === 'train' || id === 'english' ? `: ${QUESTS[id].sub(i)}` : '');
      const what = L.adds.map((id) => `${QUESTS[id].emoji} ${QUESTS[id].title(i)}${detail(id)}`).join(' · ')
        + (L.harder && L.harder.length ? ` · ⬆️ ${L.harder.map((id) => `${QUESTS[id].title(i).toLowerCase()}${detail(id)}`).join(' · ')}` : '');
      return `<li class="lv-road-${state}"><span>${state === 'open' ? '✅' : state === 'next' ? '🔓' : '🔒'} Ур. ${i + 1}</span><b>${UI.esc(what)}</b><small>${state === 'open' ? 'открыто' : `${L.need} ${UI.plural(L.need, 'день', 'дня', 'дней')} подряд`}</small></li>`;
    }).join('');

    el.innerHTML = `
      <div class="lv-card">
        <div class="lv-top">
          <div class="lv-badge"><small>LVL</small><b>${s.level + 1}</b></div>
          <div class="lv-info">
            <h2>${UI.esc(LEVELS[s.level].name)}</h2>
            <small>${upTomorrow ? `🎉 Новый уровень! С завтра: ${LEVELS[s.level].adds.map((id) => QUESTS[id].title(s.level)).join(', ')}`
              : next ? `До уровня ${s.level + 2}: ${n} из ${need} ${UI.plural(need, 'дня', 'дней', 'дней')} подряд` : 'Все уровни открыты — держи серию'}</small>
          </div>
        </div>
        ${next ? `<div class="lv-bar"><span style="width:${pct}%"></span></div>
          ${need <= 15 ? `<div class="lv-dots">${Array.from({ length: need }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>` : ''}` : ''}
        <p class="lv-rule">Закрой <b>все</b> дела ниже — день засчитан. Пропустишь день — счёт этого уровня начнётся заново.</p>
      </div>

      ${night ? '<div class="mt-night"><b>🌙 Сейчас ночь — лучшее дело: спать</b><span>Дела уровня ждут утром.</span></div>' : ''}

      <h4 class="my-sec">Сегодня · ${doneN} из ${ids.length}${s.counted[k] ? ' · ✅ день засчитан' : ''}</h4>
      <ul class="mt-list">${rows}</ul>

      <div class="my-week">
        <h4 class="my-sec">Что откроется дальше</h4>
        <ul class="lv-road">${road}</ul>
      </div>

      ${typeof Account !== 'undefined' ? Account.line() : ''}
      ${typeof Remind !== 'undefined' ? Remind.alarmLine() : ''}
      <button class="btn btn-ghost btn-block my-switch" data-space="all">🧩 Всё остальное — график, задачи, привычки, фокус…</button>`;

    el.querySelectorAll('[data-lvgo]').forEach((b) => { b.onclick = () => start(b.dataset.lvgo, b); });
    el.querySelectorAll('[data-lvdone]').forEach((b) => { b.onclick = () => complete(b.dataset.lvdone, b); });
    el.querySelectorAll('[data-lvinfo]').forEach((b) => { b.onclick = () => start(b.dataset.lvinfo, b); });
    const al = el.querySelector('[data-alarm]'); if (al) al.onclick = () => Remind.open();
    const ac = el.querySelector('[data-account]'); if (ac) ac.onclick = () => Account.open();
  }

  return { render, complete, start, streak, levelOn, questsAt, isDone, LEVELS, QUESTS, checkDay, state: st };
})();

Screens.mytasks = { render: () => Levels.render() };
