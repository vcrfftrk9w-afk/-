const { chromium } = require('./_browser');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({viewport:{width:1280,height:1000}});
  const errors=[]; p.on('pageerror',e=>errors.push('PAGEERROR: '+e.message));
  p.on('console',m=>{ if(m.type()==='error'&&!m.text().includes('ERR_')&&!m.text().includes('Failed to load')) errors.push('CONSOLE: '+m.text()); });
  const hide=()=>p.evaluate(()=>{document.querySelectorAll('.modal:not(.hidden)').forEach(m=>{m.classList.add('hidden');m.classList.remove('modal-open');});document.body.classList.remove('modal-lock');});
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(1500);

  console.log('=== ПОЛГОДА ЕЖЕДНЕВНОГО ПОЛЬЗОВАНИЯ ===');
  const gen = await p.evaluate(()=>{
    State.s.onboarded=true; State.s.name='Долгожитель'; Track.profile().set=true;
    for (let i=180;i>=0;i--){
      const k=State.daysAgoKey(i);
      State.s.day[k]={ wakeAt:400+Math.round(Math.random()*90), sleepAt:1340+Math.round(Math.random()*80),
        water:4+Math.round(Math.random()*5), coffee:Math.round(Math.random()*3),
        meals:[{at:500,kcal:450,title:'З'},{at:780,kcal:700,title:'О'},{at:1150,kcal:550,title:'У'}],
        pills:{}, busy:[], workout: Math.random()>0.4?35:0, closed:true };
      State.s.dailyTaskCounts[k]=Math.round(Math.random()*7);
      State.s.dailyFocusMinutes[k]=Math.round(Math.random()*150);
      State.s.moods[k]={mood:3+Math.round(Math.random()*2), energy:3};
      for(let j=0;j<3;j++) State.s.focusLog.push({at:Date.now()-i*86400000-j*3600000, minutes:25, mode:'pomodoro'});
    }
    for(let i=0;i<400;i++) Screens.tasks.add('Задача '+i,'work','mid',false,{estimate:30});
    State.s.tasks.slice(0,350).forEach(t=>{t.done=true;t.doneAt=Date.now()-Math.random()*1e10;});
    for(let i=0;i<15;i++) State.s.habits.unshift({id:State.uid(),name:'Привычка '+i,emoji:'🔥',skill:'health',
      history:Object.fromEntries([...Array(120)].map((_,d)=>[State.daysAgoKey(d), Math.random()>0.3])), rewarded:{}, createdAt:Date.now()});
    Path.STAGES.slice(0,3).forEach(st=>st.steps.forEach(x=>{ if(!Path.isDone(x.id)) Path.toggle(x.id); }));
    State.save();
    return { bytes: localStorage.getItem(State.KEY).length };
  });
  console.log('  размер сохранения:', Math.round(gen.bytes/1024)+' КБ', gen.bytes<3e6?'✓':'✗ близко к лимиту');

  const t0=Date.now();
  await p.reload(); await p.waitForTimeout(2200); await hide();
  console.log('  загрузка приложения:', Date.now()-t0+'ms');

  console.log('\n  время рендера каждой вкладки:');
  for (const tab of ['dashboard','day','tasks','path','adhd','habits','goals','lessons','empire','rewards','stats']) {
    const ms = await p.evaluate((x)=>{ App.go(x); const t=performance.now(); App.renderActive(); return Math.round((performance.now()-t)*10)/10; }, tab);
    await hide();
    console.log(`    ${tab.padEnd(10)} ${ms} мс ${ms>50?'✗ медленно':''}`);
  }

  const plan = await p.evaluate(()=>{ const t=performance.now(); Planner.build({}); return {ms:Math.round(performance.now()-t), blocks:Planner.blocks().length, unplaced:Planner.unplaced().length}; });
  console.log(`\n  сборка плана из 50 открытых задач: ${plan.ms} мс, ${plan.blocks} блоков, ${plan.unplaced} не влезло`);
  const v = await p.evaluate(()=>{ const t=performance.now(); const d=Verdict.decide(); return {ms:Math.round((performance.now()-t)*10)/10, top:d.top.title}; });
  console.log(`  разбор: ${v.ms} мс → «${v.top}»`);

  console.log('\n=== КЛАВИАТУРА ===');
  await p.evaluate(()=>App.go('dashboard')); await p.waitForTimeout(300);
  const keys = [];
  for (const k of ['1','2','3','4','5','6','7','8','9']) {
    await p.keyboard.press(k); await p.waitForTimeout(160);
    keys.push(k+'→'+await p.evaluate(()=>document.querySelector('.tab-panel.active').id.replace('tab-','')));
  }
  console.log('  цифры:', keys.join(' '));
  const tabsTotal = await p.evaluate(()=>document.querySelectorAll('.tab-btn[data-tab]').length);
  console.log(`  вкладок всего ${tabsTotal}, цифрами достижимо 9 — остальные через «Ещё», Ctrl+K и свайп`);
  await p.keyboard.press('g'); await p.waitForTimeout(500);
  console.log('  G → разбор:', await p.isVisible('.verdict') ? '✓' : '✗');
  await hide();
  await p.keyboard.press('Control+k'); await p.waitForTimeout(400);
  console.log('  Ctrl+K → палитра:', await p.isVisible('#palette-modal, .palette') ? '✓' : '✗');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  console.log('\nОШИБКИ:', errors.length?JSON.stringify(errors.slice(0,3),null,1):'нет');
  await b.close();
})();
