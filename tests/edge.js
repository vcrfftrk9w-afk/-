const { chromium } = require('./_browser');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({viewport:{width:1280,height:1000}});
  const errors=[]; p.on('pageerror',e=>errors.push('PAGEERROR: '+e.message));
  p.on('console',m=>{ if(m.type()==='error'&&!m.text().includes('ERR_')&&!m.text().includes('Failed to load')) errors.push('CONSOLE: '+m.text()); });
  const hide=()=>p.evaluate(()=>{document.querySelectorAll('.modal:not(.hidden)').forEach(m=>{m.classList.add('hidden');m.classList.remove('modal-open');});document.body.classList.remove('modal-lock');});
  const R=[];
  const check=(name,ok,info)=>{ R.push({name,ok,info}); console.log(`  ${ok?'✓':'✗ БАГ'}  ${name}${info?' — '+info:''}`); };

  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(1500);
  await p.evaluate(()=>{ State.s.onboarded=true; Track.profile().set=true; State.save(); });
  await p.reload(); await p.waitForTimeout(1700); await hide();

  console.log('=== ГРАНИЧНЫЕ СЛУЧАИ ===');

  // 1. Весь день занят — планировщик не падает
  let r = await p.evaluate(()=>{
    Track.wake(8*60);
    Screens.tasks.add('Задача','work','boss',false,{estimate:60});
    Track.addBusy('Работа','08:00','23:00');
    try { Planner.build({}); return {ok:true, tasks:Planner.blocks().filter(b=>b.kind==='task').length}; }
    catch(e){ return {ok:false, err:e.message}; }
  });
  check('весь день занят — план строится', r.ok, r.ok?`задач размещено: ${r.tasks}`:r.err);

  // 2. Задача с нулевой/огромной длительностью
  r = await p.evaluate(()=>{
    State.s.day[State.todayKey()].busy=[];
    Screens.tasks.add('Ноль','work','mid',false,{estimate:0});
    Screens.tasks.add('Огромная','work','mid',false,{estimate:9999});
    Planner.build({});
    const z=Planner.blocks().find(b=>b.title==='Ноль'), h=Planner.blocks().find(b=>b.title==='Огромная');
    return { zero: z?z.end-z.start:null, huge: h?h.end-h.start:null };
  });
  check('длительность 0 не ломает', r.zero===null||r.zero>=10, `0 → ${r.zero} мин`);
  check('длительность 9999 ограничена', r.huge===null||r.huge<=240, `9999 → ${r.huge} мин`);

  // 3. Деньги: абсурдные значения
  r = await p.evaluate(()=>{
    Path.setMoney({income:-500, expenses:'abc', cushion:1e15, capital:null});
    const m=Path.money(); const c=Path.calc();
    return { m, free:c.free, years:c.yearsToFreedom, finite: Number.isFinite(c.freedomNumber) };
  });
  check('отрицательный доход → 0', r.m.income===0, JSON.stringify(r.m));
  check('нечисловой расход → 0', r.m.expenses===0);
  check('расчёт остаётся конечным', r.finite && (r.years===null||Number.isFinite(r.years)), `лет: ${r.years}`);

  // 4. Удалённая задача, на которую ссылается блок плана
  r = await p.evaluate(()=>{
    Path.setMoney({income:80000,expenses:55000,cushion:0,capital:0});
    Planner.build({});
    const blk = Planner.blocks().find(b=>b.kind==='task'&&b.taskId);
    State.s.tasks = State.s.tasks.filter(t=>t.id!==blk.taskId);
    State.commit();
    try { const done=Planner.isDone(blk); const pr=Planner.progress(); Screens.day.render();
      return {ok:true, done, pr}; } catch(e){ return {ok:false, err:e.message}; }
  });
  check('удалённая задача не ломает план', r.ok, r.ok?`isDone=${r.done}`:r.err);

  // 5. Сброс пути при живом плане со ссылкой на шаг
  r = await p.evaluate(()=>{
    Planner.build({});
    const has = Planner.blocks().some(b=>b.pathId);
    State.s.path={done:{},claimed:{},startedAt:null,stage:0};
    State.commit();
    try { Screens.day.render(); Screens.path.render(); return {ok:true, has}; } catch(e){ return {ok:false,err:e.message}; }
  });
  check('сброс пути при живом плане', r.ok, r.ok?'':r.err);

  // 6. Экспорт/импорт со всем новым состоянием
  r = await p.evaluate(()=>{
    Track.water(3); Track.meal(600,'Обед'); DayTpl.apply({quiet:true});
    const before = { water: Track.today().water, tpl: DayTpl.items().length, money: Path.money().income,
                     profile: Track.profile().wakeTarget, tasks: State.s.tasks.length };
    const dump = JSON.stringify(State.s);
    State.reset();
    State.replace(JSON.parse(dump));
    const after = { water: Track.today().water, tpl: DayTpl.items().length, money: Path.money().income,
                    profile: Track.profile().wakeTarget, tasks: State.s.tasks.length };
    return { before, after, same: JSON.stringify(before)===JSON.stringify(after) };
  });
  check('экспорт/импорт сохраняет всё новое', r.same, JSON.stringify(r.after));

  // 7. Залипание поверх открытой модалки
  r = await p.evaluate(()=>{
    UI.sheet('<h2>Тест</h2>');
    Chill.start(5,'Видео',null);
    const chillOpen = !document.querySelector('#chill').classList.contains('hidden');
    const sheetOpen = document.querySelector('#sheet-modal').classList.contains('modal-open');
    Chill.stop(false);
    return { chillOpen, sheetOpen };
  });
  check('залипание открывается поверх модалки', r.chillOpen, `sheet тоже открыт: ${r.sheetOpen}`);
  await hide();

  // 8. Двойной запуск залипания
  r = await p.evaluate(()=>{
    Chill.start(5,'Первое',null);
    Chill.start(5,'Второе',null);
    const title = document.querySelector('#chill-title').textContent;
    Chill.stop(false);
    return { title, open: !document.querySelector('#chill').classList.contains('hidden') };
  });
  check('повторный старт залипания не плодит таймеры', r.title==='Первое' && !r.open, `заголовок: ${r.title}`);
  await hide();

  // 9. Все задачи сделаны — план и разбор не падают
  r = await p.evaluate(()=>{
    State.s.tasks.forEach(t=>{t.done=true;t.doneAt=Date.now();});
    State.s.habits.forEach(h=>{h.history[State.todayKey()]=true;});
    State.commit();
    try { Planner.build({}); const v=Verdict.decide(); Screens.day.render();
      return {ok:true, top:v.top.title, blocks:Planner.blocks().length}; } catch(e){ return {ok:false,err:e.message}; }
  });
  check('всё сделано — разбор работает', r.ok, r.ok?`главное: «${r.top}»`:r.err);

  // 10. Смена дня: план вчерашний
  r = await p.evaluate(()=>{
    State.s.plan.date = State.daysAgoKey(1);
    return { plan: Planner.plan(), blocks: Planner.blocks().length, prog: Planner.progress() };
  });
  check('вчерашний план не считается сегодняшним', r.plan===null && r.blocks===0, `блоков: ${r.blocks}`);

  console.log('\n=== ОШИБКИ В КОНСОЛИ ===');
  console.log(errors.length ? JSON.stringify(errors,null,1) : '  нет');
  const bad = R.filter(x=>!x.ok);
  console.log(`\nИТОГ: ${R.length-bad.length}/${R.length} проверок прошло`);
  await b.close();
})();
