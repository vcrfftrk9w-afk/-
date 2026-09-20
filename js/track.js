'use strict';
/* =========================================================
   TRACK — контроль дня: подъём, сон, вода, еда, калории,
   таблетки, кофе, тренировка. Всё пишется по дням.
   ========================================================= */

const Track = (() => {

  const blank = () => ({
    wakeAt: null, sleepAt: null,
    water: 0, coffee: 0,
    meals: [],          // [{ at, kcal, title }]
    pills: {},          // { pillId: timestamp }
    busy: [],           // [{ id, title, start, end }] — встречи, работа, учёба
    workout: 0,         // минут
    closed: false,
  });

  function profile() {
    const s = State.s;
    if (!s.profile) s.profile = {
      chronotype: 'neutral', wakeTarget: 420, sleepTarget: 1380,
      workStart: 540, workEnd: 1080, waterGoal: 8, kcalGoal: 2000,
      mealsGoal: 3, sleepGoal: 8, pills: [], strict: true,
    };
    if (!Array.isArray(s.profile.pills)) s.profile.pills = [];
    return s.profile;
  }

  function get(key) {
    const s = State.s;
    if (!s.day) s.day = {};
    const k = key || State.todayKey();
    if (!s.day[k]) s.day[k] = blank();
    const d = s.day[k];
    if (!Array.isArray(d.meals)) d.meals = [];
    if (!d.pills) d.pills = {};
    if (!Array.isArray(d.busy)) d.busy = [];
    return d;
  }

  const today = () => get(State.todayKey());

  /* ---------- минуты от полуночи ---------- */
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const hhmm = (min) => {
    const m = ((Math.round(min) % 1440) + 1440) % 1440;
    const h = Math.floor(m / 60), mm = m % 60;
    return `${h < 10 ? '0' + h : h}:${mm < 10 ? '0' + mm : mm}`;
  };
  const parseHHMM = (str) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec((str || '').trim());
    if (!m) return null;
    const h = Math.min(23, Number(m[1])), mm = Math.min(59, Number(m[2]));
    return h * 60 + mm;
  };

  /* ---------- события дня ---------- */
  function wake(atMin) {
    const d = today();
    d.wakeAt = atMin === undefined ? nowMin() : atMin;
    State.registerActivity();
    State.s.totals.daysLogged = (State.s.totals.daysLogged || 0) + 1;
    State.emit('dayEvent', { kind: 'wake', value: d.wakeAt });
    State.commit();
    return d.wakeAt;
  }

  function sleep(atMin) {
    const d = today();
    d.sleepAt = atMin === undefined ? nowMin() : atMin;
    d.closed = true;
    State.emit('dayEvent', { kind: 'sleep', value: d.sleepAt });
    State.commit();
    return d.sleepAt;
  }

  function water(delta, silent) {
    const d = today();
    d.water = Math.max(0, (d.water || 0) + delta);
    if (delta > 0) State.s.totals.waterGlasses = (State.s.totals.waterGlasses || 0) + delta;
    State.emit('dayEvent', { kind: 'water', value: d.water });
    if (silent) State.save(); else State.commit();
    return d.water;
  }

  function coffee(delta, silent) {
    const d = today();
    d.coffee = Math.max(0, (d.coffee || 0) + delta);
    if (silent) State.save(); else State.commit();
    return d.coffee;
  }

  function meal(kcal, title) {
    const d = today();
    d.meals.push({ at: nowMin(), kcal: Math.max(0, Math.round(Number(kcal) || 0)), title: (title || '').slice(0, 40) });
    State.emit('dayEvent', { kind: 'meal', value: d.meals.length });
    State.commit();
    return d.meals.length;
  }

  function removeMeal(i) {
    const d = today();
    d.meals.splice(i, 1);
    State.commit();
  }

  function workout(minutes, silent) {
    const d = today();
    d.workout = Math.max(0, (d.workout || 0) + Math.round(minutes));
    if (silent) State.save(); else State.commit();
    return d.workout;
  }

  /* ---------- занятые часы ---------- */
  function addBusy(title, fromStr, toStr) {
    const d = today();
    const a = parseHHMM(fromStr), b = parseHHMM(toStr);
    if (a === null || b === null || b <= a) return false;
    d.busy.push({ id: State.uid(), title: (title || 'Занято').slice(0, 40), start: a, end: b });
    d.busy.sort((x, y) => x.start - y.start);
    State.commit();
    return true;
  }
  function removeBusy(id) {
    const d = today();
    d.busy = d.busy.filter((x) => x.id !== id);
    State.commit();
  }

  function pill(id) {
    const d = today();
    if (d.pills[id]) delete d.pills[id];
    else d.pills[id] = Date.now();
    State.commit();
    return !!d.pills[id];
  }

  function addPill(name, timeStr) {
    const p = profile();
    p.pills.push({ id: State.uid(), name: (name || 'Витамин').slice(0, 30), at: parseHHMM(timeStr) ?? 9 * 60 });
    p.pills.sort((a, b) => a.at - b.at);
    State.commit();
  }

  function removePill(id) {
    const p = profile();
    p.pills = p.pills.filter((x) => x.id !== id);
    State.commit();
  }

  /* ---------- производные ---------- */
  const kcal = (key) => get(key).meals.reduce((a, m) => a + (m.kcal || 0), 0);
  const lastMealMin = (key) => { const ms = get(key).meals; return ms.length ? ms[ms.length - 1].at : null; };

  /* сколько спал: от отбоя прошлой ночи до сегодняшнего подъёма */
  function sleptHours(key) {
    const k = key || State.todayKey();
    const d = get(k);
    const prevKey = State.dateKey(new Date(new Date(k).getTime() - 86400000));
    const prev = State.s.day && State.s.day[prevKey];
    if (d.wakeAt === null || !prev || prev.sleepAt === null) return null;
    let mins = d.wakeAt + (1440 - prev.sleepAt);
    if (prev.sleepAt < 12 * 60) mins = d.wakeAt - prev.sleepAt;  // лёг уже после полуночи
    if (mins <= 0 || mins > 16 * 60) return null;
    return Math.round((mins / 60) * 10) / 10;
  }

  const awakeMinutes = () => { const d = today(); return d.wakeAt === null ? null : Math.max(0, nowMin() - d.wakeAt); };

  /* ---------- оценка режима 0..100 ---------- */
  function score(key) {
    const p = profile();
    const d = get(key);
    const parts = [];

    if (d.wakeAt !== null) {
      const off = Math.abs(d.wakeAt - p.wakeTarget);
      parts.push({ id: 'wake', label: 'Подъём вовремя', v: Math.max(0, 1 - off / 120), w: 22 });
    } else parts.push({ id: 'wake', label: 'Подъём не отмечен', v: 0, w: 22 });

    parts.push({ id: 'water', label: 'Вода', v: Math.min(1, (d.water || 0) / (p.waterGoal || 8)), w: 18 });

    const meals = d.meals.length;
    parts.push({ id: 'meals', label: 'Приёмы пищи', v: Math.min(1, meals / (p.mealsGoal || 3)), w: 18 });

    const sh = sleptHours(key);
    parts.push({ id: 'sleep', label: 'Сон', v: sh === null ? 0 : Math.max(0, 1 - Math.abs(sh - (p.sleepGoal || 8)) / 4), w: 22 });

    if (p.pills.length) {
      const taken = p.pills.filter((x) => d.pills[x.id]).length;
      parts.push({ id: 'pills', label: 'Таблетки и витамины', v: taken / p.pills.length, w: 10 });
    }

    parts.push({ id: 'move', label: 'Движение', v: Math.min(1, (d.workout || 0) / 30), w: 10 });

    const totalW = parts.reduce((a, x) => a + x.w, 0);
    const value = Math.round(parts.reduce((a, x) => a + x.v * x.w, 0) / totalW * 100);
    return { value, parts };
  }

  /* средний режим за N дней */
  function scoreAvg(days) {
    let sum = 0, n = 0;
    for (let i = 0; i < days; i++) {
      const k = State.daysAgoKey(i);
      if (!State.s.day || !State.s.day[k]) continue;
      sum += score(k).value; n++;
    }
    return n ? Math.round(sum / n) : 0;
  }

  /* ---------- что прямо сейчас просрочено ---------- */
  function nudges() {
    const p = profile();
    const d = today();
    const now = nowMin();
    const out = [];

    if (d.wakeAt === null && now > p.wakeTarget + 30 && now < 14 * 60) {
      out.push({ id: 'wake', emoji: '☀️', text: 'Подъём не отмечен — во сколько ты встал?' });
    }
    if (d.wakeAt !== null) {
      const awake = now - d.wakeAt;
      const expectWater = Math.min(p.waterGoal, Math.ceil(awake / 90));
      if ((d.water || 0) < expectWater - 1) {
        out.push({ id: 'water', emoji: '💧', text: `Воды выпито ${d.water || 0} из ${expectWater} к этому часу` });
      }
      if (awake > 120 && !d.meals.length) {
        out.push({ id: 'meal', emoji: '🍳', text: 'Ты не ел уже 2 часа после подъёма' });
      }
      const lm = lastMealMin();
      if (lm !== null && now - lm > 300) {
        out.push({ id: 'meal2', emoji: '🍽️', text: `С последней еды прошло ${Math.floor((now - lm) / 60)} ч` });
      }
    }
    p.pills.forEach((x) => {
      if (!d.pills[x.id] && now > x.at + 30) out.push({ id: 'pill-' + x.id, emoji: '💊', text: `${x.name} — по плану в ${hhmm(x.at)}` });
    });
    const bedEff = p.sleepTarget > (d.wakeAt !== null ? d.wakeAt : p.wakeTarget) + 120 ? p.sleepTarget : p.sleepTarget + 1440;
    if (bedEff <= 1440 && now > p.sleepTarget && d.sleepAt === null) {
      out.push({ id: 'sleep', emoji: '🌙', text: `Отбой был назначен на ${hhmm(p.sleepTarget)}` });
    }
    return out;
  }

  return {
    profile, get, today, blank,
    nowMin, hhmm, parseHHMM,
    wake, sleep, water, coffee, meal, removeMeal, workout, pill, addPill, removePill, addBusy, removeBusy,
    kcal, lastMealMin, sleptHours, awakeMinutes, score, scoreAvg, nudges,
  };
})();
