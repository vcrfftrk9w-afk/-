'use strict';
/* =========================================================
   PLEDGE — «Обещание дня»: ровно три дела, выбранные утром.
   Психология: выбор из трёх вместо двадцати, публичное обязательство
   самому себе и один понятный финиш вместо бесконечного списка.
   ========================================================= */
Screens.pledge = (() => {
  const { $ } = UI;
  let bound = false;

  function p() {
    const s = State.s;
    if (!s.pledge) s.pledge = { date: null, items: [], rewarded: false };
    if (s.pledge.date !== State.todayKey()) {
      s.pledge = { date: null, items: [], rewarded: false };
    }
    return s.pledge;
  }

  const active = () => p().date === State.todayKey() && p().items.length > 0;

  /* ---------- кандидаты на сегодня ---------- */
  function candidates() {
    const s = State.s;
    const today = State.todayKey();
    const out = [];

    if (typeof Path !== 'undefined') {
      const n = Path.nextStep();
      if (n) out.push({ kind: 'path', ref: n.step.id, text: n.step.t, emoji: n.stage.emoji, tag: 'Шаг пути' });
    }

    const overdue = s.tasks.filter((t) => !t.done && t.due && t.due < today);
    overdue.slice(0, 3).forEach((t) => out.push({ kind: 'task', ref: t.id, text: t.title, emoji: '🔥', tag: 'Просрочено' }));

    s.tasks.filter((t) => !t.done && t.due === today).slice(0, 3)
      .forEach((t) => out.push({ kind: 'task', ref: t.id, text: t.title, emoji: '📅', tag: 'На сегодня' }));

    s.tasks.filter((t) => !t.done && (t.priority === 'boss' || t.priority === 'high') && !t.due).slice(0, 3)
      .forEach((t) => out.push({ kind: 'task', ref: t.id, text: t.title, emoji: '🔴', tag: 'Важное' }));

    s.habits.filter((h) => !h.history[today]).slice(0, 4)
      .forEach((h) => out.push({ kind: 'habit', ref: h.id, text: h.name, emoji: h.emoji || '🔁', tag: 'Привычка' }));

    const doneMin = s.dailyFocusMinutes[today] || 0;
    if (doneMin < (s.focusGoal || 60)) {
      out.push({ kind: 'focus', ref: 'focus', text: `Набрать ${s.focusGoal || 60} минут фокуса`, emoji: '⏱️', tag: 'Фокус' });
    }

    s.tasks.filter((t) => !t.done).slice(0, 6).forEach((t) => {
      if (!out.some((x) => x.kind === 'task' && x.ref === t.id)) {
        out.push({ kind: 'task', ref: t.id, text: t.title, emoji: '✅', tag: 'Задача' });
      }
    });

    // без дублей
    const seen = new Set();
    return out.filter((x) => { const k = x.kind + ':' + x.ref; if (seen.has(k)) return false; seen.add(k); return true; });
  }

  /* ---------- проверка выполнения ---------- */
  function isDone(item) {
    const s = State.s;
    const today = State.todayKey();
    if (item.kind === 'path') return typeof Path !== 'undefined' && Path.isDone(item.ref);
    if (item.kind === 'task') { const t = s.tasks.find((x) => x.id === item.ref); return !t || !!t.done; }
    if (item.kind === 'habit') { const h = s.habits.find((x) => x.id === item.ref); return !h || !!h.history[today]; }
    if (item.kind === 'focus') return (s.dailyFocusMinutes[today] || 0) >= (s.focusGoal || 60);
    return false;
  }

  const doneCount = () => p().items.filter(isDone).length;

  /* ---------- награда за сдержанное обещание ---------- */
  function checkKept() {
    const pl = p();
    if (!pl.items.length || pl.rewarded) return;
    if (doneCount() < pl.items.length) return;
    pl.rewarded = true;
    State.s.totals.pledgesKept = (State.s.totals.pledgesKept || 0) + 1;
    const xp = 80, coins = 90;
    State.addXP(xp, 'discipline');
    State.addCoins(coins);
    Sound.sfx('fanfare');
    FX.fireworks(5);
    UI.toast(`Обещание дня сдержано! +${xp} XP · +${coins} 🪙`, 'level', '🤝');
    State.commit();
  }

  /* ---------- выбор трёх дел ---------- */
  function openPicker() {
    const list = candidates();
    if (!list.length) {
      UI.toast('Сначала добавь хоть одну задачу или привычку', 'default', '🤔');
      return;
    }
    const chosen = new Set();
    const body = UI.sheet(`
      <h2>Обещание дня</h2>
      <p class="muted">Выбери ровно три дела. Не больше — три закрытых дела сегодня лучше, чем двадцать открытых.</p>
      <div class="pledge-pick" id="pledge-pick">
        ${list.slice(0, 14).map((c, i) => `
          <button class="pledge-opt" data-i="${i}">
            <span class="pledge-opt-emoji">${c.emoji}</span>
            <span class="pledge-opt-text"><b>${UI.esc(c.text)}</b><small>${UI.esc(c.tag)}</small></span>
            <span class="pledge-opt-check"></span>
          </button>`).join('')}
      </div>
      <button class="btn btn-primary btn-block" id="pledge-ok" disabled>Выбери 3 дела</button>`);

    const okBtn = body.querySelector('#pledge-ok');
    body.querySelector('#pledge-pick').addEventListener('click', (e) => {
      const b = e.target.closest('.pledge-opt');
      if (!b) return;
      const i = Number(b.dataset.i);
      if (chosen.has(i)) chosen.delete(i);
      else if (chosen.size >= 3) { Sound.sfx('deny'); UI.toast('Только три. В этом весь смысл.', 'default', '✋'); return; }
      else chosen.add(i);
      b.classList.toggle('picked', chosen.has(i));
      Sound.sfx('pop');
      okBtn.disabled = chosen.size !== 3;
      okBtn.textContent = chosen.size === 3 ? 'Обещаю сделать это сегодня' : `Выбрано ${chosen.size} из 3`;
    });
    okBtn.addEventListener('click', () => {
      const pl = State.s.pledge = { date: State.todayKey(), rewarded: false, items: [...chosen].map((i) => list[i]) };
      UI.closeModal('#sheet-modal');
      Sound.sfx('start');
      UI.toast('Обещание принято. Три дела — и день засчитан.', 'success', '🤝');
      State.commit();
    });
  }

  /* ---------- открыть дело ---------- */
  function openItem(item) {
    if (item.kind === 'path') { App.go('path'); setTimeout(() => Screens.path.openStep(item.ref), 200); return; }
    if (item.kind === 'task') { App.go('tasks'); return; }
    if (item.kind === 'habit') { App.go('habits'); return; }
    if (item.kind === 'focus') { App.go('adhd'); return; }
  }

  /* ---------- рендер карточки ---------- */
  function render() {
    const el = $('#pledge-body');
    if (!el) return;
    const pl = p();

    if (!active()) {
      el.innerHTML = `
        <p class="muted small">Три дела. Не двадцать. Выбери их один раз утром — и весь день не надо решать, за что взяться.</p>
        <button class="btn btn-primary btn-block" id="pledge-start">Дать обещание на сегодня</button>`;
      const b = $('#pledge-start');
      if (b) b.onclick = openPicker;
      return;
    }

    const done = doneCount();
    const all = pl.items.length;
    el.innerHTML = `
      <div class="pledge-head">
        <div class="pledge-ring">
          <svg viewBox="0 0 44 44"><circle class="pr-bg" cx="22" cy="22" r="18"/><circle class="pr-fg" cx="22" cy="22" r="18"
            stroke-dasharray="${2 * Math.PI * 18}" stroke-dashoffset="${2 * Math.PI * 18 * (1 - done / all)}"/></svg>
          <b>${done}/${all}</b>
        </div>
        <div class="pledge-head-text">${done === all ? 'Обещание сдержано. День засчитан.' : (done === 0 ? 'Обещание дано. Осталось сделать.' : `Ещё ${all - done} — и день закрыт.`)}</div>
      </div>
      <ul class="pledge-list">
        ${pl.items.map((it, i) => `
          <li class="pledge-item ${isDone(it) ? 'done' : ''}">
            <span class="pledge-num">${isDone(it) ? '✓' : i + 1}</span>
            <button class="pledge-text" data-i="${i}">${UI.esc(it.text)}</button>
          </li>`).join('')}
      </ul>
      ${done === all ? '' : '<button class="linkbtn" id="pledge-reset">переиграть обещание</button>'}`;

    el.querySelectorAll('.pledge-text').forEach((b) => {
      b.onclick = () => openItem(pl.items[Number(b.dataset.i)]);
    });
    const rs = $('#pledge-reset');
    if (rs) rs.onclick = openPicker;
    checkKept();
  }

  return { render, openPicker, active, doneCount, checkKept };
})();
