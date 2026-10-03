/* Сборка курса: content/*.txt → course/*.js
   Запуск: node code-school/tools/build-course.js

   Формат файла урока (строки, начинающиеся с @, — разделы):
     @module id        — начало модуля; дальше строки «ключ: значение» (icon, color, title, desc, project)
     @lesson id        — начало урока; дальше «title: …», «xp: …»
     @theory           — текст теории (мини-разметка, см. js/md.js)
     @task             — текст задания
     @canvas [ШxВ]     — задание рисует на холсте
     @wait N           — проверять через N мс (для игр)
     @prep             — код, который робот выполняет перед проверкой (нажатия клавиш)
     @starter          — начальный код
     @solution         — эталонное решение
     @test Описание    — проверка: дальше выражение JavaScript (true = выполнено)
     @hint             — подсказка
     @freebie          — начальный код уже проходит проверки (это нормально)
     @quiz             — вопросы: «? вопрос», «- неверный», «+ верный», «= объяснение» */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'content');
const outDir = path.join(root, 'course');

function trimBlock(lines) {
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines.join('\n');
}

function parse(text, file) {
  const lines = text.replace(/\r/g, '').split('\n');
  const mod = { lessons: [] };
  let lesson = null;
  let section = null; // { kind, arg, lines }
  const flush = () => {
    if (!section) return;
    const body = trimBlock(section.lines);
    const k = section.kind;
    const target = lesson || mod;
    if (k === 'module' || k === 'lesson') {
      for (const l of section.lines) {
        const m = /^(\w+):\s*(.*)$/.exec(l);
        if (m) target[m[1]] = m[2] === 'true' ? true : (/^\d+$/.test(m[2]) ? +m[2] : m[2]);
      }
    } else if (k === 'theory') lesson.theory = body;
    else if (k === 'task') { lesson.task = lesson.task || { tests: [], hints: [] }; lesson.task.text = body; }
    else if (k === 'starter') lesson.task.starter = body + '\n';
    else if (k === 'solution') lesson.task.solution = body + '\n';
    else if (k === 'prep') lesson.task.prep = body;
    else if (k === 'test') lesson.task.tests.push([section.arg, body]);
    else if (k === 'hint') lesson.task.hints.push(section.lines.map((s) => s.trim()).filter(Boolean).join(' '));
    else if (k === 'quiz') {
      lesson.quiz = lesson.quiz || [];
      let q = null;
      for (const raw of section.lines) {
        const l = raw.trim();
        if (!l) continue;
        if (l.startsWith('? ')) { q = { q: l.slice(2), a: [], c: -1, e: '' }; lesson.quiz.push(q); }
        else if (l.startsWith('- ')) q.a.push(l.slice(2));
        else if (l.startsWith('+ ')) { q.c = q.a.length; q.a.push(l.slice(2)); }
        else if (l.startsWith('= ')) q.e += (q.e ? ' ' : '') + l.slice(2);
        else if (q && q.e) q.e += ' ' + l;
        else throw new Error(`${file}: непонятная строка в тесте: ${l}`);
      }
    }
    section = null;
  };
  for (const line of lines) {
    const m = /^@(\w+)\s*(.*)$/.exec(line);
    if (m) {
      const [, kind, arg] = m;
      flush();
      if (kind === 'module') { mod.id = arg.trim(); section = { kind, lines: [] }; }
      else if (kind === 'lesson') {
        lesson = { id: arg.trim() };
        mod.lessons.push(lesson);
        section = { kind, lines: [] };
      } else if (kind === 'canvas') {
        lesson.task = lesson.task || { tests: [], hints: [] };
        lesson.task.canvas = true;
        const sz = /(\d+)\s*x\s*(\d+)/.exec(arg);
        if (sz) { lesson.task.width = +sz[1]; lesson.task.height = +sz[2]; }
      } else if (kind === 'wait') { lesson.task.wait = +arg; }
      else if (kind === 'freebie') { lesson.task.freebie = true; }
      else if (kind === 'task') { lesson.task = lesson.task || { tests: [], hints: [] }; section = { kind, lines: [] }; }
      else if (['theory', 'starter', 'solution', 'prep', 'test', 'hint', 'quiz'].includes(kind)) {
        if (!lesson) throw new Error(`${file}: раздел @${kind} вне урока`);
        if (kind !== 'theory' && kind !== 'quiz' && !lesson.task) lesson.task = { tests: [], hints: [] };
        section = { kind, arg: arg.trim(), lines: [] };
      } else throw new Error(`${file}: неизвестный раздел @${kind}`);
    } else if (section) section.lines.push(line);
    else if (line.trim()) throw new Error(`${file}: текст вне раздела: ${line}`);
  }
  flush();
  for (const l of mod.lessons) {
    if (l.task && !l.task.text) throw new Error(`${file}: у урока ${l.id} нет текста задания (@task)`);
    if (l.task && !l.task.hints.length) delete l.task.hints;
    if (l.quiz) l.quiz.forEach((q) => { if (q.c < 0) throw new Error(`${file}: у вопроса «${q.q}» нет верного ответа (+)`); });
  }
  return mod;
}

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.txt')).sort();
let lessons = 0;
for (const f of files) {
  const mod = parse(fs.readFileSync(path.join(srcDir, f), 'utf8'), f);
  lessons += mod.lessons.length;
  const js = '/* Собрано из content/' + f + ' командой node code-school/tools/build-course.js — правь исходник, а не этот файл. */\n' +
    'window.COURSE = window.COURSE || [];\nwindow.COURSE.push(' + JSON.stringify(mod, null, 1) + ');\n';
  fs.writeFileSync(path.join(outDir, f.replace(/\.txt$/, '.js')), js);
}
console.log(`Собрано модулей: ${files.length}, уроков: ${lessons}`);
