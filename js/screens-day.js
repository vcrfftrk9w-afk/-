'use strict';
/* =========================================================
   SCREENS DAY — экран «День»: контроль режима + план от ИИ
   ========================================================= */
Screens.day = (() => {
  const { $, $$ } = UI;
  let bound = false;
  let tickTimer = null;

  /* ---------- сейчас по плану ---------- */
  function nowHTML() {
    const cur = Planner.currentBlock();
    const next = Planner.nextBlock();
    const pl = Planner.plan();

    if (!pl) {
      return `
        <div class="card day-now empty">
          <h3>План на сегодня ещё не собран</h3>
          <p class="muted">Приложение посмотрит на твой режим, кривую энергии и дедлайны — и разложит задачи по часам так, чтобы тяжёлое попало на пик, а мелочь на спад.</p>
          <button class="btn btn-primary btn-lg" id="day-plan">🧠 Собрать план дня</button>
        </div>`;
    }

    const prog = Planner.progress();
    const skipped = pl.skipped || {};
    const b = cur && !skipped[cur.id] ? cur : null;
    const now = Track.nowMin();

    if (!b) {
      return `
        <div class="card day-now">
          <div class="day-now-tag">Сейчас — свободно</div>
          <h3>${next ? `Следующее в ${Track.hhmm(next.start)}` : 'На сегодня всё распланировано'}</h3>
          <p class="muted">${next ? `${next.emoji} ${UI.esc(next.title)}` : 'Можно отдыхать — план закрыт.'}</p>
          <div class="day-now-bar"><span style="width:${prog.pct}%"></span></div>
          <small class="muted">Сделано ${prog.done} из ${prog.total} пунктов плана</small>
        </div>`;
    }

    const left = b.end - now;
    const done = Planner.isDone(b);
    return `
      <div class="card day-now ${done ? 'ok' : 'live'}">
        <div class="day-now-tag">${done ? 'Выполнено' : 'Сейчас по плану'} · осталось ${left} мин</div>
        <h3>${b.emoji} ${UI.esc(b.title)}</h3>
        <p class="muted">${Track.hhmm(b.start)} – ${Track.hhmm(b.end)}${b.taskKind ? ` · ${Planner.KIND_LABEL[b.taskKind]}` : ''}${b.note ? ` · ${UI.esc(b.note)}` : ''}</p>
        <div class="day-now-bar"><span style="width:${Math.round(((now - b.start) / (b.end - b.start)) * 100)}%"></span></div>
        ${done ? '' : `
        <div class="day-now-actions">
          ${b.kind === 'task' ? `<button class="btn btn-primary" data-do="${b.id}">▶ Делаю это сейчас</button>` : ''}
          ${b.kind === 'meal' ? `<button class="btn btn-primary" data-quick="meal">🍽️ Поел</button>` : ''}
          ${b.kind === 'wake' ? `<button class="btn btn-primary" data-quick="wake">☀️ Встал</button>` : ''}
          ${b.kind === 'pill' ? `<button class="btn btn-primary" data-quick="pills">💊 Отметить</button>` : ''}
          ${b.kind === 'evening' ? `<button class="btn btn-primary" data-quick="sleep">🌙 Ложусь</button>` : ''}
          <button class="btn btn-ghost" data-skip="${b.id}">Пропустить</button>
          <button class="btn btn-ghost" data-why="${b.id}">Почему сюда?</button>
        </div>`}
      </div>`;
  }

  /* ---------- режим дня: кольцо + счётчики ---------- */
  function statusHTML() {
    const d = Track.today();
    const p = Track.profile();
    const sc = Track.score();
    const R = 2 * Math.PI * 40;
    const slept = Track.sleptHours();
    const awake = Track.awakeMinutes();

    return `
      <div class="card day-status">
        <div class="day-status-head">
          <div class="day-ring">
            <svg viewBox="0 0 100 100"><circle class="dr-bg" cx="50" cy="50" r="40"/><circle class="dr-fg" cx="50" cy="50" r="40"
              stroke-dasharray="${R}" stroke-dashoffset="${R * (1 - sc.value / 100)}"/></svg>
            <b>${sc.value}</b><small>режим</small>
          </div>
          <div class="day-status-text">
            <h3>${d.wakeAt !== null ? `Встал в ${Track.hhmm(d.wakeAt)}` : 'Подъём ещё не отмечен'}</h3>
            <p class="muted">${d.wakeAt !== null
              ? `На ногах ${Math.floor(awake / 60)} ч ${awake % 60} мин${slept !== null ? ` · спал ${String(slept).replace('.', ',')} ч` : ''}`
              : `Цель подъёма — ${Track.hhmm(p.wakeTarget)}. Отметь, когда проснулся, и план построится от этого времени.`}</p>
            <div class="day-score-parts">
              ${sc.parts.map((x) => `<span class="dsp ${x.v >= 0.8 ? 'ok' : (x.v >= 0.4 ? 'mid' : 'bad')}" title="${UI.esc(x.label)}">${UI.esc(x.label)} ${Math.round(x.v * 100)}%</span>`).join('')}
            </div>
          </div>
        </div>

        <div class="day-counters">
          <div class="day-counter">
            <span class="dc-emoji">💧</span>
            <b>${d.water || 0}<i>/${p.waterGoal}</i></b>
            <small>стаканов воды</small>
            <div class="dc-btns"><button data-water="-1">−</button><button data-water="1">+</button></div>
          </div>
          <div class="day-counter">
            <span class="dc-emoji">🍽️</span>
            <b>${Track.kcal()}<i> ккал</i></b>
            <small>${d.meals.length} из ${p.mealsGoal} приёмов</small>
            <div class="dc-btns"><button data-quick="meal">＋ еда</button></div>
          </div>
          <div class="day-counter">
            <span class="dc-emoji">☕</span>
            <b>${d.coffee || 0}</b>
            <small>кофе${d.coffee >= 3 ? ' — многовато' : ''}</small>
            <div class="dc-btns"><button data-coffee="-1">−</button><button data-coffee="1">+</button></div>
          </div>
          <div class="day-counter">
            <span class="dc-emoji">🏃</span>
            <b>${d.workout || 0}<i> мин</i></b>
            <small>движения</small>
            <div class="dc-btns"><button data-workout="10">+10</button><button data-workout="30">+30</button></div>
          </div>
        </div>

        ${p.pills.length ? `
          <div class="day-pills">
            ${p.pills.map((x) => `
              <button class="day-pill ${d.pills[x.id] ? 'taken' : ''}" data-pill="${x.id}">
                <span>${d.pills[x.id] ? '✓' : '💊'}</span>${UI.esc(x.name)}<i>${Track.hhmm(x.at)}</i>
              </button>`).join('')}
          </div>` : ''}

        <div class="day-main-actions">
          ${d.wakeAt === null
            ? `<button class="btn btn-primary" data-quick="wake">☀️ Я проснулся</button>`
            : (d.sleepAt === null ? `<button class="btn btn-ghost" data-quick="sleep">🌙 Ложусь спать</button>` : `<span class="muted small">День закрыт в ${Track.hhmm(d.sleepAt)}</span>`)}
          <button class="btn btn-ghost" id="day-settings">⚙️ Мой режим</button>
        </div>
      </div>`;
  }

  /* ---------- напоминания «ты кое-что не сделал» ---------- */
  function nudgesHTML() {
    const list = Track.nudges();
    if (!list.length) return '';
    return `
      <div class="card day-nudges">
        <div class="card-head"><h3>⚠️ Приложение заметило</h3></div>
        <ul>${list.map((n) => `<li><span>${n.emoji}</span>${UI.esc(n.text)}</li>`).join('')}</ul>
      </div>`;
  }

  /* ---------- таймлайн дня ---------- */
  function timelineHTML() {
    const pl = Planner.plan();
    const p = Track.profile();
    const d = Track.today();
    const wake = d.wakeAt !== null ? d.wakeAt : p.wakeTarget;
    const from = Math.max(0, wake - 30);
    const to = Math.min(1440, p.sleepTarget + 30);
    const span = to - from;
    const now = Track.nowMin();
    const skipped = (pl && pl.skipped) || {};

    // фон — кривая энергии
    const pts = [];
    for (let m = from; m <= to; m += 20) {
      const x = ((m - from) / span) * 100;
      pts.push(`${x.toFixed(2)},${(100 - Planner.energyAt(m) * 100).toFixed(1)}`);
    }

    const hours = [];
    for (let h = Math.ceil(from / 60); h <= Math.floor(to / 60); h++) {
      hours.push(`<span class="tl-hour" style="left:${(((h * 60) - from) / span) * 100}%">${h}:00</span>`);
    }

    const blocks = (pl ? pl.blocks : Planner.fixedBlocks()).filter((b) => b.end > from && b.start < to);

    return `
      <div class="card day-timeline">
        <div class="card-head">
          <h3>Твой день по часам</h3>
          ${pl ? `<button class="link-btn" id="day-replan">пересобрать</button>` : ''}
        </div>
        <div class="tl-energy">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs><linearGradient id="tl-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.45"/>
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.02"/>
            </linearGradient></defs>
            <polygon points="0,100 ${pts.join(' ')} 100,100" fill="url(#tl-grad)"/>
            <polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="0.8" vector-effect="non-scaling-stroke"/>
          </svg>
          <span class="tl-label">энергия</span>
        </div>
        <div class="tl-hours">${hours.join('')}</div>
        <div class="tl-track">
          ${now >= from && now <= to ? `<i class="tl-now" style="left:${((now - from) / span) * 100}%"></i>` : ''}
          ${blocks.map((b) => {
            const l = ((b.start - from) / span) * 100;
            const w = Math.max(1.4, ((b.end - b.start) / span) * 100);
            const done = Planner.isDone(b);
            const past = b.end < now;
            const cls = skipped[b.id] ? 'skip' : (done ? 'done' : (past ? 'miss' : ''));
            return `<button class="tl-block k-${b.kind} ${cls}" style="left:${l}%;width:${w}%" data-block="${b.id}" title="${UI.esc(b.title)} · ${Track.hhmm(b.start)}">
              <span>${b.emoji}</span>${w > 5 ? `<em>${UI.esc(b.title)}</em>` : ''}</button>`;
          }).join('')}
        </div>
        <div class="tl-legend">
          <span class="lg k-task">задачи</span><span class="lg k-meal">еда</span>
          <span class="lg k-wake">режим</span><span class="lg k-pill">таблетки</span>
          <span class="lg done">сделано</span><span class="lg miss">пропущено</span>
        </div>
      </div>`;
  }

  /* ---------- список плана ---------- */
  function listHTML() {
    const pl = Planner.plan();
    if (!pl) return '';
    const now = Track.nowMin();
    const skipped = pl.skipped || {};
    return `
      <div class="card day-list">
        <div class="card-head"><h3>Порядок дня</h3><span class="badge">${Planner.progress().done}/${Planner.progress().total}</span></div>
        <ul>
          ${pl.blocks.map((b) => {
            const done = Planner.isDone(b);
            const past = b.end < now;
            const live = now >= b.start && now < b.end;
            return `
              <li class="dl-item ${done ? 'done' : ''} ${skipped[b.id] ? 'skipped' : ''} ${live ? 'live' : ''} ${!done && past && !skipped[b.id] ? 'miss' : ''}">
                <span class="dl-time">${Track.hhmm(b.start)}</span>
                <span class="dl-emoji">${b.emoji}</span>
                <button class="dl-title" data-block="${b.id}">${UI.esc(b.title)}</button>
                <span class="dl-meta">${b.kind === 'task' ? `${b.end - b.start} мин · ${Math.round(b.energy * 100)}% энергии` : `${b.end - b.start} мин`}</span>
              </li>`;
          }).join('')}
        </ul>
      </div>`;
  }

  /* ---------- «почему сюда» ---------- */
  function explain(id) {
    const pl = Planner.plan();
    const b = (pl ? pl.blocks : Planner.fixedBlocks()).find((x) => x.id === id);
    if (!b) return;
    const body = UI.sheet(`
      <div class="why">
        <div class="why-tag">${Track.hhmm(b.start)} – ${Track.hhmm(b.end)}</div>
        <h2>${b.emoji} ${UI.esc(b.title)}</h2>
        ${b.kind === 'task' ? `
          <div class="why-score">
            <div><b>${Math.round(b.energy * 100)}%</b><small>энергии в это время</small></div>
            <div><b>${b.end - b.start}</b><small>минут на задачу</small></div>
            <div><b>${b.score}</b><small>оценка места</small></div>
          </div>
          <p class="muted small">Тип нагрузки: ${Planner.KIND_LABEL[b.taskKind]} — ей нужно около ${Math.round(Planner.NEED[b.taskKind] * 100)}% энергии.</p>
          ${b.pros.length ? `<div class="why-col pro"><b>За это время</b><ul>${b.pros.map((x) => `<li>${UI.esc(x)}</li>`).join('')}</ul></div>` : ''}
          ${b.cons.length ? `<div class="why-col con"><b>Против</b><ul>${b.cons.map((x) => `<li>${UI.esc(x)}</li>`).join('')}</ul></div>` : ''}
          <div class="why-actions">
            <button class="btn btn-primary" data-do="${b.id}">▶ Делаю сейчас</button>
            <button class="btn btn-ghost" data-skip="${b.id}">Пропустить</button>
          </div>`
        : `<p>${UI.esc(b.note || 'Часть твоего режима.')}</p>`}
      </div>`);
    body.addEventListener('click', (e) => {
      const d = e.target.closest('[data-do]'), sk = e.target.closest('[data-skip]');
      if (d) { UI.closeModal('#sheet-modal'); startBlock(d.dataset.do); }
      else if (sk) { UI.closeModal('#sheet-modal'); Planner.skip(sk.dataset.skip); UI.toast('Пропущено — пересоберу план', 'default', '⏭️'); }
    });
  }

  /* ---------- запустить блок в работу ---------- */
  function startBlock(id) {
    const pl = Planner.plan();
    const b = pl && pl.blocks.find((x) => x.id === id);
    if (!b || b.kind !== 'task') return;
    if (b.habitId) {
      const h = State.s.habits.find((x) => x.id === b.habitId);
      if (h) { Screens.habits.toggleDay(h, State.todayKey()); UI.toast('Привычка отмечена', 'success', h.emoji || '🔥'); render(); }
      return;
    }
    if (b.pathId) { App.go('path'); setTimeout(() => Screens.path.openStep(b.pathId), 220); return; }
    App.go('adhd');
    setTimeout(() => {
      Screens.focus.setTask(b.taskId);
      Screens.focus.quickStart(Math.min(90, b.end - b.start), b.title);
    }, 250);
  }

  /* ---------- быстрые действия ---------- */
  function quick(kind) {
    if (kind === 'wake') {
      Track.wake();
      Sound.sfx('success');
      FX.confetti(window.innerWidth / 2, window.innerHeight * 0.25, 30);
      UI.toast(`Подъём в ${Track.hhmm(Track.today().wakeAt)} — собираю план дня`, 'success', '☀️');
      setTimeout(() => { Planner.build({}); render(); }, 400);
      return;
    }
    if (kind === 'sleep') {
      Track.sleep();
      Sound.sfx('whoosh');
      const sc = Track.score();
      UI.toast(`День закрыт. Режим сегодня — ${sc.value} из 100`, 'level', '🌙');
      return;
    }
    if (kind === 'meal') { mealDialog(); return; }
    if (kind === 'pills') { App.go('day'); return; }
  }

  function mealDialog() {
    const body = UI.sheet(`
      <h2>Что съел?</h2>
      <p class="muted small">Калории примерно — важнее сам факт, что приём пищи записан.</p>
      <label class="field"><span>Что это было</span><input id="meal-title" type="text" maxlength="40" placeholder="Например, курица с рисом"></label>
      <label class="field"><span>Калории (можно пропустить)</span><input id="meal-kcal" type="number" min="0" inputmode="numeric" placeholder="600"></label>
      <div class="meal-presets">
        ${[['🍳 Завтрак', 450], ['🥗 Лёгкий', 300], ['🍽️ Обед', 700], ['🍕 Плотный', 1000], ['🍎 Перекус', 150]]
          .map(([t, k]) => `<button class="chip" data-preset="${k}" data-t="${UI.esc(t)}">${t} · ${k}</button>`).join('')}
      </div>
      <button class="btn btn-primary btn-block" id="meal-save">Записать</button>`);
    body.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
      body.querySelector('#meal-kcal').value = b.dataset.preset;
      if (!body.querySelector('#meal-title').value) body.querySelector('#meal-title').value = b.dataset.t.replace(/^\S+\s/, '');
    }));
    body.querySelector('#meal-save').addEventListener('click', () => {
      Track.meal(body.querySelector('#meal-kcal').value, body.querySelector('#meal-title').value);
      UI.closeModal('#sheet-modal');
      Sound.sfx('check');
      UI.toast('Приём пищи записан', 'success', '🍽️');
    });
  }

  /* ---------- настройки режима ---------- */
  function settings() {
    const p = Track.profile();
    const body = UI.sheet(`
      <h2>Мой режим</h2>
      <p class="muted small">По этим цифрам строится кривая энергии и весь план дня.</p>
      <div class="rg-grid">
        <label class="field"><span>Подъём</span><input id="pf-wake" type="time" value="${Track.hhmm(p.wakeTarget)}"></label>
        <label class="field"><span>Отбой</span><input id="pf-sleep" type="time" value="${Track.hhmm(p.sleepTarget)}"></label>
        <label class="field"><span>Начало дел</span><input id="pf-ws" type="time" value="${Track.hhmm(p.workStart)}"></label>
        <label class="field"><span>Конец дел</span><input id="pf-we" type="time" value="${Track.hhmm(p.workEnd)}"></label>
        <label class="field"><span>Воды в день, стаканов</span><input id="pf-water" type="number" min="1" max="20" value="${p.waterGoal}"></label>
        <label class="field"><span>Приёмов пищи</span><input id="pf-meals" type="number" min="1" max="8" value="${p.mealsGoal}"></label>
        <label class="field"><span>Калорий в день</span><input id="pf-kcal" type="number" min="0" step="50" value="${p.kcalGoal}"></label>
        <label class="field"><span>Сна, часов</span><input id="pf-sl" type="number" min="4" max="12" value="${p.sleepGoal}"></label>
      </div>
      <div class="field"><span>Когда ты живее</span>
        <div class="chrono">
          ${[['lark', '🐦 Жаворонок', 'пик с утра'], ['neutral', '⚖️ Обычный', 'пик до обеда'], ['owl', '🦉 Сова', 'пик вечером']]
            .map(([id, t, d]) => `<button class="chrono-opt ${p.chronotype === id ? 'sel' : ''}" data-chrono="${id}"><b>${t}</b><small>${d}</small></button>`).join('')}
        </div>
      </div>
      <div class="field"><span>Таблетки и витамины</span>
        <div class="pill-editor" id="pill-editor">
          ${p.pills.map((x) => `<div class="pill-row"><b>${UI.esc(x.name)}</b><i>${Track.hhmm(x.at)}</i><button data-delpill="${x.id}">✕</button></div>`).join('') || '<span class="muted small">Пока ничего</span>'}
        </div>
        <div class="row"><input id="pill-name" type="text" placeholder="Название" maxlength="30"><input id="pill-time" type="time" value="09:00"><button class="btn btn-ghost btn-sm" id="pill-add">+</button></div>
      </div>
      <button class="btn btn-primary btn-block" id="pf-save">Сохранить и пересобрать план</button>`);

    let chrono = p.chronotype;
    body.querySelectorAll('[data-chrono]').forEach((b) => b.addEventListener('click', () => {
      chrono = b.dataset.chrono;
      body.querySelectorAll('[data-chrono]').forEach((x) => x.classList.toggle('sel', x === b));
      Sound.sfx('pop');
    }));
    body.querySelector('#pill-add').addEventListener('click', () => {
      const n = body.querySelector('#pill-name').value.trim();
      if (!n) return;
      Track.addPill(n, body.querySelector('#pill-time').value);
      UI.closeModal('#sheet-modal');
      setTimeout(settings, 220);
    });
    body.querySelectorAll('[data-delpill]').forEach((b) => b.addEventListener('click', () => {
      Track.removePill(b.dataset.delpill);
      UI.closeModal('#sheet-modal');
      setTimeout(settings, 220);
    }));
    body.querySelector('#pf-save').addEventListener('click', () => {
      const v = (sel, def) => Track.parseHHMM(body.querySelector(sel).value) ?? def;
      const n = (sel, def) => Number(body.querySelector(sel).value) || def;
      p.wakeTarget = v('#pf-wake', p.wakeTarget);
      p.sleepTarget = v('#pf-sleep', p.sleepTarget);
      p.workStart = v('#pf-ws', p.workStart);
      p.workEnd = v('#pf-we', p.workEnd);
      p.waterGoal = n('#pf-water', 8);
      p.mealsGoal = n('#pf-meals', 3);
      p.kcalGoal = n('#pf-kcal', 2000);
      p.sleepGoal = n('#pf-sl', 8);
      p.chronotype = chrono;
      UI.closeModal('#sheet-modal');
      Planner.build({});
      Sound.sfx('success');
      UI.toast('Режим сохранён, план пересобран', 'success', '⚙️');
      render();
    });
  }

  /* ---------- рендер ---------- */
  function render() {
    const root = $('#day-root');
    if (!root) return;
    const badge = $('#day-badge');
    if (badge) {
      const sc = Track.score().value;
      badge.textContent = `режим ${sc}`;
      badge.className = 'badge ' + (sc >= 70 ? 'badge-ok' : (sc >= 40 ? 'badge-mid' : 'badge-bad'));
    }
    root.innerHTML = nowHTML() + statusHTML() + nudgesHTML() + timelineHTML() + listHTML();
    UI.initTilt();
    if (!bound) bind(root);
  }

  function bind(root) {
    bound = true;
    root.addEventListener('click', (e) => {
      const t = e.target;
      const g = (sel) => t.closest(sel);
      if (g('#day-plan') || g('#day-replan')) {
        Planner.build({});
        Sound.sfx('success');
        FX.confetti(window.innerWidth / 2, 160, 24);
        UI.toast('План дня собран', 'success', '🧠');
        render(); return;
      }
      if (g('#day-settings')) { settings(); return; }
      const w = g('[data-water]'); if (w) { Track.water(Number(w.dataset.water)); Sound.sfx('pop'); return; }
      const c = g('[data-coffee]'); if (c) { Track.coffee(Number(c.dataset.coffee)); Sound.sfx('pop'); return; }
      const wo = g('[data-workout]'); if (wo) { Track.workout(Number(wo.dataset.workout)); Sound.sfx('check'); return; }
      const pill = g('[data-pill]'); if (pill) { Track.pill(pill.dataset.pill); Sound.sfx('check'); return; }
      const q = g('[data-quick]'); if (q) { quick(q.dataset.quick); return; }
      const why = g('[data-why]'); if (why) { explain(why.dataset.why); return; }
      const blk = g('[data-block]'); if (blk) { explain(blk.dataset.block); return; }
      const dd = g('[data-do]'); if (dd) { startBlock(dd.dataset.do); return; }
      const sk = g('[data-skip]'); if (sk) { Planner.skip(sk.dataset.skip); UI.toast('Пропущено', 'default', '⏭️'); render(); return; }
    });
  }

  function onEnter() {
    render();
    clearInterval(tickTimer);
    tickTimer = setInterval(() => { if (!document.hidden) render(); }, 30000);
  }
  function onLeave() { clearInterval(tickTimer); tickTimer = null; }

  return { render, onEnter, onLeave, quick, settings, explain };
})();
