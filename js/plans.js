'use strict';
/* =========================================================
   PLANS — свои дела с будильником в «Моих делах».

   Дело — название и время на каждый выбранный день недели:
   «Тренировка» в понедельник в 07:00, во вторник в 10:00.
   В свой день дело стоит в списке со временем, а в APK для Android
   в это время звонит будильник (см. Remind.phoneAlarms).
   Если назвать дело как задание уровня («Тренировка», «Английский»),
   отдельной строки нет — время и будильник встают к самому заданию.
   Дела лежат в State.s.plans и через аккаунт общие на всех телефонах.
   ========================================================= */

const Plans = (() => {
  const ORDER = [1, 2, 3, 4, 5, 6, 0];
  const RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const IDEAS = [['💪', 'Тренировка'], ['🇬🇧', 'Английский'], ['▶️', 'YouTube'], ['🏃', 'Пробежка'], ['📚', 'Учёба'], ['🧹', 'Уборка']];

  const list = () => (Array.isArray(State.s.plans) ? State.s.plans : (State.s.plans = []));
  const doneMap = () => State.s.plansDone || (State.s.plansDone = {});
  const today = () => State.todayKey();
  const dowNow = () => new Date().getDay();
  const timeOn = (p, dow) => (p.times && p.times[dow] != null ? Number(p.times[dow]) : null);
  const toMin = (v) => { const m = /^(\d{1,2}):(\d{2})/.exec(v || ''); return m ? Math.min(23, +m[1]) * 60 + Math.min(59, +m[2]) : null; };

  /* задание уровня с таким же названием — к нему и привязываем */
  function questFor(title) {
    if (typeof Levels === 'undefined') return null;
    const t = String(title || '').trim().toLowerCase();
    const id = Object.keys(Levels.QUESTS).find((k) => !Levels.QUESTS[k].at && Levels.QUESTS[k].title(0).toLowerCase() === t);
    return id || null;
  }

  /* время задания уровня на сегодня, если его поставили в своём деле */
  function questTime(id, dow) {
    const d = dow == null ? dowNow() : dow;
    const p = list().find((x) => x.quest === id && linked(x) && timeOn(x, d) != null);
    return p ? timeOn(p, d) : null;
  }

  /* к заданию уровня дело привязано, только пока это задание открыто — иначе оно своей строкой */
  const linked = (p) => !!(p.quest && typeof Levels !== 'undefined'
    && Levels.questsAt(Levels.levelOn(today())).includes(p.quest));

  const isDone = (p, k) => (linked(p)
    ? Levels.isDone(p.quest, k || today())
    : (doneMap()[k || today()] || []).includes(p.id));

  /* сегодняшние свои дела (без привязанных к заданиям уровня — они и так в списке) */
  const todayItems = () => list()
    .filter((p) => !linked(p) && timeOn(p, dowNow()) != null)
    .sort((a, b) => timeOn(a, dowNow()) - timeOn(b, dowNow()));

  function schedule(p) {
    const days = ORDER.filter((d) => timeOn(p, d) != null);
    if (!days.length) return 'дни не выбраны';
    const times = new Set(days.map((d) => timeOn(p, d)));
    if (times.size === 1) {
      const lbl = days.length === 7 ? 'каждый день' : days.join() === '1,2,3,4,5' ? 'Пн–Пт' : days.map((d) => RU[d]).join(', ');
      return `${lbl} в ${Track.hhmm([...times][0])}`;
    }
    return days.map((d) => `${RU[d]} ${Track.hhmm(timeOn(p, d))}`).join(' · ');
  }

  function toggle(p, el) {
    const k = today();
    const m = doneMap();
    const arr = m[k] || (m[k] = []);
    if (arr.includes(p.id)) { m[k] = arr.filter((x) => x !== p.id); State.commit(); return; }
    arr.push(p.id);
    State.addXP(10);
    Sound.sfx('success');
    FX.confettiFrom(el || document.body, 24);
    // записи старше двух месяцев не храним
    const cut = State.daysAgoKey(60);
    Object.keys(m).filter((d) => d < cut).forEach((d) => delete m[d]);
    State.commit();
  }

  /* ---------- блок в «Моих делах» ---------- */
  function section() {
    const now = Track.nowMin();
    const dow = dowNow();
    const items = todayItems();
    const rows = items.map((p) => {
      const at = timeOn(p, dow);
      const d = isDone(p);
      return `
        <li class="mt-row ${d ? 'done' : ''} ${!d && now >= at - 15 && now <= at + 10 ? 'now' : ''}">
          <button class="mt-main" data-plan-edit="${p.id}"><small class="mt-time">${Track.hhmm(at)}${p.alarm !== false ? ' · ⏰' : ''}${d ? ' · сделано' : !d && now > at + 10 ? ' · время прошло — сделай сейчас' : ''}</small><b>${UI.esc(p.emoji || '📌')} ${UI.esc(p.title)}</b></button>
          ${d ? `<button class="mt-ok" data-plan-done="${p.id}" aria-label="Снять отметку">✓</button>`
            : `<button class="mt-check" data-plan-done="${p.id}" aria-label="Отметить сделанным: ${UI.esc(p.title)}"></button>`}
        </li>`;
    }).join('');
    const all = list();
    return `
      <div class="plans">
        <h4 class="my-sec">📌 Мои дела${items.length ? ` · ${items.filter((p) => isDone(p)).length} из ${items.length}` : ''}</h4>
        ${items.length ? `<ul class="mt-list">${rows}</ul>` : all.length ? '<p class="muted small plans-empty">Сегодня своих дел нет.</p>' : ''}
        <button class="btn btn-ghost btn-block plans-add" data-plan-new>＋ Своё дело с будильником</button>
        ${all.length ? `
          <details class="plans-all">
            <summary>Все мои дела (${all.length})</summary>
            <ul>${all.map((p) => `<li><button data-plan-edit="${p.id}"><b>${UI.esc(p.emoji || '📌')} ${UI.esc(p.title)}</b><small>${p.alarm !== false ? '⏰ ' : ''}${UI.esc(schedule(p))}${linked(p) ? ' · к заданию уровня' : ''}</small></button></li>`).join('')}</ul>
          </details>` : ''}
      </div>`;
  }

  function bind(root) {
    root.querySelectorAll('[data-plan-new]').forEach((b) => { b.onclick = () => editor(null); });
    root.querySelectorAll('[data-plan-edit]').forEach((b) => {
      b.onclick = () => { const p = list().find((x) => String(x.id) === b.dataset.planEdit); if (p) editor(p); };
    });
    root.querySelectorAll('[data-plan-done]').forEach((b) => {
      b.onclick = () => { const p = list().find((x) => String(x.id) === b.dataset.planDone); if (p) toggle(p, b); };
    });
  }

  /* ---------- редактор: название, дни, время на каждый день, будильник ---------- */
  function editor(orig) {
    const phone = !!(window.AndroidApp && window.AndroidApp.setAlarms);
    const d = orig ? JSON.parse(JSON.stringify(orig)) : { title: '', emoji: '📌', times: {}, alarm: true };
    let last = 7 * 60; // время по умолчанию для нового дня — последнее введённое
    ORDER.forEach((x) => { if (timeOn(d, x) != null) last = timeOn(d, x); });

    const readForm = (body) => {
      d.title = body.querySelector('#pl-title').value.trim();
      body.querySelectorAll('[data-pl-time]').forEach((inp) => {
        const m = toMin(inp.value);
        if (m != null) { d.times[inp.dataset.plTime] = m; last = m; }
      });
      d.alarm = body.querySelector('#pl-alarm').checked;
    };

    const render = () => {
      const levelQuests = typeof Levels !== 'undefined'
        ? Levels.questsAt(Levels.levelOn(today())).filter((id) => !Levels.QUESTS[id].at).map((id) => [Levels.QUESTS[id].emoji, Levels.QUESTS[id].title(0)])
        : [];
      const ideas = levelQuests.concat(IDEAS.filter(([, t]) => !levelQuests.some(([, q]) => q === t)));
      const body = UI.sheet(`
        <div class="plan-ed">
          <h2>${orig ? '✏️ Дело' : '＋ Своё дело'}</h2>
          <label class="field"><span>Название</span>
            <input id="pl-title" type="text" maxlength="40" placeholder="Например, Тренировка" value="${UI.esc(d.title)}" autocomplete="off">
          </label>
          <div class="plan-ideas">${ideas.map(([e, t]) => `<button type="button" class="chip" data-pl-idea="${UI.esc(t)}" data-pl-emoji="${e}">${e} ${UI.esc(t)}</button>`).join('')}</div>
          <p class="muted small">Дни и время — у каждого дня своё:</p>
          <div class="plan-days">
            ${ORDER.map((x) => {
              const on = timeOn(d, x) != null;
              return `<div class="plan-day ${on ? 'on' : ''}">
                <button type="button" class="seg-btn ${on ? 'sel' : ''}" data-pl-day="${x}" aria-pressed="${on}">${RU[x]}</button>
                ${on ? `<input type="time" data-pl-time="${x}" value="${Track.hhmm(timeOn(d, x))}" aria-label="Время, ${RU[x]}">` : '<span class="muted small">выходной</span>'}
              </div>`;
            }).join('')}
          </div>
          <button type="button" class="btn btn-ghost btn-block" id="pl-same">Всем выбранным дням — время как у первого</button>
          <label class="remind-sw"><input type="checkbox" id="pl-alarm" ${d.alarm !== false ? 'checked' : ''}><span>⏰ Будильник в это время${phone ? '' : ' <small class="muted">(звонит в приложении на Android)</small>'}</span></label>
          <p class="acc-err" id="pl-err" role="alert"></p>
          <div class="remind-new-btns">
            <button type="button" class="btn btn-primary" id="pl-save">Сохранить</button>
            <button type="button" class="btn btn-ghost" id="pl-cancel">Отмена</button>
          </div>
          ${orig ? '<button type="button" class="btn btn-ghost btn-block plan-del" id="pl-del">🗑 Удалить дело</button>' : ''}
        </div>`);

      body.onclick = (e) => {
        const idea = e.target.closest('[data-pl-idea]');
        if (idea) { readForm(body); d.title = idea.dataset.plIdea; d.emoji = idea.dataset.plEmoji; render(); return; }
        const day = e.target.closest('[data-pl-day]');
        if (day) {
          readForm(body);
          const x = day.dataset.plDay;
          if (d.times[x] != null) delete d.times[x]; else d.times[x] = last;
          render(); return;
        }
        if (e.target.closest('#pl-same')) {
          readForm(body);
          const first = ORDER.find((x) => d.times[x] != null);
          if (first != null) ORDER.forEach((x) => { if (d.times[x] != null) d.times[x] = d.times[first]; });
          render(); return;
        }
        if (e.target.closest('#pl-cancel')) { UI.closeModal('#sheet-modal'); return; }
        if (e.target.closest('#pl-del')) {
          State.s.plans = list().filter((x) => x.id !== orig.id);
          State.commit();
          after('Дело удалено', '🗑');
          return;
        }
        if (e.target.closest('#pl-save')) {
          readForm(body);
          const err = body.querySelector('#pl-err');
          if (!d.title) { err.textContent = 'Напиши, что за дело.'; return; }
          if (!Object.keys(d.times).length) { err.textContent = 'Выбери хотя бы один день.'; return; }
          d.quest = questFor(d.title);
          if (!d.emoji || d.emoji === '📌') {
            const hit = ideas.find(([, t]) => t.toLowerCase() === d.title.toLowerCase());
            d.emoji = hit ? hit[0] : '📌';
          }
          if (orig) Object.assign(list().find((x) => x.id === orig.id) || {}, d);
          else list().push(Object.assign({ id: Date.now() }, d));
          State.commit();
          after(`${d.emoji} ${d.title}: ${schedule(d)}${d.alarm !== false && phone ? ' · будильник поставлен' : ''}`, '📌');
        }
      };
    };

    const after = (msg, icon) => {
      UI.closeModal('#sheet-modal');
      if (typeof Remind !== 'undefined') Remind.syncAlarms();
      Sound.sfx('success');
      UI.toast(msg, 'success', icon);
      if (typeof App !== 'undefined') App.renderActive();
    };

    render();
  }

  /* будильники для APK: каждое дело с будильником — в каждый свой день */
  function alarms() {
    const out = [];
    list().filter((p) => p.alarm !== false).forEach((p) => {
      ORDER.forEach((dow) => {
        const min = timeOn(p, dow);
        if (min != null) out.push({ dow, min, title: `${p.emoji || '📌'} ${p.title}`, text: 'Пора! Нажми «Начинаю» — и сразу за дело.' });
      });
    });
    return out;
  }

  return { section, bind, editor, alarms, questTime, schedule, list };
})();
