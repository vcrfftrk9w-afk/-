'use strict';
/* =========================================================
   SCREENS META — курс, империя, награды, статистика
   ========================================================= */

/* =========================================================
   КУРС
   ========================================================= */
Screens.lessons = (() => {
  const { $ } = UI;

  function openLesson(lesson) {
    const s = State.s;
    const isRead = !!s.lessons.read[lesson.id];
    const body = UI.sheet(`
      <div class="lesson-view">
        <div class="lesson-emoji">${lesson.emoji}</div>
        <h2>${UI.esc(lesson.title)}</h2>
        <div class="lesson-body">${lesson.body.map((p) => `<p>${UI.esc(p)}</p>`).join('')}</div>
        <div class="lesson-action">
          <b>🎯 Действие дня</b>
          <p>${UI.esc(lesson.action)}</p>
          <button class="btn btn-ghost btn-sm" data-act="to-task">Добавить в задачи</button>
        </div>
        <button class="btn btn-primary btn-lg btn-block" data-act="read">${isRead ? 'Урок пройден ✓' : 'Прочитал — засчитать (+25 XP)'}</button>
      </div>`, { wide: true });

    body.querySelector('[data-act="to-task"]').addEventListener('click', () => {
      Screens.tasks.add(lesson.action, 'study', 'mid', false);
      UI.toast('Действие добавлено в задачи', 'success', '✅');
    });

    const readBtn = body.querySelector('[data-act="read"]');
    if (isRead) readBtn.disabled = true;
    readBtn.addEventListener('click', (e) => {
      if (s.lessons.read[lesson.id]) return;
      s.lessons.read[lesson.id] = Date.now();
      s.totals.lessonsRead += 1;
      State.addXP(25, 'mind');
      State.addCoins(20);
      State.registerActivity();
      State.bumpQuest('lessons', 1);
      Sound.sfx('success');
      FX.confettiFrom(e.currentTarget, 40);
      UI.toast('Урок засчитан! +25 XP', 'success', '📚');
      e.currentTarget.disabled = true;
      e.currentTarget.textContent = 'Урок пройден ✓';
      State.commit();
    });
  }

  function render() {
    const s = State.s;
    const root = $('#track-list');
    root.innerHTML = '';

    Data.TRACKS.forEach((track) => {
      const lessons = Data.LESSONS.filter((l) => l.track === track.id);
      const read = lessons.filter((l) => s.lessons.read[l.id]).length;
      const pct = (read / lessons.length) * 100;

      const section = UI.node('section', 'track');
      section.innerHTML = `
        <div class="track-head">
          <span class="track-emoji">${track.emoji}</span>
          <div class="grow">
            <h3>${UI.esc(track.name)}</h3>
            <p class="muted small">${UI.esc(track.desc)}</p>
          </div>
          <span class="badge">${read}/${lessons.length}</span>
        </div>
        <div class="track-progress"><i style="width:${pct}%"></i></div>
        <div class="lesson-grid"></div>`;

      const grid = section.querySelector('.lesson-grid');
      lessons.forEach((l, i) => {
        const done = !!s.lessons.read[l.id];
        const card = UI.node('button', `lesson-card${done ? ' read' : ''}`);
        card.innerHTML = `
          <span class="lesson-num">${i + 1}</span>
          <span class="lesson-card-emoji">${l.emoji}</span>
          <span class="lesson-title">${UI.esc(l.title)}</span>
          <span class="lesson-status">${done ? '✓ пройден' : 'читать →'}</span>`;
        card.addEventListener('click', () => openLesson(l));
        grid.appendChild(card);
      });
      root.appendChild(section);
    });

    const total = Data.LESSONS.length;
    const read = Object.keys(s.lessons.read).length;
    $('#lesson-progress').textContent = `${read} / ${total}`;
  }

  return { render, bind: () => {}, openById: (id) => { const l = Data.lessonById(id); if (l) openLesson(l); } };
})();

