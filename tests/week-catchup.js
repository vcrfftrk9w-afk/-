const { chromium } = require('./_browser');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport:{width:400,height:880} });
  const p = await ctx.newPage();
  const errors=[]; p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(() => {
    const fixed = new Date('2026-09-21T16:30:00').getTime();   // понедельник 16:30
    const Real = Date; const start = Real.now();
    class FD extends Real { constructor(...a){ if(a.length===0) super(fixed + (Real.now()-start)); else super(...a);} static now(){ return fixed + (Real.now()-start);} }
    window.Date = FD;
  });
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(1200);
  // старый пользователь: график ставился старой версией, план сегодня собран без графика, висят хвосты
  await p.evaluate(()=>{
    State.s.onboarded=true;
    Week.install(); DayTpl.apply({quiet:true});
    Track.profile().weekVersion = 1;
    State.s.plan = { date: State.todayKey(), blocks: [], generatedAt: Date.now(), skipped:{}, unplaced:[] };
    Screens.tasks.add('Искать и думать над заработком','money','boss',false,{silent:true});
    const y = State.daysAgoKey(1);
    const eng = State.s.tasks.find(t=>t.title==='Английский'); eng.due = y;   // вчерашний хвост
    State.save();
  });
  await p.reload(); await p.waitForTimeout(2500);
  const a = await p.evaluate(()=>{
    document.querySelectorAll('.modal:not(.hidden)').forEach(m=>m.classList.add('hidden'));
    const pl = Planner.plan();
    const eng = State.s.tasks.filter(t=>t.title==='Английский');
    return { script: !!pl.script, version: Track.profile().weekVersion,
      ghost: State.s.tasks.some(t=>t.title==='Искать и думать над заработком' && !t.done),
      engCount: eng.length, engDue: eng[0] && eng[0].due, today: State.todayKey(),
      missed: Planner.missed().map(b=>b.title) };
  });
  console.log('миграция:', JSON.stringify(a));
  await p.evaluate(()=>App.go('day')); await p.waitForTimeout(400);
  const hasBehind = await p.$('#day-catchup');
  if (hasBehind) { await p.click('#day-catchup'); await p.waitForTimeout(400); }
  const c = await p.evaluate(()=>{
    const pl = Planner.plan();
    const bl = pl.blocks.slice().sort((x,y)=>x.start-y.start);
    const overlaps=[]; for(let i=1;i<bl.length;i++){ if(bl[i].start < bl[i-1].end && !bl[i].pinned && !bl[i-1].pinned) overlaps.push(bl[i-1].title+' × '+bl[i].title); }
    return { moved: Object.keys(pl.moved||{}).length, placed: pl.blocks.filter(x=>x.moved).map(x=>x.title+'@'+Track.hhmm(x.start)+'-'+Track.hhmm(x.end)),
      unplaced: pl.unplaced, missedAfter: Planner.missed().length, overlaps };
  });
  console.log('догнать:', JSON.stringify(c));
  // отметить дело из графика
  const before = await p.evaluate(()=>State.s.tasks.filter(t=>t.done).length);
  const btn = await p.$('.wk-row.is-task:not(.done) .wk-check:not([disabled])');
  await btn.click(); await p.waitForTimeout(600);
  const after = await p.evaluate(()=>({done: State.s.tasks.filter(t=>t.done).length, badge: document.querySelector('#day-week .badge').textContent}));
  console.log('отметка:', before, '→', JSON.stringify(after));
  // перестроение не теряет перенос
  await p.evaluate(()=>Planner.build({})); 
  const d = await p.evaluate(()=>({moved: Planner.plan().blocks.filter(x=>x.moved).length, missed: Planner.missed().length}));
  console.log('после пересборки:', JSON.stringify(d));
  const ok = a.script && a.version>=3 && !a.ghost && a.engCount===1 && a.engDue===a.today && c.missedAfter===0 && !c.overlaps.length && after.done===before+1 && d.missed===0 && !errors.length;
  console.log(ok ? '✓ миграция, «догнать план» и отметка работают' : '✗ есть проблемы');
  console.log('ошибки:', errors.length?JSON.stringify(errors):'нет');
  await b.close();
})();
