#!/usr/bin/env node
// Пакет Sauda «всё в одном» — чтобы скачать проект целиком и продолжить его в другом ИИ или у другого разработчика.
//   node tools/sauda-pack.js
// Получается в dist/sauda/:
//   sauda.html         — весь сайт одним файлом: двойной щелчок — и открывается тот же сайт с той же базой;
//   sauda-source.zip   — исходники (сайт, SQL сервера, проверки, Android) + README.md и PROMPT-for-AI.txt.
// Те же файлы после каждого обновления main выкладывает GitHub (Releases → sauda-latest), см. .github/workflows/sauda-apk.yml.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const M = path.join(ROOT, 'market');
const OUT = path.join(ROOT, 'dist', 'sauda');
const PKG = path.join(OUT, 'sauda');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();

// ── сайт одним файлом: стили, скрипты и значки — внутри страницы
function single() {
  const read = (f) => fs.readFileSync(path.join(M, f), 'utf8');
  const uri = (f, type) => 'data:' + type + ';base64,' + fs.readFileSync(path.join(M, f)).toString('base64');
  let h = read('index.html');
  const swap = (from, to) => {
    if (!h.includes(from)) throw new Error('в index.html нет ' + from);
    h = h.replace(from, () => to);
  };
  swap('<link rel="manifest" href="manifest.json">\n', '');
  swap('href="icons/icon.svg"', 'href="' + uri('icons/icon.svg', 'image/svg+xml') + '"');
  swap('href="icons/apple-touch-icon.png"', 'href="' + uri('icons/apple-touch-icon.png', 'image/png') + '"');
  swap('<link rel="stylesheet" href="css/sauda.css">', '<style>\n' + read('css/sauda.css') + '\n</style>');
  let n = 0;
  h = h.replace(/<script src="(js\/[a-z0-9-]+\.js)"><\/script>/g, (m, f) => {
    n++;
    return '<script>\n/* ' + f + ' */\n' + read(f).replace(/<\/script/gi, '<\\/script') + '\n</script>';
  });
  if (!n || /(src|href)="(js|css|icons)\//.test(h)) throw new Error('в sauda.html остались ссылки на отдельные файлы');
  return h;
}

// ── что входит в исходники: только Sauda; в репозитории — то, что лежит в git, в распакованном архиве — всё по тем же правилам
const inGit = (() => { try { return git('rev-parse', '--is-inside-work-tree') === 'true'; } catch (e) { return false; } })();
function walk(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [rel];
  return fs.readdirSync(abs).filter((n) => !['build', '.gradle', 'node_modules', 'local.properties'].includes(n))
    .flatMap((n) => walk(rel + '/' + n));
}
function files() {
  const roots = ['market', 'supabase/migrations', 'tools', 'tests', 'android-sauda', '.github/workflows/sauda-apk.yml'];
  const all = inGit ? git('ls-files', '-z', '--', ...roots).split('\0').filter(Boolean) : roots.flatMap(walk);
  return all.filter((f) => f.startsWith('market/') || f.startsWith('android-sauda/') || f === '.github/workflows/sauda-apk.yml'
    || /^supabase\/migrations\/[0-9]+_sauda_[a-z0-9_]+\.sql$/.test(f) || /^tools\/sauda-[a-z0-9-]+\.(js|sh)$/.test(f) || /^tests\/sauda-[a-z0-9-]+\.js$/.test(f));
}

const sha = inGit ? git('rev-parse', '--short', 'HEAD') : 'без git';
const date = inGit ? git('log', '-1', '--format=%cs') : new Date().toISOString().slice(0, 10);
const stamp = (s) => s.replace(/\{\{version\}\}/g, `${sha} от ${date}`);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(PKG, { recursive: true });
const list = files();
for (const f of list) {
  const to = path.join(PKG, f);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(path.join(ROOT, f), to);
}
const html = single();
fs.writeFileSync(path.join(OUT, 'sauda.html'), html);
fs.writeFileSync(path.join(PKG, 'sauda.html'), html);
fs.writeFileSync(path.join(PKG, 'README.md'), stamp(fs.readFileSync(path.join(M, 'HANDOFF.md'), 'utf8')));
fs.writeFileSync(path.join(PKG, 'PROMPT-for-AI.txt'), stamp(fs.readFileSync(path.join(M, 'PROMPT-for-AI.txt'), 'utf8')));
fs.writeFileSync(path.join(PKG, 'package.json'), JSON.stringify({
  name: 'sauda',
  private: true,
  description: 'Sauda — маркетплейс Казахстана. Сайт: market/ (без сборки), сервер: supabase/migrations/*_sauda_*.sql',
  scripts: {
    db: 'sh tools/sauda-test-db.sh',
    dev: 'node tools/sauda-dev-server.js 8793',
    'test:api': 'node tests/sauda-api.js',
    'test:ui': 'node tests/sauda-ui.js',
    i18n: 'node tools/sauda-i18n.js',
    pack: 'node tools/sauda-pack.js',
  },
  devDependencies: { pg: '^8.11.0', playwright: '^1.47.0' },
}, null, 2) + '\n');

execFileSync('zip', ['-r', '-q', '-X', path.join(OUT, 'sauda-source.zip'), 'sauda'], { cwd: OUT });
const kb = (f) => Math.round(fs.statSync(path.join(OUT, f)).size / 1024) + ' КБ';
console.log(`sauda ${sha} (${date}): ${list.length} файлов исходников`);
console.log(`  dist/sauda/sauda-source.zip  ${kb('sauda-source.zip')}`);
console.log(`  dist/sauda/sauda.html        ${kb('sauda.html')}`);
