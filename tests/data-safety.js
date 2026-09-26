const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const ctx = await b.newContext();
  const p1 = await ctx.newPage();
  const errors=[]; p1.on('pageerror',e=>errors.push('P1: '+e.message));
  await p1.goto('http://localhost:8792/index.html'); await p1.waitForTimeout(1500);
  await p1.evaluate(()=>{ State.s.onboarded=true; Track.profile().set=true;
    Screens.tasks.add('Важная задача из первой вкладки','work','boss',false);
    Track.wake(8*60); Track.water(5); State.save(); });
  await p1.reload(); await p1.waitForTimeout(1600);

  console.log('=== ДВЕ ВКЛАДКИ ===');
  const p2 = await ctx.newPage();
  p2.on('pageerror',e=>errors.push('P2: '+e.message));
  await p2.goto('http://localhost:8792/index.html'); await p2.waitForTimeout(1800);
  // во второй вкладке добавляем своё
  await p2.evaluate(()=>{ document.querySelectorAll('.modal:not(.hidden)').forEach(m=>m.classList.add('hidden'));
    Screens.tasks.add('Задача из второй вкладки','work','mid',false); Track.water(3); });
  await p2.waitForTimeout(600);
  // в первой вкладке что-то делаем — она перезапишет состояние своей копией
  await p1.evaluate(()=>{ document.querySelectorAll('.modal:not(.hidden)').forEach(m=>m.classList.add('hidden'));
    Screens.tasks.add('Ещё одна из первой','work','low',false); });
  await p1.waitForTimeout(600);
  const stored = await p1.evaluate(()=>{ const s=JSON.parse(localStorage.getItem(State.KEY));
    return { tasks:s.tasks.map(t=>t.title), water:s.day[Object.keys(s.day)[0]].water }; });
  console.log('  в хранилище:', JSON.stringify(stored.tasks), '| вода:', stored.water);
  const lost = !stored.tasks.some(t=>t.includes('второй вкладки'));
  console.log(lost ? '  ✗ БАГ: правка из второй вкладки потеряна' : '  ✓ обе вкладки сохранились');

  console.log('\n=== ПОРЧА ХРАНИЛИЩА ===');
  const r = await p1.evaluate(()=>{
    const good = localStorage.getItem(State.KEY);
    localStorage.setItem(State.KEY, '{это не json');
    let res;
    try { State.load(); res = { ok:true, tasks:State.s.tasks.length, name:State.s.name }; }
    catch(e){ res = { ok:false, err:e.message }; }
    localStorage.setItem(State.KEY, good);
    return res;
  });
  console.log('  битый json:', r.ok ? `не упало, но прогресс обнулён (задач: ${r.tasks})` : 'УПАЛО: '+r.err);
  console.log('  ', r.ok && r.tasks===0 ? '✗ БАГ: испорченное хранилище стирает весь прогресс без следа' : '✓');

  console.log('\nОШИБКИ:', errors.length?JSON.stringify(errors):'нет');
  await b.close();
})();
