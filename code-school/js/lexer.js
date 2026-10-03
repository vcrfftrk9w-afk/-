/* Разбор кода на кусочки (токены).
   Нужен трём частям приложения: подсветке в редакторе, защите от бесконечных циклов
   и подсказкам об ошибках вроде русской буквы в слове «сonsole». */
(function () {
  const KEYWORDS = new Set(('let const var function return if else for while do break continue ' +
    'switch case default new class extends constructor this super typeof instanceof in of ' +
    'try catch finally throw async await yield delete void import export static get set').split(' '));
  const LITERALS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']);
  const BUILTINS = new Set(['console', 'Math', 'document', 'window', 'canvas', 'ctx', 'Array', 'Object',
    'JSON', 'String', 'Number', 'Boolean', 'Date', 'Image', 'Audio', 'Set', 'Map', 'Promise',
    'localStorage', 'parseInt', 'parseFloat', 'setTimeout', 'setInterval', 'clearInterval',
    'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'alert', 'prompt', 'confirm']);

  // Буквы, из которых может состоять слово-имя: латиница, кириллица, цифры, _ и $
  const WORD_START = /[A-Za-z_$Ѐ-ӿ]/;
  const WORD_CHAR = /[A-Za-z0-9_$Ѐ-ӿ]/;

  function regexAllowed(prev) {
    if (!prev) return true;
    if (prev.t === 'word') return KEYWORDS.has(prev.v) && !['this', 'super'].includes(prev.v);
    if (prev.t === 'punct') return !(prev.v === ')' || prev.v === ']' || prev.v === '}');
    return prev.t !== 'number' && prev.t !== 'string' && prev.t !== 'regex';
  }

  function tokenize(src) {
    const out = [];
    let i = 0;
    let prev = null; // последний значимый токен (не пробел и не комментарий)
    const n = src.length;
    const push = (t, v) => {
      const tok = { t, v, s: i - v.length };
      out.push(tok);
      if (t !== 'ws' && t !== 'comment') prev = tok;
    };
    while (i < n) {
      const c = src[i];
      const start = i;
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ' ') {
        while (i < n && /[ \t\n\r ]/.test(src[i])) i++;
        push('ws', src.slice(start, i));
      } else if (c === '/' && src[i + 1] === '/') {
        while (i < n && src[i] !== '\n') i++;
        push('comment', src.slice(start, i));
      } else if (c === '/' && src[i + 1] === '*') {
        const end = src.indexOf('*/', i + 2);
        i = end === -1 ? n : end + 2;
        push('comment', src.slice(start, i));
      } else if (c === '"' || c === "'") {
        i++;
        while (i < n && src[i] !== c && src[i] !== '\n') { if (src[i] === '\\') i++; i++; }
        if (src[i] === c) i++;
        push('string', src.slice(start, i));
      } else if (c === '`') {
        i++;
        let depth = 0;
        while (i < n) {
          if (src[i] === '\\') { i += 2; continue; }
          if (depth === 0 && src[i] === '`') { i++; break; }
          if (src[i] === '$' && src[i + 1] === '{') { depth++; i += 2; continue; }
          if (depth > 0 && src[i] === '}') depth--;
          i++;
        }
        push('string', src.slice(start, i));
      } else if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        while (i < n && /[0-9a-fA-FxXoObBn._eE]/.test(src[i])) {
          if ((src[i] === 'e' || src[i] === 'E') && (src[i + 1] === '-' || src[i + 1] === '+')) i++;
          i++;
        }
        push('number', src.slice(start, i));
      } else if (WORD_START.test(c)) {
        while (i < n && WORD_CHAR.test(src[i])) i++;
        push('word', src.slice(start, i));
      } else if (c === '/' && regexAllowed(prev)) {
        i++;
        let inClass = false;
        while (i < n && src[i] !== '\n') {
          if (src[i] === '\\') { i += 2; continue; }
          if (src[i] === '[') inClass = true;
          else if (src[i] === ']') inClass = false;
          else if (src[i] === '/' && !inClass) { i++; break; }
          i++;
        }
        while (i < n && /[a-z]/.test(src[i])) i++;
        push('regex', src.slice(start, i));
      } else if ('(){}[];,.:?'.includes(c)) {
        i++;
        if (c === '.' && src[i] === '.' && src[i + 1] === '.') i += 2;
        else if (c === '?' && (src[i] === '.' || src[i] === '?')) i++;
        push('punct', src.slice(start, i));
      } else if ('+-*/%=<>!&|^~'.includes(c)) {
        while (i < n && '+-*/%=<>!&|^~'.includes(src[i]) && i - start < 4) {
          // не склеиваем «=/» и подобное с началом комментария
          if (src[i] === '/' && (src[i + 1] === '/' || src[i + 1] === '*') && i > start) break;
          i++;
        }
        push('op', src.slice(start, i));
      } else {
        i++;
        push('other', c);
      }
    }
    return out;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Цвет для каждого токена: возвращает HTML с <span class="tk-...">
  function highlight(src) {
    const toks = tokenize(src);
    let html = '';
    for (let k = 0; k < toks.length; k++) {
      const tok = toks[k];
      let cls = '';
      if (tok.t === 'comment') cls = 'com';
      else if (tok.t === 'string') cls = 'str';
      else if (tok.t === 'regex') cls = 'str';
      else if (tok.t === 'number') cls = 'num';
      else if (tok.t === 'op') cls = 'op';
      else if (tok.t === 'punct') cls = 'pun';
      else if (tok.t === 'other') cls = 'bad';
      else if (tok.t === 'word') {
        let p = k - 1;
        while (p >= 0 && toks[p].t === 'ws') p--;
        let nx = k + 1;
        while (nx < toks.length && toks[nx].t === 'ws') nx++;
        const afterDot = p >= 0 && (toks[p].v === '.' || toks[p].v === '?.');
        if (/[Ѐ-ӿ]/.test(tok.v) && /[A-Za-z]/.test(tok.v)) cls = 'bad';
        else if (!afterDot && KEYWORDS.has(tok.v)) cls = 'kw';
        else if (!afterDot && LITERALS.has(tok.v)) cls = 'lit';
        else if (nx < toks.length && toks[nx].v === '(') cls = 'fn';
        else if (afterDot) cls = 'prop';
        else if (BUILTINS.has(tok.v)) cls = 'bi';
        else cls = 'id';
      }
      if (tok.t === 'string' && tok.v[0] === '`' && tok.v.includes('${')) {
        html += '<span class="tk-str">' + escapeHtml(tok.v).replace(/\$\{([^}]*)\}/g,
          '<span class="tk-tpl">${</span><span class="tk-id">$1</span><span class="tk-tpl">}</span>') + '</span>';
      } else {
        html += cls ? '<span class="tk-' + cls + '">' + escapeHtml(tok.v) + '</span>' : escapeHtml(tok.v);
      }
    }
    return html;
  }

  /* Защита от бесконечных циклов: в условие каждого while и for вставляем __lp(),
     которая считает повторы и останавливает программу, если их миллионы.
     Работает и для циклов без фигурных скобок. */
  function guardLoops(src) {
    const toks = tokenize(src);
    const inserts = []; // [позиция, текст]
    const sig = (k) => { while (k < toks.length && (toks[k].t === 'ws' || toks[k].t === 'comment')) k++; return k; };
    for (let k = 0; k < toks.length; k++) {
      const tok = toks[k];
      if (tok.t !== 'word' || (tok.v !== 'for' && tok.v !== 'while')) continue;
      let p = k - 1;
      while (p >= 0 && toks[p].t === 'ws') p--;
      if (p >= 0 && (toks[p].v === '.' || toks[p].v === '?.')) continue; // obj.for — не цикл
      let o = sig(k + 1);
      if (tok.v === 'for' && toks[o] && toks[o].v === 'await') o = sig(o + 1);
      if (!toks[o] || toks[o].v !== '(') continue;
      // ищем закрывающую скобку и точки с запятой на верхнем уровне
      let depth = 0;
      const semis = [];
      let close = -1;
      for (let q = o; q < toks.length; q++) {
        const v = toks[q].v;
        if (toks[q].t === 'punct') {
          if (v === '(' || v === '[' || v === '{') depth++;
          else if (v === ')' || v === ']' || v === '}') { depth--; if (depth === 0) { close = q; break; } }
          else if (v === ';' && depth === 1) semis.push(q);
        }
      }
      if (close === -1) continue;
      if (tok.v === 'while') {
        inserts.push([toks[o].s + 1, '__lp() && (']);
        inserts.push([toks[close].s, ')']);
      } else if (semis.length === 2) {
        const a = semis[0], b = semis[1];
        const empty = sig(a + 1) === b;
        if (empty) inserts.push([toks[a].s + 1, ' __lp() ']);
        else { inserts.push([toks[a].s + 1, ' __lp() && (']); inserts.push([toks[b].s, ')']); }
      } else {
        // for...of / for...in: ставим проверку в начало тела, если оно в скобках
        const b = sig(close + 1);
        if (toks[b] && toks[b].v === '{') inserts.push([toks[b].s + 1, ' __lp();']);
      }
    }
    inserts.sort((x, y) => y[0] - x[0]);
    let res = src;
    for (const [pos, text] of inserts) res = res.slice(0, pos) + text + res.slice(pos);
    return res;
  }

  /* Частые ошибки русскоязычного новичка, которые видно ещё до запуска. */
  function lint(src) {
    const toks = tokenize(src);
    const problems = [];
    const lineOf = (pos) => src.slice(0, pos).split('\n').length;
    for (const tok of toks) {
      if (tok.t === 'word' && /[Ѐ-ӿ]/.test(tok.v) && /[A-Za-z]/.test(tok.v)) {
        const ru = tok.v.replace(/[A-Za-z0-9_$]/g, '');
        problems.push({
          line: lineOf(tok.s), level: 'error',
          text: `В слове «${tok.v}» смешаны английские и русские буквы (русские: «${ru}»). ` +
            'Снаружи они выглядят одинаково, но для компьютера это разные буквы. ' +
            'Сотри слово и набери его заново на английской раскладке.'
        });
      } else if (tok.t === 'other' && '«»“”„'.includes(tok.v)) {
        problems.push({
          line: lineOf(tok.s), level: 'error',
          text: `Кавычка «${tok.v}» не подходит для кода. Используй прямые кавычки: " (Shift + Э на русской ` +
            'раскладке, Shift + \' на английской) или \'.'
        });
      } else if (tok.t === 'other' && '‘’'.includes(tok.v)) {
        problems.push({ line: lineOf(tok.s), level: 'error', text: `Кавычка «${tok.v}» — «кривая». Нужна прямая: ' или ".` });
      } else if (tok.t === 'other' && tok.v === '№') {
        problems.push({ line: lineOf(tok.s), level: 'error', text: 'Символ № есть только на русской раскладке. Наверное, ты хотел набрать # (Shift + 3 на английской).' });
      } else if (tok.t === 'string' && tok.v.length > 1 && tok.v[0] !== '`' && tok.v[tok.v.length - 1] !== tok.v[0]) {
        problems.push({ line: lineOf(tok.s), level: 'error', text: `Текст в кавычках не закрыт: ${tok.v.slice(0, 30)}… Поставь в конце такую же кавычку ${tok.v[0]}.` });
      }
    }
    return problems.slice(0, 5);
  }

  function stripCommentsAndStrings(src) {
    return tokenize(src).map((t) => (t.t === 'comment' ? ' ' : t.t === 'string' ? '""' : t.v)).join('');
  }

  function stripComments(src) {
    return tokenize(src).map((t) => (t.t === 'comment' ? ' ' : t.v)).join('');
  }

  window.Lexer = { tokenize, highlight, guardLoops, lint, escapeHtml, stripComments, stripCommentsAndStrings, KEYWORDS, BUILTINS };
})();
