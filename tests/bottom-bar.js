const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const errs=[];
  for (const cfg of [
    {name:'обычный', a11y:{font:'default',scale:'md',contrast:false}, vp:{width:390,height:844}},
    {name:'крупный шрифт', a11y:{font:'lexend',scale:'xl',contrast:true}, vp:{width:390,height:844}},
    {name:'узкий экран', a11y:{font:'default',scale:'lg',contrast:false}, vp:{width:320,height:568}},
    {name:'планшет', a11y:{font:'default',scale:'md',contrast:false}, vp:{width:720,height:1000}},
    {name:'светлая тема', a11y:{font:'default',scale:'md',contrast:false}, vp:{width:390,height:844}, theme:'light'},
  ]) {
    const p = await b.newPage({viewport:cfg.vp, hasTouch:true, isMobile:true});
    p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(1400);
    await p.evaluate((a)=>{ State.s.onboarded=true; State.s.space='all'; Track.profile().set=true; State.s.a11y=a.a; State.s.theme=a.t||'dark'; State.save(); }, {a:cfg.a11y, t:cfg.theme});
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
      // все видимые кнопки в одном ряду — иначе «Ещё» уезжает на вторую строку
      const rows = new Set([...document.querySelectorAll('.tab-btn')].filter(x=>x.offsetParent!==null && x.getBoundingClientRect().width>0).map(x=>Math.round(x.getBoundingClientRect().top)));
      // у каждой видимой кнопки есть видимая подпись — иначе внизу одни значки
      const безПодписи = [...document.querySelectorAll('.tab-btn')].filter(x=>x.offsetParent!==null && x.getBoundingClientRect().width>0)
        .filter(x=>{ const e=x.querySelector('em'); return !e || e.getBoundingClientRect().width===0; }).length;
      // активная вкладка читается на фоне панели (в светлой теме была белым по белому)
      const lum=(c)=>{ let m=c.match(/[\d.]+/g).map(Number); if (/^color\(srgb/.test(c)) m=m.map(v=>v*255); const f=v=>{v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)}; return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2]); };
      const act=document.querySelector('.tab-btn.active em');
      let bgc=getComputedStyle(document.querySelector('.tabbar')).backgroundColor;
      const l1=lum(getComputedStyle(act).color), l2=lum(bgc);
      const контраст=Math.round(((Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05))*10)/10;
      return { контраст, зазор: Math.round(tb.top - mp.bottom), заблокировано: blocked, рядов: rows.size, безПодписи,
               высотаПанели: Math.round(tb.height),
               tabbarH: getComputedStyle(document.documentElement).getPropertyValue('--tabbar-h').trim() };
    });
    console.log(`${cfg.name.padEnd(15)} панель ${r.высотаПанели}px (--tabbar-h: ${r.tabbarH}), зазор до плеера ${r.зазор}px, заблокировано: ${r.заблокировано.length?r.заблокировано.join(','):'ничего ✓'}, рядов кнопок: ${r.рядов}${r.рядов===1?' ✓':' ✗'}, активная вкладка ${r.контраст}:1`);
    if (cfg.vp.width <= 760 && r.контраст < 3) errs.push(cfg.name + ': активная вкладка не видна, контраст ' + r.контраст);
    if (r.безПодписи) errs.push(cfg.name + ': кнопок без подписи — ' + r.безПодписи);
    if (r.рядов !== 1) errs.push(cfg.name + ': кнопки панели в ' + r.рядов + ' ряда');
    await p.close();
  }
  console.log('\nошибки:', errs.length?JSON.stringify(errs):'нет');
  await b.close();
})();
