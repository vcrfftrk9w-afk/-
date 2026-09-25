'use strict';
/* =========================================================
   APP — инициализация, роутинг, шапка, события
   ========================================================= */

const App = (() => {
  const { $, $$ } = UI;
  let currentTab = 'dashboard';
  let passiveTicks = 0;
  let pendingLevelUp = null;

  /* ---------- применение настроек ---------- */
  /* авто-тема: светлая днём, тёмная вечером */
  function autoThemeTick() {
    if (!State.s.autoTheme) return;
    const h = new Date().getHours();
    const want = (h >= 8 && h < 19) ? 'light' : 'dark';
    if (State.s.theme !== want) {
      State.s.theme = want;
      applyTheme();
      State.save();
    }
  }

  function applyTheme() {
    document.body.setAttribute('data-theme', State.s.theme);
    const btn = $('#theme-toggle');
    if (btn && typeof Icons !== 'undefined') btn.innerHTML = Icons.get(State.s.theme === 'dark' ? 'moon' : 'sun', { size: 19 });
  }
  function applyPalette() { document.body.setAttribute('data-palette', State.s.palette || 'violet'); }
  function applyMode() {
    document.body.setAttribute('data-mode', State.s.mode);
    const label = $('#mode-label');
    if (label) label.textContent = State.s.mode === 'adhd' ? 'СДВГ' : 'Обычный';
    const toggle = $('#mode-toggle');
    if (toggle) toggle.setAttribute('aria-pressed', String(State.s.mode === 'adhd'));
    if (typeof Modes !== 'undefined' && typeof Planner !== 'undefined') Modes.render();
  }
  function applyMotion() { document.body.setAttribute('data-reduce-motion', String(!!State.s.reduceMotion)); }
  function applyA11y() {
    const a = State.s.a11y || {};
    document.body.setAttribute('data-font', a.font || 'default');
    document.body.setAttribute('data-scale', a.scale || 'md');
    document.body.setAttribute('data-contrast', String(!!a.contrast));
  }
  function applyAll() {
    if (typeof FX !== 'undefined' && FX.invalidateSprites) FX.invalidateSprites();
    applyTheme();
    applyPalette();
    applyMode();
    applyMotion();
    applyA11y();
    // масштаб текста меняет высоту нижней панели — отступы пересчитываем
    if (typeof syncBottomInsets === 'function') setTimeout(syncBottomInsets, 60);
  }

  /* ---------- иконки интерфейса ---------- */
  function paintIcons() {
    $$('.tab-btn').forEach((b) => {
      const holder = b.querySelector('.tab-ico');
      if (holder && !holder.dataset.icon) {
        holder.innerHTML = Icons.get(b.dataset.icon, { size: 21 });
        holder.dataset.icon = b.dataset.icon;
      }
    });
    const set = (sel, name, size = 19) => {
      const el = $(sel);
      if (el) el.innerHTML = Icons.get(name, { size });
    };
    set('#cmd-btn', 'search');
    set('#palette-ico', 'search', 18);
    set('#settings-btn', 'settings');
    set('#mini-next', 'shuffle', 16);
    set('#mini-open', 'sliders', 16);
    paintThemeIcon();
    paintMiniPlayIcon();
  }
  function paintThemeIcon() {
    const btn = $('#theme-toggle');
    if (btn) btn.innerHTML = Icons.get(State.s.theme === 'dark' ? 'moon' : 'sun', { size: 19 });
  }
  function paintMiniPlayIcon() {
    const btn = $('#mini-play');
    if (btn) btn.innerHTML = Icons.get(typeof Music !== 'undefined' && Music.playing ? 'pause' : 'play', { size: 16 });
  }

  /* ---------- индикатор активной вкладки ---------- */
  function moveIndicator() {
    const bar = $('#tabbar');
    const ind = $('#tab-indicator');
    if (!bar || !ind) return;
    const active = bar.querySelector('.tab-btn.active');
    if (!active || active.offsetParent === null) { ind.classList.remove('ready'); return; }
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    if (mobile) {
      ind.style.width = `${active.offsetWidth * 0.5}px`;
      ind.style.transform = `translateX(${active.offsetLeft + active.offsetWidth * 0.25}px)`;
    } else {
      ind.style.width = `${active.offsetWidth}px`;
      ind.style.transform = `translateX(${active.offsetLeft - bar.scrollLeft}px)`;
    }
    ind.classList.add('ready');
  }

  /* ---------- счётчики на вкладках ---------- */
  function renderBadges() {
    const s = State.s;
    const set = (tab, value, dot) => {
      const btn = $$('.tab-btn').find((b) => b.dataset.tab === tab);
      if (!btn) return;
      const badge = btn.querySelector('.tab-badge');
      if (!badge) return;
      const show = dot ? !!value : value > 0;
      badge.classList.toggle('hidden', !show);
      badge.classList.toggle('dot', !!dot);
      if (!dot && show) badge.textContent = value > 99 ? '99+' : String(value);
    };

    const quests = State.todayQuests();
    set('dashboard', quests.filter((q) => !s.quests.done[q.id]).length);
    set('tasks', s.tasks.filter((t) => !t.done).length);
    set('habits', s.habits.filter((h) => !h.history[State.todayKey()]).length);
    const affordable = Data.ASSETS.some((a, i) => {
      const prev = i === 0 ? 1 : State.assetLevel(Data.ASSETS[i - 1].id);
      return (i === 0 || prev > 0) && s.coins >= State.assetCost(a.id);
    });
    if (typeof Track !== 'undefined') set('day', Track.nudges().length);
    set('empire', affordable, true);
    // точка на «Пути», если сегодня ещё не сделан ни один шаг
    if (typeof Path !== 'undefined') {
      const since = new Date(); since.setHours(0, 0, 0, 0);
      const todayStep = Path.ALL.some((x) => (s.path.done[x.id] || 0) >= since.getTime());
      set('path', !todayStep && !!Path.nextStep(), true);
    }
    const unseen = State.unlockedAchievements() - (s.seenAchievements || 0);
    set('rewards', Math.max(0, unseen));

    // на мобильном скрытые вкладки складываем в кнопку «Ещё»
    const more = $('#tab-more');
    if (more) {
      const hidden = ['goals', 'lessons', 'empire', 'rewards', 'stats'];
      let total = 0;
      hidden.forEach((tab) => {
        const btn = $$('.tab-btn').find((b) => b.dataset.tab === tab);
        const badge = btn && btn.querySelector('.tab-badge');
        if (badge && !badge.classList.contains('hidden')) {
          total += badge.classList.contains('dot') ? 1 : (parseInt(badge.textContent, 10) || 1);
        }
      });
      const badge = more.querySelector('.tab-badge');
      badge.classList.toggle('hidden', total === 0);
      badge.classList.add('dot');
    }
  }

  /* ---------- лист «Ещё» (мобильная навигация) ---------- */
  const OVERFLOW = [
    { tab: 'habits', icon: 'habits', name: 'Привычки', desc: 'Недельная сетка и стрики' },
    { tab: 'goals', icon: 'goals', name: 'Цели', desc: 'Большие цели и шаги к ним' },
    { tab: 'lessons', icon: 'lessons', name: 'Курс', desc: '24 урока по СДВГ, фокусу и деньгам' },
    { tab: 'empire', icon: 'empire', name: 'Империя', desc: 'Активы и пассивный доход' },
    { tab: 'rewards', icon: 'rewards', name: 'Награды', desc: 'Достижения, бустеры, темы' },
    { tab: 'stats', icon: 'stats', name: 'Статистика', desc: 'Графики, тепловая карта, итоги' },
  ];

  function openMoreSheet() {
    Sound.sfx('click');
    const body = UI.sheet(`
      <h2>Ещё разделы</h2>
      <div class="more-grid">
        ${OVERFLOW.map((o) => `
          <button class="more-item" data-tab="${o.tab}">
            <span class="more-ico">${Icons.get(o.icon, { size: 22 })}</span>
            <span class="more-text">
              <b>${UI.esc(o.name)}</b>
              <small>${UI.esc(o.desc)}</small>
            </span>
          </button>`).join('')}
      </div>`);
    body.querySelectorAll('.more-item').forEach((b) => b.addEventListener('click', () => {
      UI.closeModal('#sheet-modal');
      go(b.dataset.tab);
    }));
  }

  /* ---------- шапка ---------- */
  function renderHeader() {
    const s = State.s;
    const stage = State.stage();
    $('#avatar-emoji').textContent = stage.emoji;
    $('#user-title').textContent = stage.title;
    // вместо безликого «Гость» — приветствие по времени суток
    const hr = new Date().getHours();
    const greet = hr >= 5 && hr < 12 ? 'Доброе утро' : hr < 17 && hr >= 12 ? 'Добрый день' : hr >= 17 && hr < 23 ? 'Добрый вечер' : 'Доброй ночи';
    $('#user-name').textContent = s.name ? `${greet}, ${s.name}` : greet;
    $('#stat-level').textContent = s.level;
    const need = State.xpToNext(s.level);
    $('#stat-xp').textContent = `${s.xp}/${need}`;
    $('#xp-fill').style.width = Math.min(100, (s.xp / need) * 100) + '%';
    UI.countUp($('#stat-coins'), s.coins, { short: s.coins >= 100000 });
    UI.countUp($('#stat-streak'), s.streak);
    const passive = State.passivePerMin() * State.activityMultiplier();
    $('#stat-passive').textContent = UI.fmtSmart(passive);
    $('#passive-pill').classList.toggle('hidden', State.passivePerMin() <= 0);
    renderBadges();
    renderBooster();
  }

  function renderBooster() {
    const s = State.s;
    const now = Date.now();
    const until = Math.max(s.boosters.xpUntil || 0, s.boosters.coinUntil || 0);
    const badge = $('#booster-badge');
    if (until > now) {
      const left = Math.round((until - now) / 1000);
      const m = Math.floor(left / 60), sec = left % 60;
      $('#booster-time').textContent = `${m}:${sec < 10 ? '0' + sec : sec}`;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  /* ---------- роутинг ---------- */
  const screenByTab = {
    dashboard: () => Screens.dashboard,
    day: () => Screens.day,
    tasks: () => Screens.tasks,
    path: () => Screens.path,
    adhd: () => Screens.focus,
    habits: () => Screens.habits,
    goals: () => Screens.goals,
    lessons: () => Screens.lessons,
    empire: () => Screens.empire,
    rewards: () => Screens.rewards,
    stats: () => Screens.stats,
  };

  function go(tab) {
    if (!screenByTab[tab]) return;
    if (currentTab === 'adhd' && tab !== 'adhd') Screens.focus.onLeave();
    if (currentTab === 'day' && tab !== 'day' && Screens.day) Screens.day.onLeave();
    currentTab = tab;

    if (tab === 'rewards') State.s.seenAchievements = State.unlockedAchievements();

    $$('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    const more = $('#tab-more');
    if (more) {
      const inOverflow = OVERFLOW.some((o) => o.tab === tab);
      more.classList.toggle('active', inOverflow);
      const item = OVERFLOW.find((o) => o.tab === tab);
      more.querySelector('.tab-ico').innerHTML = Icons.get(inOverflow ? item.icon : 'more', { size: 21 });
      more.querySelector('em').textContent = inOverflow ? item.name : 'Ещё';
    }
    $$('.tab-panel').forEach((p) => {
      const active = p.id === `tab-${tab}`;
      p.classList.toggle('active', active);
      if (active) {
        p.classList.remove('anim-in');
        void p.offsetWidth;
        p.classList.add('anim-in');
      }
    });
    renderActive();
    if (tab === 'adhd') Screens.focus.onEnter();
    if (tab === 'day' && Screens.day) Screens.day.onEnter();
    UI.initTilt();
    const btn = $$('.tab-btn').find((b) => b.dataset.tab === tab);
    if (btn && btn.offsetParent !== null && btn.scrollIntoView) {
      btn.scrollIntoView({ block: 'nearest', inline: 'center', behavior: State.s.reduceMotion ? 'auto' : 'smooth' });
    }
    requestAnimationFrame(() => { moveIndicator(); syncBottomInsets(); });
    setTimeout(moveIndicator, 320);
    if (Screens.focus.renderHud) Screens.focus.renderHud();
    window.scrollTo({ top: 0, behavior: State.s.reduceMotion ? 'auto' : 'smooth' });
  }

  function renderActive() {
    safely('heal', healDay);
    UI.preserveFocus(() => {
      renderHeader();
      const screen = screenByTab[currentTab] && screenByTab[currentTab]();
      if (screen && screen.render) screen.render();
    });
  }

  /* ---------- события состояния ---------- */
  function bindStateEvents() {
    State.on('change', () => renderActive());

    // другая вкладка изменила состояние — подхватываем, а не затираем
    State.on('externalChange', () => {
      applyAll();
      UI.toast('Обновил данные из другой вкладки', 'default', '🔄');
    });

    State.on('levelup', (info) => { pendingLevelUp = info; });

    State.on('pathStage', (info) => {
      Sound.sfx('fanfare');
      FX.fireworks();
      UI.sheet(`
        <div class="path-stage-win">
          <div class="path-hero-emoji" style="margin:0 auto 14px">${info.stage.emoji}</div>
          <h2 style="text-align:center;margin:0 0 6px">Этап пройден: ${UI.esc(info.stage.name)}</h2>
          <p class="muted" style="text-align:center">${UI.esc(info.stage.goal)}</p>
          <div class="path-reward" style="text-align:center;font-size:16px">+${info.xp} XP · +${info.coins} 🪙</div>
          <button class="btn btn-primary btn-block" id="path-win-ok">Дальше</button>
        </div>`).querySelector('#path-win-ok').onclick = () => UI.closeModal('#sheet-modal');
    });

    State.on('achievement', (a) => {
      UI.toast(`Достижение: ${a.name}`, 'level', a.emoji);
      Sound.sfx('quest');
      FX.confetti(window.innerWidth / 2, 120, 50, { power: 8 });
    });

    State.on('quest', (q) => {
      UI.toast(`Квест выполнен: ${q.text}`, 'level', '📜');
      Sound.sfx('quest');
      FX.coinRain(14);
    });

    State.on('millionaire', () => {
      UI.openModal('#millionaire-modal');
      Sound.sfx('fanfare');
      FX.fireworks(10);
      FX.coinRain(80);
    });

    State.on('weekly', (w) => {
      UI.toast(`Вызов недели пройден: ${w.text}`, 'level', '🏆');
      Sound.sfx('fanfare');
      FX.fireworks(4);
      FX.coinRain(40);
    });

    State.on('streakSaved', () => {
      UI.toast('Стрик спасён бустером 🛟', 'level', '🔥');
    });
  }

  function showLevelUp(info) {
    const stage = State.stage();

    // сначала показываем закрытый сундук — награда открывается по клику
    const chest = $('#levelup-chest');
    const reveal = ['#levelup-emoji', '#levelup-heading', '.levelup-title', '#levelup-desc', '#levelup-rewards', '#levelup-close'];
    chest.classList.remove('hidden', 'opening');
    reveal.forEach((sel) => $(sel).classList.add('hidden'));
    chest.onclick = () => {
      chest.classList.add('opening');
      Sound.sfx('fanfare');
      FX.confetti(window.innerWidth / 2, window.innerHeight / 2.2, 120, { power: 13 });
      FX.coinRain(28);
      FX.vibrate([30, 50, 30, 50, 60]);
      setTimeout(() => {
        chest.classList.add('hidden');
        reveal.forEach((sel) => $(sel).classList.remove('hidden'));
      }, 520);
    };

    $('#levelup-emoji').textContent = stage.emoji;
    $('#levelup-heading').textContent = info.newStage ? 'Эволюция!' : 'Новый уровень!';
    $('#levelup-title').textContent = stage.title;
    $('#levelup-desc').textContent = info.newStage ? stage.desc : `Уровень ${info.to}. Продолжай в том же духе.`;
    $('#levelup-rewards').innerHTML = `
      <div class="lv-reward"><b>${info.to}</b><small>уровень</small></div>
      <div class="lv-reward"><b>+${info.to * 15}</b><small>монет</small></div>
      ${info.newStage ? '<div class="lv-reward"><b>NEW</b><small>образ</small></div>' : ''}`;
    UI.openModal('#levelup-modal');
    Sound.sfx('levelup');
    FX.fireworks(info.newStage ? 5 : 3);
    FX.vibrate([40, 60, 40, 60, 80]);
  }

  /* ---------- тики ---------- */
  function startTicks() {
    // пассивный доход
    setInterval(() => {
      const earned = State.tickPassive();
      passiveTicks += 1;
      if (earned > 0) {
        renderHeader();
        if (currentTab === 'empire') Screens.empire.render();
      }
      if (passiveTicks % 6 === 0) { State.checkAchievements(); State.save(); }
    }, 5000);

    // бустеры
    setInterval(renderBooster, 1000);

    // авто-тема
    autoThemeTick();
    setInterval(autoThemeTick, 300000);

    // отложенная модалка уровня (чтобы не перекрывать конфетти действия)
    setInterval(() => {
      if (pendingLevelUp && $$('.modal:not(.hidden)').length === 0) {
        const info = pendingLevelUp;
        pendingLevelUp = null;
        showLevelUp(info);
      }
    }, 900);

    // напоминалки
    setInterval(() => Screens.reminders.tick(), 30000);

    // обновление подписи мини-плеера (таймер сна)
    setInterval(() => { if (Music.playing) Screens.music.render(); }, 15000);

    // смена дня
    setInterval(() => {
      if (State.s.lastSeenDate && State.s.lastSeenDate !== State.todayKey()) { dailyCheckIn(); ensureDaySetup(); }
      pathNudge();
      dayTick();
    }, 60000);
  }

  /* ---------- ежедневный вход ---------- */
  function dailyCheckIn() {
    const today = State.todayKey();
    if (State.s.lastSeenDate === today) return;
    const first = !State.s.lastSeenDate;
    const away = State.s.lastSeenDate ? State.daysBetween(State.s.lastSeenDate, today) : 0;
    State.s.lastSeenDate = today;
    State.ensureQuests();
    if (!first) {
      const bonus = 15 + State.s.streak * 5;
      State.addCoins(bonus);
      UI.toast(`С возвращением! +${bonus} монет за вход`, 'coin', '🎁');
      FX.coinRain(22);
      Sound.sfx('coin');
    }
    State.commit();
    if (away >= 2) setTimeout(() => showComeback(away), 900);
  }

  /* ---------- высота нижней панели и плеера ----------
     Меряем по факту: от настроек доступности и длины подписей панель
     меняет высоту, а от зашитой цифры плеер однажды накрыл вкладки. */
  function syncBottomInsets() {
    const root = document.documentElement;
    const bar = $('#tabbar');
    const player = $('#mini-player');
    if (bar) {
      const fixed = getComputedStyle(bar).position === 'fixed';
      // внутри просмотрщика низ может быть срезан — держим плеер повыше
      const gap = document.body.classList.contains('in-frame') ? 46 : 0;
      root.style.setProperty('--tabbar-h', fixed ? Math.round(bar.getBoundingClientRect().height) + 'px' : gap + 'px');
    }
    if (player) {
      root.style.setProperty('--miniplayer-h', Math.round(player.getBoundingClientRect().height) + 'px');
    }
  }

  /* ---------- честно сказать, если сохранение не прочиталось ---------- */
  function reportLoadProblem() {
    const kind = State.problem();
    if (!kind) return;
    setTimeout(() => {
      if (kind === 'backup') {
        UI.toast('Основное сохранение повредилось — восстановил из запасной копии', 'warn', '🛟');
      } else {
        const body = UI.sheet(`
          <div class="comeback">
            <div class="comeback-emoji">🛟</div>
            <h2>Не удалось прочитать сохранение</h2>
            <p class="muted">Данные в браузере повредились, и запасной копии тоже не нашлось. Приложение начало с чистого листа, но <b>испорченный файл не стёрт</b> — он лежит рядом, и из него можно попробовать что-то достать.</p>
            <p class="muted">Чтобы такое больше не било по тебе: во вкладке «Статистика» есть кнопка «Бэкап» — файл можно хранить где угодно и вернуть одним нажатием.</p>
            <button class="btn btn-primary btn-lg btn-block" id="lp-ok">Понятно</button>
          </div>`);
        body.querySelector('#lp-ok').onclick = () => UI.closeModal('#sheet-modal');
      }
    }, 1200);
  }

  /* ---------- контроль дня: напоминает и подгоняет ---------- */
  let lastBlockId = null;
  let lastNudgeAt = 0;
  const preWarned = {};   // предупреждения о жёстком времени, по одному на блок

  function dayTick() {
    if (typeof Planner === 'undefined' || !Planner.plan()) return;
    if (typeof Modes !== 'undefined') Modes.tick();
    const cur = Planner.currentBlock();
    const skipped = Planner.plan().skipped || {};

    const nowMin = Track.nowMin();

    // жёсткое время: предупреждаем заранее, иначе смысла в нём нет
    Planner.blocks().forEach((b) => {
      if (!b.pinned || skipped[b.id] || Planner.isDone(b)) return;
      const left = b.start - nowMin;
      // тик раз в минуту может не попасть в точную отметку — берём первый тик после неё
      for (const mark of [15, 5]) {
        const key = b.id + ':' + mark;
        if (preWarned[key]) continue;
        if (left > mark || left <= 0) continue;
        preWarned[key] = true;
        if (mark === 5) preWarned[b.id + ':15'] = true;   // если плана не было раньше, не сыпем оба сразу
        UI.toast(`Через ${UI.plur(left, 'минуту', 'минуты', 'минут')} — ${b.title} (${Track.hhmm(b.start)})`, 'warn', '⏰');
        Sound.sfx(mark === 5 ? 'quest' : 'tick');
        FX.vibrate(mark === 5 ? [80, 50, 80] : 50);
        notify(`⏰ Через ${left} мин: ${b.title}`, `Жёсткое время — ровно в ${Track.hhmm(b.start)}`);
        break;
      }
      // момент настал
      const keyNow = b.id + ':now';
      if (!preWarned[keyNow] && left <= 0 && left > -1) {
        preWarned[keyNow] = true;
        UI.toast(`${Track.hhmm(b.start)} — пора: ${b.title}`, 'level', '🔔');
        Sound.sfx('fanfare');
        FX.vibrate([160, 80, 160]);
        notify(`🔔 ${b.title}`, `Ровно ${Track.hhmm(b.start)} — это то самое время`);
      }
    });

    // блок начался — объявляем
    // пары и перерывы между ними не объявляем: на паре телефон пищать не должен
    const calm = State.s.mode !== 'adhd';
    // обычный режим не дёргает на каждый отдых и перекус — только дела и дорога
    const silent = cur && (cur.sub === 'pair' || cur.sub === 'break' || cur.sub === 'sleep'
      || (calm && (cur.sub === 'rest' || cur.sub === 'routine' || cur.sub === 'meal')));
    if (cur && silent) lastBlockId = cur.id;
    if (cur && !silent && cur.id !== lastBlockId && !skipped[cur.id] && !Planner.isDone(cur)) {
      lastBlockId = cur.id;
      const mins = cur.end - cur.start;
      Sound.sfx('start');
      FX.vibrate(60);
      notify(`${cur.emoji} ${cur.title}`, `${Track.hhmm(cur.start)}–${Track.hhmm(cur.end)} — по твоему плану дня`);
      // в строгом режиме задачу нельзя просто проигнорировать: нужен ответ
      if (Track.profile().strict && cur.kind === 'task' && !isQuietNow()) demandBlock(cur, mins);
      else UI.toast(`По плану сейчас: ${cur.title} · ${mins} мин`, 'default', cur.emoji);
    }

    // блок кончился, а дело не сделано
    const now = Track.nowMin();
    Planner.blocks().forEach((b) => {
      if (b.kind !== 'task' || skipped[b.id] || Planner.isDone(b)) return;
      if (now >= b.end && now < b.end + 2 && b.id !== lastBlockId) {
        UI.toast(`«${b.title}» по плану уже закончилось. Сделаешь сейчас или переносим?`, 'warn', '⏰');
        Sound.sfx('deny');
      }
    });

    // бытовые напоминания — не чаще раза в 20 минут
    const nudgeGap = (Track.profile().strict ? 10 : 25) * 60000;
    if (Date.now() - lastNudgeAt > nudgeGap && !isQuietNow()) {
      const list = Track.nudges();
      if (list.length) {
        const n = list[0];
        UI.toast(n.text, 'warn', n.emoji);
        Sound.sfx('tick');
        lastNudgeAt = Date.now();
      }
    }
  }

  /* строгий режим: блок требует ответа, а не просто всплывает */
  function demandBlock(b, mins) {
    if (document.querySelector('#sheet-modal.modal-open')) return;
    const body = UI.sheet(`
      <div class="demand">
        <div class="demand-emoji">${b.emoji}</div>
        <div class="why-tag">${Track.hhmm(b.start)} – ${Track.hhmm(b.end)} · ${mins} мин</div>
        <h2>${UI.esc(b.title)}</h2>
        <p class="muted">Это время ты сам отдал под эту задачу. Оно уже идёт.</p>
        <div class="demand-actions">
          <button class="btn btn-primary btn-lg btn-block" data-d="go">▶ Начинаю</button>
          <button class="btn btn-ghost btn-block" data-d="later">Дай 10 минут</button>
          <button class="linkbtn" data-d="skip">сегодня не буду</button>
        </div>
      </div>`);
    Sound.sfx('quest');
    body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-d]');
      if (!btn) return;
      UI.closeModal('#sheet-modal');
      const k = btn.dataset.d;
      if (k === 'go') { go('day'); setTimeout(() => Screens.day.explain(b.id), 200); }
      else if (k === 'later') { lastBlockId = null; setTimeout(() => dayTick(), 10 * 60000); UI.toast('Вернусь через 10 минут', 'default', '⏳'); }
      else { Planner.skip(b.id); UI.toast('Убрал из плана на сегодня', 'default', '⏭️'); }
    });
  }

  function isQuietNow() {
    const q = State.s.quiet;
    if (!q || !q.on) return false;
    const h = new Date().getHours();
    return q.from > q.to ? (h >= q.from || h < q.to) : (h >= q.from && h < q.to);
  }

  function notify(title, body) {
    if (!State.s.notifications) return;
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(title, { body, silent: true });
      }
    } catch (e) { /* не поддерживается */ }
  }

  /* ---------- вечерний толчок: шаг пути ещё не сделан ---------- */
  function pathNudge() {
    if (typeof Path === 'undefined') return;
    const s = State.s;
    const hour = new Date().getHours();
    if (hour < 19 || hour > 22) return;
    if (s.pathNudgeDate === State.todayKey()) return;
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    if (Path.ALL.some((x) => (s.path.done[x.id] || 0) >= midnight.getTime())) return;
    const n = Path.nextStep();
    if (!n) return;
    s.pathNudgeDate = State.todayKey();
    State.save();
    UI.toast(`Шаг пути ещё ждёт: ${n.step.t}`, 'default', '🧭');
  }

  /* ---------- возвращение после перерыва ----------
     Без вины: перерыв — это не провал, а просто перерыв. Показываем,
     что всё сохранено, и предлагаем один маленький шаг, а не весь список. */
  function showComeback(days) {
    const s = State.s;
    const micro = Data.MICRO_STEPS[Math.floor(Math.random() * Data.MICRO_STEPS.length)];
    const pathInfo = (typeof Path !== 'undefined' && Path.nextStep()) || null;
    const kept = [
      { emoji: '⭐', label: 'Уровень', value: s.level },
      { emoji: '🪙', label: 'Монеты', value: UI.fmtShort ? UI.fmtShort(s.coins) : s.coins },
      { emoji: '🏆', label: 'Достижений', value: State.unlockedAchievements() },
      { emoji: '🧭', label: 'Шагов пути', value: typeof Path !== 'undefined' ? Path.doneCount() : 0 },
    ];
    const body = UI.sheet(`
      <div class="comeback">
        <div class="comeback-emoji">👋</div>
        <h2>Тебя не было ${days} ${UI.plural(days, 'день', 'дня', 'дней')}</h2>
        <p class="muted">И это нормально. Перерыв — не провал, а просто перерыв. Ничего из того, что ты сделал раньше, не пропало:</p>
        <div class="comeback-kept">
          ${kept.map((k) => `<div class="comeback-chip"><span>${k.emoji}</span><b>${k.value}</b><small>${k.label}</small></div>`).join('')}
        </div>
        <div class="comeback-step">
          <b>Сегодня достаточно одного маленького действия</b>
          <p>${UI.esc(pathInfo ? pathInfo.step.t : micro)}</p>
        </div>
        <div class="comeback-actions">
          <button class="btn btn-primary btn-lg" id="cb-go">${pathInfo ? 'Показать этот шаг' : 'Хорошо, начну'}</button>
          <button class="btn btn-ghost" id="cb-later">Просто осмотрюсь</button>
        </div>
      </div>`);
    Sound.sfx('start');
    body.querySelector('#cb-go').onclick = () => {
      UI.closeModal('#sheet-modal');
      if (pathInfo) { go('path'); } else { openCapture(); }
    };
    body.querySelector('#cb-later').onclick = () => UI.closeModal('#sheet-modal');
  }

  /* ---------- горячие клавиши ---------- */
  function bindKeys() {
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea, select')) {
        if (e.key === 'Escape') e.target.blur();
        return;
      }
      const tabs = ['dashboard', 'day', 'tasks', 'path', 'adhd', 'habits', 'goals', 'lessons', 'empire'];
      if (e.key >= '1' && e.key <= '9') { go(tabs[Number(e.key) - 1]); return; }
      const k = e.key.toLowerCase();
      if (k === 'n' || k === 'т') { go('tasks'); setTimeout(() => $('#task-title').focus(), 120); }
      else if (k === 'f' || k === 'а') { Screens.focus.toggleTimer(); }
      else if (k === 'h' || k === 'р') { Screens.focus.enterHyperfocus(); }
      else if (k === 'q' || k === 'й') { e.preventDefault(); openCapture(); }
      else if (k === 'g' || k === 'п') { e.preventDefault(); Verdict.open(); }
      else if (e.key === '?' || (e.shiftKey && e.key === '/')) { e.preventDefault(); showShortcuts(); }
      else if (k === 'm' || k === 'ь') { Music.toggle(State.s.music.station); Screens.music.render(); }
      else if (e.key === 'Escape') {
        if (!$('#hyperfocus').classList.contains('hidden')) $('#hf-exit').click();
        $$('.modal:not(.hidden)').forEach((m) => UI.closeModal(m));
      }
    });
  }

  /* ---------- онбординг ---------- */
  function bindOnboarding() {
    let step = 0;
    let mode = 'adhd';
    const steps = $$('.ob-step');
    const dots = $$('.onboarding-steps i');

    function show(n) {
      step = Math.max(0, Math.min(steps.length - 1, n));
      steps.forEach((s, i) => s.classList.toggle('active', i === step));
      dots.forEach((d, i) => d.classList.toggle('active', i <= step));
    }

    $$('[data-ob-next]').forEach((b) => b.addEventListener('click', () => { show(step + 1); Sound.sfx('click'); }));
    $$('[data-ob-prev]').forEach((b) => b.addEventListener('click', () => { show(step - 1); Sound.sfx('click'); }));

    $$('.ob-mode').forEach((b) => b.addEventListener('click', () => {
      mode = b.dataset.mode;
      $$('.ob-mode').forEach((x) => x.classList.toggle('selected', x === b));
      Sound.sfx('pop');
    }));

    // живой расчёт прямо в онбординге: две цифры — и видно, сколько лет до миллиона
    const obMoney = () => {
      const inc = Number($('#ob-income').value) || 0;
      const exp = Number($('#ob-expenses').value) || 0;
      const out = $('#ob-money-out');
      if (!inc || !exp) { out.classList.add('hidden'); return; }
      State.s.money = { ...State.s.money, income: inc, expenses: exp };
      const free = Math.max(0, inc - exp);
      const pr = Path.project({});
      out.classList.remove('hidden');
      out.innerHTML = free <= 0
        ? `<b>Расходы съедают весь доход.</b><span>Первый шаг пути как раз про это — приложение покажет, где искать.</span>`
        : `<b>Откладывая ${UI.fmt(free)} в месяц, ты дойдёшь до первого миллиона примерно за ${pr.millionYears === null ? 'очень долго' : UI.years(pr.millionYears)}.</b><span>Внутри есть ползунок «что если» — посмотришь, как это меняется, если поднять доход.</span>`;
      State.save();
    };
    ['#ob-income', '#ob-expenses'].forEach((sel) => {
      const el = $(sel);
      if (el) el.addEventListener('input', obMoney);
    });

    $('#ob-start').addEventListener('click', () => {
      const s = State.s;
      s.name = $('#ob-name').value.trim();
      s.mode = mode;
      s.onboarded = true;
      const goal = $('#ob-goal').value.trim();
      const task = $('#ob-task').value.trim();
      if (goal) Screens.goals.add(goal, '🎯', null);
      if (task) Screens.tasks.add(task, 'other', 'mid', false);
      applyAll();
      $('#onboarding').classList.add('hidden');
      $('#app').classList.remove('hidden');
      dailyCheckIn();
      ensureDaySetup();
      go('dashboard');
      Sound.ready();
      Sound.sfx('fanfare');
      FX.fireworks(3);
      UI.toast('Погнали! Твой путь начался 🚀', 'level', '🦥');
      State.commit();
    });
  }

  /* ---------- настройки ---------- */
  function bindSettings() {
    $('#settings-btn').addEventListener('click', () => {
      const s = State.s;
      $('#setting-name').value = s.name || '';
      $('#setting-theme').checked = s.theme === 'light';
      $('#setting-adhd').checked = s.mode === 'adhd';
      $('#setting-sfx').checked = !!s.sfx;
      $('#setting-haptics').checked = !!s.haptics;
      $('#setting-reduce').checked = !!s.reduceMotion;
      $('#setting-notify').checked = !!s.notifications;
      $('#setting-font').checked = (s.a11y && s.a11y.font) === 'lexend';
      $('#setting-contrast').checked = !!(s.a11y && s.a11y.contrast);
      $('#setting-scale').value = (s.a11y && s.a11y.scale) || 'md';
      $('#setting-autotheme').checked = !!s.autoTheme;
      $('#setting-sfx-vol').value = Math.round((s.sfxVolume != null ? s.sfxVolume : 0.3) * 100);
      UI.openModal('#settings-modal');
    });
    $('#settings-close').addEventListener('click', () => UI.closeModal('#settings-modal'));

    $('#setting-name').addEventListener('input', (e) => { State.s.name = e.target.value.trim(); renderHeader(); State.save(); });
    $('#setting-theme').addEventListener('change', (e) => { State.s.theme = e.target.checked ? 'light' : 'dark'; applyTheme(); State.save(); });
    $('#setting-adhd').addEventListener('change', (e) => { State.s.mode = e.target.checked ? 'adhd' : 'normal'; applyMode(); State.save(); });
    $('#setting-sfx').addEventListener('change', (e) => { State.s.sfx = e.target.checked; State.save(); });
    $('#setting-sfx-vol').addEventListener('input', (e) => {
      State.s.sfxVolume = Number(e.target.value) / 100;
      Sound.setSfxVolume(State.s.sfxVolume);
    });
    $('#setting-sfx-vol').addEventListener('change', () => { Sound.sfx('check'); State.save(); });
    $('#setting-haptics').addEventListener('change', (e) => { State.s.haptics = e.target.checked; State.save(); });
    $('#setting-reduce').addEventListener('change', (e) => { State.s.reduceMotion = e.target.checked; applyMotion(); State.save(); });
    $('#setting-notify').addEventListener('change', (e) => {
      State.s.notifications = e.target.checked;
      if (e.target.checked && 'Notification' in window && Notification.permission === 'default') {
        try { Notification.requestPermission(); } catch (err) {}
      }
      State.save();
    });

    $('#setting-font').addEventListener('change', (e) => { State.s.a11y.font = e.target.checked ? 'lexend' : 'default'; applyA11y(); State.save(); });
    $('#setting-contrast').addEventListener('change', (e) => { State.s.a11y.contrast = e.target.checked; applyA11y(); State.save(); });
    $('#setting-autotheme').addEventListener('change', (e) => {
      State.s.autoTheme = e.target.checked;
      if (e.target.checked) { autoThemeTick(); UI.toast('Тема будет меняться сама: светлая днём, тёмная вечером', 'default', '🌗'); }
      State.save();
    });
    $('#setting-scale').addEventListener('change', (e) => { State.s.a11y.scale = e.target.value; applyA11y(); State.save(); });

    $('#theme-toggle').addEventListener('click', () => {
      State.s.theme = State.s.theme === 'dark' ? 'light' : 'dark';
      applyTheme();
      paintThemeIcon();
      Sound.sfx('click');
      State.save();
    });

    $('#mode-toggle').addEventListener('click', () => {
      State.s.mode = State.s.mode === 'adhd' ? 'normal' : 'adhd';
      applyMode();
      Sound.sfx('pop');
      UI.toast(State.s.mode === 'adhd'
        ? 'СДВГ: одно дело на экране, таймер, комбо и сюрпризы. Остальное свёрнуто.'
        : 'Обычный: спокойный планер, вся неделя, меньше шума.', 'default', State.s.mode === 'adhd' ? '⚡' : '🧘');
      State.save();
      renderActive();
    });

    $('#brand-btn').addEventListener('click', showCharacter);

    $$('[data-close-sheet]').forEach((b) => b.addEventListener('click', () => UI.closeModal('#sheet-modal')));
    $('#levelup-close').addEventListener('click', () => UI.closeModal('#levelup-modal'));
    $('#millionaire-close').addEventListener('click', () => UI.closeModal('#millionaire-modal'));
    $$('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) UI.closeModal(m); }));
  }

  /* ---------- кнопки в пустых состояниях ---------- */
  function bindEmptyStates() {
    const actions = {
      task: () => { go('tasks'); setTimeout(() => $('#task-title').focus(), 150); },
      habit: () => { go('habits'); setTimeout(() => $('#habit-title').focus(), 150); },
      goal: () => { go('goals'); setTimeout(() => $('#goal-title').focus(), 150); },
      unstuck: () => { go('dashboard'); setTimeout(() => $('#unstuck-btn').click(), 220); },
    };
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-empty]');
      if (!btn) return;
      const fn = actions[btn.dataset.empty];
      if (fn) { Sound.sfx('click'); fn(); }
    });
  }

  /* ---------- установка как приложение (PWA) ---------- */
  let installEvent = null;
  function bindInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      installEvent = e;
      $('#install-btn').classList.remove('hidden');
      if (!State.s.installOffered) {
        State.s.installOffered = true;
        State.save();
        setTimeout(() => UI.toast('Приложение можно установить на устройство — в настройках', 'default', '📲'), 4000);
      }
    });
    $('#install-btn').addEventListener('click', async () => {
      if (!installEvent) return;
      installEvent.prompt();
      const res = await installEvent.userChoice.catch(() => null);
      if (res && res.outcome === 'accepted') {
        UI.toast('Установлено! Теперь работает и офлайн', 'success', '📲');
        FX.confetti(window.innerWidth / 2, window.innerHeight / 3, 60);
      }
      installEvent = null;
      $('#install-btn').classList.add('hidden');
    });
  }

  /* ---------- справка по горячим клавишам ---------- */
  const SHORTCUTS = [
    ['Разделы по номерам', '1 … 9'],
    ['Поиск и команды', 'Ctrl + K'],
    ['Новая задача', 'N'],
    ['Быстрый захват мысли', 'Q'],
    ['Старт / пауза фокус-таймера', 'F'],
    ['Режим гиперфокуса', 'H'],
    ['Музыка вкл/выкл', 'M'],
    ['Закрыть окно', 'Esc'],
    ['Эта справка', '?'],
  ];

  function showShortcuts() {
    Sound.sfx('click');
    UI.sheet(`
      <h2>⌨️ Горячие клавиши</h2>
      <p class="muted small">Работают, когда курсор не в поле ввода.</p>
      <div class="keys-grid">
        ${SHORTCUTS.map(([name, key]) => `
          <div class="keys-row">
            <span>${UI.esc(name)}</span>
            <span>${key.split(' ').map((k) => (k === '+' || k === '…' ? k : `<kbd>${UI.esc(k)}</kbd>`)).join(' ')}</span>
          </div>`).join('')}
      </div>`);
  }

  /* ---------- быстрый захват мысли ---------- */
  function openCapture() {
    UI.openModal('#capture-modal');
    setTimeout(() => $('#capture-input').focus(), 80);
  }

  function bindCapture() {
    const save = (toDump) => {
      const input = $('#capture-input');
      const text = input.value.trim();
      if (!text) return;
      if (toDump) {
        State.s.brainDump.unshift({ id: State.uid(), text, createdAt: Date.now() });
        State.s.totals.dumpCount += 1;
        State.addXP(3, 'mind');
        State.bumpQuest('dump', 1);
        UI.toast('В brain dump 🧠', 'success', '🧠');
      } else {
        Screens.tasks.add(text, 'other', 'mid', false);
      }
      input.value = '';
      UI.closeModal('#capture-modal');
      Sound.sfx('pop');
      State.commit();
    };
    $('#capture-form').addEventListener('submit', (e) => { e.preventDefault(); save(false); });
    $('#capture-dump').addEventListener('click', () => save(true));
  }

  function showCharacter() {
    const s = State.s;
    const stage = State.stage();
    const next = State.nextStage();
    Sound.sfx('click');
    UI.sheet(`
      <div class="char-sheet">
        <div class="char-avatar">${stage.emoji}</div>
        <h2>${UI.esc(stage.title)}</h2>
        <p class="muted">${UI.esc(stage.desc)}</p>
        <div class="char-stats">
          <div><b>${s.level}</b><small>уровень</small></div>
          <div><b>${UI.fmtShort(s.totals.xpEarned)}</b><small>всего XP</small></div>
          <div><b>${UI.fmtShort(State.netWorth())}</b><small>капитал</small></div>
          <div><b>${s.bestStreak}</b><small>рекорд серии</small></div>
        </div>
        ${next ? `<p class="char-next">Следующая форма: <b>${next.emoji} ${UI.esc(next.title)}</b> на ${next.level} уровне</p>` : '<p class="char-next">Ты достиг финальной формы 💎</p>'}
        <div class="char-evolution">${Data.EVOLUTION.map((e) => `
          <div class="char-evo${s.level >= e.level ? ' reached' : ''}">
            <span>${s.level >= e.level ? e.emoji : '❔'}</span>
            <small>${e.level}</small>
          </div>`).join('')}</div>
      </div>`, { wide: true });
  }

  /* ---------- уход и возвращение во время фокуса ---------- */
  let leftAt = 0;
  function bindPresence() {
    document.addEventListener('visibilitychange', () => {
      if (!Screens.focus.running) return;
      if (document.hidden) {
        leftAt = Date.now();
      } else if (leftAt) {
        const away = Math.round((Date.now() - leftAt) / 1000);
        leftAt = 0;
        if (away >= 20) {
          State.s.totals.returns = (State.s.totals.returns || 0) + 1;
          State.addXP(4, 'discipline');
          UI.toast('С возвращением! Отвлечься — норм, вернуться — сила 💪', 'success', '🔄');
          State.commit();
        }
      }
    });
  }

  /* ---------- свайпы между вкладками ---------- */
  const TAB_ORDER = ['dashboard', 'day', 'tasks', 'path', 'adhd', 'habits', 'goals', 'lessons', 'empire', 'rewards', 'stats'];
  function bindSwipe() {
    const area = $('.content');
    if (!area) return;
    let startX = 0, startY = 0, tracking = false;

    area.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      const t = e.target;
      // не перехватываем жесты у ползунков и горизонтально прокручиваемых блоков
      if (t.closest('input[type="range"], .heatmap, .mixer-grid, .station-grid, .chips-row, .filter-row')) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    }, { passive: true });

    area.addEventListener('touchend', (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
      const idx = TAB_ORDER.indexOf(currentTab);
      if (idx === -1) return;
      const next = dx < 0 ? idx + 1 : idx - 1;
      if (next < 0 || next >= TAB_ORDER.length) return;
      Sound.sfx('whoosh');
      FX.vibrate(10);
      go(TAB_ORDER[next]);
    }, { passive: true });
  }

  /* ---------- забытые задачи ---------- */
  function ghostTasks() {
    const cutoff = Date.now() - 14 * 86400000;
    return State.s.tasks.filter((t) => !t.done && t.createdAt < cutoff);
  }

  function offerGhostCleanup() {
    const ghosts = ghostTasks();
    if (ghosts.length < 3) return;
    if (State.s.ghostAskedAt && Date.now() - State.s.ghostAskedAt < 7 * 86400000) return;
    State.s.ghostAskedAt = Date.now();
    State.save();

    setTimeout(() => {
      const body = UI.sheet(`
        <h2>👻 Задачи-призраки</h2>
        <p class="muted">Эти задачи висят больше двух недель. Если они до сих пор не сделаны — скорее всего, они не нужны. Отпустить их не стыдно: это освобождает внимание.</p>
        <div class="ghost-list">
          ${ghosts.slice(0, 12).map((t) => `
            <label class="ghost-item">
              <input type="checkbox" data-ghost="${t.id}" checked>
              <span>${UI.esc(t.title)}</span>
              <small>${UI.timeAgo(t.createdAt)}</small>
            </label>`).join('')}
        </div>
        <div class="row-end" style="margin-top:16px">
          <button class="btn btn-ghost" data-act="keep">Оставить всё</button>
          <button class="btn btn-primary" data-act="drop">Отпустить выбранные</button>
        </div>`, { wide: true });

      body.querySelector('[data-act="keep"]').addEventListener('click', () => UI.closeModal('#sheet-modal'));
      body.querySelector('[data-act="drop"]').addEventListener('click', () => {
        const ids = Array.from(body.querySelectorAll('[data-ghost]:checked')).map((c) => c.dataset.ghost);
        State.s.tasks = State.s.tasks.filter((t) => !ids.includes(t.id));
        UI.closeModal('#sheet-modal');
        Sound.sfx('whoosh');
        UI.toast(`Отпущено: ${UI.plur(ids.length, 'задача', 'задачи', 'задач')} 🍃`, 'success');
        State.commit();
      });
    }, 3000);
  }

  /* ---------- первый жест: восстановить звук ---------- */
  function bindFirstGesture() {
    const restore = () => {
      Sound.ready();
      if (State.s.masterVolume != null) Sound.setMasterVolume(State.s.masterVolume);
      if (State.s.soundMix && Object.keys(State.s.soundMix).length) Sound.applyMix(State.s.soundMix);
      document.removeEventListener('pointerdown', restore);
      document.removeEventListener('keydown', restore);
    };
    document.addEventListener('pointerdown', restore);
    document.addEventListener('keydown', restore);
  }

  /* ---------- запуск ---------- */
  function init() {
    // внутри просмотрщика Claude низ страницы может уходить за экран телефона
    try { document.body.classList.toggle('in-frame', window.self !== window.top); } catch (e) { document.body.classList.add('in-frame'); }
    State.load();
    safely('State.watchOtherTabs', () => State.watchOtherTabs());
    safely('applyAll', () => applyAll());

    safely('FX.initBackground', () => FX.initBackground($('#bg-canvas')));
    safely('FX.initConfetti', () => FX.initConfetti($('#confetti-canvas')));
    safely('UI.initRipple', () => UI.initRipple());

    safely('bindStateEvents', () => bindStateEvents());
    safely('bindOnboarding', () => bindOnboarding());
    safely('bindSettings', () => bindSettings());
    safely('bindKeys', () => bindKeys());
    safely('bindFirstGesture', () => bindFirstGesture());

    safely('Screens.dashboard.bind', () => Screens.dashboard.bind());
    safely('Screens.tasks.bind', () => Screens.tasks.bind());
    safely('Screens.habits.bind', () => Screens.habits.bind());
    safely('Screens.goals.bind', () => Screens.goals.bind());
    safely('Screens.focus.bind', () => Screens.focus.bind());
    safely('Screens.rewards.bind', () => Screens.rewards.bind());
    safely('Screens.stats.bind', () => Screens.stats.bind());
    safely('Screens.routines.bind', () => Screens.routines.bind());
    safely('Screens.music.bind', () => Screens.music.bind());
    safely('Screens.review.bind', () => Screens.review.bind());
    safely('bindCapture', () => bindCapture());
    safely('bindPresence', () => bindPresence());
    safely('bindEmptyStates', () => bindEmptyStates());
    safely('bindInstall', () => bindInstall());
    safely('bindSwipe', () => bindSwipe());
    safely('Palette.bind', () => Palette.bind());
    safely('Advisor.bind', () => Advisor.bind());
    safely('Modes.bind', () => Modes.bind());
    safely('$', () => $('#mini-clock').addEventListener('click', () => go('dashboard')));
    safely('Chill.bind', () => Chill.bind());
    safely('DayTpl.seed', () => DayTpl.seed());
    safely('syncBottomInsets', () => syncBottomInsets());
    window.addEventListener('resize', syncBottomInsets);
    window.addEventListener('orientationchange', () => setTimeout(syncBottomInsets, 250));
    safely('setTimeout', () => setTimeout(syncBottomInsets, 400));
    safely('reportLoadProblem', () => reportLoadProblem());
    $('#shortcuts-btn').addEventListener('click', () => { UI.closeModal('#settings-modal'); setTimeout(showShortcuts, 200); });

    safely('paintIcons', () => paintIcons());
    $$('.tab-btn').forEach((b) => b.addEventListener('click', () => {
      if (b.id === 'tab-more') {
        const inOverflow = OVERFLOW.some((o) => o.tab === currentTab);
        if (inOverflow) { openMoreSheet(); return; }
        openMoreSheet();
        return;
      }
      go(b.dataset.tab);
      Sound.sfx('click');
    }));
    window.addEventListener('resize', moveIndicator);
    safely('$', () => $('#tabbar').addEventListener('scroll', moveIndicator, { passive: true }));

    State.tickPassive();
    startTicks();

    /* Облако спрашиваем сразу, параллельно с заставкой. */
    const cloudPromise = Cloud.init(8000);

    const hideLoader = (then) => {
      const loader = $('#loader');
      loader.style.opacity = '0';
      setTimeout(() => { loader.classList.add('hidden'); then(); }, 450);
    };

    setTimeout(async () => {
      if (State.s.onboarded) {
        // браузер уже знает человека — не ждём облако, открываем сразу
        hideLoader(showApp);
        cloudPromise.then(reconcile);
        return;
      }
      /* В браузере пусто. Это не значит, что человек новый: окно могло
         просто не сохранить память. Спрашиваем облако, и только если там
         никого нет — показываем анкету. */
      const text = $('.loader-text');
      if (text) text.textContent = 'Загружаю твой прогресс…';
      const remote = await Promise.race([cloudPromise, new Promise((r) => setTimeout(() => r(undefined), 7000))]);
      if (remote && remote.onboarded) {
        State.adopt(remote);
        applyAll();
        hideLoader(showApp);
        afterCloud();
        return;
      }
      hideLoader(() => {
        $('#onboarding').classList.remove('hidden');
      });
      // облако ответило позже анкеты — если человек там есть, пускаем в приложение
      cloudPromise.then((late) => {
        if (late && late.onboarded && !State.s.onboarded) {
          State.adopt(late);
          applyAll();
          $('#onboarding').classList.add('hidden');
          showApp();
          UI.toast('Прогресс подтянулся из облака', 'success', '☁️');
        }
        afterCloud();
      });
    }, 850);
  }

  /* Каждый шаг запуска — отдельно: если один упал, остальные всё равно
     отработают. Раньше ошибка в сборке дня оставляла приложение без плана. */
  function safely(name, fn) {
    try { return fn(); } catch (e) { logError(name, e); return undefined; }
  }

  /* ошибки пишем в сохранение (оно уходит в облако) — так их видно,
     даже если телефон не показывает консоль */
  function logError(where, e) {
    try {
      const s = State.s;
      s.errLog = (s.errLog || []).concat({
        at: Date.now(), where: String(where).slice(0, 40),
        msg: String((e && e.message) || e).slice(0, 200),
        stack: String((e && e.stack) || '').split('\n').slice(0, 3).join(' | ').slice(0, 300),
      }).slice(-12);
      State.save();
    } catch (err) { /* даже журнал не записался — молчим */ }
  }

  function showApp() {
    $('#app').classList.remove('hidden');
    safely('dailyCheckIn', dailyCheckIn);
    safely('ensureDaySetup', ensureDaySetup);
    safely('go', () => go('dashboard'));
    safely('tilt', () => UI.initTilt());
    safely('ghosts', offerGhostCleanup);
    safely('env', noteEnv);
  }

  /* размеры экрана внутри просмотрщика — чтобы понять, куда девается нижняя панель */
  function noteEnv() {
    setTimeout(() => {
      const bar = $('#tabbar');
      const r = bar ? bar.getBoundingClientRect() : null;
      State.s.envNote = {
        at: Date.now(), w: innerWidth, h: innerHeight,
        vv: window.visualViewport ? Math.round(window.visualViewport.height) : null,
        framed: (() => { try { return window.self !== window.top; } catch (e) { return true; } })(),
        bar: r ? { top: Math.round(r.top), h: Math.round(r.height), pos: getComputedStyle(bar).position } : null,
        ua: navigator.userAgent.slice(0, 160),
      };
      State.save();
    }, 1500);
  }

  /* облако ответило, а приложение уже открыто: берём то, что свежее */
  function reconcile(remote) {
    if (remote && (remote.savedAt || 0) > (State.s.savedAt || 0)) {
      State.adopt(remote);
      applyAll();
      // в облаке мог лежать вчерашний план — собираем сегодняшний
      lastHeal = 0;
      safely('dailyCheckIn', dailyCheckIn);
      safely('ensureDaySetup', ensureDaySetup);
      renderActive();
    }
    afterCloud();
  }

  function afterCloud() {
    if (!Cloud.ready) return;
    Cloud.bindTriggers();
    Cloud.flush();                 // первая синхронизация: локальное — в облако
    Cloud.watch((fresh) => {       // другое устройство сохранило новее
      State.adopt(fresh);
      applyAll();
      lastHeal = 0;
      safely('ensureDaySetup', ensureDaySetup);
      renderActive();
      UI.toast('Обновил прогресс с другого устройства', 'default', '☁️');
    });
  }

  /* день настраивается сам: график недели и сегодняшние дела на месте,
     без единой кнопки */
  let settingUp = false;
  function ensureDaySetup() {
    if (typeof Week === 'undefined' || typeof DayTpl === 'undefined' || settingUp) return;
    settingUp = true;
    try {
      // старые закрытые задачи — в журнал, чтобы память не пухла годами
      safely('compact', () => { if (State.compactDone(30)) State.save(); });
      // график ставится и обновляется сам — руками ничего нажимать не нужно
      const fresh = safely('weekCheck', () => !Week.installed() || Week.outdated());
      if (fresh) safely('weekInstall', () => Week.install());
      if (fresh || !DayTpl.appliedToday()) safely('tplApply', () => DayTpl.apply({ quiet: true }));
      if (typeof Planner === 'undefined') return;
      const pl = Planner.plan();
      if (fresh || !pl || (Planner.inScript() && !pl.script)) safely('planBuild', () => Planner.build({}));
    } finally { settingUp = false; }
  }

  /* план на сегодня должен быть всегда: если его нет (новый день, облако
     подсунуло старое сохранение) — собираем тихо, не чаще раза в 20 секунд */
  let lastHeal = 0;
  function healDay() {
    if (typeof Planner === 'undefined' || !State.s.onboarded || $('#app').classList.contains('hidden')) return;
    if (Planner.plan() && DayTpl.appliedToday()) return;
    if (Date.now() - lastHeal < 20000) return;
    lastHeal = Date.now();
    ensureDaySetup();
  }

  return { init, go, showComeback, syncBottomInsets, applyAll, applyPalette, renderHeader, renderActive, openCapture, moveIndicator, paintMiniPlayIcon, isQuietNow, logError, ensureDaySetup, focusTask: null };
})();

window.addEventListener('error', (e) => { try { App.logError('window', e.error || e.message); } catch (err) {} });
window.addEventListener('unhandledrejection', (e) => { try { App.logError('promise', e.reason); } catch (err) {} });
document.addEventListener('DOMContentLoaded', App.init);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
