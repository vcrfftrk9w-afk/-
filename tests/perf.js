const { chromium } = require('./_browser');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({viewport:{width:1280,height:1000}});
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(1500);
  await p.evaluate(()=>{ State.s.onboarded=true;
    for(let i=0;i<300;i++){ const k=State.daysAgoKey(i); State.s.dailyTaskCounts[k]=Math.floor(Math.random()*8);
      State.s.dailyFocusMinutes[k]=Math.floor(Math.random()*120); State.s.moods[k]={mood:3,energy:3}; }
    for(let i=0;i<200;i++) State.s.focusLog.push({at:Date.now()-i*3600000, minutes:25, mode:'pomodoro'});
    for(let i=0;i<120;i++) Screens.tasks.add('Задача '+i,'work','mid',false);
    State.save(); });
  await p.reload(); await p.waitForTimeout(1800);
  await p.evaluate(()=>document.querySelectorAll('.modal:not(.hidden)').forEach(m=>m.classList.add('hidden')));

  const r = await p.evaluate(()=>{
    const out = {};
    const time = (name, fn) => { const t0=performance.now(); for(let i=0;i<8;i++) fn(); out[name]=Math.round((performance.now()-t0)/8*10)/10; };
    App.go('stats');
    time('stats.render', ()=>Screens.stats.render());
    App.go('dashboard');
    time('dashboard.render', ()=>Screens.dashboard.render());
    App.go('tasks');
    time('tasks.render (120 задач)', ()=>Screens.tasks.render());
    App.go('day');
    time('day.render', ()=>Screens.day.render());
    App.go('rewards');
    time('rewards.render', ()=>Screens.rewards.render());
    App.go('path');
    time('path.render', ()=>Screens.path.render());
    App.go('adhd');
    time('focus.render', ()=>Screens.focus.render());
    time('Planner.build', ()=>Planner.build({}));
    time('Verdict.decide', ()=>Verdict.decide());
    time('Advisor.renderNext', ()=>{ App.go('dashboard'); Advisor.renderNext(); });
    return out;
  });
  Object.entries(r).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(`  ${String(v).padStart(7)} мс  ${k}`));
  await b.close();
})();
