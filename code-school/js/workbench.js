/* Рабочее место: редактор + кнопки + перевод слова под курсором + символы + результат (холст и консоль).
   Используется и в уроках, и в песочнице. */
(function () {
  const SYMBOLS = [
    ['(', '()', 1], ['{', '{}', 1], ['[', '[]', 1], [')', ')'], ['}', '}'], [']', ']'],
    ['"', '""', 1], ["'", "''", 1], ['`', '``', 1], [';', ';'], ['=', ' = '], ['+', '+'], ['-', '-'], ['*', '*'],
    ['/', '/'], ['<', '<'], ['>', '>'], ['.', '.'], [',', ', '], [':', ': '], ['!', '!'], ['&&', ' && '], ['||', ' || '],
    ['$', '$'], ['_', '_'], ['?', '?'], ['%', '%'], ['⇥', '  ']
  ];

  function create(host, opts) {
    opts = opts || {};
    const s = Store.s;
    host.classList.add('wb');
    host.innerHTML = `
      <div class="wb-bar">
        <button class="btn primary wb-run" type="button" title="Ctrl + Enter">▶ Запустить</button>
        ${opts.checkButton ? '<button class="btn good wb-check" type="button" hidden>🤖 Проверить игру</button>' : ''}
        <span class="wb-spacer"></span>
        <span class="wb-extra"></span>
        <button class="btn ghost icon wb-font-minus" type="button" title="Шрифт меньше" aria-label="Шрифт меньше">A−</button>
        <button class="btn ghost icon wb-font-plus" type="button" title="Шрифт больше" aria-label="Шрифт больше">A+</button>
      </div>
      <div class="wb-editor"></div>
      <div class="wb-word" aria-live="polite"><span class="ww-hint">💬 Поставь курсор на английское слово — здесь появится перевод</span></div>
      <div class="wb-symbols" ${s.settings.symbols ? '' : 'hidden'}>${SYMBOLS.map((x, k) => `<button type="button" class="sym" data-k="${k}">${UI.esc(x[0])}</button>`).join('')}</div>
      <div class="wb-out">
        <div class="wb-stage" hidden><div class="wb-frame"></div><div class="wb-stage-note">🖱️ Кликни по игре, чтобы управлять клавишами</div></div>
        <div class="wb-console-head"><span>📟 Консоль <small>(сюда пишет console.log)</small></span><button class="btn ghost tiny wb-clear" type="button">Очистить</button></div>
        <div class="console wb-console"><div class="cl muted">Нажми «▶ Запустить», чтобы выполнить код.</div></div>
      </div>`;
    const $ = (q) => host.querySelector(q);
    const consoleEl = $('.wb-console');
    const stage = $('.wb-stage');
    const frameHost = $('.wb-frame');
    const wordBar = $('.wb-word');
    let hadError = false;
    let lastHadError = false;
    let printed = 0;
    let canvasMode = !!opts.canvas;
    stage.hidden = !canvasMode;

    const editor = CodeEditor.create($('.wb-editor'), {
      value: opts.value || '',
      onChange: (v) => opts.onChange && opts.onChange(v),
      onRun: () => run(),
      onSave: () => opts.onSave && opts.onSave(),
      onCursorWord: (w) => showWord(w)
    });
    applyFont();

    function applyFont() {
      host.style.setProperty('--code-size', Store.s.settings.font + 'px');
      editor.refresh();
    }
    $('.wb-font-minus').onclick = () => { Store.s.settings.font = Math.max(11, Store.s.settings.font - 1); Store.save(); applyFont(); };
    $('.wb-font-plus').onclick = () => { Store.s.settings.font = Math.min(24, Store.s.settings.font + 1); Store.save(); applyFont(); };

    let lastWord = '';
    function showWord(w) {
      if (w === lastWord) return;
      lastWord = w;
      const g = w && window.glossLookup(w);
      if (g) {
        wordBar.innerHTML = `<b class="ww-word">${UI.esc(g.word)}</b> <span class="ww-say">[${UI.esc(g.say)}]</span> — <span class="ww-ru">${UI.esc(g.ru)}</span>` +
          (g.what ? `<span class="ww-what"> · ${UI.esc(g.what)}</span>` : '') +
          `<button type="button" class="ww-speak" title="Послушать" aria-label="Послушать">🔊</button>`;
        wordBar.querySelector('.ww-speak').onclick = () => UI.sayEnglish(g.word);
      } else if (w && /^[Ѐ-ӿ]/.test(w)) {
        wordBar.innerHTML = '<span class="ww-hint">Русское слово. В коде оно может быть только внутри кавычек "..." или в комментарии //</span>';
      } else if (w && /^\d+$/.test(w)) {
        wordBar.innerHTML = '<span class="ww-hint">Это число.</span>';
      } else if (w) {
        wordBar.innerHTML = `<span class="ww-hint">«${UI.esc(w)}» — имя, которое придумал программист (его нет в словаре).</span>`;
      }
    }

    host.querySelectorAll('.sym').forEach((b) => {
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => {
        const x = SYMBOLS[+b.dataset.k];
        editor.insert(x[1], x[2] || 0);
      });
    });

    $('.wb-run').onclick = () => run();
    $('.wb-clear').onclick = () => { consoleEl.innerHTML = ''; };

    function line(html, cls) {
      const d = document.createElement('div');
      d.className = 'cl ' + (cls || '');
      d.innerHTML = html;
      consoleEl.appendChild(d);
      if (consoleEl.children.length > 600) consoleEl.firstChild.remove();
      consoleEl.scrollTop = consoleEl.scrollHeight;
      return d;
    }

    function showError(info) {
      const d = line(`<div class="err-title">🐞 ${UI.esc(info.title)}${info.line ? ` <button type="button" class="err-line">строка ${info.line}</button>` : ''}</div>` +
        `<div class="err-text">${info.text}</div>` +
        (info.original && info.original !== '__INFINITE__' ? `<details class="err-orig"><summary>Как это написал компьютер (по-английски)</summary><code>${UI.esc(info.original)}</code></details>` : ''), 'err');
      const b = d.querySelector('.err-line');
      if (b) b.onclick = () => { editor.markError(info.line); editor.focus(); };
      if (info.line) editor.markError(info.line);
    }

    function setCanvas(on) { canvasMode = !!on; stage.hidden = !canvasMode; }

    /* run({ check, tests, wait, prep }) → Promise<{ results, hadError, printed }> */
    function run(chk) {
      chk = chk || (opts.autoCheck ? opts.autoCheck() : null);
      UI.hideTip();
      const code = editor.value;
      consoleEl.innerHTML = '';
      editor.clearMark();
      hadError = false;
      printed = 0;
      const problems = Lexer.lint(code);
      problems.forEach((p) => {
        line(`<div class="err-title">⚠️ Строка ${p.line}</div><div class="err-text">${UI.esc(p.text)}</div>`, 'warn-box');
        editor.markError(p.line);
      });
      Store.s.stats.runs++;
      Store.touchDay();
      Store.save();
      opts.onStart && opts.onStart(chk);
      return new Promise((resolve) => {
        Runner.run({
          host: frameHost,
          code,
          canvas: canvasMode,
          width: opts.width, height: opts.height,
          check: !!(chk && chk.tests),
          tests: chk && chk.tests,
          wait: chk && chk.wait,
          prep: chk && chk.prep,
          storage: Store.s.sbStorage || {},
          onStore: (d) => { Store.s.sbStorage = d; Store.save(); },
          onLog: (m) => { printed++; line(UI.esc(m.text) || '&nbsp;', m.kind); },
          onClear: () => { consoleEl.innerHTML = ''; },
          onError: (err) => {
            hadError = true;
            Store.s.stats.errors++;
            showError(ErrorsRu.explain(err, code));
          },
          onDone: (results) => {
            if (!hadError && lastHadError) Store.s.stats.fixed++;
            lastHadError = hadError;
            if (!hadError && !printed && !canvasMode) line('Программа выполнилась, но ничего не напечатала. Чтобы увидеть результат, используй <code>console.log(...)</code>.', 'muted');
            else if (!hadError && !printed && canvasMode && opts.showDone !== false) line('✓ Программа запущена. Результат — на холсте выше.', 'muted');
            Store.save();
            Progress.checkAchievements();
            const res = { results, hadError, printed };
            opts.onDone && opts.onDone(res, chk);
            resolve(res);
          }
        });
        if (canvasMode) setTimeout(() => { if (frameHost._runner) frameHost._runner.focus(); }, 100);
      });
    }

    return {
      editor,
      run,
      setCanvas,
      line,
      extra: $('.wb-extra'),
      checkBtn: $('.wb-check'),
      runBtn: $('.wb-run'),
      stop() { if (frameHost._runner) frameHost._runner.stop(); },
      toggleSymbols(on) { $('.wb-symbols').hidden = !on; }
    };
  }

  window.Workbench = { create };
})();