/* =========================================================
   ИМПЕРИЯ
   ========================================================= */
Screens.empire = (() => {
  const { $ } = UI;

  function buy(asset, btn) {
    const cost = State.assetCost(asset.id);
    if (State.s.coins < cost) {
      Sound.sfx('deny');
      FX.shake(btn.closest('.asset-card'));
      UI.toast('Не хватает монет. Выполняй задачи!', 'warn', '🪙');
      return;
    }
    State.buyAsset(asset.id);
    Sound.sfx('buy');
    FX.vibrate([10, 30, 10]);
    FX.confettiFrom(btn, 40, { power: 9 });
    const lvl = State.assetLevel(asset.id);
    UI.toast(`${asset.name} → уровень ${lvl}`, 'coin', asset.emoji);
    State.commit();
  }

  function render() {
    const s = State.s;
    const nw = State.netWorth();
    const passive = State.passivePerMin();
    const mult = State.activityMultiplier();

    UI.countUp($('#empire-networth'), nw, { short: nw > 99999 });
    UI.countUp($('#empire-passive'), passive * mult, { smart: true });

    const pct = Math.min(100, (nw / Data.MILLIONAIRE_GOAL) * 100);
    $('#empire-progress').style.width = pct + '%';
    $('#empire-percent').textContent = pct < 1 ? pct.toFixed(2) + '%' : pct.toFixed(1) + '%';

    // прогноз: сколько дней до миллиона при текущем темпе
    const perDayPassive = passive * mult * 60 * 24;
    const activeDays = Math.max(1, Object.keys(s.dailyTaskCounts).length);
    const perDayActive = s.totals.coinsEarned / activeDays * 0.6;   // консервативная оценка
    const perDay = perDayPassive + perDayActive;
    const left = Math.max(0, Data.MILLIONAIRE_GOAL - nw);
    const forecast = $('#empire-forecast');
    if (forecast) {
      if (nw >= Data.MILLIONAIRE_GOAL) {
        forecast.innerHTML = '👑 Миллион взят. Дальше — просто ради удовольствия.';
      } else if (perDay <= 0) {
        forecast.innerHTML = 'Выполни задачи или купи первый актив — появится прогноз.';
      } else {
        const days = Math.ceil(left / perDay);
        forecast.innerHTML = days > 3650
          ? `При текущем темпе до миллиона — больше 10 лет. Пора вкладываться в активы 🏦`
          : `При текущем темпе до миллиона: <b>${UI.plur(days, 'день', 'дня', 'дней')}</b> · примерно ${UI.fmtShort(perDay)} ${UI.plural(perDay, 'монета', 'монеты', 'монет')} в день`;
      }
    }

    $('#empire-note').innerHTML = mult === 1
      ? '✅ Сегодня ты был активен — бизнес работает на <b>100%</b> мощности.'
      : '⚠️ Бизнес простаивает: сегодня не было активности, доход <b>25%</b>. Выполни любую задачу.';
    $('#empire-note').className = `note-line ${mult === 1 ? 'ok' : 'warn'}`;

    const root = $('#asset-list');
    root.innerHTML = '';
    Data.ASSETS.forEach((a, idx) => {
      const level = State.assetLevel(a.id);
      const cost = State.assetCost(a.id);
      const prevLevel = idx === 0 ? 1 : State.assetLevel(Data.ASSETS[idx - 1].id);
      const locked = idx > 0 && prevLevel === 0 && level === 0;
      const affordable = s.coins >= cost;

      const card = UI.node('div', `asset-card${level > 0 ? ' owned' : ''}${locked ? ' locked' : ''}`);
      card.innerHTML = `
        <div class="asset-emoji">${a.emoji}</div>
        <div class="asset-body">
          <div class="asset-name">
            ${UI.esc(a.name)}
            ${level > 0 ? `<span class="asset-level">ур. ${level}</span>` : ''}
            ${locked ? '<span class="asset-lock">🔒 закрыто</span>' : ''}
          </div>
          <div class="asset-desc muted small">${locked ? `Откроется после покупки «${UI.esc(Data.ASSETS[idx - 1].name)}»` : UI.esc(a.desc)}</div>
          <div class="asset-income">+${UI.fmtSmart(a.income)} 🪙/мин за уровень${level > 0 ? ` · сейчас +${UI.fmtSmart(a.income * level)}/мин` : ''}</div>
        </div>
        <div class="asset-buy">
          <button class="btn ${affordable && !locked ? 'btn-primary' : 'btn-ghost'}" ${locked ? 'disabled' : ''}>
            ${locked ? '🔒' : `${UI.fmtShort(cost)} 🪙`}
          </button>
        </div>`;
      if (!locked) {
        const btn = card.querySelector('button');
        btn.addEventListener('click', () => buy(a, btn));
      }
      root.appendChild(card);
    });
  }

  return { render, bind: () => {} };
})();

