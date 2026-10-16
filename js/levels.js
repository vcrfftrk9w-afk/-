'use strict';
/* =========================================================
   LEVELS — окно «Мои дела» как игра с уровнями.

   Начало — два дела: TikTok «кино» и TikTok «orca». Закрыл ВСЕ
   открытые дела нужное число дней ПОДРЯД — уровень растёт: открывается
   новое дело или старое становится труднее. Пропустил день — серия
   уровня начинается заново. 3 дня подряд без засчитанного дня —
   уровень ПОНИЖАЕТСЯ (каждые 3 дня — минус уровень, не ниже первого):
   дела этого уровня уходят, тренировка снова легче. Вернуть уровень —
   снова нужное число дней подряд. После повышения и понижения дни
   считаются с нуля. Новые дела начинаются со следующего дня.
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
  const ENGLISH = { 5: ['1 видео или 10 минут', 10], 6: ['2 видео или 25 минут', 25], 7: ['3 видео или 35 минут', 35] };

  /* 3-й уровень — только тренировка труднее; 4-й — тишина без телефона и танец из TikTok;
     YouTube — с 5-го, английский — с 6-го (урок во вкладке «Курсы» закрывает его сам). */
  const LEVELS = [
    { need: 0,  name: 'Старт',          adds: ['kino', 'orca'] },
    { need: 2,  name: 'Движение',       adds: ['train'] },
    { need: 4,  name: 'Сила',           adds: [], harder: ['train'] },
    { need: 10, name: 'Тишина и танец', adds: ['silence', 'dance'], harder: ['train'] },
    { need: 15, name: 'Автор',          adds: ['youtube'], harder: ['train'] },
    { need: 20, name: 'Язык',           adds: ['english'], harder: ['train'] },
    { need: 25, name: 'Деньги',         adds: ['olx', 'earn'], harder: ['english'] },
    { need: 30, name: 'Голова',         adds: ['ai'], harder: ['english'] },
    { need: 35, name: 'Отложенное',     adds: ['video'] },
    { need: 40, name: 'Хозяин дня',     adds: ['backlog'] },
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
    silence: { emoji: '🧘', title: () => 'Тишина без телефона', sub: () => `${silenceMin()} ${UI.plural(silenceMin(), 'минута', 'минуты', 'минут')} · телефон экраном вниз, просто дыши` },
    dance:   { emoji: '💃', title: () => 'Танец из TikTok', sub: () => 'повтори хотя бы 1 видео' },
    olx:     { emoji: '📦', title: () => 'OLX', sub: () => 'торговля: ответить, выложить, обменять', link: 'OLX: объявления и обмены' },
    earn:    { emoji: '💰', title: () => 'Думать над заработком', sub: () => '5 минут: одна идея, как заработать', link: 'Работа над заработком' },
    ai:      { emoji: '🤖', title: () => 'Разбор с ИИ', sub: () => 'узнать, что главное и что делать', link: 'Разбор с ИИ: что получилось и что дальше' },
    video:   { emoji: '🍿', title: () => 'Отложенное видео', sub: () => 'ровно одно, потом одна мысль', link: 'Одно сохранённое видео' },
    backlog: { emoji: '📋', title: () => 'Отложенные дела', sub: () => 'взять одно и закрыть' },
  };

  /* тишина растёт сама: каждые 3 дня, когда сделал, +1 минута — до 5 минут */
  const SILENCE_STEP = 3;
  const SILENCE_MAX = 5;
  function silenceMin() {
    const g = ((st().grow || {}).silence) || { n: 0, last: null };
    const before = Math.max(0, (g.n || 0) - (g.last === today() ? 1 : 0)); // сегодняшний раз — уже по сегодняшней длине
    return Math.min(SILENCE_MAX, 1 + Math.floor(before / SILENCE_STEP));
  }

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
    // понижение за пропуски появилось позже: дни до этого не считаем пропущенными
    if (!s.missSince) s.missSince = today();
    return s;
  }

  /* ---------- понижение: 3 дня подряд без засчитанного дня — минус уровень ---------- */
  const MISS_DOWN = 3;
  // сколько дней подряд до вчера включительно день не засчитан (внутри текущего уровня)
  function missedRun() {
    const s = st();
    const floor = s.stageStart > s.missSince ? s.stageStart : s.missSince;
    let n = 0;
    let k = addDays(today(), -1);
    while (k >= floor && !s.counted[k]) { n += 1; k = addDays(k, -1); }
    return n;
  }
  // что уходит при понижении с уровня from до уровня to
  function lostBetween(from, to) {
    const gone = [];
    const easier = [];
    for (let lv = from; lv > to; lv -= 1) {
      LEVELS[lv].adds.forEach((id) => gone.push(id));
      (LEVELS[lv].harder || []).forEach((id) => { if (!easier.includes(id) && !gone.includes(id)) easier.push(id); });
    }
    return { gone, easier: easier.filter((id) => questsAt(to).includes(id)) };
  }
  function checkDemote() {
    const s = st();
    if (s.level <= 0) return false;
    const miss = missedRun();
    if (miss < MISS_DOWN) return false;
    const from = s.level;
    s.level -= Math.min(s.level, Math.floor(miss / MISS_DOWN));
    s.from = today();
    s.stageStart = today();
    s.demoted = { at: today(), from, to: s.level, missed: miss };
    State.save();
    setTimeout(() => demotedSheet(s.demoted), 700);
    return true;
  }
  function demotedSheet(d) {
    if (!d || typeof UI === 'undefined' || !UI.sheet) return;
    const lost = lostBetween(d.from, d.to);
    const lines = lost.gone.map((id) => `<li>➖ ${QUESTS[id].emoji} <b>${UI.esc(QUESTS[id].title(d.to))}</b><small>ушло вместе с уровнем</small></li>`)
      .concat(lost.easier.map((id) => `<li>⬇️ ${QUESTS[id].emoji} <b>${UI.esc(QUESTS[id].title(d.to))} — снова легче</b><small>${UI.esc(QUESTS[id].sub(d.to))}</small></li>`));
    const next = LEVELS[d.to + 1];
    Sound.sfx('deny');
    const body = UI.sheet(`
      <div class="lv-up lv-down-sheet">
        <div class="lv-up-badge lv-down-badge">LVL ${d.from + 1} → ${d.to + 1}</div>
        <h2>Уровень понижен</h2>
        <p class="muted">${d.missed} ${UI.plural(d.missed, 'день', 'дня', 'дней')} подряд дела не закрыты. Теперь ты на уровне «${UI.esc(LEVELS[d.to].name)}».</p>
        ${lines.length ? `<ul class="lv-up-list">${lines.join('')}</ul>` : ''}
        ${next ? `<p class="muted small">Вернуть уровень ${d.to + 2}: ${next.need} ${UI.plural(next.need, 'день', 'дня', 'дней')} подряд закрывай все дела.</p>` : ''}
        <button class="btn btn-primary btn-lg btn-block" id="lv-down-ok">Понял — возвращаю</button>
      </div>`);
    body.querySelector('#lv-down-ok').onclick = () => UI.closeModal('#sheet-modal');
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
    // сколько дней сделана тишина — от этого её длина
    if (id === 'silence') {
      s.grow = s.grow || {};
      const g = s.grow.silence || (s.grow.silence = { n: 0, last: null });
      if (g.last !== k) { g.n += 1; g.last = k; }
    }
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
        <p class="muted small">Следующий уровень — снова считаем дни с нуля. 3 дня подряд без засчитанного дня — уровень понизится.</p>
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
    if (id === 'silence') {
      const m = silenceMin();
      return run([{ t: 'Телефон экраном вниз. Просто дыши', sec: m * 60, how: 'Не трогай телефон, пока не прозвучит сигнал.' }], `Тишина · ${m} ${UI.plural(m, 'минута', 'минуты', 'минут')}`);
    }
    if (id === 'dance') {
      const body = UI.sheet(`
        <div class="lv-dance">
          <h2>💃 Танец из TikTok</h2>
          <ol class="lv-dance-steps">
            <li>Открой TikTok и найди любой танец-тренд.</li>
            <li>Поставь скорость 0.5x и повторяй по 8 счётов.</li>
            <li>Потом на обычной скорости — <b>хотя бы 1 видео целиком</b>.</li>
          </ol>
          <a class="btn btn-ghost btn-block" href="https://www.tiktok.com/search?q=${encodeURIComponent('танец тренд')}" target="_blank" rel="noopener">Открыть TikTok ↗</a>
          <button class="btn btn-primary btn-lg btn-block" id="lv-dance-done">Повторил ✓</button>
        </div>`);
      body.querySelector('#lv-dance-done').onclick = () => { UI.closeModal('#sheet-modal'); done(); };
      return undefined;
    }
    if (id === 'earn') return run([{ t: 'Подумай: одна идея, как заработать', sec: 300, how: 'Запиши её одной строкой — и один первый шаг.' }], 'Заработок');
    if (id === 'video') return run([{ t: 'Одно отложенное видео — и выйти', sec: 1200, how: 'После — запиши одну мысль или действие.' }], 'Отложенное видео');
    if (id === 'backlog') return run([{ t: 'Возьми одно отложенное дело и закрой', sec: 900 }], 'Отложенные дела');
    return undefined;
  }

  /* ---------- окно ---------- */
  function render() {
    const el = $('#mytasks-root');
    if (!el) return;
    // 3 дня подряд без засчитанного дня — уровень вниз; дело могли закрыть и в «Дне», и через ИИ — засчитываем день и здесь
    checkDemote();
    if (checkDay()) State.save();
    const k = today();
    const s = st();
    // предупреждение заранее: сколько дней подряд не засчитано и когда понизится уровень
    const miss = s.level > 0 && !s.counted[k] ? missedRun() : 0;
    const left = MISS_DOWN - miss;
    const warnHTML = s.demoted && s.demoted.at === k
      ? `<p class="lv-warn down">📉 Уровень понижен: ${s.demoted.from + 1} → ${s.demoted.to + 1} — ${s.demoted.missed} ${UI.plural(s.demoted.missed, 'день', 'дня', 'дней')} подряд без засчитанного дня.</p>`
      : miss >= MISS_DOWN - 1 ? `<p class="lv-warn last">🔥 Сегодня последний шанс: не закроешь все дела — завтра уровень станет ${s.level}.</p>`
        : miss >= 1 ? `<p class="lv-warn">⚠️ ${miss === 1 ? 'Вчера день не засчитан.' : `${miss} ${UI.plural(miss, 'день', 'дня', 'дней')} подряд не засчитаны.`} Ещё ${left} ${UI.plural(left, 'день', 'дня', 'дней')} без засчитанного дня — и уровень понизится до ${s.level}.</p>`
          : '';

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
      // своё время из «Моих дел» (Тренировка в пн 07:00, во вт 10:00) — если у задания нет фиксированного
      const own = !q.at && typeof Plans !== 'undefined' ? Plans.questTime(id) : null;
      const at = q.at || own;
      const late = !d && at && now > at + 10;
      return `
        <li class="mt-row has-bell ${d ? 'done' : ''} ${!d && at && now >= at - 15 && now <= at + 10 ? 'now' : ''}">
          <button class="mt-main" data-lvinfo="${id}"><small class="mt-time">${at ? Track.hhmm(at) + (own != null ? ' ⏰' : '') + ' · ' : ''}${d ? 'сделано' : late ? 'время прошло — сделай сейчас' : UI.esc(q.sub(lv))}</small><b>${q.emoji} ${UI.esc(q.title(lv))}</b></button>
          ${typeof Plans !== 'undefined' ? Plans.bell(id) : ''}
          ${d ? '<span class="mt-ok" aria-label="Сделано">✓</span>'
            : `<button class="mt-go" data-lvgo="${id}" aria-label="Начать: ${UI.esc(q.title(lv))}">▶</button>
               <button class="mt-check" data-lvdone="${id}" aria-label="Отметить сделанным"></button>`}
        </li>`;
    }).join('');

    const road = LEVELS.map((L, i) => {
      if (i === 0) return '';
      const state = i <= s.level ? 'open' : i === s.level + 1 ? 'next' : 'lock';
      const detail = (id) => (id === 'train' || id === 'english' ? `: ${QUESTS[id].sub(i)}`
        : id === 'silence' ? ': 1 минута, потом сама растёт до 5' : id === 'dance' ? ': повтори хотя бы 1 видео' : '');
      const what = L.adds.map((id) => `${QUESTS[id].emoji} ${QUESTS[id].title(i)}${detail(id)}`)
        .concat(L.harder && L.harder.length ? [`⬆️ ${L.harder.map((id) => `${QUESTS[id].title(i).toLowerCase()}${detail(id)}`).join(' · ')}`] : [])
        .join(' · ');
      return `<li class="lv-road-${state}"><span>${state === 'open' ? '✅' : state === 'next' ? '🔓' : '🔒'} Ур. ${i + 1}</span><b>${UI.esc(what)}</b><small>${state === 'open' ? 'открыто' : `${L.need} ${UI.plural(L.need, 'день', 'дня', 'дней')} подряд`}</small></li>`;
    }).join('');

    el.innerHTML = `
      <div class="lv-card">
        <div class="lv-top">
          <div class="lv-badge"><small>LVL</small><b>${s.level + 1}</b></div>
          <div class="lv-info">
            <h2>${UI.esc(LEVELS[s.level].name)}</h2>
            <small>${upTomorrow ? `🎉 Новый уровень! С завтра: ${(LEVELS[s.level].adds.length ? LEVELS[s.level].adds : (LEVELS[s.level].harder || [])).map((id) => QUESTS[id].title(s.level) + (LEVELS[s.level].adds.length ? '' : ' труднее')).join(', ')}`

              : next ? `До уровня ${s.level + 2}: ${n} из ${need} ${UI.plural(need, 'дня', 'дней', 'дней')} подряд` : 'Все уровни открыты — держи серию'}</small>
          </div>
        </div>
        ${next ? `<div class="lv-bar"><span style="width:${pct}%"></span></div>
          ${need <= 15 ? `<div class="lv-dots">${Array.from({ length: need }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>` : ''}` : ''}
        <p class="lv-rule">Закрой <b>все</b> дела ниже — день засчитан. Пропустишь день — серия начнётся заново. <b>3 дня подряд</b> без засчитанного дня — уровень понизится.</p>
        ${warnHTML}
      </div>

      ${typeof Push !== 'undefined' && Push.banner ? Push.banner() : ''}

      ${night ? '<div class="mt-night"><b>🌙 Сейчас ночь — лучшее дело: спать</b><span>Дела уровня ждут утром.</span></div>' : ''}

      <h4 class="my-sec">Сегодня · ${doneN} из ${ids.length}${s.counted[k] ? ' · ✅ день засчитан' : ''}</h4>
      <ul class="mt-list">${rows}</ul>

      ${typeof Plans !== 'undefined' ? Plans.section() : ''}

      <div class="my-week">
        <h4 class="my-sec">Что откроется дальше</h4>
        <ul class="lv-road">${road}</ul>
      </div>

      ${typeof Account !== 'undefined' ? Account.line() : ''}
      ${typeof Remind !== 'undefined' ? Remind.alarmLine() : ''}
      ${typeof Push !== 'undefined' ? Push.line() : ''}
      <button class="btn btn-ghost btn-block my-switch" data-space="all">🧩 Всё остальное — график, задачи, привычки, фокус…</button>`;

    el.querySelectorAll('[data-lvgo]').forEach((b) => { b.onclick = () => start(b.dataset.lvgo, b); });
    el.querySelectorAll('[data-lvdone]').forEach((b) => { b.onclick = () => complete(b.dataset.lvdone, b); });
    el.querySelectorAll('[data-lvinfo]').forEach((b) => { b.onclick = () => start(b.dataset.lvinfo, b); });
    if (typeof Plans !== 'undefined') Plans.bind(el);
    el.querySelectorAll('[data-lvalarm]').forEach((b) => { b.onclick = () => Plans.bellClick(b.dataset.lvalarm); });
    const al = el.querySelector('[data-alarm]'); if (al) al.onclick = () => Remind.open();
    const ac = el.querySelector('[data-account]'); if (ac) ac.onclick = () => Account.open();
    el.querySelectorAll('[data-push]').forEach((b) => { b.onclick = () => Push.open(); });
  }

  return { render, complete, start, streak, levelOn, questsAt, isDone, LEVELS, QUESTS, checkDay, checkDemote, missedRun, MISS_DOWN, state: st };

})();

Screens.mytasks = { render: () => Levels.render() };
