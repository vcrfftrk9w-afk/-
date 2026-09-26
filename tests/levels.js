const { chromium } = require('playwright');
// Уровни «Моих дел»: старт — 2 дела; все дела N дней подряд → новый уровень; пропуск — счёт заново.
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  let ok = true; const check=(n,c,i)=>{ console.log((c?'✓ ':'✗ ')+n, i!==undefined?JSON.stringify(i).slice(0,260):''); if(!c) ok=false; };
  const ctx = await b.newContext({ viewport:{width:393,height:793} });
  await ctx.addInitScript(()=>{ const R=Date; let off=0; window.__day=(iso)=>{ off=new R(iso+'T18:00:00').getTime()-R.now(); }; window.__day('2026-09-28');
    class FD extends R{constructor(...a){a.length?super(...a):super(R.now()+off)} static now(){return R.now()+off}} window.Date=FD;
    window.speechSynthesis && Object.defineProperty(window,'speechSynthesis',{configurable:true,get:()=>({speak(){},cancel(){},getVoices:()=>[]})}); });
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(700);
  await p.evaluate(()=>{ State.s.onboarded=true; delete State.s.space; delete State.s.lvl; State.save(); }); await p.reload(); await p.waitForTimeout(2500);
  await p.evaluate(()=>document.querySelectorAll('.modal.modal-open').forEach(m=>UI.closeModal('#'+m.id)));
  const titles = () => p.evaluate(()=>[...document.querySelectorAll('#mytasks-root .mt-list .mt-main b')].map(x=>x.textContent.trim()));
  const day = async (iso) => { await p.evaluate((d)=>{ window.__day(d); App.renderActive(); }, iso); await p.waitForTimeout(150); };
  const doAll = () => p.evaluate(()=>{ Levels.questsAt(Levels.levelOn(State.todayKey())).forEach(id=>Levels.complete(id)); document.querySelectorAll('.modal.modal-open').forEach(m=>{m.classList.add('hidden');m.classList.remove('modal-open');}); App.renderActive(); });
  const info = () => p.evaluate(()=>({ lvl: Levels.state().level+1, streak: Levels.streak(), today: Levels.questsAt(Levels.levelOn(State.todayKey())) }));

  check('старт: только TikTok кино и orca', JSON.stringify(await titles())===JSON.stringify(['🎞️ TikTok · кино','🐋 TikTok · orca']), await titles());
  await doAll(); check('день 1 засчитан: серия 1', (await info()).streak===1, await info());
  await day('2026-09-29'); await doAll();
  let I = await info(); check('2 дня подряд → уровень 2', I.lvl===2, I);
  check('новое открывается со следующего дня', !I.today.includes('train'), I.today);
  await day('2026-09-30'); I = await info();
  check('на следующий день — тренировка 5 отжиманий', I.today.includes('train') && /5 отжиманий/.test(await p.evaluate(()=>document.querySelector('#mytasks-root').textContent)), I.today);
  // пропуск: 1 день сделал, следующий нет → счёт уровня заново
  await doAll(); await day('2026-10-01'); /* пропускаем */ await day('2026-10-02');
  I = await info(); check('пропустил день — серия 0, уровень не падает', I.streak===0 && I.lvl===2, I);
  for (const d of ['2026-10-02','2026-10-03','2026-10-04','2026-10-05']) { await day(d); await doAll(); }
  I = await info(); check('4 дня подряд → уровень 3 (YouTube, тренировка труднее)', I.lvl===3, I);
  await day('2026-10-06');
  const txt = await p.evaluate(()=>document.querySelector('#mytasks-root').textContent);
  check('уровень 3: YouTube + 10 отжиманий, 5 приседаний', /YouTube/.test(txt) && /10 отжиманий, 5 приседаний/.test(txt));
  // ▶ тренировка — сессия с шагами
  await p.evaluate(()=>document.querySelector('[data-lvgo="train"]').click()); await p.waitForTimeout(300);
  const run = await p.evaluate(()=>({ running: Coach.running, steps: document.querySelector('.run-top span').textContent }));
  check('▶ тренировка — пошаговая сессия', run.running && /Тренировка · уровень 3/.test(run.steps), run);
  await p.evaluate(()=>{ for (let i=0;i<8;i++){ const b=document.querySelector('[data-run="next"]'); if(b) b.click(); } }); await p.waitForTimeout(400);
  check('после сессии тренировка засчитана', await p.evaluate(()=>Levels.isDone('train')));
  check('лестница уровней видна', await p.evaluate(()=>document.querySelectorAll('.lv-road li').length)===8);
  check('без ошибок', !errs.length, errs);
  console.log(ok ? '\n✓ уровни работают' : '\n✗ есть проблемы');
  await b.close();
})();