/* =========================================================
   НАГРАДЫ: достижения, бустеры, темы, свои награды
   ========================================================= */
Screens.rewards = (() => {
  const { $ } = UI;
  let achFilter = 'all';

  function bind() {
    $('#reward-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = $('#reward-title').value.trim();
      const cost = Math.max(1, Number($('#reward-cost').value) || 50);
      if (!title) return;
      State.s.rewards.unshift({ id: State.uid(), title, cost });
      $('#reward-title').value = '';
      $('#reward-cost').value = 80;
      Sound.sfx('click');
      State.commit();
    });
  }

  function buyReward(r, btn) {
    if (!State.spend(r.cost)) {
      Sound.sfx('deny');
      FX.shake(btn.closest('.reward-item'));
      UI.toast('Не хватает монет', 'warn', '🪙');
      return;
    }
    State.s.totals.rewardsBought += 1;
    Sound.sfx('buy');
    FX.confettiFrom(btn, 45);
    FX.coinRain(18);
    UI.toast(`Заслужено: ${r.title} 🎉`, 'coin', '🎁');
    State.commit();
  }

  function buyBooster(b, btn) {
    if (!State.spend(b.cost)) {
      Sound.sfx('deny');
      FX.shake(btn.closest('.booster-card'));
      UI.toast('Не хватает монет', 'warn', '🪙');
      return;
    }
    const s = State.s;
    if (b.id === 'xp2_1h') s.boosters.xpUntil = Math.max(Date.now(), s.boosters.xpUntil || 0) + b.duration * 60000;
    if (b.id === 'coin2_1h') s.boosters.coinUntil = Math.max(Date.now(), s.boosters.coinUntil || 0) + b.duration * 60000;
    if (b.id === 'streak_save') s.boosters.streakSaves = (s.boosters.streakSaves || 0) + 1;
    Sound.sfx('buy');
    FX.confettiFrom(btn, 40);
    UI.toast(`${b.name} активирован!`, 'level', b.emoji);
    State.commit();
  }

  function selectPalette(p) {
    if (!State.paletteUnlocked(p)) {
      Sound.sfx('deny');
      UI.toast(`Откроется на ${p.level} уровне`, 'warn', '🔒');
      return;
    }
    State.s.palette = p.id;
    App.applyPalette();
    FX.seedParticles();
    Sound.sfx('success');
    UI.toast(`Тема: ${p.name}`, 'success', p.emoji);
    State.commit();
  }

  function render() {
    const s = State.s;

    // достижения
    const grid = $('#achievement-grid');
    const filterRow = $('#ach-filters');
    if (filterRow && !filterRow.dataset.built) {
      filterRow.dataset.built = '1';
      filterRow.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-ach]');
        if (!chip) return;
        achFilter = chip.dataset.ach;
        UI.$$('[data-ach]', filterRow).forEach((c) => c.classList.toggle('active', c === chip));
        Sound.sfx('click');
        render();
      });
    }
    grid.innerHTML = '';
    const withMeta = Data.ACHIEVEMENTS.map((a) => {
      const unlocked = !!(s.achievements[a.id] && s.achievements[a.id].unlocked);
      const prog = unlocked ? null : Data.achProgress(a, s, State.api);
      return { a, unlocked, prog, rarity: Data.achRarity(a) };
    });
    // сначала полученные, затем самые близкие к получению
    withMeta.sort((x, y) => {
      if (x.unlocked !== y.unlocked) return x.unlocked ? -1 : 1;
      if (x.unlocked) return (s.achievements[y.a.id].at || 0) - (s.achievements[x.a.id].at || 0);
      return (y.prog ? y.prog.pct : 0) - (x.prog ? x.prog.pct : 0);
    });

    const visible = withMeta.filter(({ unlocked, prog }) => {
      if (achFilter === 'unlocked') return unlocked;
      if (achFilter === 'close') return !unlocked && prog && prog.pct >= 30;
      if (achFilter === 'locked') return !unlocked;
      return true;
    });

    visible.forEach(({ a, unlocked, prog, rarity }) => {
      const el = UI.node('div', `achievement r-${rarity.id}${unlocked ? ' unlocked' : ''}${!unlocked && prog && prog.pct >= 60 ? ' close' : ''}`);
      el.innerHTML = `
        <span class="achievement-emoji">${unlocked ? a.emoji : '🔒'}</span>
        <div class="achievement-name">${UI.esc(a.name)}</div>
        <div class="achievement-desc">${UI.esc(a.desc)}</div>
        ${unlocked
          ? `<div class="achievement-date">${new Date(s.achievements[a.id].at).toLocaleDateString('ru-RU')}</div>`
          : `${prog ? `<div class="ach-bar"><i style="width:${prog.pct}%"></i></div>
               <div class="ach-prog">${UI.fmtShort(prog.cur)} / ${UI.fmtShort(prog.goal)}</div>` : ''}
             <div class="achievement-reward">+${a.xp} XP${a.coins ? ` · +${a.coins}🪙` : ''}</div>`}
        <span class="ach-rarity">${rarity.name}</span>`;
      grid.appendChild(el);
    });
    $('#achievement-progress').textContent = `${State.unlockedAchievements()} / ${Data.ACHIEVEMENTS.length}`;

    // бустеры
    const boosters = $('#booster-list');
    boosters.innerHTML = '';
    Data.BOOSTERS.forEach((b) => {
      let activeNote = '';
      if (b.id === 'xp2_1h' && State.boosterActive('xp')) activeNote = '<span class="tag-done">активен</span>';
      if (b.id === 'coin2_1h' && State.boosterActive('coin')) activeNote = '<span class="tag-done">активен</span>';
      if (b.id === 'streak_save' && s.boosters.streakSaves > 0) activeNote = `<span class="tag-done">в запасе: ${s.boosters.streakSaves}</span>`;
      const card = UI.node('div', 'booster-card');
      card.innerHTML = `
        <span class="booster-emoji">${b.emoji}</span>
        <div class="grow">
          <div class="booster-name">${UI.esc(b.name)} ${activeNote}</div>
          <div class="muted small">${UI.esc(b.desc)}</div>
        </div>
        <button class="btn btn-primary btn-sm">${UI.fmtShort(b.cost)} 🪙</button>`;
      const btn = card.querySelector('button');
      btn.addEventListener('click', () => buyBooster(b, btn));
      boosters.appendChild(card);
    });

    // палитры
    const pal = $('#palette-list');
    pal.innerHTML = '';
    Data.PALETTES.forEach((p) => {
      const unlocked = State.paletteUnlocked(p);
      const el = UI.node('button', `palette-card${s.palette === p.id ? ' selected' : ''}${unlocked ? '' : ' locked'}`);
      el.innerHTML = `
        <span class="palette-swatches">${p.colors.map((c) => `<i style="background:${c}"></i>`).join('')}</span>
        <span class="palette-name">${p.emoji} ${UI.esc(p.name)}</span>
        <span class="palette-status">${unlocked ? (s.palette === p.id ? 'выбрана' : 'выбрать') : `🔒 ур. ${p.level}`}</span>`;
      el.addEventListener('click', () => selectPalette(p));
      pal.appendChild(el);
    });

    // свои награды
    const list = $('#reward-list');
    list.innerHTML = '';
    s.rewards.forEach((r) => {
      const el = UI.node('div', 'reward-item');
      el.innerHTML = `
        <div class="reward-title">${UI.esc(r.title)}</div>
        <div class="reward-cost">${UI.fmt(r.cost)} 🪙</div>
        <button class="btn ${s.coins >= r.cost ? 'btn-primary' : 'btn-ghost'} btn-sm btn-block">Выкупить</button>
        <button class="link-btn reward-del">удалить</button>`;
      const btn = el.querySelector('.btn');
      btn.addEventListener('click', () => buyReward(r, btn));
      el.querySelector('.reward-del').addEventListener('click', () => {
        State.s.rewards = State.s.rewards.filter((x) => x.id !== r.id);
        State.commit();
      });
      list.appendChild(el);
    });
  }

  return { bind, render };
})();

