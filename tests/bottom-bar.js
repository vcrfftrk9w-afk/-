const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const errs=[];
  for (const cfg of [
    {name:'обычный', a11y:{font:'default',scale:'md',contrast:false}, vp:{width:390,height:844}},
    {name:'крупный шрифт', a11y:{font:'lexend',scale:'xl',contrast:true}, vp:{width:390,height:844}},
    {name:'узкий экран', a11y:{font:'default',scale:'lg',contrast:false}, vp:{width:320,height:568}},
    {name:'планшет', a11y:{font:'default',scale:'md',contrast:false}, vp:{width:720,height:1000}},
  ]) {
    const p = await b.newPage({viewport:cfg.vp, hasTouch:true, isMobile:true});
    p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(1400);
    await p.evaluate((a)=>{ State.s.onboarded=true; Track.profile().set=true; State.s.a11y=a; State.save(); }, cfg.a11y);
    await p.reload(); await p.waitForTimeout(1800);
    await p.evaluate(()=>document.querySelectorAll('.modal:not(.hidden)').forEach(m=>m.classList.add('hidden')));
    await p.waitForTimeout(500);
    const r = await p.evaluate(()=>{
      const mp=document.querySelector('#mini-player').getBoundingClientRect();
      const tb=document.querySelector('.tabbar').getBoundingClientRect();
      const blocked=[];
      document.querySelectorAll('.tab-btn').forEach(btn=>{
        if (btn.offsetParent===null) return;
        const r=btn.getBoundingClientRect(); if(r.width===0) return;
        const hit=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
        if (hit && !btn.contains(hit) && hit!==btn) blocked.push(btn.dataset.tab||'ещё');
      });
      // последняя карточка контента не скрыта под панелью?
      const panel=document.querySelector('.tab-panel.active');
      const last=panel && panel.lastElementChild;
      const lastHidden = last ? last.getBoundingClientRect().bottom > tb.top + 4 && last.getBoundingClientRect().top < tb.top : false;
      return { зазор: Math.round(tb.top - mp.bottom), заблокировано: blocked,
               высотаПанели: Math.round(tb.height),
               tabbarH: getComputedStyle(document.documentElement).getPropertyValue('--tabbar-h').trim() };
    });
    console.log(`${cfg.name.padEnd(15)} панель ${r.высотаПанели}px (--tabbar-h: ${r.tabbarH}), зазор до плеера ${r.зазор}px, заблокировано: ${r.заблокировано.length?r.заблокировано.join(','):'ничего ✓'}`);
    await p.close();
  }
  console.log('\nошибки:', errs.length?JSON.stringify(errs):'нет');
  await b.close();
})();
