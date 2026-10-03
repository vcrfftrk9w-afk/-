/* Перевод ошибок JavaScript на понятный русский язык с советом, как исправить. */
(function () {
  function distance(a, b) {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > 3) return 99;
    const d = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0.3 : 1);
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      }
    }
    return d[m][n];
  }

  // Похожее известное слово: «consol» → «console», «Console» → «console»
  function suggest(word, code) {
    const known = new Set(Object.keys(window.GLOSSARY || {}));
    for (const t of window.Lexer.tokenize(code || '')) if (t.t === 'word' && t.v !== word) known.add(t.v);
    let best = null, bestD = 99;
    for (const k of known) {
      const dd = distance(word, k);
      if (dd < bestD) { bestD = dd; best = k; }
    }
    const limit = word.length <= 3 ? 1 : 2;
    return bestD <= limit ? best : null;
  }

  function countBrackets(code) {
    const src = window.Lexer.stripCommentsAndStrings(code);
    const c = (ch) => src.split(ch).length - 1;
    const res = [];
    const pairs = [['(', ')', 'круглых'], ['{', '}', 'фигурных'], ['[', ']', 'квадратных']];
    for (const [o, cl, name] of pairs) {
      const a = c(o), b = c(cl);
      if (a > b) res.push(`не хватает ${a - b} закрывающих ${name} скобок «${cl}»`);
      if (b > a) res.push(`лишних закрывающих ${name} скобок «${cl}»: ${b - a}`);
    }
    return res;
  }

  const code_ = (s) => '<code>' + window.Lexer.escapeHtml(s) + '</code>';

  /* explain({msg, name, line}, code) → { title, text (HTML), line } */
  function explain(err, code) {
    const msg = String(err.msg || '');
    let m;
    let title = 'Ошибка';
    let text = '';

    if (msg === '__INFINITE__' || /__INFINITE__/.test(msg)) {
      title = 'Бесконечный цикл';
      text = 'Цикл повторился миллионы раз и никак не заканчивается, поэтому я остановил программу. ' +
        'Проверь условие цикла: оно когда-нибудь должно стать ложным (<code>false</code>). ' +
        'Часто забывают увеличить счётчик: <code>i++</code>.';
    } else if ((m = /^(?:Can't find variable: )?([\w$Ѐ-ӿ]+) is not defined$/.exec(msg)) || (m = /^Can't find variable: ([\w$Ѐ-ӿ]+)/.exec(msg))) {
      const w = m[1];
      title = `Не знаю, что такое «${w}»`;
      text = `JavaScript не нашёл ${code_(w)}. `;
      const sug = suggest(w, code);
      if (/[Ѐ-ӿ]/.test(w) && /[A-Za-z]/.test(w)) text += 'В этом слове смешаны русские и английские буквы — набери его заново на английской раскладке. ';
      else if (sug) text += `Может, ты имел в виду ${code_(sug)}? `;
      text += 'Проверь: <br>• правильно ли написано слово (большие и маленькие буквы — разные: <code>Score</code> и <code>score</code> — два разных имени);' +
        '<br>• объявлена ли переменная через <code>let</code> или <code>const</code>;' +
        '<br>• если это текст — возьми его в кавычки: <code>"текст"</code>.';
    } else if (/Unexpected end of input|missing \} after|expected expression, got end of script|end of script/.test(msg)) {
      title = 'Код оборвался';
      const br = countBrackets(code);
      text = 'JavaScript дочитал до конца, а код как будто не закончен. Обычно это значит, что не хватает закрывающей скобки. ' +
        (br.length ? '<br>Я посчитал скобки: <b>' + br.join(', ') + '</b>.' : '') +
        '<br>Каждой открывающей скобке <code>(</code> <code>{</code> <code>[</code> нужна своя закрывающая <code>)</code> <code>}</code> <code>]</code>.';
    } else if (/missing \) after argument list/.test(msg)) {
      title = 'Не хватает скобки «)» или запятой';
      text = 'Внутри скобок вызова что-то не так. Либо не закрыта скобка <code>)</code>, либо между значениями пропущена запятая или <code>+</code>. ' +
        '<br>Например: <code>console.log("Счёт: " score)</code> ❌ → <code>console.log("Счёт: " + score)</code> ✅';
    } else if ((m = /Unexpected identifier(?: '?([^']*)'?)?/.exec(msg)) || (m = /unexpected token: identifier/.exec(msg))) {
      title = 'Неожиданное слово' + (m[1] ? ` «${m[1]}»` : '');
      text = 'Слово стоит там, где JavaScript его не ждал. Частые причины:' +
        '<br>• пропущена запятая, точка или знак <code>+</code> перед словом;' +
        '<br>• текст забыли взять в кавычки (<code>console.log(Привет)</code> → <code>console.log("Привет")</code>);' +
        '<br>• опечатка в ключевом слове (<code>funtion</code> вместо <code>function</code>).';
    } else if (/Invalid or unexpected token|illegal character|unterminated string/i.test(msg)) {
      title = 'Странный символ в коде';
      text = 'В коде есть символ, который JavaScript не понимает. Чаще всего это:' +
        '<br>• текст в кавычках не закрыт: <code>"Привет</code> ❌ → <code>"Привет"</code> ✅;' +
        '<br>• русские кавычки <code>«»</code> вместо прямых <code>""</code>;' +
        '<br>• символ с русской раскладки (например, <code>№</code>).';
    } else if ((m = /Unexpected string/.exec(msg))) {
      title = 'Неожиданный текст в кавычках';
      text = 'Перед текстом в кавычках чего-то не хватает: скорее всего знака <code>+</code> или запятой. ' +
        '<br><code>"Жизни: " lives</code> ❌ → <code>"Жизни: " + lives</code> ✅';
    } else if ((m = /Unexpected number/.exec(msg))) {
      title = 'Неожиданное число';
      text = 'Число стоит не на своём месте. Возможно, пропущен оператор (<code>+ - * /</code>) или запятая. ' +
        'Ещё имя переменной не может начинаться с цифры: <code>1player</code> ❌, <code>player1</code> ✅.';
    } else if ((m = /Unexpected token '?([^'\s]+)'?/.exec(msg)) || (m = /expected expression, got '([^']+)'/.exec(msg))) {
      const t = m[1];
      title = `Неожиданный символ «${t}»`;
      const br = countBrackets(code);
      text = `Символ ${code_(t)} стоит там, где его не должно быть. ` +
        (t === '}' || t === ')' || t === ']' ? 'Похоже, это лишняя закрывающая скобка или раньше что-то не дописано. ' : '') +
        (t === '=' ? 'Может, ты хотел сравнить? Для сравнения пишут <code>===</code>. ' : '') +
        (t === 'else' ? 'Перед <code>else</code> должен идти блок <code>if (...) { ... }</code>. Проверь скобки. ' : '') +
        (br.length ? '<br>Я посчитал скобки: <b>' + br.join(', ') + '</b>.' : '<br>Проверь строку с ошибкой и строку над ней.');
    } else if ((m = /Cannot read propert(?:y|ies) of (undefined|null)(?: \(reading '([^']*)'\))?/.exec(msg)) ||
      (m = /(undefined|null) is not an object \(evaluating '[^']*?\.?([\w$]*)'\)/.exec(msg)) ||
      (m = /^([\w.$\[\]]+) is (undefined|null)$/.exec(msg))) {
      const empty = m[1] === 'null' || m[2] === 'null' ? 'null' : 'undefined';
      const prop = m[2] && m[2] !== 'null' && m[2] !== 'undefined' ? m[2] : '';
      title = 'Обращение к пустоте';
      text = `Ты пытаешься взять ${prop ? code_('.' + prop) : 'свойство'} у значения <code>${empty}</code> (то есть «ничего»). ` +
        'Значит, то, что стоит перед точкой, пока пустое. ' +
        '<br>• проверь написание имени перед точкой;' +
        '<br>• если это элемент массива — существует ли такой номер (номера начинаются с 0)?' +
        (empty === 'null' ? '<br>• <code>document.getElementById(...)</code> возвращает <code>null</code>, если элемента с таким id нет.' : '');
    } else if ((m = /Cannot set propert(?:y|ies) of (undefined|null)(?: \(setting '([^']*)'\))?/.exec(msg))) {
      title = 'Запись в пустоту';
      text = `Ты пытаешься записать ${m[2] ? code_('.' + m[2]) : 'свойство'} в <code>${m[1]}</code> — а туда ничего записать нельзя. Проверь, что объект перед точкой существует.`;
    } else if ((m = /^([\w$.\[\]'"()Ѐ-ӿ]+) is not a function/.exec(msg))) {
      const w = m[1];
      const last = w.split('.').pop();
      title = `«${w}» — не функция`;
      text = `Ты поставил скобки <code>()</code> после ${code_(w)}, как будто это команда, но это не команда. `;
      const sug = suggest(last, code);
      if (sug && sug !== last) text += `Может, имелось в виду ${code_(sug)}? `;
      text += '<br>Проверь написание: большие и маленькие буквы важны (<code>console.log</code>, а не <code>console.Log</code>).';
    } else if (/Assignment to constant variable|invalid assignment to const/.test(msg)) {
      title = 'Нельзя изменить const';
      text = 'Значение, объявленное через <code>const</code> (константа — «постоянная»), менять нельзя. ' +
        'Если значение должно меняться (счёт, жизни, координаты), объявляй его через <code>let</code>.';
    } else if ((m = /Identifier '([^']+)' has already been declared|redeclaration of (?:let|const) (\S+)/.exec(msg))) {
      const w = m[1] || m[2];
      title = `«${w}» уже объявлено`;
      text = `Имя ${code_(w)} уже создано выше. Второй раз писать <code>let</code> или <code>const</code> не нужно — просто пиши <code>${window.Lexer.escapeHtml(w)} = ...</code>`;
    } else if (/Maximum call stack size exceeded|too much recursion/.test(msg)) {
      title = 'Функция вызывает себя бесконечно';
      text = 'Функция вызывает сама себя снова и снова, и это никогда не заканчивается. ' +
        'Если так и задумано (рекурсия) — нужно условие остановки. Если нет — проверь, не вызываешь ли ты функцию внутри неё самой.';
    } else if ((m = /Cannot access '([^']+)' before initialization|can't access lexical declaration '([^']+)' before/.exec(msg))) {
      const w = m[1] || m[2];
      title = `«${w}» используется раньше, чем создано`;
      text = `Строка, которая создаёт ${code_(w)} (<code>let</code>/<code>const</code>), стоит ниже, чем место, где ты его используешь. Перенеси объявление выше.`;
    } else if (/Invalid left-hand side in assignment|invalid assignment left-hand side/.test(msg)) {
      title = 'Слева от «=» что-то не то';
      text = 'Знак <code>=</code> означает «положить значение в переменную», поэтому слева должно быть имя. ' +
        'Если ты хотел <b>сравнить</b> — пиши <code>===</code>.';
    } else if (/Missing initializer in const declaration|missing = in const declaration/.test(msg)) {
      title = 'const без значения';
      text = 'Константе нужно сразу дать значение: <code>const speed = 5;</code>. Если значение появится позже — используй <code>let</code>.';
    } else if (/Illegal return statement|return not in function/.test(msg)) {
      title = 'return вне функции';
      text = '<code>return</code> («вернуть») можно писать только внутри функции. Проверь фигурные скобки функции — может, она закрылась раньше времени.';
    } else if (/Illegal break statement|Illegal continue|unlabeled break must be inside loop/.test(msg)) {
      title = 'break/continue вне цикла';
      text = '<code>break</code> и <code>continue</code> работают только внутри цикла (<code>for</code>, <code>while</code>) или <code>switch</code>.';
    } else if ((m = /([\w$.]+) is not iterable/.exec(msg))) {
      title = 'Это нельзя перебрать';
      text = `${code_(m[1])} не является списком (массивом), поэтому перебрать его через <code>for...of</code> нельзя.`;
    } else if ((m = /([\w$.]+) is not a constructor/.exec(msg))) {
      title = 'Нельзя создать через new';
      text = `${code_(m[1])} — не класс. <code>new</code> можно писать только перед именем класса.`;
    } else if (/Class constructor (\S+) cannot be invoked without 'new'/.test(msg)) {
      title = 'Забыто слово new';
      text = 'Чтобы создать объект из класса, перед именем пиши <code>new</code>: <code>new Enemy(10, 20)</code>.';
    } else if (/await is only valid/.test(msg)) {
      title = 'await вне async';
      text = '<code>await</code> («ждать») работает только внутри функции, помеченной <code>async</code>.';
    } else if (/Unexpected strict mode reserved word|reserved word/.test(msg)) {
      title = 'Занятое слово';
      text = 'Это слово зарезервировано языком, его нельзя использовать как имя. Придумай другое имя.';
    } else if (/Invalid array length/.test(msg)) {
      title = 'Неправильная длина массива';
      text = 'Длина массива должна быть целым неотрицательным числом.';
    } else if (/Unexpected token|SyntaxError|syntax error/i.test(msg) || err.name === 'SyntaxError') {
      title = 'Ошибка в записи кода';
      const br = countBrackets(code);
      text = 'Код записан так, что JavaScript не может его прочитать. Проверь скобки, кавычки и запятые на этой строке и строке выше.' +
        (br.length ? '<br>Я посчитал скобки: <b>' + br.join(', ') + '</b>.' : '');
    } else {
      title = err.name ? 'Ошибка (' + err.name + ')' : 'Ошибка';
      text = 'Что-то пошло не так. Сообщение компьютера: ' + code_(msg) + '<br>Посмотри на строку с ошибкой и сравни с примером из урока.';
    }
    return { title, text, line: err.line > 0 ? err.line : 0, original: msg };
  }

  window.ErrorsRu = { explain, suggest, countBrackets };
})();
