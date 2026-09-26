'use strict';
/* =========================================================
   REMIND — напоминания, которые звонят на телефоне,
   даже когда приложение закрыто.

   Веб-страница не может завести будильник в телефоне сама, а её
   уведомления живут, только пока она открыта. Поэтому график недели
   превращается в файл календаря (.ics): каждое дело — повторяющееся
   событие со звуковым напоминанием. Один раз импортировал — и телефон
   сам зовёт в 19:50 на «кино», в 16:00 на тренировку и так далее.
   ========================================================= */

const Remind = (() => {
  const APP_URL = 'https://claude.ai/artifact/DE7DjuVVbdRMKDwWyUD5UM';
  const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const ORDER = [1, 2, 3, 4, 5, 6, 0];

  /* важное — то, без чего день разваливается */
  const IMPORTANT = new Set([
    'ТТ видео — кино', 'ТТ видео — orca', 'Тренировка', 'Прогулка и восстановление',
    'Работа над заработком', 'Английский', 'Готовка', 'Разбор с ИИ: что получилось и что дальше',
  ]);

  const pad = (n) => String(n).padStart(2, '0');
  const hm = (m) => `${pad(Math.floor(m / 60) % 24)}${pad(m % 60)}00`;
  const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

  /* первый день не раньше `from`, который попадает в нужные дни недели */
  function firstDate(from, days) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    for (let i = 0; i < 7; i++) {
      if (days.indexOf(d.getDay()) !== -1) return d;
      d.setDate(d.getDate() + 1);
    }
    return d;
  }

  /* события недели: одинаковое дело в одно время в разные дни — одно событие */
  function events(opts) {
    const o = Object.assign({ set: 'important', before: 5, road: true, wake: true }, opts || {});
    const map = new Map();
    ORDER.forEach((dow) => {
      Week.scriptFor(dow).forEach((b, i) => {
        let title = null, hard = false, note = '';
        if (b.kind === 'task') {
          if (o.set === 'important' && !IMPORTANT.has(b.task)) return;
          title = `${b.emoji || '⏰'} ${b.title}`;
          hard = !!b.hard;
          const p = Week.PLAN.find((x) => x.title === b.task);
          note = p && p.note ? p.note : '';
        } else if (o.road && b.kind === 'road' && /на учёбу/.test(b.title)) {
          title = '🚌 Выходи на пары';
          note = 'Дорога 30 минут — выйдешь сейчас, успеешь к первой паре.';
        } else if (o.wake && i === 0) {
          title = '☀️ Подъём';
          note = 'Вода, умывание, открой приложение — план дня уже готов.';
        } else return;
        const key = `${title}|${b.start}|${b.end}`;
        if (!map.has(key)) map.set(key, { title, start: b.start, end: Math.min(b.end, 24 * 60 - 1), hard, note, days: [], wake: title === '☀️ Подъём' });
        map.get(key).days.push(dow);
      });
    });
    return Array.from(map.values()).sort((a, b) => a.start - b.start);
  }

  /* ---------- формат iCalendar ---------- */
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

  /* строки длиннее 75 байт переносятся — по байтам UTF-8, не по символам */
  function fold(line) {
    const enc = new TextEncoder();
    if (enc.encode(line).length <= 75) return line;
    const out = [];
    let cur = '', size = 0, limit = 75;
    for (const ch of line) {
      const n = enc.encode(ch).length;
      if (size + n > limit) { out.push(cur); cur = ''; size = 0; limit = 74; }
      cur += ch; size += n;
    }
    out.push(cur);
    return out.join('\r\n ');
  }

  function alarm(minutesBefore, text) {
    return [
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(text)}`,
      `TRIGGER:${minutesBefore > 0 ? `-PT${minutesBefore}M` : 'PT0M'}`, 'END:VALARM',
    ];
  }

  function ics(opts) {
    const o = Object.assign({ set: 'important', before: 5 }, opts || {});
    const from = o.from || new Date();
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lenivec//Iz Lenivca v Millionery//RU',
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Из Ленивца в Миллионеры',
    ];
    events(o).forEach((e) => {
      const day = firstDate(from, e.days);
      const uid = `ldm-${e.days.join('')}-${e.start}-${[...e.title].reduce((h, c) => ((h * 31) + c.codePointAt(0)) >>> 0, 7)}@lenivec`;
      lines.push(
        'BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`,
        `DTSTART:${ymd(day)}T${hm(e.start)}`, `DTEND:${ymd(day)}T${hm(e.end)}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${e.days.map((d) => BYDAY[d]).join(',')}`,
        `SUMMARY:${esc(e.title)}`,
        `DESCRIPTION:${esc((e.note ? e.note + '\n\n' : '') + 'Открыть приложение: ' + APP_URL)}`,
        `URL:${APP_URL}`,
      );
      // публикации — два раза: за 15 минут подготовиться и ровно в срок
      if (e.hard) { lines.push(...alarm(15, `Через 15 минут: ${e.title}`), ...alarm(0, `Сейчас: ${e.title}`)); }
      else if (e.wake) lines.push(...alarm(0, e.title));
      else lines.push(...alarm(o.before, o.before ? `Через ${o.before} мин: ${e.title}` : e.title));
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
  }

  /* ссылка «добавить в Google Календарь» для одного события */
  function googleLink(e, from) {
    const day = firstDate(from || new Date(), e.days);
    const q = new URLSearchParams({
      action: 'TEMPLATE', text: e.title,
      dates: `${ymd(day)}T${hm(e.start)}/${ymd(day)}T${hm(e.end)}`,
      recur: `RRULE:FREQ=WEEKLY;BYDAY=${e.days.map((d) => BYDAY[d]).join(',')}`,
      details: (e.note ? e.note + '\n\n' : '') + APP_URL,
    });
    return 'https://calendar.google.com/calendar/render?' + q.toString();
  }

  /* обычные будильники — громко, для подъёма и двух публикаций */
  function alarmClock() {
    const wk = Week.scriptFor(1)[0], we = Week.scriptFor(6)[0];
    return [
      { time: Track.hhmm(wk.start), days: 'Пн–Пт', what: 'Подъём' },
      { time: Track.hhmm(we.start), days: 'Сб, Вс', what: 'Подъём' },
      { time: '19:45', days: 'каждый день', what: 'Проверить «кино» → публикация 19:55' },
      { time: '20:50', days: 'каждый день', what: 'Подготовить «orca» → публикация 21:00' },
    ];
  }

  function download(text, name) {
    try {
      const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return true;
    } catch (e) { return false; }
  }

  /* внутри просмотрщика Claude скачивание файлов со страницы заблокировано */
  function framed() {
    try { return window.self !== window.top; } catch (e) { return true; }
  }

  const DAYS_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const daysLabel = (ds) => (ds.length === 7 ? 'каждый день' : ds.join() === '1,2,3,4,5' ? 'Пн–Пт' : ds.map((d) => DAYS_RU[d]).join(', '));

  function open() {
    const st = State.s.remind || (State.s.remind = { set: 'important', before: 5 });
    const render = () => {
      const list = events(st);
      const body = UI.sheet(`
        <div class="coach-sheet remind">
          <div class="why-tag">Звонит, даже когда приложение закрыто</div>
          <h2>⏰ Напоминания в телефон</h2>
          <p class="muted small">Я превращу твой график в календарь: каждое дело станет повторяющимся событием с сигналом. Импортируешь один раз — дальше телефон сам зовёт.</p>

          <div class="remind-opts">
            <div class="seg" role="group" aria-label="Какие дела">
              <button class="seg-btn ${st.set === 'important' ? 'sel' : ''}" data-rset="important">Только важное</button>
              <button class="seg-btn ${st.set === 'all' ? 'sel' : ''}" data-rset="all">Все дела графика</button>
            </div>
            <div class="seg" role="group" aria-label="За сколько минут">
              ${[0, 5, 10, 15].map((m) => `<button class="seg-btn ${st.before === m ? 'sel' : ''}" data-rbefore="${m}">${m ? `за ${m} мин` : 'в момент'}</button>`).join('')}
            </div>
          </div>

          <ul class="remind-list">
            ${list.map((e) => `<li><b>${Track.hhmm(e.start)}</b><span>${UI.esc(e.title)}</span><small>${daysLabel(e.days)}${e.hard ? ' · за 15 мин и ровно' : ''}</small></li>`).join('')}
          </ul>

          ${framed()
            ? `<div class="remind-note"><b>📅 Файл календаря</b><p class="muted small">Внутри Claude страница не может скачивать файлы. Готовый файл «важное, за 5 минут» лежит в чате, где мы делали приложение, — открой его на телефоне. Или добавь дела по одной кнопке ниже.</p></div>`
            : `<button class="btn btn-primary btn-lg btn-block" id="rm-ics">📅 Скачать календарь (${list.length} ${UI.plural(list.length, 'событие', 'события', 'событий')})</button>`}

          <details class="remind-how">
            <summary>Как добавить на телефон</summary>
            <p><b>iPhone:</b> открой скачанный файл → «Добавить все». События попадут в «Календарь», сигнал придёт сам.</p>
            <p><b>Android:</b> открой файл в Google Календаре или в календаре Samsung. Если телефон не открывает — на компьютере зайди в calendar.google.com → Настройки → Импорт. Или добавь важные дела по одной кнопке ниже.</p>
            <p>Чтобы не было дублей, при следующем импорте сначала удали старый календарь «Из Ленивца в Миллионеры».</p>
          </details>

          <details class="remind-how" ${framed() ? 'open' : ''}>
            <summary>По одному в Google Календарь</summary>
            <div class="remind-g">
              ${events({ set: 'important' }).map((e) => `<a class="chip" target="_blank" rel="noopener" href="${UI.esc(googleLink(e))}">${Track.hhmm(e.start)} ${UI.esc(e.title)}</a>`).join('')}
            </div>
          </details>

          <details class="remind-how remind-tg">
            <summary>🤖 Напоминания в Telegram</summary>
            <p>Бот сам пишет тебе: утром — план дня, за 5 минут — о каждом деле, за 15 минут и ровно в срок — о публикациях в TikTok. Работает бесплатно на GitHub, где лежит проект.</p>
            <ol>
              <li>В Telegram открой <b>@BotFather</b> → <code>/newbot</code> → придумай имя. Он пришлёт ключ вида <code>123456:ABC…</code>.</li>
              <li>Открой своего нового бота и нажми <b>Start</b>.</li>
              <li>На GitHub в репозитории: <b>Settings → Secrets and variables → Actions → New repository secret</b>, имя <code>TELEGRAM_TOKEN</code>, значение — ключ.</li>
              <li><b>Actions → Telegram-напоминания → Run workflow</b>. Придёт «✅ Бот подключён» — готово. В логе будет номер чата: добавь его секретом <code>TELEGRAM_CHAT_ID</code>, чтобы бот не терял тебя.</li>
            </ol>
            <p class="muted small">Ключ никому не показывай и не пиши в чат — только в секреты GitHub.</p>
          </details>

          <div class="remind-clock">
            <b>🔊 Громкие будильники — поставь в «Часах» руками, 1 минута</b>
            <p class="muted small">Календарь присылает уведомление, а будильник звонит, пока не выключишь. Для подъёма и публикаций нужен именно он.</p>
            <ul>${alarmClock().map((a) => `<li><b>${a.time}</b> ${a.days} — ${UI.esc(a.what)}</li>`).join('')}</ul>
          </div>
        </div>`, { wide: true });

      body.onclick = (e) => {
        const s1 = e.target.closest('[data-rset]'), s2 = e.target.closest('[data-rbefore]');
        if (s1) { st.set = s1.dataset.rset; State.save(); Sound.sfx('pop'); render(); return; }
        if (s2) { st.before = Number(s2.dataset.rbefore); State.save(); Sound.sfx('pop'); render(); return; }
        if (e.target.closest('#rm-ics')) {
          const ok = download(ics(st), 'lenivec-reminders.ics');
          State.s.totals.remindersExported = (State.s.totals.remindersExported || 0) + 1;
          State.save();
          UI.toast(ok ? 'Файл календаря скачан — открой его на телефоне' : 'Не получилось скачать — добавь дела кнопками Google Календаря ниже', ok ? 'success' : 'warn', '📅');
        }
      };
    };
    render();
  }

  return { events, ics, googleLink, alarmClock, open, IMPORTANT };
})();

