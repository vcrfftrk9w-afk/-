const { chromium } = require('playwright');
// Два окна: «Мои дела» (только названные главными) и «Всё остальное» (всё приложение).
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  let ok = true; const check=(n,c,i)=>{ console.log((c?'✓ ':'✗ ')+n, i!==undefined?JSON.stringify(i).slice(0,240):''); if(!c) ok=false; };
  const p = await b.newPage({viewport:{width:393,height:793}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(()=>{ const R=Date,f=new R('2026-09-28T16:05:00').getTime(),s=R.now(); class FD extends R{constructor(...a){a.length?super(...a):super(f+R.now()-s)} static now(){return f+R.now()-s}} window.Date=FD; });
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(700);
  await p.evaluate(()=>{ State.s.onboarded=true; delete State.s.space; State.save(); }); await p.reload(); await p.waitForTimeout(2600);
  await p.evaluate(()=>document.querySelectorAll('.modal.modal-open').forEach(m=>UI.closeModal('#'+m.id)));
  const A = await p.evaluate(()=>({ space: document.body.dataset.space, panel: document.querySelector('.tab-panel.active').id,
    tabbar: getComputedStyle(document.querySelector('.tabbar')).display, pills: getComputedStyle(document.querySelector('.stat-pills')).display,
    titles: [...document.querySelectorAll('#mytasks-root .mt-main b')].map(x=>x.textContent.trim()) }));
  check('по умолчанию открывается окно «Мои дела»', A.space==='tasks' && A.panel==='tab-mytasks', A);
  check('в окне «Мои дела» нет вкладок и счётчиков', A.tabbar==='none' && A.pills==='none');
  check('в окне только названные дела', A.titles.length>=8 && A.titles.every(t=>/Тренировка|Готовка|TikTok|ИИ|Английский|YouTube|видео|OLX|Заработок|Прогулка/.test(t)), A.titles);
  await p.evaluate(()=>document.querySelector('.wk-chip[data-myday="3"]').click()); await p.waitForTimeout(200);
  check('по дням: в среду видно свои дела и время', await p.evaluate(()=>document.querySelectorAll('.my-plan li').length>=8));
  await p.evaluate(()=>document.querySelector('.space-btn[data-space="all"]').click()); await p.waitForTimeout(600);
  const B = await p.evaluate(()=>({ space: document.body.dataset.space, panel: document.querySelector('.tab-panel.active').id, tabbar: getComputedStyle(document.querySelector('.tabbar')).display, cards: document.querySelectorAll('.grid-dash > .card').length }));
  check('окно «Всё остальное» — всё приложение с вкладками', B.space==='all' && B.panel==='tab-dashboard' && B.tabbar!=='none' && B.cards>=15, B);
  await p.evaluate(()=>App.go('habits')); await p.waitForTimeout(300);
  await p.evaluate(()=>document.querySelector('.space-btn[data-space="tasks"]').click()); await p.waitForTimeout(300);
  await p.evaluate(()=>document.querySelector('.space-btn[data-space="all"]').click()); await p.waitForTimeout(300);
  check('возврат во «Всё остальное» — на ту же вкладку', await p.evaluate(()=>document.querySelector('.tab-panel.active').id)==='tab-habits');
  await p.reload(); await p.waitForTimeout(2600);
  check('окно запоминается после перезагрузки', await p.evaluate(()=>document.body.dataset.space)==='all');
  check('без ошибок', !errs.length, errs);
  console.log(ok ? '\n✓ два окна работают' : '\n✗ есть проблемы');
  await b.close();
})();
