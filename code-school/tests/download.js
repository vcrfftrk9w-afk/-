/* Песочница → «Скачать игру»: файл скачивается и сам по себе запускает игру без ошибок. */
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8793/code-school/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + 'index.html#/sandbox');
  await p.waitForSelector('.sb-tpl');
  const names = await p.$$eval('.sb-tpl option', (o) => o.map((x) => x.textContent));
  let fails = 0;
  for (let k = 1; k < names.length; k++) {
    await p.selectOption('.sb-tpl', String(k - 1));
    const dlg = await p.$('.modal .btn.primary');
    if (dlg) await dlg.click();
    await p.waitForTimeout(300);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.sb-download')]);
    const file = await dl.path();
    const html = fs.readFileSync(file, 'utf8');
    const g = await ctx.newPage();
    const gerr = [];
    g.on('pageerror', (e) => gerr.push(e.message));
    await g.setContent(html);
    await g.waitForTimeout(600);
    const painted = await g.evaluate(() => {
      const c = document.getElementById('game');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
      return n;
    });
    const ok = !gerr.length && (painted > 0 || /консоль/.test(names[k]));
    if (!ok) fails++;
    console.log(`${ok ? '✓' : '✗'} ${names[k]} → ${dl.suggestedFilename()} ${gerr.join('; ')} пикселей: ${painted}`);
    await g.close();
  }
  if (errs.length) { console.log('Ошибки приложения:', errs); fails++; }
  await b.close();
  process.exit(fails ? 1 : 0);
})();
