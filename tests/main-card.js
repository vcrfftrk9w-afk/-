const { chromium } = require('./_browser');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({viewport:{width:1280,height:1100}});
  const errors=[]; p.on('pageerror',e=>errors.push(e.message));
  p.on('console',m=>{ if(m.type()==='error'&&!m.text().includes('ERR_')&&!m.text().includes('Failed to load')) errors.push(m.text()); });
  const hide=()=>p.evaluate(()=>{document.querySelectorAll('.modal:not(.hidden)').forEach(m=>{m.classList.add('hidden');m.classList.remove('modal-open');});document.body.classList.remove('modal-lock');document.querySelectorAll('.toast').forEach(t=>t.remove());});
  // время закреплено: среда 12:20 — посреди дня, есть и сделанное, и впереди
  await p.addInitScript(()=>{ const R=Date,f=new R('2026-09-23T12:20:00').getTime(),s=R.now(); class FD extends R{constructor(...a){a.length?super(...a):super(f+R.now()-s)} static now(){return f+R.now()-s}} window.Date=FD; });
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(1500);
  await p.evaluate(()=>{ State.s.onboarded=true; State.s.space='all'; State.s.name='Саша'; State.save(); });
  await p.reload(); await p.waitForTimeout(1800); await hide();

  console.log('=== КАРТОЧКА ПЕРВАЯ НА ЭКРАНЕ? ===');
  const pos = await p.evaluate(()=>{
    const cards=[...document.querySelectorAll('#tab-dashboard [data-card]')].filter(c=>c.offsetParent!==null);
    return { первая: cards[0]?cards[0].dataset.card:null, порядок: cards.slice(0,4).map(c=>c.dataset.card) };
  });
  console.log(' ', JSON.stringify(pos), pos.первая==='main'?'✓':'✗');

  console.log('\n=== ПУСТОЕ СОСТОЯНИЕ ===');
  console.log(' ', (await p.textContent('#main-today')).replace(/\s+/g,' ').trim().slice(0,90));

  console.log('\n=== ПОСЛЕ ЗАГРУЗКИ ГРАФИКА ===');
  await p.evaluate(()=>{ Week.install(); Track.wake(7*60); DayTpl.apply({}); }); await p.waitForTimeout(1200); await hide();
  await p.evaluate(()=>App.go('dashboard')); await p.waitForTimeout(700); await hide();
  const card = await p.evaluate(()=>{
    const items=[...document.querySelectorAll('#main-today .mt-row')].map(li=>({
      when: li.querySelector('.mt-time').textContent, title: li.querySelector('.mt-main b').textContent.trim(),
      классы: li.className.replace('mt-row','').trim() }));
    return { счётчик: document.querySelector('#main-count').textContent, items };
  });
  console.log('  счётчик:', card.счётчик);
  card.items.forEach(i=>console.log(`   ${i.when.padEnd(24)} ${i.title}${i.классы?'  {'+i.классы+'}':''}`));

  console.log('\n=== ОТМЕТИТЬ ДЕЛО ПРЯМО С ГЛАВНОЙ ===');
  const before = await p.evaluate(()=>State.s.tasks.filter(t=>t.done).length);
  await p.evaluate(()=>document.querySelector('#main-today .mt-row:not(.done) [data-mdone]').click()); await p.waitForTimeout(900); await hide();
  const after = await p.evaluate(()=>({done:State.s.tasks.filter(t=>t.done).length, badge:document.querySelector('#main-count').textContent}));
  console.log(`  выполнено задач: ${before} → ${after.done} ${after.done>before?'✓':'✗'} | счётчик: ${after.badge}`);

  await p.evaluate(()=>App.go('dashboard')); await p.waitForTimeout(600); await hide();
  await p.locator('[data-card="main"]').screenshot({path:require('os').tmpdir()+'/v17_main.png'});

  console.log('\n=== НИЧЕГО НЕ УБРАНО ===');
  const all = await p.evaluate(()=>[...document.querySelectorAll('#tab-dashboard [data-card]')].map(c=>c.dataset.card));
  console.log('  карточек на главной:', all.length, '→', all.join(', '));

  console.log('\n=== МОБИЛЬНЫЙ ===');
  await p.setViewportSize({width:390,height:844}); await p.waitForTimeout(600); await hide();
  const ov = await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  console.log('  горизонтальный скролл:', ov, ov===0?'✓':'✗');
  await p.screenshot({path:require('os').tmpdir()+'/v17_main_mobile.png'});
  console.log('\nОШИБКИ:', errors.length?JSON.stringify(errors.slice(0,3)):'нет');
  await b.close();
})();
