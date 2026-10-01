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

  /* ---------- настоящий будильник в APK для Android ---------- */
  const phone = () => typeof window !== 'undefined' && window.AndroidApp && typeof window.AndroidApp.setAlarms === 'function';
  const alarmCfg = () => State.s.alarms || (State.s.alarms = { wake: true, publish: true });

  /* подъём — первый блок дня по графику; публикации — за 10 минут до фиксированного времени */
  function phoneAlarms(cfg) {
    const out = [];
    for (let dow = 0; dow < 7; dow++) {
      const day = Week.scriptFor(dow);
      if (cfg.wake && day[0]) {
        out.push({ dow, min: day[0].start, title: '☀️ Подъём', text: 'Вода, умывание — и открой приложение: план дня уже готов.' });
      }
      // публикации: у каждой свой будильник (⏰ у задания в «Моих делах») — вкл/выкл и за сколько минут
      day.filter((b) => b.hard).forEach((b) => {
        const pc = pubCfg(questOf(b.task), cfg);
        if (!pc.on) return;
        out.push({
          dow, min: b.start - pc.lead,
          title: `${b.emoji || '⏰'} ${pc.lead ? `Через ${pc.lead} минут` : 'Сейчас'}: ${b.title}`,
          text: pc.lead ? `Ровно в ${Track.hhmm(b.start)}. Подпись, хэштеги и обложка — готовь сейчас.` : 'Жми «Опубликовать» — прямо сейчас.',
        });
      });
    }
    // свои будильники: время и дни недели, как в «Часах»
    (cfg.custom || []).filter((a) => a.on !== false).forEach((a) => a.days.forEach((dow) => out.push({
      dow, min: a.min, title: '⏰ Будильник', text: a.label || 'Твой будильник. Встань и начни с первого дела.',
    })));
    // свои дела из «Моих дел»: у каждого дня своё время
    if (typeof Plans !== 'undefined') out.push(...Plans.alarms());
    return out;
  }

  /* задание уровня по делу графика: «ТТ видео — кино» → kino */
  function questOf(task) {
    if (typeof Levels === 'undefined') return null;
    return Object.keys(Levels.QUESTS).find((id) => Levels.QUESTS[id].link === task) || null;
  }
  /* будильник публикации: общий переключатель + своя настройка у задания */
  function pubCfg(id, cfg) {
    const c = cfg || alarmCfg();
    return Object.assign({ on: c.publish !== false, lead: 10 }, (id && c.pub && c.pub[id]) || {});
  }

  /* ⏰ у публикации в «Моих делах»: включить, выключить, за сколько минут */
  function pubSheet(id) {
    const q = Levels.QUESTS[id];
    const render = () => {
      const pc = pubCfg(id);
      const at = q.at;
      const body = UI.sheet(`
        <div class="plan-ed">
          <h2>⏰ ${q.emoji} ${UI.esc(q.title(0))}</h2>
          <p class="muted">Публикация каждый день ровно в <b>${Track.hhmm(at)}</b>. Когда звонить?</p>
          <div class="seg" role="group" aria-label="За сколько минут">
            ${[0, 5, 10, 15].map((m) => `<button class="seg-btn ${pc.on && pc.lead === m ? 'sel' : ''}" data-pub-lead="${m}">${m ? `за ${m} мин` : 'в момент'}</button>`).join('')}
          </div>
          <p class="remind-next">${pc.on ? `Будильник: каждый день в <b>${Track.hhmm(at - pc.lead)}</b>` : '🔕 Будильник выключен'}${phone() ? '' : '<br><small class="muted">Звонит в приложении на Android</small>'}</p>
          <button class="btn ${pc.on ? 'btn-ghost' : 'btn-primary'} btn-block" id="pub-toggle">${pc.on ? '🔕 Выключить будильник' : '⏰ Включить будильник'}</button>
          <button class="btn btn-ghost btn-block" id="pub-close">Готово</button>
        </div>`);
      const save = (patch) => {
        const c = alarmCfg();
        c.pub = c.pub || {};
        c.pub[id] = Object.assign(pubCfg(id), patch);
        State.commit();
        syncAlarms();
        Sound.sfx('pop');
        render();
      };
      body.onclick = (e) => {
        const l = e.target.closest('[data-pub-lead]');
        if (l) { save({ on: true, lead: Number(l.dataset.pubLead) }); return; }
        if (e.target.closest('#pub-toggle')) { save({ on: !pubCfg(id).on }); return; }
        if (e.target.closest('#pub-close')) { UI.closeModal('#sheet-modal'); refresh(); }
      };
    };
    render();
  }

  const anyOn = (cfg) => cfg.wake || cfg.publish || (cfg.custom || []).some((a) => a.on !== false)
    || (typeof Plans !== 'undefined' && Plans.alarms().length > 0);
  let draft = null; // новый свой будильник, пока его настраивают
  const toMin = (v) => { const m = /^(\d{1,2}):(\d{2})/.exec(v || ''); return m ? Math.min(23, +m[1]) * 60 + Math.min(59, +m[2]) : null; };

  const refresh = () => { try { if (typeof App !== 'undefined' && App.renderActive) App.renderActive(); } catch (e) {} };

  function alarmStatus() {
    try { return JSON.parse(window.AndroidApp.alarmStatus()) || {}; } catch (e) { return {}; }
  }

  let lastSent = null; // какой список будильников в последний раз отдали телефону

  function syncAlarms() {
    if (!phone()) return null;
    const cfg = alarmCfg();
    let st = {};
    const json = JSON.stringify(phoneAlarms(cfg));
    try { st = JSON.parse(window.AndroidApp.setAlarms(json)) || {}; } catch (e) { return null; }
    lastSent = json;
    // первый раз — сказать, что будильник заведён, и попросить разрешение на уведомления
    if (!cfg.announced && st.next) {
      cfg.announced = true; State.save();
      UI.toast(`Будильник заведён: ${whenLabel(st.next)} — ${st.nextTitle}`, 'success', '⏰');
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        try { Notification.requestPermission().then(refresh); } catch (e) {}
      }
    }
    refresh();
    return st;
  }

  function whenLabel(ms) {
    const d = new Date(ms), now = new Date();
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(d) - day(now)) / 864e5);
    const t = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (diff === 0) return `сегодня в ${t}`;
    if (diff === 1) return `завтра в ${t}`;
    return `${DAYS_RU[d.getDay()]} в ${t}`;
  }

  /* строка «⏰ Будильник: завтра в 07:00» для «Моих заданий» — только в APK */
  function alarmLine() {
    if (!phone()) return '';
    const st = alarmStatus();
    const cfg = alarmCfg();
    const off = !anyOn(cfg);
    const warn = typeof Notification !== 'undefined' && Notification.permission !== 'granted';
    return `<button class="lv-alarm ${warn ? 'warn' : ''}" data-alarm>⏰ ${off ? 'Будильник выключен' : warn ? 'Будильник не сможет звонить — разреши уведомления' : st.next ? `Будильник: ${whenLabel(st.next)} · ${UI.esc(String(st.nextTitle || '').replace(/^\S+\s/, ''))}` : 'Будильник'}</button>`;
  }

  function alarmBlock() {
    const cfg = alarmCfg();
    const st = alarmStatus();
    const perm = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
    const wk = Week.scriptFor(1)[0], we = Week.scriptFor(6)[0];
    const warns = [];
    if (perm !== 'granted') warns.push(`<button class="btn btn-primary btn-block" data-afix="notify">🔔 Разрешить уведомления — без них будильник не покажется</button>`);
    if (st.exact === false) warns.push(`<button class="btn btn-ghost btn-block" data-afix="exact">⏱ Разрешить точные будильники — иначе может опоздать</button>`);
    if (st.fullScreen === false) warns.push(`<button class="btn btn-ghost btn-block" data-afix="fullscreen">📱 Разрешить звонок на весь экран на заблокированном телефоне</button>`);
    return `
      <div class="remind-alarm">
        <b>⏰ Будильник в этом телефоне</b>
        <p class="muted small">Звонит как обычный будильник — даже когда приложение закрыто и экран заблокирован. Кнопки: «Встал» и «Ещё 5 минут».</p>
        <label class="remind-sw"><input type="checkbox" data-aopt="wake" ${cfg.wake ? 'checked' : ''}><span>☀️ Подъём · Пн–Пт ${Track.hhmm(wk.start)}, Сб–Вс ${Track.hhmm(we.start)}</span></label>
        <label class="remind-sw"><input type="checkbox" data-aopt="publish" ${cfg.publish ? 'checked' : ''}><span>🎞️🐋 Публикации в TikTok (за сколько минут — ⏰ у задания в «Моих делах»)</span></label>
        ${(cfg.custom || []).map((a) => `
          <div class="remind-sw remind-own">
            <label><input type="checkbox" data-aown="${a.id}" ${a.on !== false ? 'checked' : ''}><span>⏰ <b>${Track.hhmm(a.min)}</b> · ${daysLabel(a.days)}</span></label>
            <button class="icon-btn" data-adel="${a.id}" aria-label="Удалить будильник ${Track.hhmm(a.min)}">🗑</button>
          </div>`).join('')}
        ${draft ? `
          <div class="remind-new">
            <input type="time" id="al-time" value="${Track.hhmm(draft.min)}" aria-label="Время будильника">
            <div class="remind-days">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button class="seg-btn ${draft.days.includes(d) ? 'sel' : ''}" data-dday="${d}">${DAYS_RU[d]}</button>`).join('')}</div>
            <div class="remind-new-btns">
              <button class="btn btn-primary" id="al-save">Сохранить</button>
              <button class="btn btn-ghost" id="al-cancel">Отмена</button>
            </div>
          </div>` : '<button class="btn btn-ghost btn-block" data-anew>＋ Свой будильник</button>'}
        <p class="remind-next">${anyOn(cfg) ? (st.next ? `Следующий: <b>${whenLabel(st.next)}</b> — ${UI.esc(st.nextTitle || '')}` : '') : 'Все будильники выключены.'}${st.snooze ? `<br>😴 Отложенный: ${whenLabel(st.snooze)}` : ''}</p>
        ${warns.join('')}
        <label class="remind-sw"><input type="checkbox" id="rm-alarm-voice" ${st.voice !== false ? 'checked' : ''}><span>🗣 Говорить название дела — «Тренировка! Пора.»</span></label>
        <button class="btn btn-ghost btn-block" id="rm-alarm-sound">🎵 Мелодия: ${UI.esc(st.sound || 'как в «Часах»')}</button>
        <div class="remind-test">
          <button class="btn btn-primary" id="rm-alarm-now">🔔 Проверить звук сейчас</button>
          <button class="btn btn-ghost" id="rm-alarm-test">⏱ Проверить через минуту</button>
        </div>
        <p class="muted small">Звонит на громкости будильника — даже в беззвучном режиме. «Через 1 минуту» — чтобы проверить на заблокированном экране.</p>
      </div>`;
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
          ${phone() ? alarmBlock() : ''}
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

          <div class="remind-clock" ${phone() ? 'hidden' : ''}>
            <b>🔊 Громкие будильники — поставь в «Часах» руками, 1 минута</b>
            <p class="muted small">Календарь присылает уведомление, а будильник звонит, пока не выключишь. Для подъёма и публикаций нужен именно он.</p>
            <ul>${alarmClock().map((a) => `<li><b>${a.time}</b> ${a.days} — ${UI.esc(a.what)}</li>`).join('')}</ul>
          </div>
        </div>`, { wide: true });

      if (phone()) window.onAlarmSound = () => { if (body.isConnected) render(); };
      body.onclick = (e) => {
        const tIn = body.querySelector('#al-time');
        if (tIn && draft && toMin(tIn.value) != null) draft.min = toMin(tIn.value);
        const s1 = e.target.closest('[data-rset]'), s2 = e.target.closest('[data-rbefore]');
        if (s1) { st.set = s1.dataset.rset; State.save(); Sound.sfx('pop'); render(); return; }
        if (s2) { st.before = Number(s2.dataset.rbefore); State.save(); Sound.sfx('pop'); render(); return; }
        const opt = e.target.closest('[data-aopt]');
        if (opt) {
          const c = alarmCfg();
          c[opt.dataset.aopt] = opt.checked;
          if (opt.dataset.aopt === 'publish') c.pub = {}; // общий переключатель — для всех публикаций сразу
          State.save(); syncAlarms(); Sound.sfx('pop'); render(); return;
        }
        const fix = e.target.closest('[data-afix]');
        if (fix) {
          const k = fix.dataset.afix;
          if (k === 'notify' && Notification.permission === 'default') Notification.requestPermission().then(render);
          else window.AndroidApp.openSettings(k);
          return;
        }
        if (e.target.closest('#rm-alarm-test')) {
          window.AndroidApp.testAlarm();
          UI.toast('Зазвонит через минуту — можешь заблокировать телефон', 'success', '🔔');
          return;
        }
        const voice = e.target.closest('#rm-alarm-voice');
        if (voice) { if (window.AndroidApp.setAlarmVoice) window.AndroidApp.setAlarmVoice(voice.checked); Sound.sfx('pop'); return; }
        if (e.target.closest('#rm-alarm-now')) { window.AndroidApp.ringNow(); return; }
        if (e.target.closest('#rm-alarm-sound')) { window.AndroidApp.pickSound(); return; }
        const cfg = alarmCfg();
        if (e.target.closest('[data-anew]')) { draft = { min: 7 * 60, days: [1, 2, 3, 4, 5] }; render(); return; }
        const dd = e.target.closest('[data-dday]');
        if (dd && draft) {
          const d = Number(dd.dataset.dday);
          draft.days = draft.days.includes(d) ? draft.days.filter((x) => x !== d) : draft.days.concat(d);
          render(); return;
        }
        if (e.target.closest('#al-cancel')) { draft = null; render(); return; }
        if (e.target.closest('#al-save') && draft) {
          if (!draft.days.length) { UI.toast('Выбери хотя бы один день', 'warn', '📅'); return; }
          const a = { id: Date.now(), min: draft.min, days: draft.days.slice().sort((x, y) => ((x + 6) % 7) - ((y + 6) % 7)), on: true };
          (cfg.custom || (cfg.custom = [])).push(a);
          draft = null; State.save(); syncAlarms(); Sound.sfx('success');
          UI.toast(`Будильник на ${Track.hhmm(a.min)} · ${daysLabel(a.days)}`, 'success', '⏰');
          render(); return;
        }
        const own = e.target.closest('[data-aown]');
        if (own) {
          const a = (cfg.custom || []).find((x) => String(x.id) === own.dataset.aown);
          if (a) { a.on = own.checked; State.save(); syncAlarms(); Sound.sfx('pop'); render(); }
          return;
        }
        const del = e.target.closest('[data-adel]');
        if (del) {
          cfg.custom = (cfg.custom || []).filter((x) => String(x.id) !== del.dataset.adel);
          State.save(); syncAlarms(); render(); return;
        }
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

  /* после любых изменений: если список будильников стал другим — отдать телефону новый */
  function syncIfChanged() {
    if (!phone() || lastSent === null) return;
    if (JSON.stringify(phoneAlarms(alarmCfg())) !== lastSent) syncAlarms();
  }

  return { events, ics, googleLink, alarmClock, open, IMPORTANT, phoneAlarms, syncAlarms, syncIfChanged, alarmLine, pubCfg, pubSheet };
})();

/* в APK будильники ставятся сами при каждом запуске — по актуальному графику */
if (typeof window !== 'undefined' && window.AndroidApp) {
  window.addEventListener('load', () => setTimeout(() => { try { Remind.syncAlarms(); } catch (e) {} }, 1500));
  // дела и будильники могли поменять на другом телефоне (аккаунт) — переставляем, когда список правда изменился
  let alarmTimer = null;
  State.on('change', () => {
    clearTimeout(alarmTimer);
    alarmTimer = setTimeout(() => { try { Remind.syncIfChanged(); } catch (e) {} }, 2000);
  });
}

