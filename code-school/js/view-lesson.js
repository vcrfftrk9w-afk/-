/* Экран урока: теория слева, задание и редактор справа (на телефоне — вкладками). */
(function () {
  let wb = null;
  let current = null;

  function render(root, id) {
    const l = Course.byId(id);
    if (!l) { root.innerHTML = '<div class="empty"><h2>Урок не найден</h2><a class="btn primary" href="#/">На главную</a></div>'; return; }
    if (!Course.isUnlocked(id)) {
      const prev = Course.prev(id);
      root.innerHTML = `<div class="empty"><div class="empty-icon">🔒</div><h2>Этот урок пока закрыт</h2>
        <p>Сначала пройди предыдущий урок${prev ? `: <b>${UI.esc(prev.title)}</b>` : ''}. Так знания будут складываться по порядку.</p>
        ${prev ? `<a class="btn primary" href="#/lesson/${prev.id}">Перейти к нему</a>` : ''} <a class="btn" href="#/">К карте курса</a>
        <p class="muted small">Если ты уже умеешь программировать, в профиле можно открыть все уроки.</p></div>`;
      return;
    }
    const s = Store.s;
    s.lastLesson = id;
    Store.save();
    current = l;
    const m = l._m;
    const task = l.task;
    const all = Course.lessons();
    const idx = all.indexOf(l);
    const prev = Course.prev(id), next = Course.next(id);
    const done = Course.isDone(id);

    root.innerHTML = `
    <div class="lesson" data-tab="theory">
      <div class="lesson-head">
        <a class="btn ghost small" href="#/" title="К карте курса">← Карта</a>
        <div class="lh-title"><small>${m.icon} ${UI.esc(m.title)} · урок ${l._li + 1} из ${m.lessons.length}</small><h1>${UI.esc(l.title)} ${done ? '<span class="done-badge" title="Пройден">✓</span>' : ''}</h1></div>
        <div class="lh-dots" aria-hidden="true">${m.lessons.map((x) => `<a href="#/lesson/${x.id}" class="${Course.isDone(x.id) ? 'd' : ''} ${x === l ? 'c' : ''} ${Course.isUnlocked(x.id) ? '' : 'lk'}" title="${UI.esc(x.title)}"></a>`).join('')}</div>
      </div>
      <div class="lesson-tabs" role="tablist">
        <button type="button" role="tab" data-tab="theory" class="on">📖 Теория</button>
        <button type="button" role="tab" data-tab="code">${task ? '💻 Практика' : '✅ Итог'}</button>
      </div>
      <div class="lesson-body ${task ? '' : 'no-task'}">
        <article class="theory">
          <div class="theory-tools"><button type="button" class="btn ghost small read-aloud">🔊 Слушать урок</button>
          <span class="muted small">Наведи на любое английское слово в коде — увидишь перевод</span></div>
          <div class="md">${MD.render(l.theory || '')}</div>
          ${l.quiz ? quizHtml(l) : ''}
          ${task ? `<button type="button" class="btn primary big to-task mobile-only">💻 К заданию →</button>` : ''}
          ${!task && !l.quiz ? `<div class="read-done"><button type="button" class="btn primary big mark-read">${done ? '✓ Прочитано' : '✓ Я всё прочитал'}</button></div>` : ''}
          <div class="lesson-nav">
            ${prev ? `<a class="btn" href="#/lesson/${prev.id}">← ${UI.esc(prev.title)}</a>` : '<span></span>'}
            ${next ? `<a class="btn ${done ? 'primary' : ''} next-link" href="#/lesson/${next.id}">${UI.esc(next.title)} →</a>` : ''}
          </div>
        </article>
        ${task ? `<section class="work">
          <div class="task-card">
            <h2>🎯 Задание</h2>
            <div class="md">${MD.render(task.text)}</div>
            <ul class="checklist">${task.tests.map((t, k) => `<li data-i="${k}"><span class="ck">⬜</span>${MD.inline(t[0])}</li>`).join('')}</ul>
            <div class="task-status" aria-live="polite"></div>
            <div class="hints"></div>
            <div class="task-btns">
              <button type="button" class="btn small hint-btn">💡 Подсказка</button>
              <button type="button" class="btn small sol-btn">👀 Решение</button>
              <button type="button" class="btn small ghost reset-btn">↺ Начать заново</button>
            </div>
            <div class="solution" hidden></div>
          </div>
          <div class="wb-host"></div>
        </section>` : `<section class="work theory-only-side">
          <div class="task-card"><h2>📖 Теоретический урок</h2><p>В этом уроке нет задания с кодом. ${l.quiz ? 'Ответь на вопросы в конце урока, чтобы закрепить знания.' : 'Прочитай его и нажми «Я всё прочитал».'}</p>
          ${next ? `<a class="btn ${done ? 'primary' : ''}" href="#/lesson/${next.id}">Следующий урок →</a>` : ''}</div>
        </section>`}
      </div>
    </div>`;

    const lessonEl = root.querySelector('.lesson');
    root.querySelectorAll('.lesson-tabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
    function setTab(t) {
      lessonEl.dataset.tab = t;
      root.querySelectorAll('.lesson-tabs button').forEach((x) => x.classList.toggle('on', x.dataset.tab === t));
      window.scrollTo({ top: 0 });
      if (t === 'code' && wb) setTimeout(() => wb.editor.refresh(), 30);
    }
    const toTask = root.querySelector('.to-task');
    if (toTask) toTask.onclick = () => setTab('code');

    // озвучка
    const ra = root.querySelector('.read-aloud');
    let reading = false;
    ra.onclick = () => {
      if (reading) { UI.stopSpeech(); reading = false; ra.textContent = '🔊 Слушать урок'; return; }
      const text = root.querySelector('.theory .md').innerText.replace(/\n+/g, '. ');
      if (UI.sayRussian(text, () => { reading = false; ra.textContent = '🔊 Слушать урок'; })) { reading = true; ra.textContent = '⏹ Остановить'; }
    };

    wireExamples(root);
    if (l.quiz) wireQuiz(root, l);
    const mr = root.querySelector('.mark-read');
    if (mr) mr.onclick = () => complete(l);
    if (task) setupTask(root, l);
  }

  function wireExamples(root) {
    root.querySelectorAll('.example').forEach((ex) => {
      const data = window.EXAMPLES[ex.dataset.ex];
      const out = ex.querySelector('.ex-out');
      const con = ex.querySelector('.console');
      const frame = ex.querySelector('.ex-frame');
      ex.querySelector('.ex-run').onclick = () => {
        out.hidden = false;
        con.innerHTML = '';
        let printed = 0, err = false;
        Store.s.stats.runs++;
        Store.save();
        Runner.run({
          host: frame, code: data.code, canvas: data.canvas, width: data.w, height: data.h,
          onLog: (m) => { printed++; const d = document.createElement('div'); d.className = 'cl ' + m.kind; d.textContent = m.text; con.appendChild(d); con.scrollTop = con.scrollHeight; },
          onError: (e) => { err = true; const info = ErrorsRu.explain(e, data.code); const d = document.createElement('div'); d.className = 'cl err'; d.innerHTML = `<div class="err-title">🐞 ${UI.esc(info.title)}</div><div class="err-text">${info.text}</div>`; con.appendChild(d); },
          onDone: () => {
            con.hidden = data.canvas && !printed && !err;
            if (!printed && !err && !data.canvas) con.innerHTML = '<div class="cl muted">(ничего не напечатано)</div>';
            Progress.checkAchievements();
          }
        });
      };
      ex.querySelector('.ex-copy').onclick = async () => {
        if (!wb) {
          // в теоретическом уроке — открываем пример в песочнице
          sessionStorage.setItem('igrokod_sandbox_in', data.code);
          location.hash = '#/sandbox';
          return;
        }
        const cur = wb.editor.value.trim();
        const starter = (current.task.starter || '').trim();
        if (cur && cur !== starter && !(await UI.confirmBox('Заменить твой код в редакторе на этот пример? Отменить можно через Ctrl+Z.', 'Заменить'))) return;
        wb.editor.setValue(data.code);
        Store.s.code[current.id] = data.code;
        Store.save();
        const tabBtn = document.querySelector('.lesson-tabs button[data-tab="code"]');
        if (tabBtn && getComputedStyle(tabBtn.parentNode).display !== 'none') tabBtn.click();
        UI.toast('Пример в редакторе — меняй и запускай!', 'ok');
      };
    });
  }

  function quizHtml(l) {
    return `<section class="quiz"><h2>🧩 Проверь себя</h2>${l.quiz.map((q, qi) => `
      <div class="q" data-q="${qi}"><p class="q-text"><b>${qi + 1}.</b> ${MD.inline(q.q)}</p>
      <div class="q-opts">${q.a.map((a, ai) => `<button type="button" class="q-opt" data-a="${ai}">${MD.inline(a)}</button>`).join('')}</div>
      <div class="q-exp" hidden></div></div>`).join('')}</section>`;
  }

  function wireQuiz(root, l) {
    const state = l.quiz.map(() => ({ tries: 0, ok: false }));
    root.querySelectorAll('.q').forEach((qe) => {
      const qi = +qe.dataset.q;
      const q = l.quiz[qi];
      qe.querySelectorAll('.q-opt').forEach((b) => b.addEventListener('click', () => {
        if (state[qi].ok) return;
        const ai = +b.dataset.a;
        state[qi].tries++;
        const exp = qe.querySelector('.q-exp');
        exp.hidden = false;
        if (ai === q.c) {
          state[qi].ok = true;
          b.classList.add('right');
          qe.classList.add('answered');
          exp.innerHTML = '✅ ' + (state[qi].tries === 1 ? 'Верно! ' : 'Правильно. ') + MD.inline(q.e || '');
          UI.sounds.ok();
          if (state.every((x) => x.ok)) quizDone();
        } else {
          b.classList.add('wrong');
          b.disabled = true;
          exp.innerHTML = '❌ Не совсем. ' + (q.w && q.w[ai] ? MD.inline(q.w[ai]) : 'Подумай ещё и попробуй другой вариант.');
          UI.sounds.fail();
        }
      }));
    });
    function quizDone() {
      const s = Store.s;
      const firstTry = state.filter((x) => x.tries === 1).length;
      if (s.quiz[l.id] === undefined) {
        s.quiz[l.id] = firstTry;
        s.xp += firstTry * 2;
        Store.touchDay();
        Store.save();
        if (firstTry) UI.toast(`🧩 Тест пройден: +${firstTry * 2} XP`, 'ok');
        checkLevelUp(s.xp - firstTry * 2);
      }
      if (!l.task) complete(l);
      Progress.checkAchievements();
    }
  }

  function setupTask(root, l) {
    const task = l.task;
    const s = Store.s;
    const host = root.querySelector('.wb-host');
    const isGame = !!(task.wait || task.prep);
    let saveTimer = null;
    wb = Workbench.create(host, {
      value: s.code[l.id] !== undefined ? s.code[l.id] : task.starter,
      canvas: !!task.canvas,
      width: task.width, height: task.height,
      checkButton: isGame,
      onChange: (v) => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => { s.code[l.id] = v; Store.save(); }, 400);
      },
      autoCheck: () => (isGame ? null : { tests: task.tests }),
      onStart: (chk) => {
        const st = root.querySelector('.task-status');
        if (chk && chk.wait) st.innerHTML = '<div class="robot">🤖 Робот-проверяльщик тестирует игру… <span class="dots"></span></div>';
        else st.innerHTML = '';
      },
      onDone: (res, chk) => onResult(root, l, res, chk)
    });
    if (isGame) {
      wb.checkBtn.hidden = false;
      wb.checkBtn.onclick = () => wb.run({ tests: task.tests, wait: task.wait || 300, prep: task.prep });
      wb.line('Это игровое задание: «▶ Запустить» — поиграть самому, «🤖 Проверить игру» — робот проверит, всё ли работает.', 'muted');
    }

    // подсказки
    const hintsEl = root.querySelector('.hints');
    const hintBtn = root.querySelector('.hint-btn');
    const hints = task.hints || [];
    const showHints = () => {
      const n = s.hints[l.id] || 0;
      hintsEl.innerHTML = hints.slice(0, n).map((h, k) => `<div class="callout tip"><b>Подсказка ${k + 1}:</b> ${MD.inline(h)}</div>`).join('');
      hintBtn.textContent = n >= hints.length ? '💡 Подсказок больше нет' : `💡 Подсказка (${n}/${hints.length})`;
      hintBtn.disabled = n >= hints.length;
    };
    if (!hints.length) hintBtn.hidden = true;
    showHints();
    hintBtn.onclick = () => {
      s.hints[l.id] = Math.min(hints.length, (s.hints[l.id] || 0) + 1);
      Store.save();
      showHints();
      hintBtn.classList.remove('pulse');
    };

    // решение
    const solEl = root.querySelector('.solution');
    const showSolution = () => {
      solEl.hidden = false;
      solEl.innerHTML = `<div class="sol-head"><b>👀 Решение</b><button type="button" class="btn tiny primary sol-use">Вставить в редактор</button></div>` +
        `<pre class="code">${MD.codeHtml(task.solution)}</pre><p class="muted small">Не просто копируй — разберись в каждой строчке. Наведи на слова, чтобы увидеть перевод.</p>`;
      solEl.querySelector('.sol-use').onclick = () => { wb.editor.setValue(task.solution); s.code[l.id] = task.solution; Store.save(); };
    };
    if (s.sol[l.id]) showSolution();
    root.querySelector('.sol-btn').onclick = async () => {
      if (s.sol[l.id]) { solEl.hidden = !solEl.hidden; return; }
      const fails = s.fails[l.id] || 0;
      const msg = fails < 2
        ? 'Ты ещё почти не пробовал 🙂 Лучший способ научиться — попытаться самому, даже с ошибками. Точно показать решение? (опыта за урок будет меньше)'
        : 'Показать решение? Опыта за урок будет меньше. Совет: сначала попробуй подсказки.';
      if (!(await UI.confirmBox(msg, 'Показать', 'Попробую сам'))) return;
      s.sol[l.id] = true;
      Store.save();
      showSolution();
    };
    root.querySelector('.reset-btn').onclick = async () => {
      if (!(await UI.confirmBox('Вернуть начальный код задания? Твой код пропадёт.', 'Вернуть'))) return;
      wb.editor.setValue(task.starter);
      s.code[l.id] = task.starter;
      Store.save();
      root.querySelectorAll('.checklist li').forEach((li) => { li.classList.remove('pass', 'fail'); li.querySelector('.ck').textContent = '⬜'; });
    };
  }

  function onResult(root, l, res, chk) {
    if (!res.results) return; // просто запуск без проверки
    const s = Store.s;
    const items = root.querySelectorAll('.checklist li');
    let passed = 0;
    res.results.forEach((ok, k) => {
      const li = items[k];
      if (!li) return;
      li.classList.toggle('pass', !!ok);
      li.classList.toggle('fail', !ok);
      li.querySelector('.ck').textContent = ok ? '✅' : '❌';
      if (ok) passed++;
    });
    s.stats.checks++;
    const st = root.querySelector('.task-status');
    const total = res.results.length;
    if (passed === total && !res.hadError) {
      st.innerHTML = '<div class="status ok">🎉 Всё верно! Задание выполнено.</div>';
      complete(l);
    } else {
      s.fails[l.id] = (s.fails[l.id] || 0) + 1;
      Store.save();
      const f = s.fails[l.id];
      let msg = res.hadError
        ? 'В коде ошибка — посмотри объяснение в консоли внизу, исправь и запусти снова.'
        : `Выполнено ${passed} из ${total}. Посмотри, какие пункты отмечены ❌.`;
      if (f >= 3 && (s.hints[l.id] || 0) < (l.task.hints || []).length) {
        msg += ' Попробуй взять подсказку 💡';
        root.querySelector('.hint-btn').classList.add('pulse');
      }
      st.innerHTML = `<div class="status ${res.hadError ? 'bad' : 'part'}">${msg}</div>`;
      if (chk && chk.wait) UI.sounds.fail();
    }
  }

  function checkLevelUp(before) {
    const a = Progress.levelInfo(before), b = Progress.levelInfo(Store.s.xp);
    if (b.n > a.n) {
      setTimeout(() => {
        UI.sounds.level();
        UI.confetti(220);
        UI.modal(`<div class="levelup"><div class="lu-icon">${b.icon}</div><h2>Новый уровень!</h2><p>Теперь ты — <b>${b.title}</b></p><p class="muted">Уровень ${b.n} из ${Progress.LEVELS.length}</p>
          <button class="btn primary" data-close="ok">Ура! 🎉</button></div>`);
      }, 900);
    }
  }

  function complete(l) {
    const s = Store.s;
    const already = !!s.done[l.id];
    const next = Course.next(l.id);
    if (already) {
      UI.sounds.ok();
      UI.toast('✓ Снова верно! Урок уже пройден.', 'ok');
      return;
    }
    const base = Course.lessonXp(l);
    const hints = s.hints[l.id] || 0;
    const sol = !!s.sol[l.id];
    const xp = sol ? 3 : Math.max(3, base - hints * 2);
    const before = s.xp;
    s.done[l.id] = { xp, at: Date.now(), hints, sol };
    s.xp += xp;
    const h = new Date().getHours();
    if (h >= 23 && !s.ach.night) s.ach.night = true;
    if (h < 7 && h >= 4 && !s.ach.early) s.ach.early = true;
    Store.touchDay();
    Store.saveNow();
    UI.sounds.win();
    UI.confetti();
    const praise = ['Отлично!', 'Супер!', 'Великолепно!', 'Так держать!', 'Ты молодец!', 'Здорово!', 'Красота!'][Math.floor(Math.random() * 7)];
    const lastInModule = l._m.lessons[l._m.lessons.length - 1] === l;
    UI.modal(`<div class="win">
      <div class="win-icon">${lastInModule ? l._m.icon : '🎉'}</div>
      <h2>${praise}</h2>
      <p>${lastInModule ? `Модуль «${UI.esc(l._m.title)}» пройден полностью!` : `Урок «${UI.esc(l.title)}» пройден.`}</p>
      <div class="xp-gain">+${xp} XP</div>
      ${sol ? '<p class="muted small">Опыта меньше, потому что было открыто решение. Попробуй следующий урок сам!</p>' : hints ? `<p class="muted small">Подсказок использовано: ${hints}</p>` : '<p class="muted small">Без подсказок — ты настоящий программист! 💪</p>'}
      <div class="modal-btns">
        <button class="btn" data-close="stay">Остаться</button>
        ${next ? `<button class="btn primary" data-close="next">Следующий урок →</button>` : `<button class="btn primary" data-close="cert">🏆 К сертификату</button>`}
      </div></div>`, {
      onClose: (v) => {
        if (v === 'next' && next) location.hash = '#/lesson/' + next.id;
        else if (v === 'cert') location.hash = '#/profile';
        else {
          const nl = document.querySelector('.next-link');
          if (nl) nl.classList.add('primary');
        }
      }
    });
    checkLevelUp(before);
    Progress.checkAchievements();
    if (window.App) App.refreshHeader();
  }

  function leave() {
    if (wb) { wb.stop(); wb = null; }
    UI.stopSpeech();
    current = null;
  }

  window.ViewLesson = { render, leave };
})();
