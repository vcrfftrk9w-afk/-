const { chromium } = require('./_browser');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const errs=[];
  for (const [t, expect] of [['2026-09-21T23:10','sleep'],['2026-09-22T02:30','sleep'],['2026-09-22T06:45','between'],['2026-09-22T12:00','any']]) {
    const p = await b.newPage({viewport:{width:390,height:844}});
    p.on('pageerror',e=>errs.push(e.message));
    await p.addInitScript((iso)=>{ const R=Date, f=new R(iso).getTime(), s=R.now(); class FD extends R{constructor(...a){a.length?super(...a):super(f+R.now()-s)} static now(){return f+R.now()-s}} window.Date=FD; }, t);
    await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(800);
    await p.evaluate(()=>{ State.s.onboarded=true; State.s.mode='adhd'; State.save(); }); await p.reload(); await p.waitForTimeout(2300);
    const r = await p.evaluate(()=>({k: Modes.target().kind, clock: document.querySelector('#mini-clock').classList.contains('hidden'), first: (document.querySelector('#main-today .mt-row b, #main-today .mt-empty')||{}).textContent}));
    console.log(t, JSON.stringify(r), expect==='any' || r.k===expect ? '✓' : '✗');
    // ночью часы в плеере не тикают до утра
    if (expect==='sleep') console.log('  часы в плеере скрыты ночью →', r.clock ? '✓' : '✗');
    // отбой после полуночи — днём не «ночь»
    if (t.endsWith('12:00')) console.log('  отбой 01:00, полдень →', await p.evaluate(()=>{ Track.profile().sleepTarget=60; Track.profile().weekStudy=false; return Modes.target().kind; }));
    await p.close();
  }
  console.log('errors', errs);
  await b.close();
})();
