// Выгружает недельный график из js/week.js в bot/schedule.json — боту и приложению
// один и тот же график. Запуск: node tools/export-schedule.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/week.js'), 'utf8') + ';this.Week=Week;', ctx);
const W = ctx.Week;
const days = {};
for (let dow = 0; dow < 7; dow++) {
  days[dow] = W.scriptFor(dow).map((b, i) => {
    const plan = b.task ? W.PLAN.find((p) => p.title === b.task) : null;
    return { start: b.start, end: b.end, title: b.title, emoji: b.emoji || '', kind: i === 0 ? 'wake' : b.kind,
      task: b.task || null, hard: !!b.hard, note: plan && plan.note ? plan.note : '' };
  });
}
const out = { version: W.VERSION, days_ru: W.DAY_NAMES, days };
fs.writeFileSync(path.join(root, 'bot/schedule.json'), JSON.stringify(out, null, 1));
console.log('bot/schedule.json:', Object.values(days).reduce((a, d) => a + d.length, 0), 'блоков');
