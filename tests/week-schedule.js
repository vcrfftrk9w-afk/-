const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage();
  const errors=[]; p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(1500);
  await p.evaluate(()=>{ State.s.onboarded=true; State.save(); });
  await p.reload(); await p.waitForTimeout(1800);
  const r = await p.evaluate(()=>{
    document.querySelectorAll('.modal:not(.hidden)').forEach(m=>m.classList.add('hidden'));
    Week.install();
    const names={0:'Вс',1:'Пн',2:'Вт',3:'Ср',4:'Чт',5:'Пт',6:'Сб'};
    const realDow = new Date().getDay();
    const out=[];
    [1,2,3,4,5,6,0].forEach(d=>{
      // подменяем день недели для расчёта
      const origDay = Date.prototype.getDay;
      Date.prototype.getDay = function(){ return d; };
      try {
        State.s.tasks = [];
        State.s.day = {};
        Track.wake(7*60);
        DayTpl.apply({quiet:true});
        Planner.build({});
        const blocks = Planner.blocks();
        const pairs = blocks.find(x=>x.id==='week-pairs');
        const tasks = blocks.filter(x=>x.kind==='task');
        const clash = pairs ? tasks.filter(t=>t.start<pairs.end && t.end>pairs.start).length : 0;
        let inPlace=0, withPrefer=0, maxDrift=0;
        tasks.forEach(t=>{
          const src=State.s.tasks.find(x=>x.id===t.taskId);
          if(!src || src.prefer==null) return;
          withPrefer++;
          const off=Math.abs(t.start-src.prefer);
          if(off<=20) inPlace++;
          if(off>maxDrift) maxDrift=off;
        });
        out.push({ день:names[d], дел:tasks.length,
          пары: pairs?`${Track.hhmm(pairs.start)}–${Track.hhmm(pairs.end)}`:'—',
          наложений:clash, вЧас:`${inPlace}/${withPrefer}`, максСдвиг:maxDrift,
          неВлезло: Planner.unplaced().length });
      } finally { Date.prototype.getDay = origDay; }
    });
    return out;
  });
  console.log('день  пары          дел  наложений  в свой час  макс.сдвиг  не влезло');
  r.forEach(x=>console.log(`${x.день.padEnd(5)} ${x.пары.padEnd(13)} ${String(x.дел).padStart(3)}  ${String(x.наложений).padStart(9)}  ${x.вЧас.padStart(10)}  ${String(x.максСдвиг+' мин').padStart(10)}  ${String(x.неВлезло).padStart(9)}`));
  const bad = r.filter(x=>x.наложений>0 || x.неВлезло>0 || x.максСдвиг>45);
  console.log(bad.length ? '\n✗ проблемы: '+JSON.stringify(bad) : '\n✓ все семь дней складываются чисто');
  console.log('ошибки:', errors.length?JSON.stringify(errors):'нет');
  await b.close();
})();
