'use strict';
/* =========================================================
   SCREENS PATH — экран «Путь к деньгам»
   ========================================================= */
Screens.path = (() => {
  const { $, $$ } = UI;
  let openStage = null;
  let bound = false;

  const ACT_LABEL = {
    money: { icon: 'coin', text: 'Заполнить трекер' },
    task: { icon: 'plus', text: 'Добавить в задачи' },
    habit: { icon: 'habits', text: 'Сделать привычкой' },
    goal: { icon: 'goals', text: 'Создать цель' },
    focus: { icon: 'timer', text: 'Включить фокус' },
    lesson: { icon: 'lessons', text: 'Открыть курс' },
  };

  /* ---------- шапка пути ---------- */
  function heroHTML() {
    const idx = Path.currentIndex();
    const st = Path.STAGES[idx];
    const pct = Path.progressPct();
    const done = Path.doneCount();
    return `
      <div class="card path-hero tilt">
        <div class="path-hero-top">
          <div class="path-hero-emoji">${st.emoji}</div>
          <div class="path-hero-text">
            <small>Этап ${idx + 1} из ${Path.STAGES.length}</small>
            <h3>${UI.esc(st.name)}</h3>
            <p>${UI.esc(st.tagline)}</p>
          </div>
          <div class="path-hero-pct"><b>${pct}%</b><small>пути</small></div>
        </div>
        <div class="path-bar"><span style="width:${pct}%"></span></div>
        <div class="path-hero-meta">
          <span>${done} из ${Path.STEP_COUNT} шагов сделано</span>
          <span>${UI.esc(st.time)}</span>
        </div>
        <div class="path-stepper">
          ${Path.STAGES.map((x, i) => {
            const cls = Path.stageComplete(x) ? 'done' : (i === idx ? 'now' : (Path.stageOpen(i) ? '' : 'locked'));
            return `<button class="path-dot ${cls}" data-jump="${x.id}" title="${UI.esc(x.name)}">
              <span>${x.emoji}</span><em>${UI.esc(x.name)}</em></button>`;
          }).join('<i class="path-line"></i>')}
        </div>
      </div>`;
  }

  /* ---------- следующий шаг ---------- */
  function nextHTML() {
    const n = Path.nextStep();
    if (!n) {
      return `<div class="card path-next done-all">
        <h3>🏁 Весь путь пройден</h3>
        <p>Ты прошёл все 35 шагов. Дальше — только масштаб. Перечитай этапы, подними цифры в трекере и поставь новую цель.</p>
      </div>`;
    }
    const { stage, step } = n;
    const actKey = step.act && ACT_LABEL[step.act] ? step.act : null;
    return `
      <div class="card path-next">
        <div class="path-next-tag">${stage.emoji} ${UI.esc(stage.name)} · следующий шаг</div>
        <h3>${UI.esc(step.t)}</h3>
        <div class="path-why"><b>Зачем.</b> ${UI.esc(step.why)}</div>
        <div class="path-how">
          <b>Как сделать</b>
          <ol>${step.how.map((h) => `<li>${UI.esc(h)}</li>`).join('')}</ol>
        </div>
        ${State.s.mode === 'adhd' ? `
          <div class="path-micro">
            <b>⚡ Слишком много? Начни с этого</b>
            <p>${UI.esc(step.how[0])}</p>
            <button class="btn btn-accent btn-sm" data-micro="${step.id}">5 минут на это</button>
          </div>` : ''}
        <div class="path-reward">+${step.xp} XP · +${step.coins} 🪙</div>
        <div class="path-next-actions">
          <button class="btn btn-primary" data-done="${step.id}">${Icons.get('check', { size: 18 })} Сделал</button>
          ${actKey ? `<button class="btn btn-ghost" data-act="${step.act}" data-step="${step.id}">${Icons.get(ACT_LABEL[actKey].icon, { size: 18 })} ${ACT_LABEL[actKey].text}</button>` : ''}
        </div>
      </div>`;
  }

  /* ---------- трекер денег ---------- */
  function moneyOutHTML(c) {
    const fmt = (v) => UI.fmt(Math.round(v));
    const cushionPct = Math.min(100, c.cushionMonths * 100);
    return `
        <div class="money-out">
          <div class="money-stat"><small>Свободный остаток</small><b>${fmt(c.free)}</b><em>${c.savingRate}% от дохода</em></div>
          <div class="money-stat"><small>Подушка</small><b>${(Math.round(c.cushionMonths * 10) / 10)} мес.</b><em>цель — 1 месяц</em></div>
          <div class="money-stat"><small>Пассив сейчас</small><b>${fmt(c.passiveNow)}/мес</b><em>${Math.round(c.freedomPct)}% расходов</em></div>
          <div class="money-stat"><small>Цифра свободы</small><b>${fmt(c.freedomNumber)}</b><em>${c.yearsToFreedom !== null ? `≈ ${years(c.yearsToFreedom)} при текущем темпе` : 'нужен положительный остаток'}</em></div>
        </div>
        <div class="money-bars">
          <div class="money-bar"><span>Подушка</span><i><b style="width:${cushionPct}%"></b></i></div>
          <div class="money-bar"><span>Свобода</span><i><b class="alt" style="width:${c.freedomPct}%"></b></i></div>
        </div>
        ${c.free <= 0 && c.income > 0 ? `<div class="money-warn">Расходы съедают весь доход. Пока остаток не станет плюсовым, дальше по пути идти бессмысленно — вернись к этапу «Фундамент».</div>` : ''}`;
  }

  function moneyHTML() {
    const c = Path.calc();
    return `
      <div class="card path-money">
        <div class="panel-header"><h3>Трекер денег</h3><span class="badge">реальные деньги</span></div>
        <p class="muted small">Это не монеты из игры. Впиши свои настоящие цифры — приложение посчитает, где ты и сколько осталось.</p>
        <div class="money-grid">
          <label class="money-field"><span>Доход в месяц</span><input type="number" min="0" id="m-income" value="${c.income}" inputmode="numeric"></label>
          <label class="money-field"><span>Расходы в месяц</span><input type="number" min="0" id="m-expenses" value="${c.expenses}" inputmode="numeric"></label>
          <label class="money-field"><span>Подушка (накоплено)</span><input type="number" min="0" id="m-cushion" value="${c.cushion}" inputmode="numeric"></label>
          <label class="money-field"><span>Капитал / инвестиции</span><input type="number" min="0" id="m-capital" value="${c.capital}" inputmode="numeric"></label>
        </div>
        <button class="btn btn-primary btn-block" id="m-save">Пересчитать</button>
        <div id="money-out-wrap">${moneyOutHTML(Path.calc())}</div>
      </div>`;
  }


  /* ---------- «что если» ---------- */
  const WI = { extraIncome: 0, cutExpenses: 0 };

  /* по-русски: 1 год, 2 года, 5 лет, но дробное — всегда «года» (1,3 года) */
  function years(n) {
    const v = Math.round(n * 10) / 10;
    return Number.isInteger(v) ? `${v} ${UI.plural(v, 'год', 'года', 'лет')}` : `${v} года`;
  }

  function whatIfOutHTML() {
    const pr = Path.project(WI);
    const m = Path.money();
    const fmt = (v) => UI.fmt(Math.round(v));
    if (!m.income && !m.expenses) {
      return `<p class="muted small">Заполни доход и расходы выше — и приложение посчитает, через сколько лет ты станешь миллионером и когда сможешь не работать.</p>`;
    }
    const line = (label, now, base) => {
      const diff = (base !== null && now !== null) ? Math.round((base - now) * 10) / 10 : null;
      return `<div class="wi-row">
        <span>${label}</span>
        <b>${now === null ? 'никогда при таком темпе' : years(now)}</b>
        ${diff && diff > 0 ? `<em class="wi-gain">−${years(diff)}</em>` : ''}
      </div>`;
    };
    return `
      <div class="wi-out">
        ${line('Первый миллион', pr.millionYears, pr.baseMillionYears)}
        ${line('Свобода (пассив покрывает жизнь)', pr.freedomYears, pr.baseFreedomYears)}
        <div class="wi-row muted"><span>Откладываешь в месяц</span><b>${fmt(pr.perMonth)}</b></div>
      </div>`;
  }

  function whatIfHTML() {
    return `
      <div class="card path-whatif">
        <div class="panel-header"><h3>Что если</h3><span class="badge">твои цифры</span></div>
        <p class="muted small">Подвигай ползунки и посмотри, что делает с твоей жизнью лишняя тысяча в месяц. Это тот же расчёт, что и выше, только с другим тобой.</p>
        <label class="wi-slider">
          <span>Дополнительный доход <b id="wi-inc-val">${UI.fmt(WI.extraIncome)}</b> в месяц</span>
          <input type="range" id="wi-inc" min="0" max="100000" step="1000" value="${WI.extraIncome}">
        </label>
        <label class="wi-slider">
          <span>Урезать расходы на <b id="wi-cut-val">${UI.fmt(WI.cutExpenses)}</b> в месяц</span>
          <input type="range" id="wi-cut" min="0" max="50000" step="500" value="${WI.cutExpenses}">
        </label>
        <div id="wi-out-wrap">${whatIfOutHTML()}</div>
      </div>`;
  }

  /* ---------- список этапов ---------- */
  function stagesHTML() {
    const cur = Path.currentIndex();
    return `<div class="path-stages">${Path.STAGES.map((st, i) => {
      const open = Path.stageOpen(i);
      const complete = Path.stageComplete(st);
      const expanded = openStage === st.id || (openStage === null && i === cur);
      const d = Path.stageDone(st);
      return `
        <div class="card path-stage ${complete ? 'complete' : ''} ${open ? '' : 'locked'} ${expanded ? 'expanded' : ''}" data-stage="${st.id}">
          <button class="path-stage-head" data-toggle="${st.id}">
            <span class="path-stage-emoji">${open ? st.emoji : '🔒'}</span>
            <span class="path-stage-title">
              <b>${i + 1}. ${UI.esc(st.name)}</b>
              <small>${UI.esc(st.tagline)}</small>
            </span>
            <span class="path-stage-count">${d}/${st.steps.length}</span>
          </button>
          <div class="path-stage-body">
            <div class="path-goal"><b>Результат этапа.</b> ${UI.esc(st.goal)} <i>· ${UI.esc(st.time)}</i></div>
            ${open && st.traps && st.traps.length ? `
              <div class="path-traps">
                <b>На чём здесь спотыкаются</b>
                <ul>${st.traps.map((t) => `<li>${UI.esc(t)}</li>`).join('')}</ul>
              </div>` : ''}
            ${open && st.lessons && st.lessons.length ? `
              <div class="path-reading">
                <b>Почитать на этом этапе</b>
                <div class="path-reading-list">
                  ${st.lessons.map((lid) => {
                    const l = Data.LESSONS.find((x) => x.id === lid);
                    if (!l) return '';
                    const read = !!State.s.lessons.read[lid];
                    return `<button class="path-lesson ${read ? 'read' : ''}" data-lesson="${lid}">
                      <span>${l.emoji}</span><em>${UI.esc(l.title)}</em>${read ? '<i>прочитано</i>' : ''}</button>`;
                  }).join('')}
                </div>
              </div>` : ''}
            ${!open ? `<div class="path-locked-note">Откроется, когда закроешь этап «${UI.esc(Path.STAGES[i - 1].name)}».</div>` : `
            <ul class="path-steps">
              ${st.steps.map((step, j) => {
                const isD = Path.isDone(step.id);
                const actKey = step.act && ACT_LABEL[step.act] ? step.act : null;
                return `
                <li class="path-step ${isD ? 'done' : ''}">
                  <button class="path-check" data-done="${step.id}" aria-label="Отметить шаг">${isD ? Icons.get('check', { size: 16 }) : `<i>${j + 1}</i>`}</button>
                  <div class="path-step-body">
                    <button class="path-step-title" data-open="${step.id}">${UI.esc(step.t)}</button>
                    <div class="path-step-meta">+${step.xp} XP · +${step.coins} 🪙${actKey ? ` · <button class="linkbtn" data-act="${step.act}" data-step="${step.id}">${ACT_LABEL[actKey].text}</button>` : ''}</div>
                  </div>
                </li>`;
              }).join('')}
            </ul>`}
          </div>
        </div>`;
    }).join('')}</div>`;
  }

  /* ---------- подробная карточка шага ---------- */
  function openStep(id) {
    const step = Path.ALL.find((x) => x.id === id);
    if (!step) return;
    const st = Path.STAGES.find((x) => x.id === step.stage);
    const isD = Path.isDone(id);
    const actKey = step.act && ACT_LABEL[step.act] ? step.act : null;
    const body = UI.sheet(`
      <div class="path-modal">
        <div class="path-next-tag">${st.emoji} ${UI.esc(st.name)}</div>
        <h2>${UI.esc(step.t)}</h2>
        <div class="path-why"><b>Зачем.</b> ${UI.esc(step.why)}</div>
        <div class="path-how"><b>Как сделать</b><ol>${step.how.map((h) => `<li>${UI.esc(h)}</li>`).join('')}</ol></div>
        <div class="path-reward">+${step.xp} XP · +${step.coins} 🪙</div>
        <div class="path-next-actions">
          <button class="btn ${isD ? 'btn-ghost' : 'btn-primary'}" data-done="${step.id}">${isD ? 'Снять отметку' : 'Сделал'}</button>
          ${actKey ? `<button class="btn btn-ghost" data-act="${step.act}" data-step="${step.id}">${ACT_LABEL[actKey].text}</button>` : ''}
        </div>
      </div>`);
    body.addEventListener('click', (e) => {
      const d = e.target.closest('[data-done]');
      const a = e.target.closest('[data-act]');
      if (d) { UI.closeModal('#sheet-modal'); markDone(d.dataset.done); }
      else if (a) { UI.closeModal('#sheet-modal'); runAct(a.dataset.act, a.dataset.step); }
    });
  }

  /* ---------- отметка шага ---------- */
  function markDone(id) {
    const step = Path.ALL.find((x) => x.id === id);
    const was = Path.isDone(id);
    const now = Path.toggle(id);
    if (now && step) {
      Sound.sfx('success');
      FX.confetti(window.innerWidth / 2, window.innerHeight * 0.3, 40);
      UI.toast(`Шаг пути: +${step.xp} XP`, 'xp', '🧭');
    } else if (was) {
      UI.toast('Шаг снят', 'info', '↩️');
    }
  }

  /* ---------- действия шага ---------- */
  function runAct(act, stepId) {
    const step = Path.ALL.find((x) => x.id === stepId);
    if (!step) return;
    if (act === 'money') {
      App.go('path');
      const el = $('#m-income');
      if (el) { el.scrollIntoView({ block: 'center', behavior: State.s.reduceMotion ? 'auto' : 'smooth' }); el.focus(); }
      return;
    }
    if (act === 'task') {
      const pr = Data.priorityById('high') || Data.PRIORITIES[2];
      State.s.tasks.unshift({
        id: State.uid(), title: step.t, category: 'money', priority: pr.id, xp: pr.xp, skill: 'money',
        urgent: false, done: false, rewarded: false, createdAt: Date.now(), doneAt: null,
        goalId: null, due: null, repeat: null,
        subtasks: step.how.map((h) => ({ id: State.uid(), text: h, done: false })),
        fromPath: step.id,
      });
      State.commit();
      UI.toast('Шаг добавлен в задачи вместе с чек-листом', 'ok', '✅');
      Sound.sfx('click');
      return;
    }
    if (act === 'habit') {
      State.s.habits.unshift({ id: State.uid(), name: step.t, emoji: '💰', skill: 'money', history: {}, rewarded: {}, createdAt: Date.now() });
      State.commit();
      UI.toast('Привычка создана — отмечай каждый день', 'ok', '🔥');
      return;
    }
    if (act === 'goal') {
      State.s.goals.unshift({
        id: State.uid(), title: step.t, emoji: '🎯', deadline: null, done: false, createdAt: Date.now(),
        milestones: step.how.map((h) => ({ id: State.uid(), text: h, done: false })),
      });
      State.commit();
      UI.toast('Цель создана с вехами', 'ok', '🎯');
      return;
    }
    if (act === 'focus') { App.go('adhd'); return; }
    if (act === 'lesson') { App.go('lessons'); return; }
  }

  /* ---------- рендер ---------- */
  function render() {
    const root = $('#path-root');
    if (!root) return;
    const badge = $('#path-progress');
    if (badge) badge.textContent = `${Path.doneCount()} / ${Path.STEP_COUNT}`;
    root.innerHTML = heroHTML() + nextHTML() + moneyHTML() + whatIfHTML() + stagesHTML();
    UI.initTilt();
    if (!bound) bindRoot(root);
  }

  function bindRoot(root) {
    bound = true;
    root.addEventListener('input', (e) => {
      if (e.target.matches('#wi-inc, #wi-cut')) {
        WI.extraIncome = Number($('#wi-inc').value) || 0;
        WI.cutExpenses = Number($('#wi-cut').value) || 0;
        $('#wi-inc-val').textContent = UI.fmt(WI.extraIncome);
        $('#wi-cut-val').textContent = UI.fmt(WI.cutExpenses);
        $('#wi-out-wrap').innerHTML = whatIfOutHTML();
        return;
      }
      if (!e.target.matches('#m-income, #m-expenses, #m-cushion, #m-capital')) return;
      Path.setMoney({
        income: $('#m-income').value, expenses: $('#m-expenses').value,
        cushion: $('#m-cushion').value, capital: $('#m-capital').value,
      }, true);
      const wrap = $('#money-out-wrap');
      if (wrap) wrap.innerHTML = moneyOutHTML(Path.calc());
      const wi = $('#wi-out-wrap');
      if (wi) wi.innerHTML = whatIfOutHTML();
    });
    root.addEventListener('click', (e) => {
      const jump = e.target.closest('[data-jump]');
      const toggleBtn = e.target.closest('[data-toggle]');
      const doneBtn = e.target.closest('[data-done]');
      const openBtn = e.target.closest('[data-open]');
      const actBtn = e.target.closest('[data-act]');
      const lessonBtn = e.target.closest('[data-lesson]');
      const microBtn = e.target.closest('[data-micro]');
      const save = e.target.closest('#m-save');

      if (save) {
        Path.setMoney({
          income: $('#m-income').value, expenses: $('#m-expenses').value,
          cushion: $('#m-cushion').value, capital: $('#m-capital').value,
        });
        Sound.sfx('coin');
        UI.toast('Цифры сохранены', 'success', '🧮');
        return;
      }
      if (jump) { openStage = jump.dataset.jump; render(); const el = root.querySelector(`[data-stage="${jump.dataset.jump}"]`); if (el) el.scrollIntoView({ block: 'center', behavior: State.s.reduceMotion ? 'auto' : 'smooth' }); return; }
      if (toggleBtn) { openStage = (openStage === toggleBtn.dataset.toggle) ? '' : toggleBtn.dataset.toggle; render(); return; }
      if (doneBtn) { markDone(doneBtn.dataset.done); return; }
      if (openBtn) { openStep(openBtn.dataset.open); return; }
      if (actBtn) { runAct(actBtn.dataset.act, actBtn.dataset.step); return; }
      if (microBtn) {
        const st = Path.ALL.find((x) => x.id === microBtn.dataset.micro);
        App.go('adhd');
        setTimeout(() => Screens.focus.quickStart(5, st ? st.how[0] : ''), 250);
        return;
      }
      if (lessonBtn) { App.go('lessons'); setTimeout(() => Screens.lessons.openById(lessonBtn.dataset.lesson), 220); return; }
    });
  }

  return { render, openStep, markDone };
})();
