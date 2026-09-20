'use strict';
/* =========================================================
   CHILL — контролируемое залипание.
   «Посмотрю одно видео» превращается в три часа, потому что решение
   «хватит» приходится принимать уставшим и в момент удовольствия.
   Здесь решение принимается ЗАРАНЕЕ, а выход — громкий и обязательный.
   ========================================================= */

const Chill = (() => {
  const { $ } = UI;
  let T = null;        // { taskId, title, total, left, raf, startedAt, over }
  let tickId = null;

  function isOpen() { return !!T; }

  function start(minutes, title, taskId) {
    if (T) return;
    const mins = Math.max(1, Math.min(120, Math.round(minutes || 15)));
    T = { taskId: taskId || null, title: title || 'Залипание', total: mins * 60, left: mins * 60, startedAt: Date.now(), over: 0 };
    render();
    $('#chill').classList.remove('hidden');
    document.body.classList.add('modal-lock');
    Sound.sfx('start');
    clearInterval(tickId);
    tickId = setInterval(tick, 1000);
  }

  function tick() {
    if (!T) return;
    if (T.left > 0) {
      T.left -= 1;
      if (T.left === 60) UI.toast('Минута до конца — досматривай', 'warn', '⏳');
      if (T.left === 0) timeUp();
    } else {
      T.over += 1;
      if (T.over % 60 === 0) {
        Sound.sfx('deny');
        FX.vibrate([90, 60, 90]);
      }
    }
    render();
  }

  function timeUp() {
    Sound.sfx('fanfare');
    FX.vibrate([140, 70, 140]);
    const el = $('#chill');
    if (el) el.classList.add('over');
    try {
      if (State.s.notifications && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('⏰ Время залипания вышло', { body: 'Ты обещал себе остановиться здесь.' });
      }
    } catch (e) { /* не поддерживается */ }
  }

  const fmt = (sec) => {
    const s = Math.max(0, Math.round(sec));
    const m = Math.floor(s / 60), r = s % 60;
    return `${m < 10 ? '0' + m : m}:${r < 10 ? '0' + r : r}`;
  };

  function render() {
    if (!T) return;
    const el = $('#chill');
    if (!el) return;
    const over = T.left <= 0;
    const pct = over ? 100 : (1 - T.left / T.total) * 100;
    const R = 2 * Math.PI * 88;

    el.querySelector('#chill-title').textContent = T.title;
    el.querySelector('#chill-time').textContent = over ? '+' + fmt(T.over) : fmt(T.left);
    el.querySelector('#chill-ring-fg').style.strokeDasharray = R;
    el.querySelector('#chill-ring-fg').style.strokeDashoffset = R * (1 - Math.min(1, pct / 100));
    const overMin = Math.floor(T.over / 60);
    el.querySelector('#chill-sub').textContent = over
      ? (overMin < 1
          ? 'Время вышло. Ты обещал себе остановиться здесь.'
          : `Время вышло ${UI.plur(overMin, 'минуту', 'минуты', 'минут')} назад. Каждая минута сверху — из завтрашнего дня.`)
      : `Ты сам дал себе ${UI.plur(Math.round(T.total / 60), 'минуту', 'минуты', 'минут')}. Досмотри и выходи.`;
    el.querySelector('#chill-done').textContent = over ? 'Всё, выхожу' : 'Хватит, выхожу раньше';
  }

  function stop(finished) {
    if (!T) return;
    clearInterval(tickId); tickId = null;
    const overMin = Math.round(T.over / 60);
    const usedMin = Math.round((T.total - Math.max(0, T.left)) / 60);
    const taskId = T.taskId;
    const title = T.title;
    const wasOver = T.over > 0;
    T = null;

    const el = $('#chill');
    el.classList.add('hidden');
    el.classList.remove('over');
    // под залипанием могла остаться открытая модалка — не снимаем блокировку прокрутки зря
    if (!document.querySelector('.modal.modal-open')) document.body.classList.remove('modal-lock');

    if (finished && taskId) {
      const t = State.s.tasks.find((x) => x.id === taskId);
      if (t && !t.done) Screens.tasks.complete(t);
    }

    if (!wasOver) {
      State.s.totals.chillKept = (State.s.totals.chillKept || 0) + 1;
      State.addXP(35, 'discipline');
      State.addCoins(40);
      Sound.sfx('success');
      FX.confetti(window.innerWidth / 2, window.innerHeight * 0.3, 30);
      UI.toast(`Вышел вовремя: ${UI.plur(usedMin, 'минута', 'минуты', 'минут')} вместо бесконечности. +35 XP`, 'level', '🍿');
    } else {
      State.s.totals.chillOver = (State.s.totals.chillOver || 0) + 1;
      UI.toast(overMin < 1
        ? 'Перебрал совсем чуть-чуть. В следующий раз выйди по звонку.'
        : `Перебрал ${UI.plur(overMin, 'минуту', 'минуты', 'минут')}. Не страшно — в следующий раз выйди по звонку.`, 'warn', '⏰');
    }
    State.commit();
  }

  /* статистика: как часто удаётся выйти вовремя */
  function stats() {
    const kept = State.s.totals.chillKept || 0;
    const over = State.s.totals.chillOver || 0;
    const total = kept + over;
    return { kept, over, total, pct: total ? Math.round((kept / total) * 100) : null };
  }

  function bind() {
    const el = $('#chill');
    if (!el) return;
    el.querySelector('#chill-done').addEventListener('click', () => stop(true));
    el.querySelector('#chill-more').addEventListener('click', () => {
      if (!T) return;
      T.left = Math.max(T.left, 0) + 5 * 60;
      T.over = 0;
      el.classList.remove('over');
      Sound.sfx('click');
      UI.toast('Ещё 5 минут. Последние.', 'default', '⏳');
      render();
    });
  }

  return { start, stop, isOpen, bind, stats };
})();
