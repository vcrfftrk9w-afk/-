const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({viewport:{width:1280,height:1000}});
  const errors=[]; p.on('pageerror',e=>errors.push('PAGEERROR: '+e.message));
  p.on('console',m=>{ if(m.type()==='error'&&!m.text().includes('ERR_')&&!m.text().includes('Failed to load')) errors.push('CONSOLE: '+m.text()); });
  const hide=()=>p.evaluate(()=>{document.querySelectorAll('.modal:not(.hidden)').forEach(m=>{m.classList.add('hidden');m.classList.remove('modal-open');});document.body.classList.remove('modal-lock');});
  const R=[]; const check=(n,ok,i)=>{R.push(ok);console.log(`  ${ok?'✓':'✗ БАГ'}  ${n}${i?' — '+i:''}`);};
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(1500);
  await p.evaluate(()=>{ State.s.onboarded=true; Track.profile().set=true; State.save(); });
  await p.reload(); await p.waitForTimeout(1700); await hide();

  console.log('=== НЕПОМЕСТИВШЕЕСЯ ===');
  let r = await p.evaluate(()=>{
    Track.wake(8*60);
    ['Отчёт','Звонок','Монтаж','Письмо'].forEach(t=>Screens.tasks.add(t,'work','high',false,{estimate:120}));
    Track.addBusy('Работа','09:00','22:00');
    Planner.build({});
    return { unplaced: Planner.unplaced(), placed: Planner.blocks().filter(b=>b.kind==='task').length };
  });
  check('непоместившееся посчитано', r.unplaced.length>0, `${r.unplaced.length} шт: ${JSON.stringify(r.unplaced.slice(0,3))}`);
  await p.evaluate(()=>App.go('day')); await p.waitForTimeout(600); await hide();
  const card = await p.$('.day-unplaced');
  check('карточка показана пользователю', !!card, card?(await card.textContent()).replace(/\s+/g,' ').trim().slice(0,90):'');
  if (card) await p.locator('.day-unplaced').screenshot({path:require('os').tmpdir()+'/v15_unplaced.png'});

  console.log('\n=== ДЛИННЫЕ СТРОКИ И ПЕРЕПОЛНЕНИЕ ===');
  r = await p.evaluate(()=>{
    State.s.tasks=[]; State.s.day[State.todayKey()].busy=[];
    const long='Оченьдлинноеслововкоторомнетпробеловисовсемнегдепереноситьстроку'.repeat(2);
    Screens.tasks.add(long,'work','mid',false,{estimate:30});
    Screens.tasks.add('Обычная задача с очень длинным названием которое точно не поместится в одну строку на любом экране','work','mid',false);
    State.s.habits.unshift({id:State.uid(),name:long,emoji:'💪',skill:'health',history:{},rewarded:{},createdAt:Date.now()});
    Planner.build({}); State.commit();
    return true;
  });
  for (const tab of ['tasks','day','habits','dashboard']) {
    await p.evaluate((t)=>App.go(t), tab); await p.waitForTimeout(350); await hide();
    const ov = await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    check(`нет горизонтального скролла: ${tab}`, ov===0, ov?`+${ov}px`:'');
  }

  console.log('\n=== МНОГО ДАННЫХ ===');
  r = await p.evaluate(()=>{
    for(let i=0;i<25;i++) State.s.habits.unshift({id:State.uid(),name:'Привычка '+i,emoji:'🔥',skill:'health',history:{},rewarded:{},createdAt:Date.now()});
    for(let i=0;i<40;i++) DayTpl.add({title:'Дело '+i, cat:'work', pri:'mid', est:20});
    State.commit(); return State.s.habits.length;
  });
  for (const tab of ['habits','day']) {
    const t0=Date.now();
    await p.evaluate((t)=>App.go(t), tab); await p.waitForTimeout(400); await hide();
    const ov = await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    check(`${tab} с 25 привычками / 50 делами`, ov===0, `${Date.now()-t0}ms, overflow ${ov}`);
  }

  console.log('\n=== БЫСТРЫЕ КЛИКИ ===');
  await p.evaluate(()=>{ State.s.habits=State.s.habits.slice(0,3); State.s.dayTemplate.items=State.s.dayTemplate.items.slice(0,5); State.commit(); App.go('day'); });
  await p.waitForTimeout(500); await hide();
  r = await p.evaluate(async ()=>{
    const btn=document.querySelector('[data-water="1"]');
    for(let i=0;i<20;i++) btn.click();
    await new Promise(r=>setTimeout(r,300));
    return Track.today().water;
  });
  check('20 быстрых кликов по воде', r>=20, `вода: ${r}`);

  console.log('\n=== ПЕРЕПОЛНЕНИЕ localStorage ===');
  r = await p.evaluate(()=>{
    try {
      const orig = localStorage.setItem.bind(localStorage);
      localStorage.setItem = () => { throw new DOMException('QuotaExceeded','QuotaExceededError'); };
      State.save(); State.commit();
      localStorage.setItem = orig;
      return {ok:true};
    } catch(e){ return {ok:false, err:e.message}; }
  });
  check('переполнение хранилища не роняет приложение', r.ok, r.ok?'':r.err);

  console.log('\n=== ОШИБКИ ==='); console.log(errors.length?JSON.stringify(errors,null,1):'  нет');
  console.log(`\nИТОГ: ${R.filter(Boolean).length}/${R.length}`);
  await b.close();
})();
