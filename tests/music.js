const { chromium } = require('./_browser');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({viewport:{width:1280,height:1000}});
  const errors=[]; p.on('pageerror',e=>errors.push(e.message));
  const hide=()=>p.evaluate(()=>{document.querySelectorAll('.modal:not(.hidden)').forEach(m=>{m.classList.add('hidden');m.classList.remove('modal-open');});document.body.classList.remove('modal-lock');});
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(1500);
  await p.evaluate(()=>{ State.s.onboarded=true; Track.profile().set=true; State.save(); });
  await p.reload(); await p.waitForTimeout(1800); await hide();
  await p.click('body'); await p.waitForTimeout(400);

  console.log('=== СМЕНА СТАНЦИИ СЛЫШНА СРАЗУ ===');
  await p.evaluate(()=>{ App.go('adhd'); Music.play('lofi'); }); await p.waitForTimeout(2000); await hide();
  for (const [id,name] of [['deadline','Дедлайн 124bpm'],['sleep','Засыпание 46bpm'],['energy','Энергия 100bpm']]) {
    const r = await p.evaluate(async (st)=>{
      const bpmBefore = Music.bpm;
      Music.setStation(st);
      // уровень сразу после переключения (шина приглушена) и через секунду
      // провал длится ~0,5 с, а анализатор сглаживает — берём самую тихую точку окна
      let ducked = 1;
      for (let i = 0; i < 12; i++) { await new Promise(r=>setTimeout(r,35)); ducked = Math.min(ducked, Math.max(...Sound.levels(8))); }
      await new Promise(r=>setTimeout(r,1600));
      const back = Math.max(...Sound.levels(8));
      let notes=0; const ctx=Sound.context(); const o=ctx.createOscillator.bind(ctx);
      ctx.createOscillator=()=>{notes++;return o();};
      await new Promise(r=>setTimeout(r,2000));
      ctx.createOscillator=o;
      return { bpmBefore, bpmAfter: Music.bpm, station: Music.stationId,
               приглушение: Math.round(ducked*100)/100, восстановление: Math.round(back*100)/100, нот: notes };
    }, id);
    console.log(`  ${name.padEnd(18)} BPM ${r.bpmBefore}→${r.bpmAfter} ${r.bpmBefore!==r.bpmAfter?'✓':'✗'}, глушение ${r.приглушение}→${r.восстановление} ${r.приглушение<r.восстановление?'✓ слышен переход':'✗'}, нот за 2с: ${r.нот}`);
  }

  console.log('\n=== BPM-ПОЛЗУНОК НЕ ЗАСТРЕВАЕТ ===');
  const bpmTest = await p.evaluate(()=>{
    Music.setBpm(40);
    const forced = Music.bpm;
    Music.setStation('energy');       // у станции свой темп 100
    const afterStation = Music.bpm;
    return { forced, afterStation, ожидаем: 100 };
  });
  console.log(' ', JSON.stringify(bpmTest), bpmTest.afterStation===100?'✓ станция вернула свой темп':'✗ застрял старый');

  console.log('\n=== ЭКВАЛАЙЗЕР НЕ ЖРЁТ КАДРЫ ===');
  const vis = await p.evaluate(async ()=>{
    Music.stop(); await new Promise(r=>setTimeout(r,1200));
    Screens.music.syncVisualizer();
    await new Promise(r=>setTimeout(r,400));
    let frames=0; const t0=performance.now();
    return new Promise(res=>{
      const c=()=>{frames++; if(performance.now()-t0<800) requestAnimationFrame(c);
        else res({ frames, музыка: Music.playing });};
      requestAnimationFrame(c);
    });
  });
  console.log('  музыка выключена, кадров за 0.8с:', vis.frames);
  const rafSrc = await p.evaluate(()=>new Promise(res=>{
    const found=[]; const orig=window.requestAnimationFrame; let n=0;
    window.requestAnimationFrame=(cb)=>{ n++; if(n<30){const st=(new Error()).stack.split('\n')[2]||''; found.push(st.trim().replace(/https?:\/\/[^/]+\//,'').slice(0,60));} return orig(cb); };
    setTimeout(()=>{ window.requestAnimationFrame=orig; const c={}; found.forEach(f=>c[f]=(c[f]||0)+1);
      res(Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,4)); }, 800);
  }));
  rafSrc.forEach(([s,n])=>console.log(`    ${String(n).padStart(3)}× ${s}`));
  console.log('  эквалайзер в списке:', rafSrc.some(([s])=>s.includes('screens-extra'))?'✗ всё ещё крутится':'✓ остановлен');
  console.log('\nОШИБКИ:', errors.length?JSON.stringify(errors):'нет');
  await b.close();
})();
