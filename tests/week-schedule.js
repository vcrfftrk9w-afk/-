const { chromium } = require('./_browser');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const out = [];
  let fail = 0;
  for (const [d, iso] of [[1,'2026-09-21'],[2,'2026-09-22'],[3,'2026-09-23'],[4,'2026-09-24'],[5,'2026-09-25'],[6,'2026-09-26'],[0,'2026-09-27']]) {
    const ctx = await b.newContext({ viewport:{width:420,height:900} });
    const p = await ctx.newPage();
    const errors=[]; p.on('pageerror',e=>errors.push(e.message));
    await p.addInitScript((iso) => {
      const fixed = new Date(iso + 'T06:30:00').getTime();
      const Real = Date; const start = Real.now();
      class FD extends Real { constructor(...a){ if(a.length===0) super(fixed + (Real.now()-start)); else super(...a);} static now(){ return fixed + (Real.now()-start);} }
      window.Date = FD;
    }, iso);
    await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(1200);
    // старый пользователь: онборд пройден, стартовый шаблон, график НЕ ставился, есть хвосты старых задач
    await p.evaluate(()=>{ State.s.onboarded=true; State.s.space='all'; State.s.profile = State.s.profile || {}; State.save(); });
    await p.reload(); await p.waitForTimeout(2200);
    const r = await p.evaluate(() => {
      document.querySelectorAll('.modal:not(.hidden)').forEach(m=>m.classList.add('hidden'));
      const pl = Planner.plan();
      const sc = Week.scriptToday();
      const tb = pl.blocks.filter(x=>x.kind==='task' && !x.extra);
      const scTasks = sc.filter(x=>x.kind==='task');
      const mismatch = scTasks.filter(s => !tb.some(t=>t.start===s.start && t.end===s.end && t.taskTitle===s.task));
      const kino = pl.blocks.find(x=>x.taskTitle==='ТТ видео — кино');
      const orca = pl.blocks.find(x=>x.taskTitle==='ТТ видео — orca');
      const main = document.querySelector('#main-today').innerText;
      return { script: !!pl.script, blocks: pl.blocks.length, script_n: sc.length, tasks: tb.length, mismatch: mismatch.map(x=>x.title),
        kino: kino && Track.hhmm(kino.start)+(kino.pinned?' ровно':''), orca: orca && Track.hhmm(orca.start)+(orca.pinned?' ровно':''),
        unplaced: Planner.unplaced(), extras: pl.blocks.filter(x=>x.extra).map(x=>x.title+'@'+Track.hhmm(x.start)),
        mainHas: /19:55/.test(main) && /21:00/.test(main), mainDay: (document.querySelector('.main-day')||{}).textContent || '' };
    });
    // экран День: вкладки
    await p.evaluate(()=>App.go('day')); await p.waitForTimeout(500);
    const wk = await p.evaluate(()=>{
      const chips=[...document.querySelectorAll('.wk-chip')].map(c=>c.textContent.trim());
      const rows=document.querySelectorAll('.wk-row').length;
      const first=document.querySelector('.wk-row .wk-body b').textContent;
      return {chips: chips.length, rows, first, h: document.querySelector('#day-week h3').textContent};
    });
    await p.click('.wk-chip[data-wkday="3"]'); await p.waitForTimeout(200);
    const wed = await p.evaluate(()=>({h: document.querySelector('#day-week h3').textContent, rows: document.querySelectorAll('.wk-row').length, sum: document.querySelector('.wk-sum').textContent}));
    const hscroll = await p.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth + 1);
    const ok = r.script && !r.mismatch.length && r.kino==='19:55 ровно' && r.orca==='21:00 ровно' && r.mainHas && wk.chips===7 && !errors.length && !hscroll;
    if(!ok) fail++;
    out.push({d, ok, ...r, wk, wed, hscroll, errors});
    await ctx.close();
  }
  out.forEach(x=>console.log(JSON.stringify(x)));
  console.log(fail ? `✗ ${fail} дней с проблемами` : '✓ все 7 дней по графику');
  await b.close();
})();
