const { chromium } = require('./_browser');
// Главная: только главные дела, у каждого ▶ — сразу сессия со звуком и голосом.
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  let ok = true; const check=(n,c,i)=>{ console.log((c?'✓ ':'✗ ')+n, i!==undefined?JSON.stringify(i).slice(0,220):''); if(!c) ok=false; };
  const open = async (iso) => {
    const p = await b.newPage({viewport:{width:360,height:780}});
    p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message));
    await p.addInitScript((iso)=>{ const R=Date,f=new R(iso).getTime(),s=R.now(); class FD extends R{constructor(...a){a.length?super(...a):super(f+R.now()-s)} static now(){return f+R.now()-s}} window.Date=FD;
      window.__said=[]; Object.defineProperty(window,'speechSynthesis',{configurable:true, get:()=>({ speak:(u)=>window.__said.push(u.text), cancel:()=>{}, getVoices:()=>[] })}); window.SpeechSynthesisUtterance=function(t){this.text=t;};
      window.__sfx=[]; }, iso);
    await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(700);
    await p.evaluate(()=>{ State.s.onboarded=true; State.s.space='all'; State.s.mode='adhd'; State.save(); }); await p.reload(); await p.waitForTimeout(2300);
    await p.evaluate(()=>{ document.querySelectorAll('.modal.modal-open').forEach(m=>UI.closeModal('#'+m.id)); const o=Sound.sfx; Sound.sfx=(n)=>{ window.__sfx.push(n); return o(n); }; });
    await p.waitForTimeout(300);
    return p;
  };
  // Пн 16:05 — тренировка идёт
  let p = await open('2026-09-21T16:05:00');
  const home = await p.evaluate(()=>({ now: getComputedStyle(document.querySelector('[data-card="now"]')).display,
    titles: [...document.querySelectorAll('#main-today .mt-list .mt-main b')].map(x=>x.textContent.trim()), live: (document.querySelector('.mt-row.now b')||{}).textContent }));
  check('большой карточки «Сейчас» на главной нет', home.now==='none');
  check('в списке только главные дела', home.titles.every(t=>!/Проверить|Задания по учёбе|Собрать вещи|Смонтировать/.test(t)) && home.titles.length>=4, home.titles);
  check('текущее дело подсвечено', /Тренировка/.test(home.live||''), home.live);
  await p.evaluate(()=>document.querySelector('.mt-row.now [data-mgo]').click()); await p.waitForTimeout(400);
  const R = await p.evaluate(()=>({ run: Coach.running, title: (document.querySelector('.run-title')||{}).textContent, said: window.__said.slice(), sfx: window.__sfx.slice() }));
  check('▶ на тренировке — сразу пошаговая тренировка', R.run && /Шаг на месте/.test(R.title||''), R.title);
  check('старт со звуком и голосом', R.sfx.includes('fanfare') && /Начинаем/.test(R.said[0]||''), [R.sfx, R.said[0]]);
  await p.click('[data-run="next"]'); await p.waitForTimeout(200);
  check('каждый шаг озвучивается', (await p.evaluate(()=>window.__said.length))>=2);
  check('без ошибок (тренировка)', !p.errs.length, p.errs); await p.close();
  // Вт 08:05 — английский: три таймера
  p = await open('2026-09-22T08:05:00');
  await p.evaluate(()=>document.querySelector('.mt-row.now [data-mgo]').click()); await p.waitForTimeout(400);
  const E = await p.evaluate(()=>({ title: (document.querySelector('.run-title')||{}).textContent, clock: (document.querySelector('#run-left')||{}).textContent, steps: document.querySelector('.run-top span').textContent }));
  check('▶ на английском — 3 шага с таймером 10 минут', /Повторить слова/.test(E.title) && E.clock==='10:00' && /из 3/.test(E.steps), E);
  await p.evaluate(()=>{ for(let i=0;i<3;i++) document.querySelector('[data-run="next"]').click(); }); await p.waitForTimeout(500);
  check('после сессии английский отмечен сделанным', await p.evaluate(()=>State.s.tasks.some(t=>t.title==='Английский'&&t.done)));
  check('без ошибок (английский)', !p.errs.length, p.errs); await p.close();
  // 19:50 — публикация кино: чек-лист
  p = await open('2026-09-22T19:56:00');
  await p.evaluate(()=>document.querySelector('.mt-row.now [data-mgo]').click()); await p.waitForTimeout(400);
  const P = await p.evaluate(()=>(document.querySelector('.run-title')||{}).textContent);
  check('▶ на публикации — чек-лист загрузки', /Открой TikTok/.test(P||''), P);
  check('без ошибок (публикация)', !p.errs.length, p.errs); await p.close();
  // вечер: пропущенное свёрнуто
  p = await open('2026-09-22T20:40:00');
  const L = await p.evaluate(()=>({ fold: (document.querySelector('#main-late')||{}).textContent, first: (document.querySelector('#main-today .mt-row b')||{}).textContent }));
  check('пропущенное свёрнуто в одну строку, сверху — текущее', /Пропущено/.test(L.fold||'') && /ИИ|orca/.test(L.first||''), L);
  await p.close();
  // внутри просмотрщика Claude вкладки закреплены сверху и видны
  p = await b.newPage({viewport:{width:320,height:640}});
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(600);
  await p.evaluate(()=>{ State.s.onboarded=true; State.s.space='all'; State.save(); });
  await p.setContent('<style>body{margin:0}</style><iframe src="http://localhost:8792/index.html" style="border:0;width:320px;height:640px"></iframe>');
  await p.waitForTimeout(3500);
  const fr = p.frames()[1];
  const T = await fr.evaluate(()=>{ window.scrollTo(0, 600); const r=document.querySelector('.tabbar').getBoundingClientRect(); return { inFrame: document.body.classList.contains('in-frame'), top: Math.round(r.top), h: Math.round(r.height), labels: [...document.querySelectorAll('.tab-btn')].filter(x=>x.offsetParent).length, err: (State.s.errLog||[]).length }; });
  check('в рамке вкладки прилипают сверху и видны при прокрутке', T.inFrame && T.top >= 0 && T.top < 5 && T.h > 40 && T.labels === 6, T);
  check('в рамке журнал ошибок пуст', T.err === 0, T.err);
  await p.close();
  console.log(ok ? '\n✓ главная и кнопки «Начать» работают' : '\n✗ есть проблемы');
  await b.close();
})();
