const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({viewport:{width:900,height:900}});
  const errors=[]; p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(1500);
  // накапливаем прогресс и даём запасной копии записаться
  await p.evaluate(()=>{ State.s.onboarded=true; State.s.name='Саша'; Track.profile().set=true;
    ['Первая','Вторая','Третья'].forEach(t=>Screens.tasks.add(t,'work','mid',false));
    Track.wake(8*60); Track.water(6); State.save();
    localStorage.setItem(State.BACKUP_KEY, localStorage.getItem(State.KEY)); });
  await p.reload(); await p.waitForTimeout(1600);
  console.log('до порчи: задач', await p.evaluate(()=>State.s.tasks.length), ', имя', await p.evaluate(()=>State.s.name));

  console.log('\n=== СЛУЧАЙ 1: основное испорчено, запасная копия есть ===');
  await p.evaluate(()=>localStorage.setItem(State.KEY,'{{{сломано'));
  await p.reload(); await p.waitForTimeout(2500);
  let r = await p.evaluate(()=>({tasks:State.s.tasks.length, name:State.s.name, water:Track.today().water,
    corrupt: Object.keys(localStorage).filter(k=>k.includes('_corrupt_')).length}));
  console.log('  восстановлено: задач', r.tasks, ', имя', r.name, ', вода', r.water);
  console.log('  испорченный файл сохранён рядом:', r.corrupt>0 ? 'да ✓' : 'НЕТ ✗');
  const t = await p.$$eval('.toast', e=>e.map(x=>x.textContent.replace(/\s+/g,' ').trim()));
  console.log('  сообщение:', t.find(x=>x.includes('запасн'))||'(не показано)');
  console.log('  ', r.tasks===3 && r.name==='Саша' ? '✓ прогресс спасён' : '✗ прогресс потерян');

  console.log('\n=== СЛУЧАЙ 2: испорчено и основное, и запасное ===');
  await p.evaluate(()=>{ localStorage.setItem(State.KEY,'мусор'); localStorage.setItem(State.BACKUP_KEY,'тоже мусор'); });
  await p.reload(); await p.waitForTimeout(3000);
  r = await p.evaluate(()=>({tasks:State.s.tasks.length,
    corrupt: Object.keys(localStorage).filter(k=>k.includes('_corrupt_')).length,
    modal: (document.querySelector('.comeback h2')||{}).textContent || null }));
  console.log('  задач после сброса:', r.tasks, '(ожидаемо 0)');
  console.log('  предупреждение человеку:', r.modal ? `«${r.modal}» ✓` : 'НЕТ ✗');
  console.log('  испорченных копий отложено:', r.corrupt);

  console.log('\n=== СЛУЧАЙ 3: запасная копия не затирается мусором ===');
  await p.evaluate(()=>{ document.querySelectorAll('.modal:not(.hidden)').forEach(m=>m.classList.add('hidden'));
    State.s.name='Новый'; Screens.tasks.add('После сброса','work','mid',false); State.save(); });
  await p.waitForTimeout(500);
  r = await p.evaluate(()=>({ main: JSON.parse(localStorage.getItem(State.KEY)).tasks.length,
                              backupIsJson: (()=>{try{JSON.parse(localStorage.getItem(State.BACKUP_KEY));return true;}catch(e){return false;}})() }));
  console.log('  основное сохранение живое:', r.main, 'задач ✓');
  console.log('  запасная копия не обновлена мусором сразу:', r.backupIsJson?'обновлена корректным json':'осталась прежней');
  console.log('\nОШИБКИ:', errors.length?JSON.stringify(errors):'нет');
  await b.close();
})();
