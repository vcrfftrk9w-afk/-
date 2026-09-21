/* Собирает всё приложение в одну страницу: dist/most.html.
   Нужно там, где нельзя положить рядом несколько файлов — например,
   чтобы отправить приложение одним файлом или открыть его в чужой оболочке.
   Запуск: node tools/build.js */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

var index = read('index.html');

var sources = [];
var re = /<script src="([^"]+)"><\/script>/g;
var match;
while ((match = re.exec(index)) !== null) sources.push(match[1]);

if (!sources.length) {
  console.error('В index.html не нашлось ни одного скрипта — сборка бессмысленна.');
  process.exit(1);
}

var parts = [];
parts.push('<title>Мост</title>');
parts.push('<style>');
parts.push(read('styles.css').trim());
parts.push('</style>');
parts.push('<main id="app" class="wrap"></main>');
parts.push('<footer id="foot" class="foot"></footer>');

/* В одностраничной сборке нет своего заголовка CSP и, как правило,
   нет права отдавать файлы на скачивание. Приложение должно об этом знать,
   чтобы не обещать того, чего не может. */
parts.push('<script>window.MOST_ENV = { downloads: false, sealed: false };</script>');

sources.forEach(function (file) {
  var code = read(file);
  if (code.indexOf('</' + 'script>') !== -1) {
    console.error('В ' + file + ' встречается закрывающий тег скрипта — он разорвёт страницу.');
    process.exit(1);
  }
  parts.push('<script>/* ' + file + ' */');
  parts.push(code.trim());
  parts.push('</script>');
});

var out = parts.join('\n') + '\n';

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/most.html'), out, 'utf8');

console.log('dist/most.html — ' + Math.round(out.length / 1024) + ' КБ, ' +
  sources.length + ' ' + (sources.length === 1 ? 'файл' : 'файлов') + ' внутри');
