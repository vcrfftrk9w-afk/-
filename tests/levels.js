const { chromium } = require('./_browser');
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
  I = await info(); check('4 дня подряд → уровень 3 «Сила» (тренировка труднее)', I.lvl===3, I);
  await day('2026-10-06');
  const txt = await p.evaluate(()=>document.querySelector('#mytasks-root .mt-list').textContent);
  check('уровень 3: YouTube нет, тренировка 10 отжиманий, 5 приседаний', !/YouTube/.test(txt) && /10 отжиманий, 5 приседаний/.test(txt), txt.replace(/\s+/g,' ').slice(0,200));
  // ▶ тренировка — сессия с шагами
  await p.evaluate(()=>document.querySelector('[data-lvgo="train"]').click()); await p.waitForTimeout(300);
  const run = await p.evaluate(()=>({ running: Coach.running, steps: document.querySelector('.run-top span').textContent }));
  check('▶ тренировка — пошаговая сессия', run.running && /Тренировка · уровень 3/.test(run.steps), run);
  await p.evaluate(()=>{ for (let i=0;i<8;i++){ const b=document.querySelector('[data-run="next"]'); if(b) b.click(); } }); await p.waitForTimeout(400);
  check('после сессии тренировка засчитана', await p.evaluate(()=>Levels.isDone('train')));
  check('лестница уровней видна', await p.evaluate(()=>document.querySelectorAll('.lv-road li').length)===9);
  const road = await p.evaluate(()=>[...document.querySelectorAll('.lv-road li')].map(li=>li.textContent.replace(/\s+/g,' ').trim()));
  check('в лестнице: 4 — тишина и танец из TikTok, 5 — YouTube', /Ур\. 4.*Тишина без телефона.*1 минута, потом сама растёт до 5.*Танец из TikTok.*повтори хотя бы 1 видео/.test(road[2]) && /Ур\. 5.*YouTube/.test(road[3]), road.slice(1,4));

  // --- 10 дней подряд на 3-м уровне → 4-й: тишина без телефона и танец из TikTok ---
  for (let d = 7; d <= 16; d++) { await day(`2026-10-${String(d).padStart(2,'0')}`); await doAll(); }
  I = await info(); check('10 дней подряд → уровень 4 «Тишина и танец»', I.lvl===4 && !I.today.includes('silence'), I);
  await day('2026-10-17'); I = await info();
  const t4 = await p.evaluate(()=>document.querySelector('#mytasks-root .mt-list').textContent.replace(/\s+/g,' '));
  check('на следующий день — 🧘 тишина 1 минута и 💃 танец из TikTok', I.today.includes('silence') && I.today.includes('dance') && !I.today.includes('youtube') && /Тишина без телефона/.test(t4) && /1 минута · телефон экраном вниз/.test(t4) && /Танец из TikTok/.test(t4) && /повтори хотя бы 1 видео/.test(t4), t4.slice(0,300));
  // ▶ танец: подсказка, ссылка на TikTok, «Повторил ✓»
  await p.evaluate(()=>document.querySelector('[data-lvgo="dance"]').click()); await p.waitForTimeout(300);
  const dance = await p.evaluate(()=>({ txt: document.querySelector('#sheet-modal').textContent.replace(/\s+/g,' '), href: (document.querySelector('#sheet-modal a[href*="tiktok.com"]')||{}).href }));
  check('▶ танец — как повторять, кнопка «Открыть TikTok»', /0\.5x/.test(dance.txt) && /хотя бы 1 видео целиком/.test(dance.txt) && /tiktok\.com/.test(dance.href||''), dance);
  await p.evaluate(()=>document.querySelector('#lv-dance-done').click()); await p.waitForTimeout(300);
  check('«Повторил ✓» — танец засчитан', await p.evaluate(()=>Levels.isDone('dance')));
  // ▶ тишина — таймер на 1 минуту
  await p.evaluate(()=>document.querySelector('[data-lvgo="silence"]').click()); await p.waitForTimeout(300);
  const sil = await p.evaluate(()=>({ running: Coach.running, title: document.querySelector('.run-top span').textContent }));
  check('▶ тишина — таймер «Тишина · 1 минута»', sil.running && /Тишина · 1 минута/.test(sil.title), sil);
  await p.evaluate(()=>{ for (let i=0;i<4;i++){ const b=document.querySelector('[data-run="next"]'); if(b) b.click(); } }); await p.waitForTimeout(400);
  check('после таймера тишина засчитана', await p.evaluate(()=>Levels.isDone('silence')));
  await doAll(); I = await info(); check('все 5 дел — день засчитан', I.streak===1, I);
  // тишина растёт: каждые 3 сделанных дня +1 минута, не больше 5
  for (const d of ['2026-10-18','2026-10-19']) { await day(d); await doAll(); }
  await day('2026-10-20');
  check('3 дня тишины — теперь 2 минуты', /2 минуты · телефон экраном вниз/.test(await p.evaluate(()=>document.querySelector('#mytasks-root .mt-list').textContent)));
  for (let d = 20; d <= 31; d++) { await day(`2026-10-${d}`); await doAll(); }
  I = await info(); check('15 дней подряд на 4-м → уровень 5', I.lvl===5, I);
  await day('2026-11-01'); I = await info();
  const t5 = await p.evaluate(()=>document.querySelector('#mytasks-root .mt-list').textContent.replace(/\s+/g,' '));
  check('уровень 5: YouTube появился, тишина дошла до 5 минут и дальше не растёт', I.today.includes('youtube') && /YouTube/.test(t5) && /5 минут · телефон экраном вниз/.test(t5), t5.slice(0,400));
  check('без ошибок', !errs.length, errs);
  console.log(ok ? '\n✓ уровни работают' : '\n✗ есть проблемы');
  await b.close();
})();
