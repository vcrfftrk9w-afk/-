// Собирает reminders.ics из недельного графика: node tools/build-ics.js
// Готовый файл лежит рядом с index.html — на случай, если скачивание из приложения не сработает.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = { console, TextEncoder, URLSearchParams, Date, UI: {}, Track: { hhmm: (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` } };
vm.createContext(ctx);
for (const f of ['js/week.js', 'js/remind.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8') + `;this.${f.includes('week') ? 'Week=Week' : 'Remind=Remind'};`, ctx);
const from = new Date(2026, 8, 28);   // понедельник: события повторяются каждую неделю, дата — только точка отсчёта
const text = ctx.Remind.ics({ set: 'important', before: 5, from });
fs.writeFileSync(path.join(root, 'reminders.ics'), text);
console.log('reminders.ics:', ctx.Remind.events({ set: 'important' }).length, 'событий,', text.length, 'байт');
