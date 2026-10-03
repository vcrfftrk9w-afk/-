/* Курс целиком: поиск уроков, открытие следующих, опыт (XP), уровни и достижения. */
(function () {
  window.COURSE = window.COURSE || [];

  const Course = {
    modules() { return window.COURSE; },
    lessons() {
      const res = [];
      window.COURSE.forEach((m, mi) => m.lessons.forEach((l, li) => res.push(Object.assign(l, { _m: m, _mi: mi, _li: li }))));
      return res;
    },
    byId(id) { return this.lessons().find((l) => l.id === id); },
    next(id) { const all = this.lessons(); const k = all.findIndex((l) => l.id === id); return k >= 0 ? all[k + 1] : null; },
    prev(id) { const all = this.lessons(); const k = all.findIndex((l) => l.id === id); return k > 0 ? all[k - 1] : null; },
    isDone(id) { return !!Store.s.done[id]; },
    isUnlocked(id) {
      if (Store.s.settings.unlockAll) return true;
      const all = this.lessons();
      const k = all.findIndex((l) => l.id === id);
      if (k <= 0) return true;
      if (this.isDone(id)) return true;
      return this.isDone(all[k - 1].id);
    },
    current() {
      const all = this.lessons();
      if (Store.s.lastLesson && !this.isDone(Store.s.lastLesson) && this.byId(Store.s.lastLesson) && this.isUnlocked(Store.s.lastLesson)) return this.byId(Store.s.lastLesson);
      return all.find((l) => !this.isDone(l.id)) || null;
    },
    lessonXp(l) { return l.xp || (10 + Math.min(10, l._mi)); },
    totalXp() {
      return this.lessons().reduce((s, l) => s + this.lessonXp(l) + (l.quiz ? l.quiz.length * 2 : 0), 0);
    },
    moduleProgress(m) {
      const done = m.lessons.filter((l) => this.isDone(l.id)).length;
      return { done, total: m.lessons.length, pct: m.lessons.length ? Math.round((done / m.lessons.length) * 100) : 0 };
    },
    overall() {
      const all = this.lessons();
      const done = all.filter((l) => this.isDone(l.id)).length;
      return { done, total: all.length, pct: all.length ? Math.round((done / all.length) * 100) : 0 };
    }
  };

  const LEVELS = [
    [0, '🐣', 'Новичок'],
    [0.03, '🌱', 'Стажёр'],
    [0.08, '🔰', 'Ученик кода'],
    [0.15, '⌨️', 'Младший программист'],
    [0.24, '💻', 'Программист'],
    [0.35, '🕹️', 'Геймдизайнер'],
    [0.48, '🎮', 'Разработчик игр'],
    [0.62, '🚀', 'Старший разработчик'],
    [0.78, '🧙', 'Мастер кода'],
    [0.93, '👑', 'Легенда геймдева']
  ];

  function levelInfo(xp) {
    const total = Course.totalXp() || 1000;
    const th = LEVELS.map((l) => Math.round(l[0] * total));
    let k = 0;
    while (k + 1 < th.length && xp >= th[k + 1]) k++;
    const from = th[k], to = th[k + 1] || th[k];
    return {
      n: k + 1, icon: LEVELS[k][1], title: LEVELS[k][2],
      from, to, max: k === th.length - 1,
      pct: k === th.length - 1 ? 100 : Math.round(((xp - from) / Math.max(1, to - from)) * 100),
      nextTitle: LEVELS[k + 1] ? LEVELS[k + 1][2] : ''
    };
  }

  const ACH = [
    ['first_run', '🚀', 'Первый запуск', 'Запусти свой первый код', (s) => s.stats.runs >= 1],
    ['first_lesson', '🎓', 'Первый урок', 'Пройди первый урок', (s) => Object.keys(s.done).length >= 1],
    ['fixer', '🔧', 'Починил!', 'Исправь ошибку в коде', (s) => s.stats.fixed >= 1],
    ['fixer10', '🛠️', 'Мастер починки', 'Исправь 10 ошибок', (s) => s.stats.fixed >= 10],
    ['lessons10', '📗', '10 уроков', 'Пройди 10 уроков', (s) => Object.keys(s.done).length >= 10],
    ['lessons25', '📘', '25 уроков', 'Пройди 25 уроков', (s) => Object.keys(s.done).length >= 25],
    ['lessons50', '📙', '50 уроков', 'Пройди 50 уроков', (s) => Object.keys(s.done).length >= 50],
    ['solo5', '🧠', 'Сам с усам', '5 уроков без подсказок и решений', (s) => Object.values(s.done).filter((d) => !d.hints && !d.sol).length >= 5],
    ['solo20', '🦾', 'Самостоятельный', '20 уроков без подсказок и решений', (s) => Object.values(s.done).filter((d) => !d.hints && !d.sol).length >= 20],
    ['quiz10', '❓', 'Знаток', '10 верных ответов в тестах с первой попытки', (s) => Object.values(s.quiz).reduce((a, b) => a + b, 0) >= 10],
    ['quiz40', '🎯', 'Эрудит', '40 верных ответов в тестах с первой попытки', (s) => Object.values(s.quiz).reduce((a, b) => a + b, 0) >= 40],
    ['streak3', '🔥', '3 дня подряд', 'Занимайся 3 дня подряд', (s) => (s.streak.best || 0) >= 3],
    ['streak7', '⚡', 'Неделя кода', 'Занимайся 7 дней подряд', (s) => (s.streak.best || 0) >= 7],
    ['streak30', '🌟', 'Месяц кода', 'Занимайся 30 дней подряд', (s) => (s.streak.best || 0) >= 30],
    ['night', '🦉', 'Ночной кодер', 'Пройди урок после 23:00', (s) => !!s.ach.night],
    ['early', '🐦', 'Ранняя пташка', 'Пройди урок до 7 утра', (s) => !!s.ach.early],
    ['inventor', '🧪', 'Изобретатель', 'Сохрани свой проект в песочнице', (s) => s.projects.length >= 1],
    ['runs100', '🏃', 'Сто запусков', 'Запусти код 100 раз', (s) => s.stats.runs >= 100],
    ['polyglot', '🗣️', 'Полиглот', 'Послушай произношение 15 слов в словаре', (s) => (s.stats.spoken || 0) >= 15],
    ['firstgame', '👾', 'Первая игра', 'Закончи первый игровой проект', (s) => window.COURSE.some((m) => m.project && m.lessons.every((l) => s.done[l.id]))],
    ['graduate', '🏆', 'Выпускник', 'Пройди весь курс', (s) => Course.overall().pct === 100]
  ];

  function allAchievements() {
    const list = ACH.map(([id, icon, title, desc, check]) => ({ id, icon, title, desc, check }));
    window.COURSE.forEach((m) => list.push({
      id: 'mod_' + m.id, icon: m.icon, title: 'Модуль: ' + m.title, desc: 'Пройди все уроки модуля',
      check: (s) => m.lessons.every((l) => s.done[l.id])
    }));
    return list;
  }

  // проверяет, не появились ли новые достижения; возвращает список новых
  function checkAchievements() {
    const s = Store.s;
    const fresh = [];
    for (const a of allAchievements()) {
      if (s.ach[a.id] && s.ach[a.id] !== true) continue;
      if (a.id === 'night' || a.id === 'early') { if (s.ach[a.id] === true) { s.ach[a.id] = Store.today(); fresh.push(a); } continue; }
      let ok = false;
      try { ok = a.check(s); } catch (e) { ok = false; }
      if (ok) { s.ach[a.id] = Store.today(); fresh.push(a); }
    }
    if (fresh.length) {
      Store.save();
      fresh.forEach((a, k) => setTimeout(() => {
        UI.toast(`<span class="ach-toast-icon">${a.icon}</span><div><b>Достижение!</b><br>${UI.esc(a.title)}</div>`, 'ach', 4200);
      }, 600 + k * 900));
    }
    return fresh;
  }

  window.Course = Course;
  window.Progress = { levelInfo, allAchievements, checkAchievements, LEVELS };
})();
