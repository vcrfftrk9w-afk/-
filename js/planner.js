'use strict';
/* =========================================================
   PLANNER — «ИИ» распределение задач по дню.
   Строит кривую энергии из твоего режима и реальной статистики,
   раскладывает задачи по свободным слотам и объясняет,
   почему именно сюда: за и против для каждого блока.
   ========================================================= */

const Planner = (() => {

  const MIN = 1440;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- кривая энергии ---------- */
  /* Опорные точки: минут с момента подъёма → уровень 0..1 */
  const CURVE = [
    [0, 0.30], [30, 0.55], [75, 0.80], [110, 0.95], [210, 0.95],
    [270, 0.80], [330, 0.60], [390, 0.48], [430, 0.55], [500, 0.78],
    [580, 0.82], [660, 0.70], [740, 0.55], [820, 0.40], [900, 0.28], [1020, 0.15],
  ];

  function baseEnergy(sinceWake) {
    if (sinceWake < 0) return 0.05;
    for (let i = 0; i < CURVE.length - 1; i++) {
      const [x1, y1] = CURVE[i], [x2, y2] = CURVE[i + 1];
      if (sinceWake <= x2) {
        const t = (sinceWake - x1) / (x2 - x1);
        return y1 + (y2 - y1) * clamp(t, 0, 1);
      }
    }
    return 0.12;
  }

  /* реальные данные: в какие часы ты чаще всего работал */
  function realCurve() {
    const h = State.s.focusByHour || {};
    const vals = Object.values(h);
    const total = vals.reduce((a, b) => a + b, 0);
    if (total < 10) return null;
    const max = Math.max(...vals);
    const out = {};
    for (let i = 0; i < 24; i++) out[i] = max ? (h[i] || 0) / max : 0;
    return out;
  }

  /* итоговая энергия в конкретную минуту суток */
  function energyAt(minute) {
    const p = Track.profile();
    const d = Track.today();
    const wake = d.wakeAt !== null ? d.wakeAt : p.wakeTarget;
    let e = baseEnergy(minute - wake);

    // хронотип смещает акценты
    const hour = Math.floor(minute / 60);
    if (p.chronotype === 'lark') e += hour < 12 ? 0.08 : (hour >= 19 ? -0.10 : 0);
    if (p.chronotype === 'owl') e += hour >= 17 ? 0.10 : (hour < 10 ? -0.10 : 0);

    // провал после еды: 40 минут вялости
    Track.today().meals.forEach((m) => {
      const dt = minute - m.at;
      if (dt >= 0 && dt < 50) e -= 0.18 * (1 - dt / 50);
    });

    // подмешиваем реальную статистику
    const rc = realCurve();
    if (rc) e = e * 0.68 + (rc[hour] || 0) * 0.32;

    // ночь — почти ноль
    if (minute >= p.sleepTarget || minute < Math.min(wake, p.wakeTarget)) e = Math.min(e, 0.12);

    return clamp(e, 0.05, 1);
  }

  function energyOver(start, end) {
    let sum = 0, n = 0;
    for (let m = start; m < end; m += 10) { sum += energyAt(m); n++; }
    return n ? sum / n : energyAt(start);
  }

  /* ---------- характеристики задачи ---------- */
  const DUR = { boss: 90, high: 45, mid: 25, low: 15 };
  const PRI_W = { boss: 1.0, high: 0.8, mid: 0.5, low: 0.3 };

  /* тип нагрузки выводим из категории */
  const KIND_BY_CAT = {
    work: 'deep', study: 'deep', money: 'deep',
    creative: 'creative', social: 'social',
    health: 'body', home: 'body', other: 'admin',
  };
  const KIND_LABEL = {
    deep: 'глубокая работа', shallow: 'обычная работа', creative: 'творчество',
    social: 'общение', body: 'тело и быт', admin: 'мелочи',
  };
  /* сколько энергии типу задачи нужно КАК МИНИМУМ */
  const NEED = { deep: 0.82, shallow: 0.55, creative: 0.68, social: 0.5, body: 0.42, admin: 0.28 };

  function taskDuration(t) {
    if (t.estimate) return clamp(t.estimate, 10, 240);
    const base = DUR[t.priority] || 25;
    const subs = (t.subtasks || []).length;
    return clamp(base + subs * 8, 10, 240);
  }
  /* категория задаёт характер, приоритет — глубину: мелкая рабочая задача не «глубокая работа» */
  function taskKind(t) {
    const base = KIND_BY_CAT[t.category] || 'admin';
    if (base === 'deep') {
      if (t.priority === 'low') return 'admin';
      if (t.priority === 'mid') return 'shallow';
    }
    if (base === 'creative' && t.priority === 'low') return 'admin';
    return base;
  }

  function urgency(t) {
    const today = State.todayKey();
    if (!t.due) return t.urgent ? 0.7 : 0.25;
    if (t.due < today) return 1;
    if (t.due === today) return 0.9;
    const days = State.daysBetween(today, t.due);
    if (days === 1) return 0.6;
    if (days <= 3) return 0.45;
    return 0.3;
  }

  /* ---------- каркас дня: сон, еда, рутины ---------- */
  function fixedBlocks() {
    const p = Track.profile();
    const d = Track.today();
    const wake = d.wakeAt !== null ? d.wakeAt : p.wakeTarget;
    const out = [];
    const add = (kind, emoji, title, start, end, note) => {
      if (end <= start) return;
      out.push({ id: `f-${kind}-${start}`, kind, emoji, title, start: Math.round(start), end: Math.round(end), fixed: true, note });
    };

    add('wake', '☀️', 'Подъём и утренняя рутина', wake, wake + 30, 'Свет, вода, движение — разгоняют мозг быстрее кофе.');
    add('meal', '🍳', 'Завтрак', wake + 30, wake + 60, 'Белок с утра держит концентрацию до обеда.');
    const lunch = clamp(wake + 330, 11 * 60, 15 * 60);
    add('meal', '🍽️', 'Обед', lunch, lunch + 40, 'После него будет спад — тяжёлое туда не ставим.');
    const dinner = clamp(p.sleepTarget - 210, 17 * 60, 21 * 60);
    add('meal', '🥗', 'Ужин', dinner, dinner + 40, 'За 3 часа до сна — иначе сон будет хуже.');
    if ((p.pills || []).length) {
      p.pills.forEach((x) => add('pill', '💊', x.name, x.at, x.at + 10, 'По расписанию.'));
    }
    add('evening', '🌙', 'Вечерняя рутина и отбой', p.sleepTarget - 45, p.sleepTarget, 'Без экранов — засыпание быстрее на 20 минут.');
    return out.sort((a, b) => a.start - b.start);
  }

  /* свободные промежутки между каркасными блоками */
  function freeSlots(fixed) {
    const p = Track.profile();
    const d = Track.today();
    const wake = d.wakeAt !== null ? d.wakeAt : p.wakeTarget;
    const dayStart = wake + 30;
    const dayEnd = p.sleepTarget - 45;
    const busy = fixed.filter((b) => b.end > dayStart && b.start < dayEnd)
      .map((b) => [b.start, b.end]).sort((a, b) => a[0] - b[0]);

    const slots = [];
    let cursor = dayStart;
    busy.forEach(([s, e]) => {
      if (s - cursor >= 20) slots.push([cursor, s]);
      cursor = Math.max(cursor, e);
    });
    if (dayEnd - cursor >= 20) slots.push([cursor, dayEnd]);
    return slots;
  }

  /* ---------- оценка размещения задачи в конкретное время ---------- */
  function evaluate(task, start, end) {
    const p = Track.profile();
    const kind = taskKind(task);
    const e = energyOver(start, end);
    const need = NEED[kind];
    const pros = [], cons = [];
    let score = 0;

    // 1. энергия — это порог, а не цель: больше нормы всегда лучше для тяжёлого
    const deficit = Math.max(0, need - e);
    const surplus = Math.max(0, e - need);
    score += (1 - clamp(deficit / 0.45, 0, 1)) * 34;

    if (kind === 'deep' || kind === 'creative') {
      score += surplus * 34;   // чем выше пик, тем лучше
      if (e >= 0.88) pros.push(`Пик энергии ${Math.round(e * 100)}% — лучшее время для сложного`);
      else if (deficit === 0) pros.push(`Энергии хватает: ${Math.round(e * 100)}% при нужных ${Math.round(need * 100)}%`);
    } else if (deficit === 0) {
      pros.push(`Энергии достаточно: ${Math.round(e * 100)}%`);
    }
    if (deficit > 0.2) cons.push(`Энергии маловато: ${Math.round(e * 100)}% против нужных ${Math.round(need * 100)}%`);

    // мелочь на пике — растрата лучшего времени дня
    if ((kind === 'admin' || kind === 'shallow' || kind === 'body') && e > 0.8) {
      score -= (e - 0.8) * 90;
      cons.push('Жалко тратить пик энергии на такую задачу — лучше в спад');
    }

    // 2. приоритет
    const pw = PRI_W[task.priority] || 0.5;
    score += pw * 22;
    if (task.priority === 'boss') pros.push('Босс-задача — её вообще нельзя откладывать');
    else if (task.priority === 'high') pros.push('Важная задача');

    // 3. дедлайн
    const u = urgency(task);
    score += u * 24;
    if (task.due && task.due < State.todayKey()) pros.push('Просрочено — дальше тянуть некуда');
    else if (task.due === State.todayKey()) pros.push('Дедлайн сегодня');
    else if (task.urgent) pros.push('Отмечено как срочное');

    // 4. рабочие часы для рабочих задач
    const inWork = start >= p.workStart && end <= p.workEnd;
    if (kind === 'deep' || kind === 'creative') {
      if (inWork) { score += 8; pros.push('Попадает в рабочие часы'); }
      else if (start >= p.workEnd) { score -= 6; cons.push('Уже после рабочего дня'); }
    }

    // 5. штраф за поздний час для тяжёлого
    if (kind === 'deep' && start >= p.sleepTarget - 180) {
      score -= 14; cons.push('Меньше трёх часов до сна — голова уже не та');
    }

    // 6. сразу после еды
    const afterMeal = fixedBlocks().some((b) => b.kind === 'meal' && start >= b.end && start - b.end < 45);
    if (afterMeal && kind === 'deep') { score -= 12; cons.push('Сразу после еды — будет клонить в сон'); }
    if (afterMeal && kind === 'body') { score -= 8; cons.push('Сразу после еды нагрузка на тело — плохая идея'); }

    // 7. раннее утро для общения
    if (kind === 'social' && start < 10 * 60) { score -= 6; cons.push('Слишком рано для звонков и людей'); }

    // 8. тело хорошо заходит в провал после обеда
    if (kind === 'body' && e < 0.6 && start > 12 * 60) { score += 6; pros.push('Спад энергии — как раз время размяться'); }

    return { score, energy: e, pros, cons, kind };
  }

  /* ---------- сборка плана ---------- */
  function build(opts) {
    const o = opts || {};
    const p = Track.profile();
    const fixed = fixedBlocks();
    const slots = freeSlots(fixed).map(([s, e]) => ({ s, e }));

    const today = State.todayKey();
    let pool = State.s.tasks.filter((t) => !t.done).map((t) => ({ ...t, _src: 'task' }));

    // привычки, не отмеченные сегодня — короткие блоки
    State.s.habits.filter((h) => !h.history[today]).forEach((h) => {
      pool.push({
        id: 'h-' + h.id, _src: 'habit', habitId: h.id, title: h.name, emoji: h.emoji || '🔁',
        category: h.skill === 'health' ? 'health' : (h.skill === 'mind' ? 'study' : 'other'),
        priority: 'mid', estimate: 15, due: today, urgent: false, subtasks: [],
      });
    });

    // следующий шаг пути — главное дело дня
    if (typeof Path !== 'undefined') {
      const n = Path.nextStep();
      const doneToday = Path.ALL.some((x) => {
        const ts = State.s.path.done[x.id];
        return ts && State.dateKey(new Date(ts)) === today;
      });
      if (n && !doneToday) {
        pool.push({
          id: 'path-' + n.step.id, _src: 'path', pathId: n.step.id, title: `Шаг пути: ${n.step.t}`,
          emoji: n.stage.emoji, category: 'money', priority: 'high', estimate: 30,
          due: today, urgent: false, subtasks: [],
        });
      }
    }

    // сначала то, что горит
    pool.sort((a, b) => urgency(b) - urgency(a) || (PRI_W[b.priority] || 0) - (PRI_W[a.priority] || 0));
    if (o.max) pool = pool.slice(0, o.max);

    const placed = [];
    const BUFFER = 10;

    pool.forEach((task) => {
      const dur = taskDuration(task);
      let best = null;
      slots.forEach((slot, si) => {
        // пробуем каждые 15 минут внутри слота
        for (let start = slot.s; start + dur <= slot.e; start += 15) {
          const ev = evaluate(task, start, start + dur);
          // небольшой бонус за то, что ставим пораньше в дне при равном счёте
          const tie = (1440 - start) / 20000;
          if (!best || ev.score + tie > best.score + best.tie) best = { ...ev, start, si, tie };
        }
      });
      if (!best) return;
      const end = best.start + dur;
      placed.push({
        id: 'p-' + task.id, kind: 'task', src: task._src || 'task',
        taskId: task._src === 'task' ? task.id : null,
        habitId: task.habitId || null, pathId: task.pathId || null,
        emoji: task.emoji || (Data.categoryById(task.category) || {}).emoji || '✅',
        title: task.title, start: best.start, end,
        score: Math.round(best.score), energy: best.energy,
        pros: best.pros, cons: best.cons, taskKind: best.kind,
        duration: dur,
      });
      // вырезаем занятое время из слота
      const slot = slots[best.si];
      const rest = [];
      if (best.start - slot.s >= 20) rest.push({ s: slot.s, e: best.start });
      if (slot.e - (end + BUFFER) >= 20) rest.push({ s: end + BUFFER, e: slot.e });
      slots.splice(best.si, 1, ...rest);
    });

    const blocks = fixed.concat(placed).sort((a, b) => a.start - b.start);
    State.s.plan = { date: today, blocks, generatedAt: Date.now(), skipped: {} };
    State.s.totals.plansMade = (State.s.totals.plansMade || 0) + 1;
    State.commit();
    return blocks;
  }

  /* ---------- доступ к плану ---------- */
  function plan() {
    const s = State.s;
    if (!s.plan || s.plan.date !== State.todayKey()) return null;
    return s.plan;
  }
  const blocks = () => (plan() ? plan().blocks : []);

  function currentBlock() {
    const now = Track.nowMin();
    return blocks().find((b) => now >= b.start && now < b.end) || null;
  }
  function nextBlock() {
    const now = Track.nowMin();
    return blocks().find((b) => b.start > now) || null;
  }

  /* блок выполнен? задача отмечена или блок каркасный и время прошло */
  function isDone(b) {
    if (b.kind === 'task') {
      if (b.habitId) {
        const h = State.s.habits.find((x) => x.id === b.habitId);
        return !h || !!h.history[State.todayKey()];
      }
      if (b.pathId) return typeof Path !== 'undefined' && Path.isDone(b.pathId);
      const t = State.s.tasks.find((x) => x.id === b.taskId);
      return !t || !!t.done;
    }
    if (b.kind === 'meal') return Track.today().meals.some((m) => Math.abs(m.at - b.start) < 90);
    if (b.kind === 'wake') return Track.today().wakeAt !== null;
    if (b.kind === 'pill') {
      const pill = Track.profile().pills.find((x) => x.name === b.title);
      return !!(pill && Track.today().pills[pill.id]);
    }
    if (b.kind === 'evening') return Track.today().sleepAt !== null;
    return false;
  }

  function skip(id) {
    const pl = plan();
    if (!pl) return;
    pl.skipped[id] = Date.now();
    State.commit();
  }

  /* перенести оставшиеся невыполненные задачи на свободное время */
  function reschedule() {
    if (!plan()) return build({});
    return build({});
  }

  /* сколько по плану сделано */
  function progress() {
    const bs = blocks();
    if (!bs.length) return { done: 0, total: 0, pct: 0 };
    const done = bs.filter(isDone).length;
    return { done, total: bs.length, pct: Math.round((done / bs.length) * 100) };
  }

  return {
    energyAt, energyOver, build, plan, blocks, currentBlock, nextBlock,
    isDone, skip, reschedule, progress, evaluate,
    taskDuration, taskKind, KIND_LABEL, NEED, fixedBlocks, freeSlots,
  };
})();
