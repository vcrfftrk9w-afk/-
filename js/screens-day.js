'use strict';
/* =========================================================
   SCREENS DAY — экран «День»: контроль режима + план от ИИ
   ========================================================= */
Screens.day = (() => {
  const { $, $$ } = UI;
  let bound = false;
  let tickTimer = null;

  /* ---------- первый вход: настроить режим ---------- */
  function setupHTML() {
    const p = Track.profile();
    if (p.set) return '';
    return `
      <div class="card day-setup">
        <div class="ob-emoji" style="font-size:38px">🕰️</div>
        <h3>Настроим режим за 30 секунд</h3>
        <p class="muted">От этих цифр зависит всё: когда у тебя пик энергии, куда встанет тяжёлая задача и когда приложение начнёт тебя подгонять.</p>
        <div class="rg-grid">
          <label class="field"><span>Во сколько встаёшь</span><input id="su-wake" type="time" value="${Track.hhmm(p.wakeTarget)}"></label>
          <label class="field"><span>Во сколько ложишься</span><input id="su-sleep" type="time" value="${Track.hhmm(p.sleepTarget)}"></label>
        </div>
        <div class="field"><span>Когда ты живее</span>
          <div class="chrono" id="su-chrono">
            ${[['lark', '🐦 Жаворонок', 'пик с утра'], ['neutral', '⚖️ Обычный', 'пик до обеда'], ['owl', '🦉 Сова', 'пик вечером']]
              .map(([id, t, dd]) => `<button class="chrono-opt ${p.chronotype === id ? 'sel' : ''}" data-su="${id}"><b>${t}</b><small>${dd}</small></button>`).join('')}
          </div>
        </div>
        <button class="btn btn-primary btn-lg btn-block" id="su-save">Готово, построй мой день</button>
        <button class="linkbtn" id="su-skip">пропустить, разберусь потом</button>
      </div>`;
  }

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

        ${(() => {
          const c = Chill.stats();
          if (!c.total) return '';
          return `<div class="chill-stat ${c.pct >= 70 ? 'ok' : (c.pct >= 40 ? 'mid' : 'bad')}">
            🍿 Выходишь вовремя из залипаний в <b>${c.pct}%</b> случаев
            <small>${c.kept} ${UI.plural(c.kept, 'раз', 'раза', 'раз')} вышел вовремя, ${c.over} ${UI.plural(c.over, 'раз', 'раза', 'раз')} перебрал</small>
          </div>`;
        })()}

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

        ${(d.busy || []).length ? `
          <div class="day-busy">
            ${d.busy.map((x) => `<span class="busy-chip">📌 ${UI.esc(x.title)} <i>${Track.hhmm(x.start)}–${Track.hhmm(x.end)}</i><button data-delbusy="${x.id}">✕</button></span>`).join('')}
          </div>` : ''}

        <div class="day-main-actions">
          ${d.wakeAt === null
            ? `<button class="btn btn-primary" data-quick="wake">☀️ Я проснулся</button>`
            : (d.sleepAt === null ? `<button class="btn btn-ghost" data-quick="sleep">🌙 Ложусь спать</button>` : `<span class="muted small">День закрыт в ${Track.hhmm(d.sleepAt)}</span>`)}
          <button class="btn btn-accent" id="day-verdict">🧠 Что сейчас главное</button>
          <button class="btn btn-ghost" id="day-busy-add">📌 Занятое время</button>
          ${typeof Notification !== 'undefined' && Notification.permission !== 'granted' ? '<button class="btn btn-ghost" id="day-notify">🔔 Включить напоминания</button>' : ''}
          <button class="btn btn-ghost" id="day-settings">⚙️ Мой режим</button>
        </div>
      </div>`;
  }

  /* ---------- что не поместилось в день ---------- */
  function unplacedHTML() {
    const list = Planner.unplaced();
    if (!list.length) return '';
    const busy = (Track.today().busy || []).reduce((a, x) => a + (x.end - x.start), 0);
    return `
      <div class="card day-unplaced">
        <div class="card-head"><h3>🚫 Не поместилось в день</h3><span class="badge badge-mid">${list.length}</span></div>
        <p class="muted small">${busy > 240
          ? `Занятого времени сегодня ${Math.round(busy / 60)} ч — свободных окон под эти дела не осталось.`
          : 'Свободного времени между едой, сном и занятыми часами не хватило.'} Убери лишнее, укороти длительность или перенеси на завтра.</p>
        <ul class="behind-list">
          ${list.slice(0, 6).map((t) => `<li><span>•</span><b>${UI.esc(t)}</b></li>`).join('')}
        </ul>
        <div class="row wrap">
          <button class="btn btn-ghost" id="day-busy-edit">📌 Посмотреть занятое время</button>
          <button class="btn btn-ghost" id="day-settings2">⚙️ Сдвинуть подъём или отбой</button>
        </div>
      </div>`;
  }

  /* ---------- отставание от плана ---------- */
  function behindHTML() {
    if (!Planner.plan()) return '';
    const miss = Planner.missed();
    if (!miss.length) return '';
    return `
      <div class="card day-behind">
        <div class="card-head"><h3>⏰ Ты отстал от плана</h3><span class="badge badge-bad">${miss.length}</span></div>
        <p class="muted small">Эти дела должны были быть сделаны. Ничего страшного — пересоберу остаток дня под то время, что осталось.</p>
        <ul class="behind-list">
          ${miss.slice(0, 5).map((b) => `<li><span>${b.emoji}</span><b>${UI.esc(b.title)}</b><i>было в ${Track.hhmm(b.start)}</i></li>`).join('')}
        </ul>
        <div class="row wrap">
          <button class="btn btn-primary" id="day-catchup">🔁 Догнать план</button>
          <button class="btn btn-ghost" id="day-dropmiss">Отпустить на сегодня</button>
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
    const wake = Planner.wakeMin();
    const from = Math.max(0, wake - 30);
    const to = Planner.sleepMin() + 30;
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
      hours.push(`<span class="tl-hour ${h % 3 === 0 ? '' : 'tl-thin'}" style="left:${(((h * 60) - from) / span) * 100}%">${h % 24}:00</span>`);
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
            // короткие блоки выше в стопке: иначе длинный сосед накрывает их край
            const z = Math.max(1, 24 - Math.round(w));
            return `<button class="tl-block k-${b.kind} ${cls}" style="left:${l}%;width:${w}%;z-index:${z}" data-block="${b.id}" title="${UI.esc(b.title)} · ${Track.hhmm(b.start)}">
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
    if (b.chill) { Chill.start(b.end - b.start, b.title, b.taskId); return; }
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
      const added = DayTpl.tpl().autoApply && !DayTpl.appliedToday() ? DayTpl.apply({ quiet: true }) : 0;
      UI.toast(added
        ? `Подъём в ${Track.hhmm(Track.today().wakeAt)}. Поставил ${added} ${UI.plural(added, 'дело', 'дела', 'дел')} из шаблона и собрал план.`
        : `Подъём в ${Track.hhmm(Track.today().wakeAt)} — собираю план дня`, 'success', '☀️');
      setTimeout(() => { Planner.build({}); render(); }, 400);
      return;
    }
    if (kind === 'sleep') { closeDay(); return; }
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

  /* ---------- итог дня ---------- */
  function closeDay() {
    Track.sleep();
    Sound.sfx('fanfare');
    const d = Track.today();
    const sc = Track.score();
    const pr = Planner.plan() ? Planner.progress() : { done: 0, total: 0, pct: 0 };
    const miss = Planner.plan() ? Planner.missed() : [];
    // обещание «завтра поставлю их первыми» должно быть настоящим
    d.carriedOver = miss.map((b) => b.taskId || b.pathId || b.habitId).filter(Boolean);
    State.save();
    const avg7 = Track.scoreAvg(7);
    const yest = State.s.day[State.daysAgoKey(1)] ? Track.score(State.daysAgoKey(1)).value : null;
    const diff = yest === null ? null : sc.value - yest;

    const wins = [];
    if (d.wakeAt !== null && Math.abs(d.wakeAt - Track.profile().wakeTarget) <= 30) wins.push('Встал вовремя');
    if ((d.water || 0) >= Track.profile().waterGoal) wins.push('Выпил всю норму воды');
    if (d.meals.length >= Track.profile().mealsGoal) wins.push('Поел как надо');
    if ((d.workout || 0) >= 30) wins.push('Подвигался');
    if (pr.pct >= 80 && pr.total) wins.push('План дня почти закрыт');
    const pills = Track.profile().pills;
    if (pills.length && pills.every((x) => d.pills[x.id])) wins.push('Всё принял по расписанию');

    if (sc.value >= 70) FX.fireworks(4);

    const body = UI.sheet(`
      <div class="day-close">
        <div class="comeback-emoji">🌙</div>
        <h2>День закрыт</h2>
        <div class="dc-score">
          <b>${sc.value}</b><small>режим дня из 100</small>
          ${diff !== null ? `<i class="${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff)} к вчера</i>` : ''}
        </div>
        <div class="comeback-kept">
          <div class="comeback-chip"><span>✅</span><b>${pr.done}/${pr.total}</b><small>по плану</small></div>
          <div class="comeback-chip"><span>💧</span><b>${d.water || 0}</b><small>воды</small></div>
          <div class="comeback-chip"><span>🍽️</span><b>${Track.kcal()}</b><small>ккал</small></div>
          <div class="comeback-chip"><span>📊</span><b>${avg7}</b><small>за 7 дней</small></div>
        </div>
        ${wins.length ? `<div class="dc-wins"><b>Что получилось</b><ul>${wins.map((w) => `<li>${UI.esc(w)}</li>`).join('')}</ul></div>` : ''}
        ${miss.length ? `<div class="dc-miss"><b>Не сделано</b><p>${miss.slice(0, 3).map((m) => UI.esc(m.title)).join(', ')}${miss.length > 3 ? ` и ещё ${miss.length - 3}` : ''}. Завтра поставлю их первыми.</p></div>` : ''}
        <p class="muted small">Ложись сейчас — и завтрашний пик энергии будет твоим. Приложение разбудит план, как только отметишь подъём.</p>
        <button class="btn btn-primary btn-lg btn-block" id="dc-ok">Спокойной ночи</button>
      </div>`);
    body.querySelector('#dc-ok').onclick = () => { UI.closeModal('#sheet-modal'); render(); };
  }

  /* ---------- занятое время ---------- */
  function busyDialog() {
    const now = Track.nowMin();
    const body = UI.sheet(`
      <h2>Занятое время</h2>
      <p class="muted small">Работа, пары, встреча, дорога — планировщик обойдёт это стороной и разложит задачи вокруг.</p>
      <label class="field"><span>Что это</span><input id="busy-title" type="text" maxlength="40" placeholder="Например, созвон с командой"></label>
      <div class="rg-grid">
        <label class="field"><span>С</span><input id="busy-from" type="time" value="${Track.hhmm(Math.ceil(now / 30) * 30)}"></label>
        <label class="field"><span>До</span><input id="busy-to" type="time" value="${Track.hhmm(Math.ceil(now / 30) * 30 + 60)}"></label>
      </div>
      <div class="meal-presets">
        ${[['💼 Работа', 9 * 60, 18 * 60], ['🎓 Учёба', 9 * 60, 14 * 60], ['🚗 Дорога', 8 * 60, 9 * 60]]
          .map(([t, a, b2]) => `<button class="chip" data-bp="${a}-${b2}" data-t="${UI.esc(t)}">${t}</button>`).join('')}
      </div>
      <button class="btn btn-primary btn-block" id="busy-save">Занять это время</button>`);
    body.querySelectorAll('[data-bp]').forEach((btn) => btn.addEventListener('click', () => {
      const [a, b2] = btn.dataset.bp.split('-').map(Number);
      body.querySelector('#busy-from').value = Track.hhmm(a);
      body.querySelector('#busy-to').value = Track.hhmm(b2);
      if (!body.querySelector('#busy-title').value) body.querySelector('#busy-title').value = btn.dataset.t.replace(/^\S+\s/, '');
    }));
    body.querySelector('#busy-save').addEventListener('click', () => {
      const ok = Track.addBusy(
        body.querySelector('#busy-title').value,
        body.querySelector('#busy-from').value,
        body.querySelector('#busy-to').value);
      if (!ok) { UI.toast('Время указано неверно', 'warn', '⚠️'); return; }
      UI.closeModal('#sheet-modal');
      Planner.build({ keepDone: true });
      Sound.sfx('check');
      UI.toast('Время занято, план пересобран вокруг него', 'success', '📌');
      render();
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
      <label class="switch-row">
        <span><b>Строгий режим</b><small>Блок плана требует ответа: «начинаю», «дай 10 минут» или «сегодня не буду». Напоминания чаще.</small></span>
        <input type="checkbox" id="pf-strict" ${p.strict ? 'checked' : ''}>
      </label>
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
      p.strict = body.querySelector('#pf-strict').checked;
      UI.closeModal('#sheet-modal');
      Planner.build({});
      Sound.sfx('success');
      UI.toast('Режим сохранён, план пересобран', 'success', '⚙️');
      render();
    });
  }

  /* ---------- шаблон дня ---------- */
  function templateHTML() {
    const t = DayTpl.tpl();
    const on = DayTpl.active().length;
    const applied = DayTpl.appliedToday();
    const pr = DayTpl.progressToday();
    const st = DayTpl.streak();
    return `
      <div class="card day-tpl">
        <div class="card-head">
          <h3>🗂️ Шаблон дня</h3>
          <span class="badge ${pr.pct >= 80 ? 'badge-ok' : (pr.pct >= 40 ? 'badge-mid' : '')}">${pr.done}/${pr.total} сегодня</span>
        </div>
        <p class="muted small">Дела, которые повторяются каждый день. Одна кнопка — и они в сегодняшнем плане, на своих часах.</p>
        <div class="tpl-progress">
          <div class="path-bar"><span style="width:${pr.pct}%"></span></div>
          <div class="tpl-progress-meta">
            <span>${pr.pct}% шаблона закрыто</span>
            ${st > 0 ? `<b>🔥 ${UI.plur(st, 'день', 'дня', 'дней')} подряд</b>` : '<span class="muted">серия начнётся, когда закроешь 80% за день</span>'}
          </div>
        </div>
        <div class="tpl-list">
          ${t.items.map((x) => `
            <button class="tpl-item ${x.on ? '' : 'off'}" data-tplon="${x.id}">
              <span class="tpl-check">${x.on ? '✓' : ''}</span>
              <span class="tpl-text">
                <b>${UI.esc(x.title)}</b>
                <small>${x.at !== null && x.at !== undefined ? `⏰ ровно в ${Track.hhmm(x.at)} · ` : ''}${x.est ? `${x.est} мин` : 'без длительности'}${x.chill ? ' · 🍿 с таймером' : ''}${x.subs && x.subs.length ? ` · ${UI.plur(x.subs.length, 'шаг', 'шага', 'шагов')}` : ''}</small>
              </span>
              <span class="tpl-del" data-tpldel="${x.id}">✕</span>
            </button>`).join('') || '<span class="muted small">Шаблон пуст</span>'}
        </div>
        <div class="row wrap">
          <button class="btn ${applied ? 'btn-ghost' : 'btn-primary'}" id="tpl-apply">${applied ? '🔁 Применить ещё раз' : '▶ Поставить дела на сегодня'}</button>
          <button class="btn btn-ghost" id="tpl-add">＋ Добавить дело</button>
          <button class="btn btn-ghost" id="tpl-capture" title="Сохранить сегодняшние задачи как шаблон">💾 Из сегодняшних</button>
        </div>
        <label class="switch-row" style="margin-bottom:0">
          <span><b>Ставить автоматически</b><small>Как только отметишь подъём, дела из шаблона появятся в плане сами.</small></span>
          <input type="checkbox" id="tpl-auto" ${t.autoApply ? 'checked' : ''}>
        </label>
      </div>`;
  }

  function tplAddDialog() {
    const body = UI.sheet(`
      <h2>Новое дело в шаблон</h2>
      <p class="muted small">Оно будет появляться каждый день.</p>
      <label class="field"><span>Что делать</span><input id="ta-title" type="text" maxlength="80" placeholder="Например, читать 20 страниц"></label>
      <div class="rg-grid">
        <label class="field"><span>Категория</span><select id="ta-cat">${Data.CATEGORIES.map((c) => `<option value="${c.id}">${c.emoji} ${c.name}</option>`).join('')}</select></label>
        <label class="field"><span>Важность</span><select id="ta-pri">${Data.PRIORITIES.map((x) => `<option value="${x.id}" ${x.id === 'mid' ? 'selected' : ''}>${x.emoji} ${x.name}</option>`).join('')}</select></label>
        <label class="field"><span>Сколько займёт</span><input id="ta-est" type="number" min="5" max="180" step="5" value="30"></label>
        <label class="field"><span>Жёсткое время</span><input id="ta-at" type="time" placeholder="не обязательно"></label>
      </div>
      <label class="switch-row">
        <span><b>Это залипательное</b><small>Видео, лента, игра. Откроется отдельный таймер, который выведет тебя обратно.</small></span>
        <input type="checkbox" id="ta-chill">
      </label>
      <button class="btn btn-primary btn-block" id="ta-save">Добавить в шаблон</button>`);
    body.querySelector('#ta-save').addEventListener('click', () => {
      const title = body.querySelector('#ta-title').value.trim();
      if (!title) { UI.toast('Напиши название', 'warn', '✍️'); return; }
      DayTpl.add({
        title, cat: body.querySelector('#ta-cat').value, pri: body.querySelector('#ta-pri').value,
        est: Number(body.querySelector('#ta-est').value) || 30,
        at: Track.parseHHMM(body.querySelector('#ta-at').value),
        chill: body.querySelector('#ta-chill').checked,
      });
      UI.closeModal('#sheet-modal');
      Sound.sfx('check');
      render();
    });
  }

  /* ---------- история режима за две недели ---------- */
  function historyHTML() {
    const days = 14;
    const rows = [];
    for (let i = days - 1; i >= 0; i--) {
      const k = State.daysAgoKey(i);
      const has = State.s.day && State.s.day[k];
      rows.push({
        key: k, i,
        score: has ? Track.score(k).value : 0,
        slept: has ? Track.sleptHours(k) : null,
        water: has ? (State.s.day[k].water || 0) : 0,
        wake: has ? State.s.day[k].wakeAt : null,
        has: !!has,
      });
    }
    if (!rows.some((r) => r.has)) return '';

    const avg = Track.scoreAvg(days);
    const sleepVals = rows.filter((r) => r.slept !== null).map((r) => r.slept);
    const avgSleep = sleepVals.length ? Math.round((sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length) * 10) / 10 : null;
    const wakeVals = rows.filter((r) => r.wake !== null).map((r) => r.wake);
    const avgWake = wakeVals.length ? Math.round(wakeVals.reduce((a, b) => a + b, 0) / wakeVals.length) : null;

    return `
      <div class="card day-history">
        <div class="card-head"><h3>Режим за две недели</h3><span class="badge">в среднем ${avg}</span></div>
        <div class="dh-bars">
          ${rows.map((r) => `
            <div class="dh-col" title="${UI.dateLabel(r.key)} — режим ${r.score}${r.slept !== null ? `, сон ${String(r.slept).replace('.', ',')} ч` : ''}">
              <i class="${r.score >= 70 ? 'ok' : (r.score >= 40 ? 'mid' : 'bad')}" style="height:${Math.max(4, r.score)}%"></i>
              <small>${r.i === 0 ? 'сег' : new Date(r.key).getDate()}</small>
            </div>`).join('')}
        </div>
        <div class="dh-sum">
          ${avgWake !== null ? `<span>Обычно встаёшь в <b>${Track.hhmm(avgWake)}</b></span>` : ''}
          ${avgSleep !== null ? `<span>Спишь в среднем <b>${String(avgSleep).replace('.', ',')} ч</b></span>` : ''}
          <span>Дней под контролем: <b>${rows.filter((r) => r.has).length}</b></span>
        </div>
      </div>`;
  }

  /* Точечное обновление счётчиков: полная перерисовка на каждый «+1»
     заменяла кнопку под пальцем и теряла быстрые нажатия. */
  let patchTimer = null;
  function patchCounters() {
    const d = Track.today();
    const p = Track.profile();
    const set = (sel, html) => { const el = $(sel); if (el) el.innerHTML = html; };
    const cells = $$('.day-counter b');
    if (cells[0]) cells[0].innerHTML = `${d.water || 0}<i>/${p.waterGoal}</i>`;
    if (cells[1]) cells[1].innerHTML = `${Track.kcal()}<i> ккал</i>`;
    if (cells[2]) cells[2].textContent = d.coffee || 0;
    if (cells[3]) cells[3].innerHTML = `${d.workout || 0}<i> мин</i>`;
    const ring = $('.day-ring');
    if (ring) {
      const sc = Track.score();
      const R = 2 * Math.PI * 40;
      const fg = ring.querySelector('.dr-fg');
      if (fg) fg.style.strokeDashoffset = R * (1 - sc.value / 100);
      const b = ring.querySelector('b');
      if (b) b.textContent = sc.value;
      const badge = $('#day-badge');
      if (badge) {
        badge.textContent = `режим ${sc.value}`;
        badge.className = 'badge ' + (sc.value >= 70 ? 'badge-ok' : (sc.value >= 40 ? 'badge-mid' : 'badge-bad'));
      }
    }
    // остальное (напоминания, достижения) досчитываем, когда пальцы остановились
    clearTimeout(patchTimer);
    patchTimer = setTimeout(() => { State.commit(); }, 700);
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
    root.innerHTML = setupHTML() + nowHTML() + statusHTML() + behindHTML() + unplacedHTML() + nudgesHTML() + timelineHTML() + listHTML() + templateHTML() + historyHTML();
    UI.initTilt();
    if (!bound) bind(root);
  }

  function bind(root) {
    bound = true;
    root.addEventListener('change', (e) => {
      if (e.target.id === 'tpl-auto') { DayTpl.tpl().autoApply = e.target.checked; State.commit(); }
    });
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
      const su = g('[data-su]');
      if (su) {
        Track.profile().chronotype = su.dataset.su;
        root.querySelectorAll('[data-su]').forEach((x) => x.classList.toggle('sel', x === su));
        Sound.sfx('pop'); State.save(); return;
      }
      if (g('#su-save')) {
        const pr = Track.profile();
        pr.wakeTarget = Track.parseHHMM($('#su-wake').value) ?? pr.wakeTarget;
        pr.sleepTarget = Track.parseHHMM($('#su-sleep').value) ?? pr.sleepTarget;
        pr.set = true;
        // если настраивает утром — сразу отмечаем подъём, вечером это было бы неправдой
        if (Track.today().wakeAt === null && Track.nowMin() < 12 * 60) Track.wake();
        Planner.build({});
        Sound.sfx('fanfare');
        FX.confetti(window.innerWidth / 2, 200, 34);
        UI.toast('Режим настроен — день построен', 'level', '🕰️');
        render(); return;
      }
      if (g('#su-skip')) { Track.profile().set = true; State.commit(); render(); return; }
      if (g('#day-settings') || g('#day-settings2')) { settings(); return; }
      if (g('#day-busy-edit')) { busyDialog(); return; }
      const tdel = g('[data-tpldel]');
      if (tdel) { e.stopPropagation(); DayTpl.remove(tdel.dataset.tpldel); render(); return; }
      const ton = g('[data-tplon]');
      if (ton) { DayTpl.toggle(ton.dataset.tplon); Sound.sfx('pop'); render(); return; }
      if (g('#tpl-apply')) {
        const n = DayTpl.apply({});
        Sound.sfx(n ? 'success' : 'click');
        UI.toast(n ? `Поставил ${n} ${UI.plural(n, 'дело', 'дела', 'дел')} и пересобрал план` : 'Все дела шаблона уже в списке', n ? 'success' : 'default', '🗂️');
        render(); return;
      }
      if (g('#tpl-add')) { tplAddDialog(); return; }
      if (g('#tpl-capture')) {
        const n = DayTpl.captureFromToday();
        UI.toast(`Шаблон обновлён: ${n} ${UI.plural(n, 'дело', 'дела', 'дел')}`, 'success', '💾');
        render(); return;
      }
      if (g('#day-verdict')) { Verdict.open(); return; }
      if (g('#day-busy-add')) { busyDialog(); return; }
      if (g('#day-notify')) {
        try {
          Notification.requestPermission().then((r) => {
            if (r === 'granted') { State.s.notifications = true; State.commit(); UI.toast('Буду напоминать о блоках плана', 'success', '🔔'); }
            else UI.toast('Без разрешения напоминания будут только внутри приложения', 'warn', '🔕');
            render();
          });
        } catch (e) { UI.toast('Браузер не поддерживает уведомления', 'warn', '🔕'); }
        return;
      }
      const db = g('[data-delbusy]');
      if (db) { Track.removeBusy(db.dataset.delbusy); Planner.build({ keepDone: true }); render(); return; }
      if (g('#day-catchup')) {
        Planner.catchUp();
        Sound.sfx('success');
        UI.toast('Остаток дня пересобран под то время, что осталось', 'success', '🔁');
        render(); return;
      }
      if (g('#day-dropmiss')) {
        Planner.missed().forEach((b) => Planner.skip(b.id));
        UI.toast('Отпустили. Завтра новый день.', 'default', '🕊️');
        render(); return;
      }
      const w = g('[data-water]'); if (w) { Track.water(Number(w.dataset.water), true); Sound.sfx('pop'); patchCounters(); return; }
      const c = g('[data-coffee]'); if (c) { Track.coffee(Number(c.dataset.coffee), true); Sound.sfx('pop'); patchCounters(); return; }
      const wo = g('[data-workout]'); if (wo) { Track.workout(Number(wo.dataset.workout), true); Sound.sfx('check'); patchCounters(); return; }
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

  return { render, onEnter, onLeave, quick, settings, explain, closeDay };
})();
