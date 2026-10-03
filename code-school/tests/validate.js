/* Проверка курса: в каждом уроке решение проходит все проверки, а начальный код — нет;
   примеры в теории запускаются без ошибок; тексты урока разбираются.
   Запуск (из корня репозитория):
     python3 -m http.server 8793 &
     NODE_PATH=/opt/node22/lib/node_modules node code-school/tests/validate.js [id-урока-или-модуля] */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8793/code-school/';
const only = process.argv[2] || '';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(BASE + 'tests/validate.html');
  const lessons = await page.evaluate(() => {
    const out = [];
    window.COURSE.forEach((m) => m.lessons.forEach((l) => out.push({ id: l.id, mod: m.id, title: l.title, hasTask: !!l.task })));
    return out;
  });
  if (pageErrors.length) { console.log('Ошибки при загрузке курса:\n' + pageErrors.join('\n')); process.exit(1); }
  const ids = new Set();
  let fails = 0, checked = 0;
  for (const l of lessons) {
    if (ids.has(l.id)) { console.log('ДУБЛЬ id: ' + l.id); fails++; }
    ids.add(l.id);
    if (only && l.id !== only && l.mod !== only) continue;
    const res = await page.evaluate(async (id) => {
      const L = []; window.COURSE.forEach((m) => m.lessons.forEach((x) => L.push(x)));
      const l = L.find((x) => x.id === id);
      const problems = [];
      // теория
      try { MD.render(l.theory || ''); if (l.task) MD.render(l.task.text || ''); } catch (e) { problems.push('разметка: ' + e.message); }
      if (!l.theory) problems.push('нет теории');
      if (l.quiz) l.quiz.forEach((q, k) => { if (!(q.c >= 0 && q.c < q.a.length)) problems.push('тест ' + k + ': неверный номер ответа'); });
      // примеры
      const exIds = [];
      const html = MD.render(l.theory || '');
      (html.match(/data-ex="(ex\d+)"/g) || []).forEach((m) => exIds.push(m.slice(9, -1)));
      for (const ex of exIds) {
        const d = window.EXAMPLES[ex];
        const r = await runIt(d.code, { canvas: d.canvas, width: d.w, height: d.h });
        const errs = r.errs;
        if (d.expectError && !errs.length) problems.push('пример должен показывать ошибку, а её нет:\n' + d.code.slice(0, 120));
        if (!d.expectError && errs.length) problems.push('пример с ошибкой: ' + errs.map((e) => e.msg + ' (стр. ' + e.line + ')').join('; ') + '\n' + d.code.slice(0, 120));
      }
      if (l.task) {
        const t = l.task;
        if (!t.tests || !t.tests.length) problems.push('нет проверок');
        if (!t.solution) problems.push('нет решения');
        const opt = { canvas: !!t.canvas, width: t.width, height: t.height, check: true, tests: t.tests, wait: t.wait || ((t.prep) ? 300 : 0), prep: t.prep };
        const sol = await runIt(t.solution, opt);
        if (sol.errs.length) problems.push('решение с ошибкой: ' + sol.errs.map((e) => e.msg + ' (стр. ' + e.line + ')').join('; '));
        if (!sol.r || !sol.r.every(Boolean)) problems.push('решение не проходит: ' + t.tests.filter((x, k) => !(sol.r && sol.r[k])).map((x) => x[0]).join(' | '));
        const st = await runIt(t.starter || '', opt);
        if (!t.freebie && st.r && st.r.every(Boolean)) problems.push('начальный код уже проходит все проверки');
        if (Lexer.lint(t.solution).length) problems.push('замечания к решению: ' + Lexer.lint(t.solution).map((p) => p.text).join('; '));
      }
      return problems;
    }, l.id);
    checked++;
    if (res.length) { fails++; console.log(`✗ ${l.id} «${l.title}»\n   - ` + res.join('\n   - ')); }
    else console.log(`✓ ${l.id} «${l.title}»`);
  }
  if (pageErrors.length) console.log('Ошибки страницы:\n' + pageErrors.join('\n'));
  console.log(`\nПроверено уроков: ${checked}, с проблемами: ${fails}`);
  await browser.close();
  process.exit(fails || pageErrors.length ? 1 : 0);
})();
