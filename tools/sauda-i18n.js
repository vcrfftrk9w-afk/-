// Казахский перевод Sauda: находит все русские строки интерфейса (литералы с кириллицей в market/js
// и data-i18n в index.html) и показывает, каких нет в market/js/i18n-kz.js.
//   node tools/sauda-i18n.js          — список недостающих
//   node tools/sauda-i18n.js --json   — недостающие как JSON-заготовка
// Код выходит с 1, если чего-то нет, — так проверка ловит новые строки без перевода.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = path.join(__dirname, '..', 'market');
const SKIP = new Set(['i18n-kz.js', 'config.js']);
const files = fs.readdirSync(path.join(DIR, 'js')).filter((f) => f.endsWith('.js') && !SKIP.has(f));

function strings(src) {
  const out = new Set();
  // убираем комментарии, чтобы не переводить их
  // (только настоящие комментарии: с начала строки или после пробела — 'image/*' и https:// в строках не трогаем)
  src = src.replace(/^\s*\/\*[\s\S]*?\*\//gm, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  // строки в одинарных и двойных кавычках ищем отдельно: атрибуты в шаблонах (placeholder="${t('…')}") не должны их съедать
  for (const re of [/'((?:[^'\\\n]|\\.)*)'/g, /"((?:[^"\\\n]|\\.)*)"/g]) {
    let m;
    while ((m = re.exec(src))) {
      const s = m[1].replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');
      if (/[А-Яа-яЁё]/.test(s) && !s.includes('${') && !/^[\s,;:.)(]|[\s,(]$/.test(s)) out.add(s);
    }
  }
  return out;
}

const all = new Set();
files.forEach((f) => strings(fs.readFileSync(path.join(DIR, 'js', f), 'utf8')).forEach((s) => all.add(s)));
const htmlSrc = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
for (const m of htmlSrc.matchAll(/data-i18n="([^"]+)"/g)) all.add(m[1]);
// названия игр и разделов из базы переводятся отдельно (в базе есть kz), а города и бренды — не переводятся
const NO = new Set(['Алматы', 'Астана', 'Шымкент', 'Караганда', 'Актобе', 'Тараз', 'Павлодар', 'Усть-Каменогорск', 'Семей', 'Атырау',
  'Костанай', 'Кызылорда', 'Уральск', 'Петропавловск', 'Актау', 'Туркестан', 'Кокшетау', 'Талдыкорган', 'Экибастуз', 'Жезказган', 'Русский', 'РУС', 'ҚАЗ']);

const ctx = { I18n: { add(d) { Object.assign(ctx.KZ, d); } }, KZ: {} };
vm.runInNewContext(fs.readFileSync(path.join(DIR, 'js', 'i18n-kz.js'), 'utf8'), ctx);
const missing = [...all].filter((s) => !NO.has(s) && ctx.KZ[s] === undefined).sort();
const extra = Object.keys(ctx.KZ).filter((k) => !all.has(k));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(Object.fromEntries(missing.map((s) => [s, ''])), null, 1));
} else {
  missing.forEach((s) => console.log('НЕТ:', JSON.stringify(s)));
  if (process.argv.includes('--extra')) extra.forEach((s) => console.log('ЛИШНЕЕ:', JSON.stringify(s)));
  console.log(`строк: ${all.size}, переведено: ${all.size - missing.length}, нет перевода: ${missing.length}`);
}
process.exit(missing.length ? 1 : 0);
