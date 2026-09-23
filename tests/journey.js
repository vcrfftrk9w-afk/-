const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({viewport:{width:390,height:844}, hasTouch:true, isMobile:true});
  const errors=[]; p.on('pageerror',e=>errors.push('PAGEERROR: '+e.message));
  p.on('console',m=>{ if(m.type()==='error'&&!m.text().includes('ERR_')&&!m.text().includes('Failed to load')) errors.push('CONSOLE: '+m.text()); });
  const hide=()=>p.evaluate(()=>{document.querySelectorAll('.modal:not(.hidden)').forEach(m=>{m.classList.add('hidden');m.classList.remove('modal-open');});document.body.classList.remove('modal-lock');});
  const step=(n,v)=>console.log(`  ${v?'✓':'✗'} ${n}`);

  console.log('=== ПЕРВЫЙ ДЕНЬ НОВОГО ЧЕЛОВЕКА (телефон) ===');
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(2000);

  // 1. Онбординг целиком
  step('онбординг показан', await p.isVisible('#onboarding'));
  await p.fill('#ob-name','Саша');
  await p.click('.ob-step.active [data-ob-next]'); await p.waitForTimeout(350);
  await p.click('.ob-mode[data-mode="adhd"]');
  await p.click('.ob-step.active [data-ob-next]'); await p.waitForTimeout(350);
  await p.click('.ob-step.active [data-ob-next]'); await p.waitForTimeout(350);
  await p.fill('#ob-income','60000'); await p.fill('#ob-expenses','45000'); await p.waitForTimeout(400);
  step('расчёт до миллиона показан', (await p.textContent('#ob-money-out')).includes('миллион'));
  await p.click('.ob-step.active [data-ob-next]'); await p.waitForTimeout(350);
  await p.fill('#ob-goal','Запустить канал'); await p.fill('#ob-task','Снять первое видео');
  await p.click('#ob-start'); await p.waitForTimeout(1500); await hide();
  step('приложение открылось', await p.isVisible('#app'));

  // 2–3. Ничего не настраивает руками: режим и дела уже стоят по недельному графику
  await p.evaluate(()=>App.go('day')); await p.waitForTimeout(700); await hide();
  const prof = await p.evaluate(()=>({w:Track.hhmm(Track.profile().wakeTarget), s:Track.hhmm(Track.profile().sleepTarget),
    script: !!(Planner.plan() && Planner.plan().script), plan:Planner.blocks().length, setup: !!document.querySelector('.day-setup'),
    week: !!document.querySelector('#day-week')}));
  step(`режим взят из графика (${prof.w}–${prof.s}), план по графику (${prof.plan} блоков), без анкеты`, prof.script && prof.plan>0 && !prof.setup && prof.week);
  const tasks = await p.evaluate(()=>State.s.tasks.filter(t=>!t.done).length);
  step(`дела дня поставлены сами (${tasks} задач)`, tasks>=10);

  // 4. Спрашивает «что сейчас главное»
  await p.evaluate(()=>App.go('day')); await p.waitForTimeout(500); await hide();
  await p.click('#day-verdict'); await p.waitForTimeout(800);
  const v = await p.evaluate(()=>{const e=document.querySelector('.verdict'); return e?{t:e.querySelector('h2').textContent, first:!!e.querySelector('.verdict-first')}:null;});
  step(`разбор дал ответ: «${v&&v.t}»`, !!v && v.first);
  await hide();

  // 5. Пьёт воду, ест, отмечает таблетку
  await p.evaluate(()=>App.go('day')); await p.waitForTimeout(500); await hide();
  for (let i=0;i<6;i++) { await p.click('[data-water="1"]'); await p.waitForTimeout(60); }
  await p.waitForTimeout(900);
  step('вода записана', await p.evaluate(()=>Track.today().water)>=6);
  await p.click('[data-quick="meal"]'); await p.waitForTimeout(600);
  await p.click('[data-preset="450"]'); await p.click('#meal-save'); await p.waitForTimeout(700); await hide();
  step('еда записана', await p.evaluate(()=>Track.today().meals.length)>0);

  // 6. Делает залипательное дело и выходит вовремя
  await p.evaluate(()=>{ const t=State.s.tasks.find(x=>x.chill); Chill.start(1,t.title,t.id); }); await p.waitForTimeout(600);
  step('таймер залипания открылся', await p.isVisible('#chill'));
  await p.click('#chill-done'); await p.waitForTimeout(800); await hide();
  const cs = await p.evaluate(()=>Chill.stats());
  step(`вышел вовремя (${cs.pct}%)`, cs.kept===1);

  // 7. Закрывает несколько задач
  await p.evaluate(()=>{ State.s.tasks.filter(t=>!t.done).slice(0,5).forEach(t=>{t.done=true;t.doneAt=Date.now();}); State.commit(); });
  await p.waitForTimeout(800); await hide();
  const lvl = await p.evaluate(()=>({lvl:State.s.level, coins:State.s.coins, ach:State.unlockedAchievements()}));
  step(`прогресс идёт: ур.${lvl.lvl}, ${lvl.coins} монет, ${lvl.ach} достижений`, lvl.coins>0 && lvl.ach>0);

  // 8. Закрывает день
  await p.evaluate(()=>{document.querySelectorAll('.modal:not(.hidden)').forEach(m=>m.classList.add('hidden')); Screens.day.closeDay();});
  await p.waitForTimeout(900);
  const close = await p.evaluate(()=>{const e=document.querySelector('.day-close'); return e?e.textContent.replace(/\s+/g,' ').trim().slice(0,90):null;});
  step('итог дня показан', !!close);
  console.log('    ', close);
  await p.screenshot({path:require('os').tmpdir()+'/v15_journey.png'});
  await hide();

  // 9. Перезагрузка — всё на месте
  await p.reload(); await p.waitForTimeout(1800); await hide();
  const after = await p.evaluate(()=>({name:State.s.name, water:Track.today().water, tpl:DayTpl.items().length,
    money:Path.money().income, wake:Track.hhmm(Track.profile().wakeTarget), tasks:State.s.tasks.length, sleep:Track.today().sleepAt!==null}));
  step(`после перезагрузки всё на месте (${after.name}, вода ${after.water}, ${after.tasks} задач, подъём ${after.wake})`,
    after.name==='Саша' && after.water>=6 && after.tasks>=10 && after.wake==='07:00' && after.sleep);

  // 10. Горизонтальный скролл нигде
  let ovAll=0;
  for (const t of ['dashboard','day','tasks','path','adhd','habits','goals','lessons','empire','rewards','stats']) {
    await p.evaluate((x)=>App.go(x), t); await p.waitForTimeout(280); await hide();
    ovAll += await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  }
  step(`ни одной вкладки с горизонтальным скроллом (сумма ${ovAll}px)`, ovAll===0);

  console.log('\nОШИБКИ:', errors.length?JSON.stringify(errors,null,1):'нет');
  await b.close();
})();
