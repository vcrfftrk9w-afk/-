/* Скриншоты основных экранов (для ручной проверки вёрстки).
   NODE_PATH=/opt/node22/lib/node_modules node code-school/tests/shots.js <папка> */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8793/code-school/';
const out = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch();
  for (const [name, vp] of [['desk', { width: 1366, height: 860 }], ['phone', { width: 390, height: 844 }]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, colorScheme: 'dark' });
    if (process.env.UNLOCK) await ctx.addInitScript(() => { try { localStorage.setItem('igrokod_v1', JSON.stringify({ v: 1, settings: { theme: 'auto', font: 15, sound: false, unlockAll: true, symbols: true } })); } catch (e) {} });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    for (const route of (process.env.ROUTES || '#/,#/lesson/start-2,#/sandbox,#/dict,#/profile').split(',')) {
      await p.goto(BASE + 'index.html' + route);
      await p.waitForTimeout(500);
      if (process.env.RUN && route.includes('lesson')) {
        if (name === 'phone') await p.click('.lesson-tabs button[data-tab="code"]').catch(() => {});
        await p.click('.wb-run').catch(() => {});
        await p.waitForTimeout(800);
      }
      await p.screenshot({ path: `${out}/${name}-${route.replace(/[#/]/g, '_')}.png`, fullPage: !!process.env.FULL });
    }
    if (errs.length) console.log(name, 'ОШИБКИ:', errs.join('\n'));
    await ctx.close();
  }
  await b.close();
})();
