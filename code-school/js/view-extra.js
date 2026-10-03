/* Песочница, словарь и профиль (с настройками и сертификатом). */
(function () {
  // ———————————————— ПЕСОЧНИЦА ————————————————
  let sbw = null;
  function renderSandbox(root) {
    const s = Store.s;
    const T = window.SANDBOX_TEMPLATES || [];
    const incoming = sessionStorage.getItem('igrokod_sandbox_in');
    sessionStorage.removeItem('igrokod_sandbox_in');
    let curProject = null;
    const startCode = incoming || s.sandboxCode || (T[0] ? T[0].code : '');
    const startCanvas = s.sandboxCanvas !== undefined ? s.sandboxCanvas : true;
    root.innerHTML = `
      <div class="page-head"><h1>🧪 Песочница</h1><p class="lead">Здесь можно писать что угодно: пробовать, ломать и создавать свои игры. Начни с шаблона или с чистого листа.</p></div>
      <div class="sandbox">
        <div class="sb-tools">
          <label class="sel"><span>Шаблон:</span><select class="sb-tpl"><option value="">— выбери —</option>${T.map((t, k) => `<option value="${k}">${UI.esc(t.name)}</option>`).join('')}</select></label>
          <label class="switch"><input type="checkbox" class="sb-canvas" ${startCanvas ? 'checked' : ''}> <span>Холст для игры</span></label>
          <span class="wb-spacer"></span>
          <span class="sb-name muted"></span>
          <button type="button" class="btn small sb-save">💾 Сохранить проект</button>
          <button type="button" class="btn small sb-list">📂 Мои проекты (${s.projects.length})</button>
        </div>
        <div class="wb-host"></div>
      </div>`;
    sbw = Workbench.create(root.querySelector('.wb-host'), {
      value: startCode,
      canvas: startCanvas,
      onChange: (v) => { s.sandboxCode = v; Store.save(); },
      onSave: () => saveProject()
    });
    const nameEl = root.querySelector('.sb-name');
    root.querySelector('.sb-canvas').onchange = (e) => { s.sandboxCanvas = e.target.checked; sbw.setCanvas(e.target.checked); Store.save(); };
    root.querySelector('.sb-tpl').onchange = async (e) => {
      const t = T[+e.target.value];
      e.target.value = '';
      if (!t) return;
      if (sbw.editor.value.trim() && !(await UI.confirmBox(`Открыть шаблон «${UI.esc(t.name)}»? Текущий код заменится (если он нужен — сначала сохрани проект).`, 'Открыть'))) return;
      sbw.editor.setValue(t.code);
      s.sandboxCode = t.code;
      s.sandboxCanvas = t.canvas;
      root.querySelector('.sb-canvas').checked = t.canvas;
      sbw.setCanvas(t.canvas);
      curProject = null;
      nameEl.textContent = '';
      Store.save();
      sbw.run();
    };
    async function saveProject() {
      let name = curProject ? curProject.name : '';
      const m = UI.modal(`<h2>💾 Сохранить проект</h2><label class="field"><span>Название</span><input class="pj-name" maxlength="40" value="${UI.esc(name)}" placeholder="Например: Моя первая игра"></label>
        <div class="modal-btns"><button class="btn" data-close="no">Отмена</button><button class="btn primary pj-ok">Сохранить</button></div>`);
      const inp = m.box.querySelector('.pj-name');
      setTimeout(() => inp.focus(), 60);
      const ok = () => {
        name = inp.value.trim() || 'Проект ' + (s.projects.length + 1);
        if (curProject && curProject.name === name) {
          curProject.code = sbw.editor.value; curProject.canvas = root.querySelector('.sb-canvas').checked; curProject.updated = Date.now();
        } else {
          curProject = { id: Date.now().toString(36), name, code: sbw.editor.value, canvas: root.querySelector('.sb-canvas').checked, updated: Date.now() };
          s.projects.unshift(curProject);
        }
        Store.save();
        nameEl.textContent = '📄 ' + name;
        root.querySelector('.sb-list').textContent = `📂 Мои проекты (${s.projects.length})`;
        m.close();
        UI.toast('Проект сохранён ✓', 'ok');
        Progress.checkAchievements();
      };
      m.box.querySelector('.pj-ok').onclick = ok;
      inp.onkeydown = (e) => { if (e.key === 'Enter') ok(); };
    }
    root.querySelector('.sb-save').onclick = saveProject;
    root.querySelector('.sb-list').onclick = () => {
      const list = s.projects;
      const m = UI.modal(`<h2>📂 Мои проекты</h2>${list.length ? `<ul class="pj-list">${list.map((p, k) => `<li><button class="pj-open" data-k="${k}"><b>${UI.esc(p.name)}</b><small>${new Date(p.updated).toLocaleString('ru-RU')}</small></button><button class="btn tiny ghost pj-del" data-k="${k}" title="Удалить" aria-label="Удалить">🗑</button></li>`).join('')}</ul>` : '<p class="muted">Пока нет сохранённых проектов. Напиши что-нибудь и нажми «💾 Сохранить проект».</p>'}
        <div class="modal-btns"><button class="btn" data-close="x">Закрыть</button></div>`);
      m.box.querySelectorAll('.pj-open').forEach((b) => b.onclick = () => {
        const p = list[+b.dataset.k];
        curProject = p;
        sbw.editor.setValue(p.code);
        s.sandboxCode = p.code;
        s.sandboxCanvas = p.canvas;
        root.querySelector('.sb-canvas').checked = p.canvas;
        sbw.setCanvas(p.canvas);
        nameEl.textContent = '📄 ' + p.name;
        Store.save();
        m.close();
        sbw.run();
      });
      m.box.querySelectorAll('.pj-del').forEach((b) => b.onclick = async () => {
        const p = list[+b.dataset.k];
        m.close();
        if (await UI.confirmBox(`Удалить проект «${UI.esc(p.name)}»?`, 'Удалить')) {
          s.projects.splice(s.projects.indexOf(p), 1);
          if (curProject === p) { curProject = null; nameEl.textContent = ''; }
          Store.save();
          root.querySelector('.sb-list').textContent = `📂 Мои проекты (${s.projects.length})`;
        }
      });
    };
    if (incoming) setTimeout(() => sbw.run(), 100);
  }

  // ———————————————— СЛОВАРЬ ————————————————
  function renderDict(root) {
    const G = window.GLOSSARY;
    const topics = [];
    Object.values(G).forEach((v) => { if (!topics.includes(v[3])) topics.push(v[3]); });
    root.innerHTML = `
      <div class="page-head"><h1>📖 Словарь программиста</h1>
      <p class="lead">Все английские слова из курса: перевод, произношение русскими буквами и что слово делает в коде. Нажми 🔊, чтобы услышать, как оно звучит.</p></div>
      <div class="dict-tools">
        <input type="search" class="dict-q" placeholder="Поиск: по-английски или по-русски…" aria-label="Поиск слова">
        <div class="chips"><button type="button" class="chip on" data-t="">Все (${Object.keys(G).length})</button>${topics.map((t) => `<button type="button" class="chip" data-t="${UI.esc(t)}">${UI.esc(t)}</button>`).join('')}</div>
      </div>
      <div class="dict-list"></div>`;
    const list = root.querySelector('.dict-list');
    let topic = '';
    const draw = () => {
      const q = root.querySelector('.dict-q').value.trim().toLowerCase();
      const words = Object.keys(G).filter((w) => {
        const v = G[w];
        if (topic && v[3] !== topic) return false;
        if (!q) return true;
        return w.toLowerCase().includes(q) || v[0].toLowerCase().includes(q) || v[1].toLowerCase().includes(q) || v[2].toLowerCase().includes(q);
      }).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      list.innerHTML = words.length ? words.map((w) => {
        const v = G[w];
        return `<div class="dw"><div class="dw-top"><code class="dw-word">${UI.esc(w)}</code><button type="button" class="dw-say" data-w="${UI.esc(w)}" aria-label="Послушать">🔊</button></div>
          <div class="dw-pr">[${UI.esc(v[1])}]</div><div class="dw-ru">${UI.esc(v[0])}</div>${v[2] && v[2] !== v[0] + '.' ? `<div class="dw-what">${UI.esc(v[2])}</div>` : ''}<span class="dw-topic">${UI.esc(v[3])}</span></div>`;
      }).join('') : '<p class="muted">Ничего не найдено.</p>';
      list.querySelectorAll('.dw-say').forEach((b) => b.onclick = () => {
        UI.sayEnglish(b.dataset.w);
        Store.s.stats.spoken = (Store.s.stats.spoken || 0) + 1;
        Store.save();
        Progress.checkAchievements();
      });
    };
    root.querySelector('.dict-q').oninput = draw;
    root.querySelectorAll('.chip').forEach((c) => c.onclick = () => {
      topic = c.dataset.t;
      root.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === c));
      draw();
    });
    draw();
  }

  // ———————————————— ПРОФИЛЬ ————————————————
  function renderProfile(root) {
    const s = Store.s;
    const lv = Progress.levelInfo(s.xp);
    const ov = Course.overall();
    const achs = Progress.allAchievements();
    const got = achs.filter((a) => s.ach[a.id] && s.ach[a.id] !== true);
    const days = Object.keys(s.days).length;
    const solo = Object.values(s.done).filter((d) => !d.hints && !d.sol).length;
    root.innerHTML = `
      <div class="page-head"><h1>👤 Профиль</h1></div>
      <div class="profile">
        <section class="card p-main">
          <div class="p-avatar">${lv.icon}</div>
          <div class="p-who">
            <label class="field"><span>Твоё имя (будет на сертификате)</span><input class="p-name" maxlength="40" value="${UI.esc(s.name)}" placeholder="Как тебя зовут?"></label>
            <div class="p-level"><b>${lv.title}</b> · уровень ${lv.n} из ${Progress.LEVELS.length} · ${s.xp} XP</div>
            <div class="bar"><i style="width:${lv.pct}%"></i></div>
            <small class="muted">${lv.max ? 'Максимальный уровень!' : `До уровня «${lv.nextTitle}» осталось ${lv.to - s.xp} XP`}</small>
          </div>
        </section>
        <section class="card p-stats">
          <div><b>${ov.done}/${ov.total}</b><small>уроков пройдено</small></div>
          <div><b>${ov.pct}%</b><small>курса</small></div>
          <div><b>🔥 ${s.streak.count || 0}</b><small>дней подряд (рекорд ${s.streak.best || 0})</small></div>
          <div><b>${days}</b><small>дней занятий</small></div>
          <div><b>${s.stats.runs}</b><small>запусков кода</small></div>
          <div><b>${s.stats.fixed}</b><small>исправленных ошибок</small></div>
          <div><b>${solo}</b><small>уроков без подсказок</small></div>
          <div><b>${s.projects.length}</b><small>своих проектов</small></div>
        </section>
        <section class="card">
          <h2>🏆 Сертификат</h2>
          ${ov.pct === 100
            ? '<p>Ты прошёл весь курс! Скачай сертификат и покажи друзьям и родителям.</p><button type="button" class="btn primary cert-btn">📜 Получить сертификат</button>'
            : `<p>Сертификат откроется, когда ты пройдёшь все уроки. Осталось: <b>${ov.total - ov.done}</b>.</p><div class="bar"><i style="width:${ov.pct}%"></i></div><button type="button" class="btn small cert-btn" style="margin-top:12px">Посмотреть, как он выглядит</button>`}
        </section>
        <section class="card">
          <h2>🏅 Достижения <small class="muted">${got.length} из ${achs.length}</small></h2>
          <div class="achs">${achs.map((a) => {
            const has = s.ach[a.id] && s.ach[a.id] !== true;
            return `<div class="ach ${has ? 'got' : ''}" title="${UI.esc(a.desc)}"><span class="ach-icon">${has ? a.icon : '🔒'}</span><b>${UI.esc(a.title)}</b><small>${UI.esc(a.desc)}</small></div>`;
          }).join('')}</div>
        </section>
        <section class="card settings">
          <h2>⚙️ Настройки</h2>
          <label class="sel"><span>Тема оформления</span><select class="st-theme">
            <option value="auto" ${s.settings.theme === 'auto' ? 'selected' : ''}>Как в системе</option>
            <option value="dark" ${s.settings.theme === 'dark' ? 'selected' : ''}>Тёмная</option>
            <option value="light" ${s.settings.theme === 'light' ? 'selected' : ''}>Светлая</option></select></label>
          <label class="sel"><span>Размер шрифта кода</span><input type="range" min="11" max="24" class="st-font" value="${s.settings.font}"> <b class="st-font-v">${s.settings.font}px</b></label>
          <label class="switch"><input type="checkbox" class="st-sound" ${s.settings.sound ? 'checked' : ''}> <span>Звуки</span></label>
          <label class="switch"><input type="checkbox" class="st-sym" ${s.settings.symbols ? 'checked' : ''}> <span>Панель символов под редактором ( ) { } ; …</span></label>
          <label class="switch"><input type="checkbox" class="st-unlock" ${s.settings.unlockAll ? 'checked' : ''}> <span>Открыть все уроки (если уже умеешь программировать)</span></label>
          <div class="st-row">
            <button type="button" class="btn small st-export">📤 Перенести прогресс на другое устройство</button>
            <button type="button" class="btn small st-import">📥 Загрузить прогресс</button>
            <button type="button" class="btn small danger st-reset">🗑 Сбросить весь прогресс</button>
          </div>
        </section>
      </div>`;
    const q = (c) => root.querySelector(c);
    q('.p-name').oninput = (e) => { s.name = e.target.value.trim(); Store.save(); };
    q('.st-theme').onchange = (e) => { s.settings.theme = e.target.value; Store.save(); App.applyTheme(); };
    q('.st-font').oninput = (e) => { s.settings.font = +e.target.value; q('.st-font-v').textContent = s.settings.font + 'px'; Store.save(); };
    q('.st-sound').onchange = (e) => { s.settings.sound = e.target.checked; Store.save(); };
    q('.st-sym').onchange = (e) => { s.settings.symbols = e.target.checked; Store.save(); };
    q('.st-unlock').onchange = (e) => { s.settings.unlockAll = e.target.checked; Store.save(); };
    q('.st-export').onclick = () => {
      const txt = Store.exportText();
      const m = UI.modal(`<h2>📤 Перенос прогресса</h2><p>Скопируй этот код и вставь его на другом устройстве: Профиль → «📥 Загрузить прогресс».</p>
        <textarea class="export-box" readonly>${txt}</textarea><div class="modal-btns"><button class="btn" data-close="x">Закрыть</button><button class="btn primary ex-copy">📋 Скопировать</button></div>`);
      const ta = m.box.querySelector('textarea');
      ta.select();
      m.box.querySelector('.ex-copy').onclick = () => {
        ta.select();
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => UI.toast('Скопировано ✓', 'ok')).catch(() => { document.execCommand('copy'); UI.toast('Скопировано ✓', 'ok'); });
      };
    };
    q('.st-import').onclick = () => {
      const m = UI.modal(`<h2>📥 Загрузить прогресс</h2><p>Вставь код, который ты скопировал на другом устройстве. Текущий прогресс на этом устройстве заменится.</p>
        <textarea class="export-box imp"></textarea><div class="modal-btns"><button class="btn" data-close="x">Отмена</button><button class="btn primary im-ok">Загрузить</button></div>`);
      m.box.querySelector('.im-ok').onclick = () => {
        try { Store.importText(m.box.querySelector('.imp').value); m.close(); UI.toast('Прогресс загружен ✓', 'ok'); App.route(); App.refreshHeader(); }
        catch (e) { UI.toast('Код не подошёл. Проверь, что скопировал его целиком.', 'bad'); }
      };
    };
    q('.st-reset').onclick = async () => {
      if (!(await UI.confirmBox('Точно стереть весь прогресс, опыт и проекты? Это нельзя отменить.', 'Стереть всё'))) return;
      Store.reset();
      App.applyTheme();
      App.refreshHeader();
      location.hash = '#/';
    };
    q('.cert-btn').onclick = () => certificate(ov.pct === 100);
  }

  function certificate(real) {
    const s = Store.s;
    const c = document.createElement('canvas');
    c.width = 1400; c.height = 990;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 1400, 990);
    grad.addColorStop(0, '#0f1630'); grad.addColorStop(1, '#241a4a');
    g.fillStyle = grad; g.fillRect(0, 0, 1400, 990);
    // звёзды
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.6})`; g.fillRect(Math.random() * 1400, Math.random() * 990, 2, 2); }
    g.strokeStyle = '#ffd166'; g.lineWidth = 6; g.strokeRect(40, 40, 1320, 910);
    g.strokeStyle = 'rgba(255,209,102,.4)'; g.lineWidth = 2; g.strokeRect(60, 60, 1280, 870);
    g.textAlign = 'center';
    g.fillStyle = '#ffd166'; g.font = '700 40px Nunito, sans-serif'; g.fillText('🎮 ИгроКод', 700, 150);
    g.fillStyle = '#ffffff'; g.font = '800 88px Nunito, sans-serif'; g.fillText('СЕРТИФИКАТ', 700, 270);
    g.fillStyle = '#b8c0ff'; g.font = '32px Nunito, sans-serif'; g.fillText('подтверждает, что', 700, 345);
    g.fillStyle = '#ffffff'; g.font = '800 72px Nunito, sans-serif'; g.fillText(s.name || 'Юный разработчик', 700, 450);
    g.fillStyle = '#b8c0ff'; g.font = '32px Nunito, sans-serif';
    g.fillText('успешно прошёл(а) курс', 700, 525);
    g.fillStyle = '#06d6a0'; g.font = '700 46px Nunito, sans-serif'; g.fillText('«Программирование игр на JavaScript с нуля»', 700, 600);
    const ov = Course.overall();
    g.fillStyle = '#d0d6ff'; g.font = '28px Nunito, sans-serif';
    g.fillText(`${ov.done} уроков · ${Course.modules().length} модулей · ${s.xp} XP · уровень «${Progress.levelInfo(s.xp).title}»`, 700, 680);
    g.fillText('Змейка · Арканоид · Flappy Bird · Платформер · Космический шутер', 700, 730);
    g.fillStyle = '#8f99d6'; g.font = '26px Nunito, sans-serif';
    g.fillText(new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }), 700, 850);
    if (!real) {
      g.save(); g.translate(700, 495); g.rotate(-0.35);
      g.fillStyle = 'rgba(239,71,111,.55)'; g.font = '900 150px Nunito, sans-serif'; g.fillText('ОБРАЗЕЦ', 0, 50); g.restore();
    }
    const url = c.toDataURL('image/png');
    UI.modal(`<h2>📜 ${real ? 'Твой сертификат' : 'Так будет выглядеть сертификат'}</h2><img class="cert-img" src="${url}" alt="Сертификат">
      <div class="modal-btns"><button class="btn" data-close="x">Закрыть</button>${real ? `<a class="btn primary" download="sertifikat-igrokod.png" href="${url}">⬇ Скачать</a>` : ''}</div>`, { cls: 'wide' });
    if (real) { UI.confetti(200); UI.sounds.level(); }
  }

  function leave() { if (sbw) { sbw.stop(); sbw = null; } }

  window.ViewExtra = { renderSandbox, renderDict, renderProfile, leave };
})();
