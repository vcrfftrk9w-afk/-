/* Мини-разметка для текстов уроков.
   ```js         — пример с кнопкой «Запустить» (вывод в консоль)
   ```js canvas  — пример с холстом
   ```code       — просто код без запуска;  ```bad / ```good — «неправильно» / «правильно»
   > 💡 ...      — совет, > ⚠️ ... — внимание, > 🎮 ... — про игры, > ... — заметка
   ## заголовок, - список, 1. список, | таблица |, `код`, **жирный**, *курсив* */
(function () {
  const esc = (s) => window.Lexer.escapeHtml(s);

  // английские слова внутри кода получают всплывающий перевод
  function glossify(html) {
    return html.replace(/<span class="tk-(\w+)">([A-Za-z_$][\w$]*)<\/span>/g, (all, cls, word) => {
      if (window.glossLookup(word)) return `<span class="tk-${cls} gw" data-w="${word}">${word}</span>`;
      return all;
    });
  }
  function codeHtml(src) { return glossify(window.Lexer.highlight(src)); }

  function inline(s) {
    // ``код с ` внутри`` или `код`
    const parts = s.split(/(``.+?``|`[^`]+`)/g);
    return parts.map((p) => {
      if (p.length > 4 && p.startsWith('``') && p.endsWith('``')) {
        return '<code class="ic">' + codeHtml(p.slice(2, -2).trim()) + '</code>';
      }
      if (p.length > 1 && p[0] === '`' && p[p.length - 1] === '`') {
        return '<code class="ic">' + codeHtml(p.slice(1, -1)) + '</code>';
      }
      return esc(p)
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
        .replace(/(^|[\s(«])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
        .replace(/\[([^\]]+)\]\((#[^)]+)\)/g, '<a href="$2">$1</a>');
    }).join('');
  }

  let exampleSeq = 0;
  window.EXAMPLES = window.EXAMPLES || {};

  function render(src) {
    const lines = src.replace(/\r/g, '').split('\n');
    // убрать общий отступ (тексты пишутся с отступом в файлах курса)
    const indents = lines.filter((l) => l.trim()).map((l) => /^ */.exec(l)[0].length);
    const cut = indents.length ? Math.min(...indents) : 0;
    const L = lines.map((l) => l.slice(cut));
    let html = '';
    let i = 0;
    while (i < L.length) {
      const line = L[i];
      if (!line.trim()) { i++; continue; }
      const fence = /^```(\w*)\s*(.*)$/.exec(line);
      if (fence) {
        const lang = fence[1] || 'code';
        const flags = fence[2] || '';
        const buf = [];
        i++;
        while (i < L.length && !/^```\s*$/.test(L[i])) { buf.push(L[i]); i++; }
        i++;
        const code = buf.join('\n');
        if (lang === 'js') {
          const id = 'ex' + (++exampleSeq);
          window.EXAMPLES[id] = { code, canvas: /canvas/.test(flags), expectError: /error/.test(flags), w: +(/w=(\d+)/.exec(flags) || [])[1] || 480, h: +(/h=(\d+)/.exec(flags) || [])[1] || 320 };
          html += `<div class="example${/error/.test(flags) ? ' ex-error' : ''}" data-ex="${id}"><div class="ex-head"><span>${/error/.test(flags) ? 'Пример с ошибкой 🐞' : 'Пример'}</span>` +
            `<span class="ex-btns"><button class="btn tiny ex-copy" type="button" title="Скопировать в редактор">📋 В редактор</button>` +
            `<button class="btn tiny primary ex-run" type="button">▶ Запустить</button></span></div>` +
            `<pre class="code">${codeHtml(code)}</pre><div class="ex-out" hidden><div class="ex-frame"></div><div class="console mini"></div></div></div>`;
        } else if (lang === 'bad' || lang === 'good') {
          html += `<div class="codebox ${lang}"><div class="cb-label">${lang === 'bad' ? '❌ Так нельзя' : '✅ Так правильно'}</div><pre class="code">${codeHtml(code)}</pre></div>`;
        } else if (lang === 'text') {
          html += `<pre class="code plain">${esc(code)}</pre>`;
        } else {
          html += `<pre class="code">${codeHtml(code)}</pre>`;
        }
        continue;
      }
      const h = /^(#{2,3})\s+(.*)$/.exec(line);
      if (h) { html += `<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`; i++; continue; }
      if (/^>\s?/.test(line)) {
        const buf = [];
        while (i < L.length && /^>\s?/.test(L[i])) { buf.push(L[i].replace(/^>\s?/, '')); i++; }
        let text = buf.join(' ');
        let kind = 'note';
        if (/^💡/.test(text)) kind = 'tip';
        else if (/^⚠️|^❗/.test(text)) kind = 'warn';
        else if (/^🎮/.test(text)) kind = 'game';
        else if (/^🧠/.test(text)) kind = 'brain';
        html += `<div class="callout ${kind}">${inline(text)}</div>`;
        continue;
      }
      if (/^\|/.test(line)) {
        const rows = [];
        while (i < L.length && /^\|/.test(L[i])) { rows.push(L[i]); i++; }
        // \| внутри ячейки — это сам символ |, а не граница
        const cells = (r) => r.replace(/\\\|/g, '\u0001').replace(/^\||\|\s*$/g, '').split('|').map((c) => c.trim().replace(/\u0001/g, '|'));
        const body = rows.filter((r) => !/^\|[\s\-:|]+\|?\s*$/.test(r));
        html += '<div class="table-wrap"><table>' + body.map((r, k) => '<tr>' + cells(r).map((c) => (k === 0 ? `<th>${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join('') + '</tr>').join('') + '</table></div>';
        continue;
      }
      if (/^(-|\d+\.)\s/.test(line)) {
        const ordered = /^\d+\./.test(line);
        const buf = [];
        while (i < L.length && /^(-|\d+\.)\s/.test(L[i])) {
          let item = L[i].replace(/^(-|\d+\.)\s/, '');
          i++;
          while (i < L.length && /^\s{2,}\S/.test(L[i]) && !/^\s*(-|\d+\.)\s/.test(L[i])) { item += ' ' + L[i].trim(); i++; }
          buf.push(item);
        }
        const tag = ordered ? 'ol' : 'ul';
        html += `<${tag}>` + buf.map((b) => `<li>${inline(b)}</li>`).join('') + `</${tag}>`;
        continue;
      }
      const buf = [];
      while (i < L.length && L[i].trim() && !/^(```|#{2,3}\s|>|\||-\s|\d+\.\s)/.test(L[i])) { buf.push(L[i]); i++; }
      if (!buf.length) { buf.push(L[i]); i++; }
      html += `<p>${inline(buf.join(' '))}</p>`;
    }
    return html;
  }

  window.MD = { render, codeHtml, inline, glossify };
})();
