/* Мастерская: прототип за двадцать минут.
   Собирает настоящий файл, который открывается в браузере и работает.
   Не «пример из учебника», а твоя вещь: внутри твои слова. */
(function (root) {
  'use strict';

  var M = root.Most || (root.Most = {});
  var W = M.workshop || (M.workshop = {});

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function js(v) { return JSON.stringify(v); }

  function page(title, body, script) {
    return '<!doctype html>\n' +
      '<html lang="ru">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>' + esc(title) + '</title>\n' +
      '<style>\n' +
      '  body { font-family: system-ui, sans-serif; background: #f3f4f1; color: #1a201d;\n' +
      '         display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 24px; }\n' +
      '  main { max-width: 32rem; text-align: center; display: grid; gap: 20px; }\n' +
      '  h1 { font-size: 1.3rem; font-weight: 600; margin: 0; }\n' +
      '  button { font: inherit; padding: 14px 22px; border-radius: 8px; cursor: pointer;\n' +
      '           border: 1px solid #2c6d60; background: #2c6d60; color: #f5fbf9; }\n' +
      '  #out { font-size: 1.25rem; line-height: 1.5; min-height: 3rem; }\n' +
      '</style>\n</head>\n<body>\n<main>\n' + body + '\n</main>\n' +
      '<script>\n' + script + '\n<\/script>\n</body>\n</html>\n';
  }

  W.projects = [
    {
      id: 'joke',
      title: 'Кнопка со случайной шуткой',
      about: 'Нажимаешь — показывает одну из твоих фраз. Двадцать минут, и штука работает.',
      minutes: 20,
      fields: [
        { id: 'title', label: 'Как назовём страницу', placeholder: 'Кнопка хорошего настроения', def: 'Кнопка хорошего настроения' },
        { id: 'lines', label: 'Пять фраз — свои, чужие, любые', type: 'area', rows: 5,
          placeholder: 'Каждая с новой строки', def: 'Всё будет нормально.\nСегодня можно ничего не успеть.\nНачало уже позади — это больше, чем вчера.\nПлохой день не равно плохая жизнь.\nЗавтра тоже есть.' }
      ],
      tweak: 'Открой файл в текстовом редакторе, найди строку со своими фразами и добавь шестую. Обнови страницу в браузере — она уже там.',
      build: function (v) {
        var lines = String(v.lines || '').split('\n')
          .map(function (s) { return s.trim(); })
          .filter(Boolean);
        if (!lines.length) lines = ['Здесь будет твоя фраза.'];
        return page(v.title || 'Кнопка',
          '  <h1>' + esc(v.title || 'Кнопка') + '</h1>\n' +
          '  <div id="out">Нажми кнопку</div>\n' +
          '  <button id="go">Ещё раз</button>',
          '  // Твои фразы. Добавь сюда строчку — и она появится на странице.\n' +
          '  var lines = ' + js(lines) + ';\n' +
          '  var out = document.getElementById("out");\n' +
          '  document.getElementById("go").addEventListener("click", function () {\n' +
          '    out.textContent = lines[Math.floor(Math.random() * lines.length)];\n' +
          '  });');
      }
    },
    {
      id: 'timer',
      title: 'Таймер на одно дело',
      about: 'Запускаешь — и двадцать минут делаешь одну вещь. Работает без интернета.',
      minutes: 20,
      fields: [
        { id: 'title', label: 'Что будешь делать', placeholder: 'Разобрать стол', def: 'Разобрать стол' },
        { id: 'mins', label: 'Сколько минут', placeholder: '20', def: '20' }
      ],
      tweak: 'Найди в файле число 20 и поставь своё. Так меняется любая программа: находишь число и меняешь.',
      build: function (v) {
        var mins = Math.max(1, Math.min(180, parseInt(v.mins, 10) || 20));
        return page(v.title || 'Таймер',
          '  <h1>' + esc(v.title || 'Одно дело') + '</h1>\n' +
          '  <div id="out">' + mins + ':00</div>\n' +
          '  <button id="go">Начать</button>',
          '  var minutes = ' + mins + '; // поменяй это число\n' +
          '  var left = minutes * 60, timer = null;\n' +
          '  var out = document.getElementById("out");\n' +
          '  function show() {\n' +
          '    var m = Math.floor(left / 60), s = left % 60;\n' +
          '    out.textContent = m + ":" + (s < 10 ? "0" + s : s);\n' +
          '  }\n' +
          '  document.getElementById("go").addEventListener("click", function () {\n' +
          '    if (timer) return;\n' +
          '    timer = setInterval(function () {\n' +
          '      left = left - 1; show();\n' +
          '      if (left <= 0) { clearInterval(timer); timer = null; out.textContent = "Готово"; }\n' +
          '    }, 1000);\n' +
          '  });\n' +
          '  show();');
      }
    },
    {
      id: 'count',
      title: 'Счётчик «сколько раз сегодня»',
      about: 'Считает отжимания, стаканы воды, выкуренные сигареты — что угодно. Помнит между заходами.',
      minutes: 20,
      fields: [
        { id: 'title', label: 'Что считаем', placeholder: 'Стаканы воды', def: 'Стаканы воды' },
        { id: 'goal', label: 'Сколько за день — по-хорошему', placeholder: '8', def: '8' }
      ],
      tweak: 'Добавь вторую кнопку «минус»: скопируй строчки про кнопку и поменяй плюс на минус.',
      build: function (v) {
        var goal = Math.max(1, parseInt(v.goal, 10) || 8);
        return page(v.title || 'Счётчик',
          '  <h1>' + esc(v.title || 'Счётчик') + '</h1>\n' +
          '  <div id="out">0</div>\n' +
          '  <button id="go">+1</button>',
          '  var goal = ' + goal + ';\n' +
          '  var key = "count." + new Date().toDateString();\n' +
          '  var n = Number(localStorage.getItem(key) || 0);\n' +
          '  var out = document.getElementById("out");\n' +
          '  function show() { out.textContent = n + " из " + goal; }\n' +
          '  document.getElementById("go").addEventListener("click", function () {\n' +
          '    n = n + 1; localStorage.setItem(key, n); show();\n' +
          '  });\n' +
          '  show();');
      }
    },
    {
      id: 'card',
      title: 'Страница для одного человека',
      about: 'Открытка, которую можно отправить файлом. Самый быстрый способ увидеть, что твой текст живёт в браузере.',
      minutes: 15,
      fields: [
        { id: 'to', label: 'Кому', placeholder: 'Имя', def: '' },
        { id: 'text', label: 'Что хочешь сказать', type: 'area', rows: 4, placeholder: 'То, что обычно не говорится вслух', def: '' },
        { id: 'from', label: 'От кого', placeholder: 'Твоё имя', def: '' }
      ],
      tweak: 'Найди в файле строчку background и поменяй цвет на #ffe9d6. Это первое, что меняют все, кто начинает.',
      build: function (v) {
        return page('Для ' + (v.to || 'тебя'),
          '  <h1>' + esc(v.to || 'Привет') + '</h1>\n' +
          '  <div id="out">' + esc(v.text || 'Здесь твои слова.') + '</div>\n' +
          (v.from ? '  <p>— ' + esc(v.from) + '</p>' : ''),
          '  // Тут пока ничего не происходит — и это нормально.\n' +
          '  // Страница уже работает: её можно отправить файлом.');
      }
    }
  ];

  W.projectById = function (id) {
    for (var i = 0; i < W.projects.length; i++) if (W.projects[i].id === id) return W.projects[i];
    return null;
  };

  W.filename = function (project) { return project.id + '.html'; };

  if (typeof module !== 'undefined' && module.exports) module.exports = W;
})(typeof window !== 'undefined' ? window : globalThis);
