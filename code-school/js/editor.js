/* Редактор кода: прозрачное поле ввода поверх подсвеченного текста.
   Номера строк, автоотступ, автозакрытие скобок, Tab, Ctrl+Enter — запуск, Ctrl+/ — комментарий. */
(function () {
  const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
  const CLOSERS = new Set([')', ']', '}']);

  function create(host, opts) {
    opts = opts || {};
    host.classList.add('ed');
    host.innerHTML =
      '<div class="ed-scroll"><div class="ed-inner">' +
      '<div class="ed-gutter" aria-hidden="true"></div>' +
      '<div class="ed-code"><div class="ed-mark" hidden></div><div class="ed-curline"></div>' +
      '<pre class="ed-hl" aria-hidden="true"></pre>' +
      '<textarea class="ed-ta" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="Редактор кода"></textarea>' +
      '</div></div></div>';
    const scroll = host.querySelector('.ed-scroll');
    const gutter = host.querySelector('.ed-gutter');
    const pre = host.querySelector('.ed-hl');
    const ta = host.querySelector('.ed-ta');
    const mark = host.querySelector('.ed-mark');
    const curline = host.querySelector('.ed-curline');
    let lastLines = 0;

    function lineHeight() { return parseFloat(getComputedStyle(pre).lineHeight) || 21; }
    function padTop() { return parseFloat(getComputedStyle(pre).paddingTop) || 0; }

    function render() {
      const v = ta.value;
      pre.innerHTML = window.Lexer.highlight(v) + '\n';
      const lines = v.split('\n').length;
      if (lines !== lastLines) {
        let s = '';
        for (let k = 1; k <= lines; k++) s += k + '\n';
        gutter.textContent = s;
        lastLines = lines;
      }
      updateCursorLine();
    }

    function caretLineCol() {
      const before = ta.value.slice(0, ta.selectionStart);
      const lines = before.split('\n');
      return { line: lines.length, col: lines[lines.length - 1].length };
    }

    function updateCursorLine() {
      const { line } = caretLineCol();
      curline.style.top = (padTop() + (line - 1) * lineHeight()) + 'px';
      curline.style.height = lineHeight() + 'px';
    }

    function ensureCaretVisible() {
      const { line, col } = caretLineCol();
      const lh = lineHeight();
      const top = padTop() + (line - 1) * lh;
      if (top < scroll.scrollTop) scroll.scrollTop = top;
      else if (top + lh > scroll.scrollTop + scroll.clientHeight) scroll.scrollTop = top + lh - scroll.clientHeight;
      const charW = measureChar();
      const left = col * charW + 60;
      if (left > scroll.scrollLeft + scroll.clientWidth - 20) scroll.scrollLeft = left - scroll.clientWidth + 40;
      else if (left - 60 < scroll.scrollLeft) scroll.scrollLeft = Math.max(0, left - 90);
    }
    let charWCache = 0;
    function measureChar() {
      if (charWCache) return charWCache;
      const s = document.createElement('span');
      s.textContent = 'MMMMMMMMMM';
      s.style.visibility = 'hidden';
      pre.appendChild(s);
      charWCache = s.getBoundingClientRect().width / 10 || 8.4;
      s.remove();
      return charWCache;
    }

    // вставка с сохранением истории «отменить» (Ctrl+Z)
    function insert(text, selStart, selEnd) {
      ta.focus();
      if (selStart !== undefined) ta.setSelectionRange(selStart, selEnd === undefined ? selStart : selEnd);
      let ok = false;
      try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
      if (!ok) {
        ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
        ta.dispatchEvent(new Event('input'));
      }
    }

    function currentWord() {
      const v = ta.value, p = ta.selectionStart;
      let a = p, b = p;
      while (a > 0 && /[\w$]/.test(v[a - 1])) a--;
      while (b < v.length && /[\w$]/.test(v[b])) b++;
      return v.slice(a, b);
    }

    function lineStartOf(pos) { return ta.value.lastIndexOf('\n', pos - 1) + 1; }

    function indentLines(outdent) {
      const v = ta.value;
      const s = ta.selectionStart, e = ta.selectionEnd;
      const a = lineStartOf(s);
      let b = v.indexOf('\n', e - (e > s && v[e - 1] === '\n' ? 1 : 0));
      if (b === -1) b = v.length;
      const block = v.slice(a, b);
      const lines = block.split('\n');
      const changed = lines.map((l) => (outdent ? l.replace(/^ {1,2}/, '') : '  ' + l)).join('\n');
      insert(changed, a, b);
      const diffFirst = outdent ? -(lines[0].length - lines[0].replace(/^ {1,2}/, '').length) : 2;
      ta.setSelectionRange(Math.max(a, s + diffFirst), a + changed.length);
    }

    function toggleComment() {
      const v = ta.value;
      const s = ta.selectionStart, e = ta.selectionEnd;
      const a = lineStartOf(s);
      let b = v.indexOf('\n', e - (e > s && v[e - 1] === '\n' ? 1 : 0));
      if (b === -1) b = v.length;
      const lines = v.slice(a, b).split('\n');
      const all = lines.filter((l) => l.trim()).every((l) => /^\s*\/\//.test(l));
      const res = lines.map((l) => {
        if (!l.trim()) return l;
        return all ? l.replace(/^(\s*)\/\/ ?/, '$1') : l.replace(/^(\s*)/, '$1// ');
      }).join('\n');
      insert(res, a, b);
      ta.setSelectionRange(a, a + res.length);
    }

    ta.addEventListener('keydown', (ev) => {
      const v = ta.value;
      const s = ta.selectionStart, e = ta.selectionEnd;
      const prev = v[s - 1], next = v[e];
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') { ev.preventDefault(); opts.onRun && opts.onRun(); return; }
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === '/' || ev.code === 'Slash')) { ev.preventDefault(); toggleComment(); return; }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); opts.onSave && opts.onSave(); return; }
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === 'Tab') {
        ev.preventDefault();
        if (s !== e && v.slice(s, e).includes('\n')) indentLines(ev.shiftKey);
        else if (ev.shiftKey) indentLines(true);
        else insert('  ');
        return;
      }
      if (ev.key === 'Enter') {
        ev.preventDefault();
        const ls = lineStartOf(s);
        const indent = /^[ \t]*/.exec(v.slice(ls, s))[0];
        const opener = prev && '{(['.includes(prev);
        if (opener && next === PAIRS[prev] && s === e) {
          insert('\n' + indent + '  ' + '\n' + indent);
          const pos = s + 1 + indent.length + 2;
          ta.setSelectionRange(pos, pos);
        } else if (opener) insert('\n' + indent + '  ');
        else insert('\n' + indent);
        ensureCaretVisible();
        return;
      }
      if (ev.key === 'Backspace' && s === e && s > 0) {
        if (PAIRS[prev] && next === PAIRS[prev]) { ev.preventDefault(); insert('', s - 1, s + 1); return; }
        // удалить отступ целиком
        const ls = lineStartOf(s);
        const before = v.slice(ls, s);
        if (before.length >= 2 && /^ +$/.test(before)) { ev.preventDefault(); insert('', s - (before.length % 2 === 0 ? 2 : 1), s); return; }
      }
      if (ev.key.length !== 1) return;
      const ch = ev.key;
      if (CLOSERS.has(ch) && next === ch && s === e) { ev.preventDefault(); ta.setSelectionRange(s + 1, s + 1); return; }
      if (ch === '}' && s === e) {
        // «}» на пустой строке — убрать лишний отступ
        const ls = lineStartOf(s);
        const before = v.slice(ls, s);
        if (/^ {2,}$/.test(before)) { ev.preventDefault(); insert(before.slice(2) + '}', ls, s); return; }
      }
      if ((ch === '"' || ch === "'" || ch === '`') && next === ch && s === e) { ev.preventDefault(); ta.setSelectionRange(s + 1, s + 1); return; }
      if (PAIRS[ch]) {
        const isQuote = ch === '"' || ch === "'" || ch === '`';
        if (s !== e) { ev.preventDefault(); const sel = v.slice(s, e); insert(ch + sel + PAIRS[ch]); ta.setSelectionRange(s + 1, s + 1 + sel.length); return; }
        const nextOk = next === undefined || /[\s)\]};,]/.test(next);
        const prevOk = !isQuote || prev === undefined || !/[\w$]/.test(prev);
        if (nextOk && prevOk) { ev.preventDefault(); insert(ch + PAIRS[ch]); ta.setSelectionRange(s + 1, s + 1); }
      }
    });

    ta.addEventListener('input', () => {
      render();
      clearMark();
      opts.onChange && opts.onChange(ta.value);
    });
    const cursorMoved = () => {
      updateCursorLine();
      opts.onCursorWord && opts.onCursorWord(currentWord());
    };
    ta.addEventListener('keyup', cursorMoved);
    ta.addEventListener('click', cursorMoved);
    ta.addEventListener('focus', () => host.classList.add('focus'));
    ta.addEventListener('blur', () => host.classList.remove('focus'));
    document.addEventListener('selectionchange', () => { if (document.activeElement === ta) cursorMoved(); });

    function markError(line) {
      if (!line || line < 1 || line > lastLines) { clearMark(); return; }
      mark.hidden = false;
      mark.style.top = (padTop() + (line - 1) * lineHeight()) + 'px';
      mark.style.height = lineHeight() + 'px';
      const top = padTop() + (line - 1) * lineHeight();
      if (top < scroll.scrollTop || top > scroll.scrollTop + scroll.clientHeight - 30) scroll.scrollTop = Math.max(0, top - 60);
    }
    function clearMark() { mark.hidden = true; }

    function setValue(v) {
      ta.value = v;
      render();
      clearMark();
    }
    setValue(opts.value || '');

    return {
      get value() { return ta.value; },
      set value(v) { setValue(v); },
      setValue,
      focus() { ta.focus(); },
      insert(text, back) {
        const s = ta.selectionStart;
        insert(text);
        if (back) ta.setSelectionRange(s + text.length - back, s + text.length - back);
        cursorMoved();
      },
      markError,
      clearMark,
      refresh() { charWCache = 0; render(); },
      textarea: ta
    };
  }

  window.CodeEditor = { create };
})();
