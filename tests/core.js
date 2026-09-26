const { chromium } = require('./_browser');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({viewport:{width:1280,height:1000}});
  const errors=[]; p.on('pageerror',e=>errors.push(e.message));
  p.on('console',m=>{ if(m.type()==='error'&&!m.text().includes('ERR_')&&!m.text().includes('Failed to load')) errors.push(m.text()); });
  const hide=()=>p.evaluate(()=>{document.querySelectorAll('.modal:not(.hidden)').forEach(m=>{m.classList.add('hidden');m.classList.remove('modal-open');});document.body.classList.remove('modal-lock');});
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(1500);
  await p.evaluate(()=>{ State.s.onboarded=true; Track.profile().set=true; State.save(); });
  await p.reload(); await p.waitForTimeout(1700); await hide();
  await p.click('body'); await p.waitForTimeout(300);

  console.log('=== МУЗЫКА ===');
  for (const st of ['lofi','deep','jazz','deadline']) {
    const r = await p.evaluate(async (id)=>{
      Music.stop(); await new Promise(r=>setTimeout(r,150));
      let notes=0; const ctx=Sound.context();
      const origOsc=ctx.createOscillator.bind(ctx);
      ctx.createOscillator=()=>{notes++;return origOsc();};
      Music.play(id);
      await new Promise(r=>setTimeout(r,2500));
      const lv=Sound.levels(8);
      ctx.createOscillator=origOsc;
      Music.stop();
      return { notes, peak: Math.round(Math.max(...lv)*100)/100, playing:true };
    }, st);
    console.log(`  ${st.padEnd(9)} осцилляторов за 2.5с: ${String(r.notes).padStart(3)}, пик уровня ${r.peak} ${r.notes>3?'✓':'✗ ТИШИНА'}`);
  }

  console.log('\n=== ФОКУС-ТАЙМЕР ===');
  await p.evaluate(()=>App.go('adhd')); await p.waitForTimeout(600); await hide();
  const f = await p.evaluate(async ()=>{
    Screens.focus.quickStart(1,'Тест');
    await new Promise(r=>setTimeout(r,2200));
    const t = document.querySelector('#timer-time').textContent;
    const running = Screens.focus.running;
    Screens.focus.toggleTimer();
    await new Promise(r=>setTimeout(r,300));
    return { t, running, stopped: !Screens.focus.running };
  });
  console.log(`  запуск: ${f.running?'✓':'✗'}, время идёт: ${f.t}, пауза работает: ${f.stopped?'✓':'✗'}`);
  await hide();

  const hf = await p.evaluate(async ()=>{
    Screens.focus.enterHyperfocus();
    await new Promise(r=>setTimeout(r,600));
    const vis = !document.querySelector('#hyperfocus').classList.contains('hidden');
    const bars = document.querySelectorAll('#hf-vis i').length;
    document.querySelector('#hf-exit').click();
    await new Promise(r=>setTimeout(r,400));
    return { vis, bars, closed: document.querySelector('#hyperfocus').classList.contains('hidden') };
  });
  console.log(`  гиперфокус: открылся ${hf.vis?'✓':'✗'}, полос эквалайзера ${hf.bars}, закрылся ${hf.closed?'✓':'✗'}`);

  console.log('\n=== ЗВУКОВОЙ МИКШЕР ===');
  const mix = await p.evaluate(async ()=>{
    Sound.setLayer('rain', 0.6); Sound.setLayer('fire', 0.5);
    await new Promise(r=>setTimeout(r,1200));
    const lv = Sound.levels(8);
    const active = Sound.activeLayers().length;
    Sound.stopAll();
    return { active, peak: Math.round(Math.max(...lv)*100)/100 };
  });
  console.log(`  слоёв включено: ${mix.active}, пик ${mix.peak} ${mix.active>=2?'✓':'✗'}`);

  console.log('\nОШИБКИ:', errors.length?JSON.stringify(errors.slice(0,3)):'нет');
  await b.close();
})();