/* =========================================================
   СТАТИСТИКА
   ========================================================= */
Screens.stats = (() => {
  const { $ } = UI;

  /* человекочитаемый отчёт в Markdown — можно унести куда угодно */
  function exportReport() {
    const s = State.s;
    const stage = State.stage();
    const L = [];
    L.push(`# Отчёт: ${s.name || 'Игрок'} — ${stage.emoji} ${stage.title}`);
    L.push('');
    L.push(`Дата: ${new Date().toLocaleDateString('ru-RU')}`);
    L.push('');
    L.push('## Прогресс');
    L.push(`- Уровень: **${s.level}** (${UI.fmt(s.totals.xpEarned)} XP всего)`);
    L.push(`- Капитал: **${UI.fmt(State.netWorth())}** монет, пассивный доход ${UI.fmtSmart(State.passivePerMin())}/мин`);
    L.push(`- Серия: ${UI.plur(s.streak, 'день', 'дня', 'дней')} подряд (рекорд ${s.bestStreak})`);
    L.push(`- Достижений: ${State.unlockedAchievements()} из ${Data.ACHIEVEMENTS.length}`);
    L.push('');
    L.push('## Сделано');
    L.push(`- Задач выполнено: **${s.totals.tasksCompleted}**`);
    L.push(`- Минут фокуса: **${s.totals.focusMinutes}** за ${UI.plur(s.totals.focusSessions, 'сессию', 'сессии', 'сессий')}`);
    L.push(`- Уроков пройдено: ${Object.keys(s.lessons.read).length} из ${Data.LESSONS.length}`);
    L.push(`- Квестов выполнено: ${s.totals.questsDone}`);
    L.push(`- Минут под музыку: ${s.totals.musicMinutes || 0}`);
    L.push('');
    if (typeof Path !== 'undefined') {
      const cur = Path.currentStage();
      const n = Path.nextStep();
      const m = Path.money();
      L.push('## Путь к деньгам');
      L.push(`- Пройдено: **${Path.doneCount()} из ${Path.STEP_COUNT}** шагов (${Path.progressPct()}%)`);
      L.push(`- Текущий этап: ${cur.emoji} **${cur.name}** — ${cur.goal}`);
      if (n) L.push(`- Следующий шаг: **${n.step.t}**`);
      L.push('');
      if (m.income || m.expenses) {
        const c = Path.calc();
        L.push('### Реальные деньги');
        L.push(`- Доход ${UI.fmt(m.income)} · расходы ${UI.fmt(m.expenses)} · свободный остаток **${UI.fmt(c.free)}** (${c.savingRate}%)`);
        L.push(`- Подушка: ${UI.fmt(m.cushion)} — это ${Math.round(c.cushionMonths * 10) / 10} мес. расходов`);
        L.push(`- Капитал: ${UI.fmt(m.capital)} · пассив ${UI.fmt(c.passiveNow)}/мес (${Math.round(c.freedomPct)}% расходов)`);
        L.push(`- Цифра свободы: **${UI.fmt(c.freedomNumber)}**${c.yearsToFreedom !== null ? ` — примерно ${c.yearsToFreedom} года при текущем темпе` : ''}`);
        L.push('');
      }
      L.push('### Что делать дальше');
      Path.STAGES.forEach((st, i) => {
        const done = Path.stageDone(st);
        L.push(`${i + 1}. ${st.emoji} **${st.name}** (${done}/${st.steps.length}) — ${st.tagline}`);
        st.steps.forEach((step) => L.push(`   - [${Path.isDone(step.id) ? 'x' : ' '}] ${step.t}`));
      });
      L.push('');
    }
    L.push('## Навыки');
    Data.SKILLS.forEach((sk) => {
      const p = State.skillProgress(sk.id);
      L.push(`- ${sk.emoji} ${sk.name}: ур. **${p.level}** (${p.xp}/${p.need})`);
    });
    L.push('');
    if (s.habits.length) {
      L.push('## Привычки');
      s.habits.forEach((h) => L.push(`- ${h.emoji} ${h.name}: ${UI.plur(State.habitStreak(h), 'день', 'дня', 'дней')} подряд, всего ${Object.keys(h.history).length}`));
      L.push('');
    }
    const openTasks = s.tasks.filter((t) => !t.done);
    if (openTasks.length) {
      L.push('## Открытые задачи');
      openTasks.slice(0, 30).forEach((t) => {
        const pri = Data.priorityById(t.priority);
        L.push(`- [ ] ${t.title} — ${pri.name}${t.due ? ` (до ${UI.dateLabel(t.due)})` : ''}`);
      });
      L.push('');
    }
    if (s.goals.length) {
      L.push('## Цели');
      s.goals.forEach((g) => {
        const done = g.milestones.filter((m) => m.done).length;
        L.push(`- ${g.emoji} **${g.title}** — ${done}/${g.milestones.length} шагов${g.done ? ' ✅' : ''}`);
      });
      L.push('');
    }
    const insights = Advisor && Advisor.renderInsights ? null : null;
    L.push('---');
    L.push('_Сгенерировано приложением «Из Ленивца в Миллионеры»_');

    const blob = new Blob([L.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lenivec-otchet-${State.todayKey()}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    Sound.sfx('success');
    UI.toast('Отчёт скачан в Markdown', 'success', '📄');
  }

  function bind() {
    $('#export-btn').addEventListener('click', exportData);
    $('#report-btn').addEventListener('click', exportReport);
    $('#import-btn').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', (e) => {
      if (e.target.files[0]) importData(e.target.files[0]);
      e.target.value = '';
    });
    $('#path-reset-btn').addEventListener('click', async () => {
      const ok = await UI.confirm('Отметки на пути будут сняты, но цифры в трекере денег останутся. Уровень, монеты и достижения не тронуты.', { title: 'Пройти путь заново?', okText: 'Сбросить путь', danger: true });
      if (!ok) return;
      State.s.path = { done: {}, claimed: {}, startedAt: null, stage: 0 };
      State.commit();
      UI.toast('Путь сброшен — начинай с первого шага', 'success', '🧭');
    });
    $('#reset-btn').addEventListener('click', resetData);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(State.s, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lenivec-backup-${State.todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    UI.toast('Бэкап скачан', 'success', '💾');
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        State.replace(JSON.parse(reader.result));
        App.applyAll();
        State.commit();
        UI.toast('Данные восстановлены', 'success', '✅');
      } catch (e) {
        UI.toast('Файл не читается', 'warn', '⚠️');
      }
    };
    reader.readAsText(file);
  }

  async function resetData() {
    const ok = await UI.confirm('Весь прогресс будет удалён безвозвратно. Точно сбросить?', { danger: true, okText: 'Сбросить всё', title: '🗑️ Сброс прогресса' });
    if (!ok) return;
    State.reset();
    App.applyAll();
    location.reload();
  }

  function barChart(root, values, labels, opts = {}) {
    const max = Math.max(1, ...values);
    root.innerHTML = '';
    values.forEach((v, i) => {
      const col = UI.node('div', 'bar-col');
      const pct = Math.max(2, (v / max) * 100);
      col.innerHTML = `
        <span class="bar-value">${v || ''}</span>
        <div class="bar" style="height:${pct}%"></div>
        <span class="bar-label">${labels[i]}</span>`;
      col.title = `${labels[i]}: ${v}${opts.unit || ''}`;
      root.appendChild(col);
    });
  }

  function renderHeatmap() {
    const root = $('#heatmap');
    root.innerHTML = '';
    const days = 364;
    for (let i = days; i >= 0; i--) {
      const key = State.daysAgoKey(i);
      const lvl = Screens.helpers.activityLevel(key);
      const cls = lvl === 0 ? 'h0' : lvl <= 1 ? 'h1' : lvl <= 3 ? 'h2' : lvl <= 6 ? 'h3' : 'h4';
      const cell = UI.node('i', `heat ${cls}`);
      cell.title = `${UI.dateLabel(key)}: активность ${lvl}`;
      root.appendChild(cell);
    }
  }

  function renderMood() {
    const root = $('#chart-mood');
    const points = [];
    for (let i = 13; i >= 0; i--) {
      const key = State.daysAgoKey(i);
      const m = State.s.moods[key];
      points.push({ key, mood: m ? m.mood : null, energy: m ? m.energy : null });
    }
    const W = 300, H = 120, pad = 14;
    const stepX = (W - pad * 2) / 13;
    const y = (v) => H - pad - ((v - 1) / 4) * (H - pad * 2);

    const line = (field, color) => {
      let d = '';
      let started = false;
      points.forEach((p, i) => {
        if (p[field] == null) return;
        const x = pad + i * stepX;
        d += `${started ? 'L' : 'M'}${x.toFixed(1)} ${y(p[field]).toFixed(1)} `;
        started = true;
      });
      return d ? `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : '';
    };
    const dots = points.map((p, i) => p.mood == null ? '' :
      `<circle cx="${(pad + i * stepX).toFixed(1)}" cy="${y(p.mood).toFixed(1)}" r="3.5" fill="var(--accent)"/>`).join('');

    const hasData = points.some((p) => p.mood != null);
    root.innerHTML = hasData ? `
      <svg viewBox="0 0 ${W} ${H}" class="mood-svg">
        <line x1="${pad}" y1="${y(3)}" x2="${W - pad}" y2="${y(3)}" class="chart-grid"/>
        ${line('energy', 'var(--accent3)')}
        ${line('mood', 'var(--accent)')}
        ${dots}
      </svg>
      <div class="chart-legend"><span class="dot-accent"></span> настроение <span class="dot-accent3"></span> энергия</div>`
      : '<p class="empty-hint">Отмечай состояние дня на главной — здесь появится график.</p>';
  }

  function renderHours() {
    const root = $('#chart-hours');
    root.innerHTML = '';
    const data = State.s.focusByHour || {};
    const max = Math.max(1, ...Object.values(data));
    for (let h = 0; h < 24; h++) {
      const v = data[h] || 0;
      const col = UI.node('div', 'hour-col');
      col.innerHTML = `<div class="hour-bar" style="height:${Math.max(3, (v / max) * 100)}%"></div>${h % 6 === 0 ? `<span class="hour-label">${h}</span>` : ''}`;
      col.title = `${h}:00 — ${v} задач`;
      root.appendChild(col);
    }
  }

  function renderSkillBars() {
    const root = $('#skill-bars');
    root.innerHTML = '';
    Data.SKILLS.forEach((sk) => {
      const p = State.skillProgress(sk.id);
      const el = UI.node('div', 'skill-row');
      el.innerHTML = `
        <span class="skill-emoji">${sk.emoji}</span>
        <div class="skill-body">
          <div class="skill-name">${sk.name} <b>ур. ${p.level}</b></div>
          <div class="skill-bar"><i style="width:${p.pct}%; background:${sk.color}"></i></div>
        </div>
        <span class="muted small">${p.xp}/${p.need}</span>`;
      root.appendChild(el);
    });
  }

  function renderSessionLog() {
    const log = State.s.focusLog || [];
    const root = $('#session-log');
    if (!log.length) {
      root.innerHTML = '<p class="empty-hint">Сессий пока нет. Первая — самая важная.</p>';
      $('#session-avg').textContent = '—';
      return;
    }
    const avg = Math.round(log.reduce((a, x) => a + x.minutes, 0) / log.length);
    $('#session-avg').textContent = `в среднем ${avg} мин`;

    const modeName = (id) => (Data.TIMER_MODES.find((m) => m.id === id) || {}).name || 'сессия';
    root.innerHTML = log.slice(0, 8).map((x) => `
      <div class="session-row">
        <span class="session-min">${x.minutes}<small>мин</small></span>
        <span class="session-body">
          <b>${UI.esc(x.task || 'Без конкретной задачи')}</b>
          <small>${UI.esc(modeName(x.mode))} · ${UI.timeAgo(x.at)}</small>
        </span>
      </div>`).join('');
  }

  function renderNumbers() {
    const s = State.s;
    const items = [
      ['✅', s.totals.tasksCompleted, 'задач выполнено'],
      ['⏱️', s.totals.focusMinutes, 'минут фокуса'],
      ['🍅', s.totals.focusSessions, 'фокус-сессий'],
      ['🔥', s.bestStreak, 'лучшая серия'],
      ['⭐', s.totals.xpEarned, 'всего XP'],
      ['🪙', Math.floor(s.totals.coinsEarned), 'монет заработано'],
      ['🏦', Math.floor(s.totals.passiveEarned), 'пассивного дохода'],
      ['📚', Object.keys(s.lessons.read).length, 'уроков пройдено'],
      ['📜', s.totals.questsDone, 'квестов выполнено'],
      ['🏆', State.unlockedAchievements(), 'достижений'],
      ['🧭', (s.totals.pathSteps || 0), 'шагов пути'],
      ['🗺️', (s.totals.pathStages || 0), 'этапов пути закрыто'],
      ['🤝', (s.totals.pledgesKept || 0), 'обещаний сдержано'],
    ];
    const root = $('#stat-numbers');
    root.innerHTML = items.map(([emoji, value, label]) => `
      <div class="stat-num">
        <span class="stat-emoji">${emoji}</span>
        <b>${UI.fmtShort(value)}</b>
        <small>${label}</small>
      </div>`).join('');
  }

  function render() {
    const s = State.s;
    const keys = [];
    for (let i = 13; i >= 0; i--) keys.push(State.daysAgoKey(i));
    const labels = keys.map((k) => {
      const d = new Date(k);
      return d.getDate();
    });
    barChart($('#chart-tasks'), keys.map((k) => s.dailyTaskCounts[k] || 0), labels, { unit: ' задач' });
    barChart($('#chart-focus'), keys.map((k) => s.dailyFocusMinutes[k] || 0), labels, { unit: ' мин' });
    renderHeatmap();
    renderMood();
    renderHours();
    renderSkillBars();
    renderSessionLog();
    Advisor.renderInsights();
    renderNumbers();
    Screens.review.render();
  }

  return { bind, render };
})();
