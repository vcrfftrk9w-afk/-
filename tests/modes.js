const { chromium } = require('playwright');
const SP=require('os').tmpdir()+'/';
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport:{width:375,height:812}, hasTouch:true, isMobile:true });
  const p = await ctx.newPage();
  const errors=[]; p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(() => {
    const fixed = new Date('2026-09-21T12:20:00').getTime();   // понедельник, английский 12:10–12:50
    const Real = Date; const start = Real.now();
    class FD extends Real { constructor(...a){ if(a.length===0) super(fixed + (Real.now()-start)); else super(...a);} static now(){ return fixed + (Real.now()-start);} }
    window.Date = FD;
  });
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(1000);
  await p.evaluate(()=>{ State.s.onboarded=true; State.s.mode='adhd'; Math.random = () => 0.9; State.save(); });
  await p.reload(); await p.waitForTimeout(2600);
  await p.evaluate(()=>{ Math.random = () => 0.9; });   // без случайных сюрпризов — проверяем комбо
  await p.evaluate(()=>document.querySelectorAll('.modal:not(.hidden)').forEach(m=>m.classList.add('hidden')));
  await p.waitForTimeout(4200);   // тосты улеглись
  const vis = (sel) => p.evaluate((s)=>{ const e=document.querySelector(s); return !!e && e.offsetParent!==null && getComputedStyle(e).display!=='none'; }, sel);
  const A = await p.evaluate(()=>{
    const cards=[...document.querySelectorAll('.grid-dash > .card')].filter(c=>c.offsetParent!==null).map(c=>c.dataset.card);
    return { cards, now: document.querySelector('#adhd-now h2') && document.querySelector('#adhd-now h2').textContent,
      timer: (document.querySelector('.an-mm')||{}).textContent, challenge: (document.querySelector('.an-challenge')||{}).textContent,
      mini: (document.querySelector('#mini-clock')||{}).textContent, more: document.querySelector('#dash-more-btn').textContent,
      perfect: (document.querySelector('#adhd-now .perfect-head b')||{}).textContent };
  });
  console.log('СДВГ главная:', JSON.stringify(A));
  await p.screenshot({path:SP+'v19_adhd_now.png'});
  const t1 = await p.evaluate(()=>document.querySelector('.an-mm').textContent);
  await p.waitForTimeout(2100);
  const t2 = await p.evaluate(()=>document.querySelector('.an-mm').textContent);
  console.log('таймер идёт:', t1, '→', t2, t1!==t2?'✓':'✗');
  await p.click('[data-an="stuck"]'); await p.waitForTimeout(400);
  const S = await p.evaluate(()=>(document.querySelector('.stuck-move')||{}).textContent);
  console.log('не могу начать:', S, S ? '✓' : '✗');
  await p.evaluate(()=>UI.closeModal('#sheet-modal')); await p.waitForTimeout(400);
  // СТАРТ → фокус с задачей и челлендж
  await p.click('[data-an="start"]'); await p.waitForTimeout(800);
  const F = await p.evaluate(()=>({tab: document.querySelector('.tab-panel.active').id, running: Screens.focus.running, sel: document.querySelector('#timer-task').value, eng: (State.s.tasks.find(t=>t.title==='Английский')||{}).id, ch: !!State.s.challenge}));
  console.log('старт:', JSON.stringify(F), F.running && F.sel===F.eng && F.ch ? '✓' : '✗');
  await p.evaluate(()=>Screens.focus.toggleTimer());
  await p.evaluate(()=>App.go('dashboard')); await p.waitForTimeout(500);
  const xp0 = await p.evaluate(()=>State.s.xp);
  await p.click('[data-an="done"]'); await p.waitForTimeout(700);
  const C = await p.evaluate(()=>({xp: State.s.xp, combo: State.s.combo, toasts:[...document.querySelectorAll('.toast')].map(t=>t.textContent.trim()).slice(-3), next: document.querySelector('#adhd-now h2').textContent}));
  console.log('готово:', xp0, '→', JSON.stringify(C));
  // второе дело подряд → комбо
  await p.evaluate(()=>{ const t=State.s.tasks.find(x=>x.title==='YouTube'); Screens.tasks.complete(t, document.body); });
  await p.waitForTimeout(500);
  const C2 = await p.evaluate(()=>({combo: State.s.combo.n, toasts:[...document.querySelectorAll('.toast')].map(t=>t.textContent.trim()), badge:(document.querySelector('.an-combo')||{}).textContent}));
  console.log('комбо:', JSON.stringify(C2), C2.combo===2 && /комбо/.test(C2.toasts.join(' ')) ? '✓':'✗');
  // «не могу начать»
  await p.evaluate(()=>document.querySelectorAll('.modal.modal-open').forEach(m=>UI.closeModal('#'+m.id))); await p.waitForTimeout(400);
  // День в СДВГ: окно
  await p.evaluate(()=>App.go('day')); await p.waitForTimeout(600);
  const D = await p.evaluate(()=>({rows: document.querySelectorAll('.wk-row').length, more: (document.querySelector('#wk-more')||{}).textContent}));
  console.log('день СДВГ:', JSON.stringify(D));
  await p.click('#wk-more'); await p.waitForTimeout(200);
  const D2 = await p.evaluate(()=>document.querySelectorAll('.wk-row').length);
  console.log('развернул:', D2);
  const hs1 = await p.evaluate(()=>document.documentElement.scrollWidth > innerWidth+1);
  // обычный режим
  await p.evaluate(()=>App.go('dashboard'));
  await p.click('#mode-toggle'); await p.waitForTimeout(700);
  const N = await p.evaluate(()=>({mode: State.s.mode, cards:[...document.querySelectorAll('.grid-dash > .card')].filter(c=>c.offsetParent!==null).map(c=>c.dataset.card).slice(0,6),
    week: document.querySelectorAll('.wo-col').length, mini: getComputedStyle(document.querySelector('#mini-clock')).display, nowVis: document.querySelector('[data-card="now"]').offsetParent!==null}));
  console.log('обычный:', JSON.stringify(N));
  await p.screenshot({path:SP+'v19_normal.png'});
  await p.evaluate(()=>App.go('day')); await p.waitForTimeout(500);
  const D3 = await p.evaluate(()=>({rows: document.querySelectorAll('.wk-row').length, more: !!document.querySelector('#wk-more')}));
  console.log('день обычный:', JSON.stringify(D3));
  const hs2 = await p.evaluate(()=>document.documentElement.scrollWidth > innerWidth+1);
  console.log('гориз. скролл:', hs1, hs2);
  console.log('ошибки:', errors.length?JSON.stringify(errors):'нет');
  await b.close();
})();
