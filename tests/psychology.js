const { chromium } = require('./_browser');
const SP=require('os').tmpdir()+'/';
async function page(b, iso, mode, seed) {
  const ctx = await b.newContext({ viewport:{width:390,height:844} });
  const p = await ctx.newPage();
  p.errors=[]; p.on('pageerror',e=>p.errors.push(e.message));
  await p.addInitScript((iso) => {
    const fixed = new Date(iso).getTime(); const Real = Date; const start = Real.now();
    class FD extends Real { constructor(...a){ if(a.length===0) super(fixed + (Real.now()-start)); else super(...a);} static now(){ return fixed + (Real.now()-start);} }
    window.Date = FD;
  }, iso);
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(900);
  await p.evaluate(({mode, seed})=>{
    State.s.onboarded=true; State.s.space='all'; State.s.mode=mode;
    if (seed) {
      for (let i=1;i<=4;i++){ State.logDone('ТТ видео — кино', State.daysAgoKey(i)); State.logDone('Английский', State.daysAgoKey(i)); State.s.dailyTaskCounts[State.daysAgoKey(i)] = 5; }
      State.s.tasks.push({id:'old1', title:'Старое дело', done:true, doneAt: Date.now()-40*86400000, createdAt: Date.now()-41*86400000, category:'other', priority:'mid'});
    }
    State.save();
  }, {mode, seed});
  await p.reload(); await p.waitForTimeout(2400);
  await p.evaluate(()=>document.querySelectorAll('.modal.modal-open').forEach(m=>UI.closeModal('#'+m.id)));
  return p;
}
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  let ok = true; const check=(name,cond,info)=>{ console.log((cond?'✓ ':'✗ ')+name, info!==undefined?JSON.stringify(info):''); if(!cond) ok=false; };

  // понедельник 19:58, СДВГ: серия на публикации + баннер новой недели + сжатие истории
  let p = await page(b, '2026-09-21T19:58:00', 'adhd', true);
  let r = await p.evaluate(()=>({ chain: (document.querySelector('.an-chain')||{}).textContent, fresh: (document.querySelector('#fresh-banner b')||{}).textContent,
    old: State.s.tasks.some(t=>t.id==='old1'), logged: State.doneTitlesOn(State.daysAgoKey(40)).has('Старое дело'), kinoChain: State.chain('ТТ видео — кино') }));
  check('серия на экране «Сейчас»', /4 дня подряд/.test(r.chain||'') && /публикует/.test(r.chain||''), r.chain);
  check('баннер новой недели в понедельник', /Новая неделя/.test(r.fresh||''), r.fresh);
  check('старая закрытая задача ушла в журнал', !r.old && r.logged, r);
  await p.screenshot({path:SP+'v20_chain.png'});
  await p.click('#fresh-x'); await p.waitForTimeout(200);
  check('баннер скрывается', await p.evaluate(()=>document.querySelector('#fresh-banner').classList.contains('hidden')));
  await p.evaluate(()=>App.go('day')); await p.waitForTimeout(400);
  check('серия видна в графике дня', await p.evaluate(()=>!!document.querySelector('.wk-chain')));
  // идеальный день: закрыть всё
  const pd = await p.evaluate(()=>{
    const pl = Planner.plan();
    const blocks = pl.blocks.filter(b=>b.kind==='task' && !(pl.skipped||{})[b.id]);
    blocks.forEach(b=>{ if (b.pathId) { Path.complete ? Path.complete(b.pathId) : (State.s.path.done[b.pathId]=Date.now()); } });
    const tasks = blocks.map(b=>State.s.tasks.find(t=>t.id===b.taskId)).filter(Boolean).filter(t=>!t.done);
    tasks.forEach(t=>Screens.tasks.complete(t, document.body));
    return { left: Modes.perfectDay().left, perfectDate: State.s.perfectDate, today: State.todayKey(), perfectDays: State.s.totals.perfectDays };
  });
  check('идеальный день засчитан один раз', pd.perfectDate===pd.today && pd.perfectDays===1, pd);
  const serie = await p.evaluate(()=>State.chain('ТТ видео — кино'));
  check('серия выросла до 5 после публикации', serie===5, serie);
  check('без ошибок (1)', !p.errors.length, p.errors);
  await p.context().close();

  // вечерний толчок: 21:20, осталось 2 дела
  p = await page(b, '2026-09-22T21:20:00', 'normal', false);
  await p.evaluate(()=>{
    const pl = Planner.plan(); const sk = pl.skipped||{};
    const open = pl.blocks.filter(b=>b.kind==='task' && !sk[b.id] && !Planner.isDone(b));
    open.slice(0, open.length-2).forEach(b=>{ const t=State.s.tasks.find(x=>x.id===b.taskId); if(t) { t.done=true; t.doneAt=Date.now(); } if (b.pathId) State.s.path.done[b.pathId]=Date.now(); });
    State.s.rescueDate=null; State.save();
  });
  await p.evaluate(()=>Modes.tick()); await p.waitForTimeout(300);
  const t = await p.evaluate(()=>[...document.querySelectorAll('.toast')].map(x=>x.textContent).join(' | '));
  check('вечерний толчок «до идеального дня 2 дела»', /До идеального дня/.test(t), t.slice(0,160));
  const w = await p.evaluate(()=>({cols: document.querySelectorAll('.wo-col').length, perfect: (document.querySelector('#week-overview .perfect-head b')||{}).textContent}));
  check('обычный режим: неделя и «идеальный день»', w.cols===7 && /идеального/.test(w.perfect||''), w);
  check('без ошибок (2)', !p.errors.length, p.errors);
  await p.context().close();
  console.log(ok ? '\n✓ психология работает' : '\n✗ есть проблемы');
  await b.close();
})();
