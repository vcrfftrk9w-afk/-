'use strict';
/* =========================================================
   ADVISOR — «что дальше» и автоматические наблюдения
   Правила простые и прозрачные: приложение всегда называет
   одно следующее действие, а не вываливает список.
   ========================================================= */

const Advisor = (() => {
  const { $ } = UI;
  let skip = 0;

  /* ---------- кандидаты на следующее действие ---------- */
  function candidates() {
    const s = State.s;
    const today = State.todayKey();
    const hour = new Date().getHours();
    const list = [];

    if (Screens.focus.running) {
      list.push({
        emoji: '🎯', title: 'Ты уже в фокусе',
        text: 'Ничего не надо решать — просто продолжай. Вкладка фокуса рядом.',
        action: 'К таймеру', run: () => App.go('adhd'), weight: 100,
      });
    }

    const overdue = s.tasks.filter((t) => !t.done && t.due && new Date(t.due) < new Date(today));
    if (overdue.length) {
      const t = overdue[0];
      list.push({
        emoji: '📅', title: 'Просроченное тянет вниз',
        text: `«${t.title}» ждёт с ${UI.dateLabel(t.due)}. Закрой или перенеси — так спокойнее.`,
        action: 'Работать над этим', run: () => { App.go('adhd'); Screens.focus.setTask(t.id); Screens.focus.startIfIdle(); }, weight: 92,
      });
    }

    if (!s.tasks.filter((t) => !t.done).length) {
      list.push({
        emoji: '📝', title: 'Список задач пуст',
        text: 'Запиши хотя бы одну вещь, которая крутится в голове. Записанное перестаёт весить.',
        action: 'Добавить задачу', run: () => App.openCapture(), weight: 88,
      });
    }

    const focusToday = s.dailyFocusMinutes[today] || 0;
    const goal = s.focusGoal || 60;
    if (focusToday < goal && hour >= 7 && hour <= 23) {
      const left = goal - focusToday;
      list.push({
        emoji: '⏱️', title: focusToday ? `Осталось ${UI.plur(left, 'минута', 'минуты', 'минут')} до цели` : 'Сегодня ещё не было фокуса',
        text: focusToday ? 'Одна сессия — и дневная цель закрыта.' : 'Начни с 10 минут. Это меньше, чем кажется.',
        action: 'Запустить сессию', run: () => { App.go('adhd'); setTimeout(() => Screens.focus.startIfIdle(), 250); }, weight: 74,
      });
    }

    const unchecked = s.habits.filter((h) => !h.history[today]);
    if (unchecked.length) {
      const h = unchecked[0];
      list.push({
        emoji: h.emoji || '🔥', title: `Привычка ждёт: ${h.name}`,
        text: unchecked.length > 1 ? `Сегодня не отмечено ${UI.plur(unchecked.length, 'привычка', 'привычки', 'привычек')}.` : 'Последняя на сегодня — и день закрыт.',
        action: 'К привычкам', run: () => App.go('habits'), weight: 70,
      });
    }

    const quests = State.todayQuests().filter((q) => !s.quests.done[q.id]);
    if (quests.length === 1) {
      list.push({
        emoji: '📜', title: 'Остался один квест',
        text: `${quests[0].text} — и день выполнен полностью.`,
        action: 'Показать квесты', run: () => App.go('dashboard'), weight: 80,
      });
    }

    const mProg = State.routineProgress('morning');
    if (hour < 13 && mProg.total && mProg.done < mProg.total) {
      list.push({
        emoji: '🌅', title: 'Утренняя рутина не закрыта',
        text: `Готово ${mProg.done} из ${mProg.total}. Утро задаёт тон всему дню.`,
        action: 'К рутине', run: () => App.go('dashboard'), weight: 76,
      });
    }

    const eProg = State.routineProgress('evening');
    if (hour >= 19 && eProg.total && eProg.done < eProg.total) {
      list.push({
        emoji: '🌙', title: 'Вечерняя рутина ждёт',
        text: 'Закрой день осознанно — завтрашнему тебе будет проще начать.',
        action: 'К рутине', run: () => App.go('dashboard'), weight: 78,
      });
    }

    if (hour >= 17 && !s.moods[today]) {
      list.push({
        emoji: '🙂', title: 'Как прошёл день?',
        text: 'Отметь настроение и энергию — через месяц увидишь закономерности.',
        action: 'Отметить', run: () => App.go('dashboard'), weight: 60,
      });
    }

    const affordable = Data.ASSETS.find((a, i) => {
      const prev = i === 0 ? 1 : State.assetLevel(Data.ASSETS[i - 1].id);
      return (i === 0 || prev > 0) && s.coins >= State.assetCost(a.id);
    });
    if (affordable) {
      list.push({
        emoji: affordable.emoji, title: 'Монеты простаивают',
        text: `Хватает на «${affordable.name}» — актив начнёт приносить доход сам.`,
        action: 'В империю', run: () => App.go('empire'), weight: 55,
      });
    }

    const unread = Data.LESSONS.find((l) => !s.lessons.read[l.id]);
    if (unread) {
      list.push({
        emoji: '📚', title: `Урок: ${unread.title}`,
        text: 'Пять минут чтения — и одно рабочее действие на сегодня.',
        action: 'Открыть урок', run: () => { App.go('lessons'); setTimeout(() => Screens.lessons.openById(unread.id), 250); }, weight: 45,
      });
    }

    list.push({
      emoji: '🧘', title: 'Можно выдохнуть',
      text: 'Главное на сегодня сделано. Отдых — тоже часть работы.',
      action: 'Дыхательная пауза', run: () => { App.go('adhd'); setTimeout(() => { const b = document.getElementById('breathing-toggle'); if (b) b.click(); }, 300); }, weight: 10,
    });

    return list.sort((a, b) => b.weight - a.weight);
  }

  function renderNext() {
    const root = $('#next-action');
    if (!root) return;
    const list = candidates();
    const item = list[skip % list.length];
    root.innerHTML = `
      <div class="next-emoji">${item.emoji}</div>
      <div class="next-body">
        <b>${UI.esc(item.title)}</b>
        <p class="muted small">${UI.esc(item.text)}</p>
      </div>
      <button class="btn btn-primary btn-sm next-go">${UI.esc(item.action)}</button>`;
    root.querySelector('.next-go').addEventListener('click', () => { Sound.sfx('click'); item.run(); });
  }

  function cycle() {
    skip += 1;
    Sound.sfx('whoosh');
    renderNext();
  }

  /* ---------- наблюдения для статистики ---------- */
  function insights() {
    const s = State.s;
    const out = [];

    const hours = s.focusByHour || {};
    const bestHour = Object.keys(hours).sort((a, b) => hours[b] - hours[a])[0];
    if (bestHour != null && hours[bestHour] >= 3) {
      out.push(['🕐', `Чаще всего ты закрываешь задачи около <b>${bestHour}:00</b>. Ставь туда самое важное.`]);
    }

    const byWeekday = {};
    Object.keys(s.dailyTaskCounts).forEach((k) => {
      const d = new Date(k).getDay();
      byWeekday[d] = (byWeekday[d] || 0) + s.dailyTaskCounts[k];
    });
    const bestDay = Object.keys(byWeekday).sort((a, b) => byWeekday[b] - byWeekday[a])[0];
    if (bestDay != null && byWeekday[bestDay] >= 3) {
      const names = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
      out.push(['📆', `Самый продуктивный день недели — <b>${names[bestDay]}</b>.`]);
    }

    let thisWeek = 0, lastWeek = 0;
    for (let i = 0; i < 7; i++) thisWeek += s.dailyFocusMinutes[State.daysAgoKey(i)] || 0;
    for (let i = 7; i < 14; i++) lastWeek += s.dailyFocusMinutes[State.daysAgoKey(i)] || 0;
    if (thisWeek || lastWeek) {
      if (lastWeek === 0) out.push(['📈', `За неделю <b>${thisWeek}</b> минут фокуса — первая точка отсчёта.`]);
      else {
        const diff = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
        out.push([diff >= 0 ? '📈' : '📉',
          `Фокус за неделю: <b>${thisWeek}</b> мин — это ${diff >= 0 ? 'на <b>+' + diff + '%</b> больше' : '<b>' + diff + '%</b> относительно'} прошлой недели.`]);
      }
    }

    const days = Object.keys(s.dailyTaskCounts).length;
    if (days >= 3) {
      const total = Object.values(s.dailyTaskCounts).reduce((a, b) => a + b, 0);
      out.push(['✅', `В среднем <b>${(total / days).toFixed(1).replace('.', ',')}</b> задач в активный день.`]);
    }

    const moods = Object.values(s.moods);
    if (moods.length >= 4) {
      const avgMood = moods.reduce((a, m) => a + m.mood, 0) / moods.length;
      const avgEnergy = moods.reduce((a, m) => a + (m.energy || 3), 0) / moods.length;
      out.push(['🙂', `Среднее настроение <b>${avgMood.toFixed(1).replace('.', ',')}</b> из 5, энергия <b>${avgEnergy.toFixed(1).replace('.', ',')}</b>.`]);
    }

    if ((s.totals.returns || 0) >= 3) {
      out.push(['🔄', `Ты <b>${s.totals.returns}</b> ${UI.plural(s.totals.returns, 'раз', 'раза', 'раз')} возвращался к работе после отвлечения. Это и есть навык фокуса.`]);
    }

    if (s.bestStreak >= 3) out.push(['🔥', `Лучшая серия: <b>${s.bestStreak}</b> ${UI.plural(s.bestStreak, 'день', 'дня', 'дней')} подряд.`]);

    if (!out.length) out.push(['🌱', 'Наблюдения появятся через несколько дней использования — нужны данные.']);
    return out;
  }

  function renderInsights() {
    const root = $('#insights');
    if (!root) return;
    root.innerHTML = insights().map(([emoji, html]) => `
      <div class="insight-row"><span>${emoji}</span><p>${html}</p></div>`).join('');
  }

  function bind() {
    const btn = $('#next-refresh');
    if (btn) btn.addEventListener('click', cycle);
  }

  return { bind, renderNext, renderInsights };
})();
