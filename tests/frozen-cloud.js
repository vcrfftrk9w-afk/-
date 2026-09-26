const { chromium } = require('playwright');
/* На iPhone облако отдаёт данные замороженными (только чтение). Из-за этого
   день не собирался: шаблон и задачи нельзя было поменять. Имитируем это:
   снимки облака глубоко заморожены, память браузера пуста. */
const STORE = {};
const freezeMock = `(() => {
  const deepFreeze = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };
  const UID='u_me';
  const snap=(id,body)=>({id,exists:body!=null,data:()=>body==null?undefined:deepFreeze(JSON.parse(JSON.stringify(body))),metadata:{fromCache:false,hasPendingWrites:false}});
  const doc=(path)=>({id:path.split('/').pop(),path,get:async()=>snap(path.split('/').pop(),await window.__cloudGet(path)),set:async(b)=>{await window.__cloudSet(path,b)},update:async(b)=>{await window.__cloudSet(path,b)},delete:async()=>{},onSnapshot:()=>()=>{}});
  window.claude={use:(n)=>new Promise(r=>setTimeout(()=>r(n==='db'?{doc}:n==='user'?{id:async()=>UID,me:async()=>({id:UID})}:null),200))};
  const R=Date, f=new R('2026-09-26T09:20:00').getTime(), s=R.now(); class FD extends R{constructor(...a){a.length?super(...a):super(f+R.now()-s)} static now(){return f+R.now()-s}} window.Date=FD;
})();`;
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  let ok = true; const check=(n,c,i)=>{ console.log((c?'✓ ':'✗ ')+n, i!==undefined?JSON.stringify(i).slice(0,300):''); if(!c) ok=false; };
  // 1) вчерашнее сохранение: человек прошёл анкету, график старой версии, дела на вчера
  const ctx1 = await b.newContext({ viewport:{width:393,height:793} });
  const p1 = await ctx1.newPage();
  await p1.addInitScript(()=>{ const R=Date, f=new R('2026-09-24T20:00:00').getTime(), s=R.now(); class FD extends R{constructor(...a){a.length?super(...a):super(f+R.now()-s)} static now(){return f+R.now()-s}} window.Date=FD; });
  await p1.goto('http://localhost:8792/index.html'); await p1.waitForTimeout(800);
  const seed = await p1.evaluate(()=>{ State.s.onboarded=true; State.s.mode='adhd'; State.save(); location.reload(); });
  await p1.waitForTimeout(2600);
  const old = await p1.evaluate(()=>{ Track.profile().weekVersion=3; State.save(); const s=JSON.parse(JSON.stringify(State.s)); const tasks={list:s.tasks}; delete s.tasks; return {core:s, tasks}; });
  await ctx1.close();
  STORE['data/users/u_me/core'] = old.core; STORE['data/users/u_me/tasks'] = old.tasks; STORE['data/users/u_me/history'] = {};
  // 2) на следующий день — айфон: память пустая, облако заморожено
  const ctx = await b.newContext({ viewport:{width:393,height:793} });
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.exposeFunction('__cloudGet', (path) => STORE[path] === undefined ? null : STORE[path]);
  await p.exposeFunction('__cloudSet', (path, body) => { STORE[path] = body; });
  await p.addInitScript(freezeMock);
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(5500);
  const r = await p.evaluate(()=>({ app: !document.querySelector('#app').classList.contains('hidden'), plan: Planner.plan() && Planner.plan().date, tpl: DayTpl.tpl().appliedDate, wv: Track.profile().weekVersion,
    today: State.todayKey(), todayTasks: State.s.tasks.filter(t=>t.due===State.todayKey()).length, rows: document.querySelectorAll('#main-today .mt-row').length, errLog: (State.s.errLog||[]).map(e=>e.where+': '+e.msg) }));
  check('приложение открылось без анкеты', r.app);
  check('день собран на сегодня', r.plan===r.today && r.tpl===r.today, r);
  check('график обновился до новой версии', r.wv>=4, r.wv);
  check('дела на сегодня стоят, главная не пустая', r.todayTasks>=10 && r.rows>=1, [r.todayTasks, r.rows]);
  check('в журнале нет ошибок', !r.errLog.length, r.errLog);
  check('без ошибок страницы', !errs.length, errs);
  console.log(ok ? '\n✓ замороженное облако (как на iPhone) больше не ломает день' : '\n✗ есть проблемы');
  await b.close();
})();
