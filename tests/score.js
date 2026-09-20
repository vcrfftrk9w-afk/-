const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage();
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(1500);
  await p.evaluate(()=>{ State.s.onboarded=true; Track.profile().set=true; State.save(); });
  await p.reload(); await p.waitForTimeout(1600);
  const r = await p.evaluate(()=>{
    const out={};
    // Сценарий A: первый день, человек всё сделал, но вчерашней ночи нет
    Track.wake(Track.profile().wakeTarget);
    Track.water(8,true); [1,2,3].forEach(()=>Track.meal(500,'Еда')); Track.workout(40,true);
    const a = Track.score();
    out['A. первый день, всё сделано'] = { v:a.value, пропущено:a.parts.filter(x=>x.na).map(x=>x.id) };
    // Сценарий B: то же, но вчера есть — сон 8 ч
    const y = State.daysAgoKey(1);
    State.s.day[y] = { wakeAt:420, sleepAt:1380, water:8, coffee:0, meals:[], pills:{}, busy:[], workout:0, closed:true };
    const b2 = Track.score();
    out['B. есть вчерашняя ночь'] = { v:b2.value, пропущено:b2.parts.filter(x=>x.na).map(x=>x.id) };
    // Сценарий C: утро, только проснулся, ещё ничего не успел
    const k = State.todayKey();
    State.s.day[k] = { wakeAt: Track.nowMin()-30, sleepAt:null, water:0, coffee:0, meals:[], pills:{}, busy:[], workout:0, closed:false };
    const c = Track.score();
    out['C. проснулся 30 мин назад'] = { v:c.value, пропущено:c.parts.filter(x=>x.na).map(x=>x.id) };
    // Сценарий D: вечер, ничего не делал
    State.s.day[k] = { wakeAt: 420, sleepAt:null, water:0, coffee:0, meals:[], pills:{}, busy:[], workout:0, closed:false };
    const d = Track.score();
    out['D. весь день ничего'] = { v:d.value, пропущено:d.parts.filter(x=>x.na).map(x=>x.id) };
    // Сценарий E: реальное утро — подъём точно по цели 30 минут назад
    Track.profile().wakeTarget = Track.nowMin()-30;
    State.s.day[k] = { wakeAt: Track.nowMin()-30, sleepAt:null, water:0, coffee:0, meals:[], pills:{}, busy:[], workout:0, closed:false };
    const e = Track.score();
    out['E. подъём по цели, 30 мин назад'] = { v:e.value, пропущено:e.parts.filter(x=>x.na).map(x=>x.id) };
    // Сценарий F: то же, но прошло 6 часов и ничего не сделано
    State.s.day[k].wakeAt = Track.nowMin()-360; Track.profile().wakeTarget = Track.nowMin()-360;
    const f = Track.score();
    out['F. 6 часов на ногах, ничего'] = { v:f.value, пропущено:f.parts.filter(x=>x.na).map(x=>x.id) };
    return out;
  });
  Object.entries(r).forEach(([k,v])=>console.log(`  ${k}: ${v.v}/100  (не учтено: ${v.пропущено.length?v.пропущено.join(', '):'—'})`));
  await b.close();
})();
