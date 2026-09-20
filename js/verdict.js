'use strict';
/* =========================================================
   VERDICT — «Что сейчас главное».
   Не список и не совет вообще, а одно решение с разбором:
   почему именно это, почему не остальное и с чего начать.
   Считает по тем же данным, что и планировщик: энергия, дедлайны,
   этап пути, деньги, тело, что заброшено.
   ========================================================= */

const Verdict = (() => {

  /* ---------- сбор кандидатов ---------- */
  function candidates() {
    const s = State.s;
    const today = State.todayKey();
    const now = Track.nowMin();
    const e = Planner.energyAt(now);
    const d = Track.today();
    const out = [];

    const push = (c) => out.push({ pros: [], cons: [], ...c });

    /* тело вперёд головы: голодному и обезвоженному думать нечем */
    if (d.wakeAt !== null) {
      const awake = now - d.wakeAt;
      const lm = Track.lastMealMin();
      if (awake > 150 && !d.meals.length) {
        push({
          id: 'eat', key: 'eat', emoji: '🍳', title: 'Поесть', weight: 96, minutes: 25,
          why: 'Ты на ногах больше двух часов и ещё не ел. Любая сложная задача сейчас будет идти вдвое дольше.',
          pros: ['Мозг работает на глюкозе, а её нет', 'Это займёт 20 минут и вернёт весь день'],
          first: 'Открой холодильник и сделай что угодно с белком.',
          run: () => { App.go('day'); setTimeout(() => Screens.day.quick('meal'), 250); },
        });
      } else if (lm !== null && now - lm > 330) {
        push({
          id: 'eat2', key: 'eat', emoji: '🍽️', title: 'Поесть', weight: 80, minutes: 25,
          why: `С последней еды прошло ${Math.floor((now - lm) / 60)} часов. Раздражение и туман в голове сейчас — это не характер, это сахар.`,
          pros: ['Пять с лишним часов без еды', 'Быстро и возвращает концентрацию'],
          first: 'Что-то простое, не готовку на час.',
          run: () => { App.go('day'); setTimeout(() => Screens.day.quick('meal'), 250); },
        });
      }
      const expectWater = Math.min(Track.profile().waterGoal, Math.ceil(awake / 90));
      if ((d.water || 0) < expectWater - 2) {
        push({
          id: 'water', emoji: '💧', title: 'Выпить воды', weight: 70, minutes: 2,
          why: `К этому часу должно быть ${expectWater} стаканов, а выпито ${d.water || 0}. Обезвоживание бьёт по вниманию раньше, чем по жажде.`,
          pros: ['Две минуты', 'Самый дешёвый способ поднять концентрацию'],
          first: 'Набери стакан прямо сейчас, пока читаешь это.',
          run: () => { Track.water(1); UI.toast('Записал', 'success', '💧'); },
        });
      }
    } else if (now > Track.profile().wakeTarget + 60 && now < 14 * 60) {
      push({
        id: 'wake', emoji: '☀️', title: 'Отметить подъём', weight: 92, minutes: 1,
        why: 'Без времени подъёма приложение не знает, где у тебя пик энергии, и весь план строится вслепую.',
        pros: ['Одна кнопка', 'От неё зависит расписание всего дня'],
        first: 'Нажми «Я проснулся» на вкладке День.',
        run: () => { App.go('day'); setTimeout(() => Screens.day.quick('wake'), 250); },
      });
    }

    /* блок плана, который идёт прямо сейчас */
    const cur = Planner.plan() ? Planner.currentBlock() : null;
    if (cur && cur.kind === 'task' && !Planner.isDone(cur)) {
      push({
        id: 'cur', key: cur.taskId ? 't-' + cur.taskId : 'cur', emoji: cur.emoji, title: cur.title, weight: 88, minutes: cur.end - cur.start,
        why: `Это время ты сам отдал под эту задачу, и оно идёт. Решение уже принято — сейчас его надо просто выполнить.`,
        pros: cur.pros.slice(0, 2).concat([`До ${Track.hhmm(cur.end)} по плану`]),
        cons: cur.cons.slice(0, 1),
        first: 'Открой то, в чём это делается, и поставь таймер.',
        run: () => { App.go('day'); },
      });
    }

    /* просроченное */
    const overdue = s.tasks.filter((t) => !t.done && t.due && t.due < today);
    if (overdue.length) {
      const t = overdue[0];
      push({
        id: 'over-' + t.id, key: 't-' + t.id, emoji: '🔥', title: t.title, weight: 86, minutes: Planner.taskDuration(t),
        why: `Срок прошёл ${UI.plur(Math.abs(State.daysBetween(t.due, today)), 'день', 'дня', 'дней')} назад. Просроченное дело давит фоном и съедает силы, даже когда ты им не занимаешься.`,
        pros: ['Дедлайн уже нарушен', overdue.length > 1 ? `И таких ещё ${overdue.length - 1}` : 'Оно одно такое — добей и забудь'],
        first: 'Не делай идеально. Сделай на «сойдёт» и закрой.',
        run: () => { App.go('tasks'); },
      });
    }

    /* сгоревшие блоки сегодняшнего плана: это не «просрочено вообще»,
       а «ты сам отвёл под это время сегодня, и оно прошло» */
    const missed = (typeof Planner !== 'undefined' && Planner.plan()) ? Planner.missed() : [];
    if (missed.length) {
      const m = missed[0];
      const late = now - m.end;
      push({
        id: 'missed', key: m.taskId ? 't-' + m.taskId : (m.pathId ? 'p-' + m.pathId : m.id),
        emoji: m.emoji, title: m.title, weight: 87, minutes: m.end - m.start,
        why: `Это стояло в плане на ${Track.hhmm(m.start)} и не сделано — ${UI.plur(Math.max(1, Math.round(late / 60)), 'час', 'часа', 'часов')} назад. ${missed.length > 1 ? `Таких сегодня ${missed.length}: чем дольше они висят, тем тяжелее к ним подойти.` : 'Пока оно висит, оно продолжает забирать внимание.'}`,
        pros: [`По плану было в ${Track.hhmm(m.start)}`, missed.length > 1 ? `Всего пропущено сегодня: ${missed.length}` : 'Осталось только это'],
        cons: [],
        first: 'Сделай самую маленькую часть — или честно перенеси кнопкой «Догнать план».',
        run: () => App.go('day'),
      });
    }

    /* задача с жёстким временем, которая скоро */
    const soon = Planner.blocks().find((b) => b.pinned && !Planner.isDone(b) && b.start - now > 0 && b.start - now <= 45);
    if (soon) {
      push({
        id: 'soon', key: soon.taskId ? 't-' + soon.taskId : 'soon', emoji: '⏰', title: soon.title, weight: 84, minutes: soon.end - soon.start,
        why: `Через ${soon.start - now} минут у тебя жёсткое время. Начинать сейчас что-то длинное — значит гарантированно это сорвать.`,
        pros: [`Ровно в ${Track.hhmm(soon.start)}`, 'Лучше подготовиться, чем метаться в последнюю минуту'],
        first: 'Подготовь всё, что нужно, чтобы в нужную минуту просто нажать кнопку.',
        run: () => { App.go('day'); },
      });
    }

    /* босс-задача на пике энергии */
    const boss = s.tasks.filter((t) => !t.done && (t.priority === 'boss' || t.priority === 'high') && (t.at === null || t.at === undefined));
    if (boss.length && e >= 0.75) {
      const t = boss[0];
      push({
        id: 'boss-' + t.id, key: 't-' + t.id, emoji: '💼', title: t.title, weight: 82, minutes: Planner.taskDuration(t),
        why: `Сейчас ${Math.round(e * 100)}% энергии — это твой верх. Такие окна за день бывают один-два раза, и тратить их на мелочь — самая дорогая ошибка дня.`,
        pros: [`Пик энергии ${Math.round(e * 100)}%`, t.priority === 'boss' ? 'Босс-задача' : 'Важная задача'],
        first: 'Поставь таймер на 25 минут и сделай только первый кусок.',
        run: () => { App.go('tasks'); },
      });
    }

    /* шаг пути к деньгам */
    if (typeof Path !== 'undefined') {
      const n = Path.nextStep();
      const doneToday = Path.ALL.some((x) => {
        const ts = s.path.done[x.id];
        return ts && State.dateKey(new Date(ts)) === today;
      });
      if (n && !doneToday) {
        push({
          id: 'path', key: 'p-' + n.step.id, emoji: n.stage.emoji, title: `Шаг пути: ${n.step.t}`, weight: e >= 0.7 ? 78 : 62, minutes: 30,
          why: `Всё остальное в списке — это сегодняшний день. Этот шаг — единственное, что двигает тебя с места, где ты сейчас, туда, где хочешь быть.`,
          pros: ['Без него остальное — бег на месте', `Этап «${n.stage.name}»`],
          cons: e < 0.6 ? ['Энергии сейчас маловато для нового'] : [],
          first: n.step.how[0],
          run: () => { App.go('path'); },
        });
      }
    }

    /* заброшенная привычка */
    const habits = s.habits.filter((h) => !h.history[today]);
    if (habits.length) {
      const h = habits.sort((a, b) => State.habitStreak(b) - State.habitStreak(a))[0];
      const streak = State.habitStreak(h);
      if (streak >= 2) {
        push({
          id: 'habit', key: 'h-' + h.id, emoji: h.emoji || '🔥', title: h.name, weight: 66 + Math.min(14, streak), minutes: 15,
          why: `Серия ${UI.plur(streak, 'день', 'дня', 'дней')}. Обрывать её сегодня обиднее всего — на восстановление уйдёт больше сил, чем на сегодняшний раз.`,
          pros: [`Серия ${streak} — жалко терять`, 'Обычно это минут пятнадцать'],
          first: 'Сделай минимальную версию. Засчитывается.',
          run: () => { App.go('habits'); },
        });
      }
    }

    /* деньги: цифры не заполнены */
    if (typeof Path !== 'undefined') {
      const m = Path.money();
      if (!m.income || !m.expenses) {
        push({
          id: 'money', emoji: '🧮', title: 'Вписать свои цифры', weight: 60, minutes: 15,
          why: 'Пока приложение не знает твой доход и расход, все разговоры о заработке — абстракция. С цифрами оно скажет, сколько лет до первого миллиона.',
          pros: ['15 минут один раз', 'После этого путь становится конкретным'],
          first: 'Открой банковское приложение и посмотри прошлый месяц.',
          run: () => { App.go('path'); },
        });
      }
    }

    /* низкая энергия — честно предложить отдых, а не подвиг */
    if (e < 0.4) {
      push({
        id: 'rest', emoji: '🛋️', title: 'Не геройствовать', weight: 58, minutes: 20,
        why: `Энергии ${Math.round(e * 100)}%. В таком состоянии сложная задача займёт втрое больше времени и выйдет хуже. Это не лень — это физиология.`,
        pros: ['Спад энергии — данные, а не оправдание', 'После двадцати минут отдыха вернёшься быстрее'],
        first: 'Ляг на 20 минут без телефона. Или сделай мелочь из списка.',
        run: () => { App.go('adhd'); },
      });
    }

    /* залипание — только если всё важное закрыто */
    const chillTask = s.tasks.find((t) => !t.done && t.chill);
    if (chillTask) {
      const bigLeft = s.tasks.filter((t) => !t.done && !t.chill && (t.priority === 'boss' || t.priority === 'high')).length;
      push({
        id: 'chill', key: 't-' + chillTask.id, emoji: '🍿', title: chillTask.title, weight: bigLeft ? 22 : 54, minutes: chillTask.estimate || 15,
        why: bigLeft
          ? `Отдых заслуженный, но не сейчас: в списке ещё ${UI.plur(bigLeft, 'важное дело', 'важных дела', 'важных дел')}. Залипание до работы превращается в залипание вместо работы.`
          : 'Важное на сегодня закрыто. Это честный отдых — с таймером, чтобы одно видео осталось одним.',
        pros: bigLeft ? [] : ['Важное сделано', 'Таймер не даст утонуть'],
        cons: bigLeft ? [`Не закрыто важного: ${bigLeft}`] : [],
        first: 'Запусти таймер и договорись с собой заранее.',
        run: () => { if (typeof Chill !== 'undefined') Chill.start(chillTask.estimate || 15, chillTask.title, chillTask.id); },
      });
    }

    /* совсем пусто */
    if (!out.length) {
      push({
        id: 'plan', emoji: '🧠', title: 'Собрать план дня', weight: 50, minutes: 5,
        why: 'Срочного нет, тело в порядке. Лучшее вложение пяти минут — разложить день по часам, чтобы потом не решать это на ходу.',
        pros: ['Решение принимается один раз', 'Дальше день идёт сам'],
        first: 'Нажми «Собрать план дня».',
        run: () => { Planner.build({}); App.go('day'); },
      });
    }

    // одно и то же дело не должно попасть в разбор дважды:
    // задача может быть и просроченной, и важной — считаем сильнейшую версию
    const byKey = new Map();
    out.sort((a, b) => b.weight - a.weight).forEach((c) => {
      const k = c.key || c.id;
      if (!byKey.has(k)) byKey.set(k, c);
    });
    return [...byKey.values()];
  }

  /* ---------- вердикт ---------- */
  function decide() {
    const list = candidates();
    const top = list[0];
    /* последняя страховка: одно и то же дело не должно оказаться
       и главным, и в списке «почему не это» */
    const rest = list.slice(1).filter((x) => x.title !== top.title).slice(0, 3);
    return { top, rest, all: list };
  }

  function open() {
    const v = decide();
    const t = v.top;
    const e = Planner.energyAt(Track.nowMin());

    const body = UI.sheet(`
      <div class="verdict">
        <div class="why-tag">Разбор на ${Track.hhmm(Track.nowMin())} · энергия ${Math.round(e * 100)}%</div>
        <div class="verdict-top">
          <div class="verdict-emoji">${t.emoji}</div>
          <div>
            <small>Главное прямо сейчас</small>
            <h2>${UI.esc(t.title)}</h2>
            <i>примерно ${UI.plur(t.minutes, 'минута', 'минуты', 'минут')}</i>
          </div>
        </div>
        <p class="verdict-why">${UI.esc(t.why)}</p>
        ${t.pros.length ? `<div class="why-col pro"><b>Почему это</b><ul>${t.pros.map((x) => `<li>${UI.esc(x)}</li>`).join('')}</ul></div>` : ''}
        ${t.cons.length ? `<div class="why-col con"><b>Что против</b><ul>${t.cons.map((x) => `<li>${UI.esc(x)}</li>`).join('')}</ul></div>` : ''}
        <div class="verdict-first"><b>С чего начать</b><p>${UI.esc(t.first)}</p></div>
        ${v.rest.length ? `
          <div class="verdict-rest">
            <b>Почему не это</b>
            ${v.rest.map((r) => `
              <div class="vr-item">
                <span>${r.emoji}</span>
                <div><b>${UI.esc(r.title)}</b><small>${UI.esc(r.cons.length ? r.cons[0] : 'Подождёт — сейчас есть важнее')}</small></div>
              </div>`).join('')}
          </div>` : ''}
        <div class="why-actions">
          <button class="btn btn-primary btn-lg" id="v-go">Делаю это</button>
          <button class="btn btn-ghost" id="v-next">Не сейчас, что ещё?</button>
        </div>
      </div>`, { wide: true });

    body.querySelector('#v-go').onclick = () => { UI.closeModal('#sheet-modal'); setTimeout(() => t.run(), 200); };
    body.querySelector('#v-next').onclick = () => {
      UI.closeModal('#sheet-modal');
      const alt = v.rest[0];
      if (!alt) { UI.toast('Больше вариантов нет — это и есть главное', 'default', '🧠'); return; }
      setTimeout(() => {
        const b2 = UI.sheet(`
          <div class="verdict">
            <div class="why-tag">Следующий по важности</div>
            <div class="verdict-top"><div class="verdict-emoji">${alt.emoji}</div>
              <div><small>Тогда это</small><h2>${UI.esc(alt.title)}</h2><i>примерно ${UI.plur(alt.minutes, 'минута', 'минуты', 'минут')}</i></div></div>
            <p class="verdict-why">${UI.esc(alt.why)}</p>
            <div class="verdict-first"><b>С чего начать</b><p>${UI.esc(alt.first)}</p></div>
            <div class="why-actions"><button class="btn btn-primary btn-lg btn-block" id="v-go2">Делаю это</button></div>
          </div>`, { wide: true });
        b2.querySelector('#v-go2').onclick = () => { UI.closeModal('#sheet-modal'); setTimeout(() => alt.run(), 200); };
      }, 220);
    };
    Sound.sfx('quest');
  }

  return { decide, candidates, open };
})();
