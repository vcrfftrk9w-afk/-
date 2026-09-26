const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({viewport:{width:390,height:844}});
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(1500);
  await p.evaluate(()=>{ State.s.onboarded=true; Track.profile().set=true;
    Screens.tasks.add('Задача','work','mid',false);
    State.s.habits.unshift({id:State.uid(),name:'Зарядка',emoji:'💪',skill:'health',history:{},rewarded:{},createdAt:Date.now()});
    Track.wake(8*60); Planner.build({}); State.save(); });
  await p.reload(); await p.waitForTimeout(1700);
  await p.evaluate(()=>document.querySelectorAll('.modal:not(.hidden)').forEach(m=>m.classList.add('hidden')));

  console.log('=== РАЗМЕР НАЖИМАЕМЫХ ЭЛЕМЕНТОВ (мобильный, минимум 44×44 по рекомендации) ===');
  for (const tab of ['dashboard','day','tasks','path','adhd','habits']) {
    await p.evaluate((t)=>App.go(t), tab); await p.waitForTimeout(400);
    await p.evaluate(()=>document.querySelectorAll('.modal:not(.hidden)').forEach(m=>m.classList.add('hidden')));
    const small = await p.evaluate(()=>{
      const out=[];
      document.querySelectorAll('.tab-panel.active button, .tab-panel.active a, .tab-panel.active input[type=checkbox]').forEach(el=>{
        const r=el.getBoundingClientRect();
        if (r.width===0||r.height===0) return;
        if (r.width<32||r.height<32) out.push(`${(el.className||'').toString().split(' ')[0]||el.tagName} ${Math.round(r.width)}×${Math.round(r.height)} «${(el.textContent||'').trim().slice(0,18)}»`);
      });
      const seen=new Set(); return out.filter(x=>{const k=x.split(' ')[0]; if(seen.has(k))return false; seen.add(k); return true;}).slice(0,6);
    });
    console.log(` ${tab}: ${small.length?small.join(' | '):'все ≥32px ✓'}`);
  }

  console.log('\n=== ДОСТУПНОСТЬ ===');
  const a = await p.evaluate(()=>{
    const noLabel=[];
    document.querySelectorAll('button').forEach(el=>{
      if (el.offsetParent===null) return;
      const t=(el.textContent||'').trim();
      if (!t && !el.getAttribute('aria-label') && !el.title) noLabel.push((el.className||'').toString().split(' ')[0]||el.id||'button');
    });
    const noAlt=[...document.querySelectorAll('img:not([alt])')].length;
    const inputs=[...document.querySelectorAll('input,select')].filter(el=>el.offsetParent!==null
      && !el.getAttribute('aria-label') && !el.title && !el.closest('label') && !el.placeholder);
    return { noLabel:[...new Set(noLabel)].slice(0,8), noAlt, inputsNoLabel: inputs.map(e=>e.id||e.tagName).slice(0,8) };
  });
  console.log('  кнопки без подписи и aria-label:', a.noLabel.length?JSON.stringify(a.noLabel):'нет ✓');
  console.log('  img без alt:', a.noAlt || 'нет ✓');
  console.log('  поля без подписи:', a.inputsNoLabel.length?JSON.stringify(a.inputsNoLabel):'нет ✓');

  console.log('\n=== КЛАВИАТУРА ===');
  await p.evaluate(()=>App.go('dashboard')); await p.waitForTimeout(300);
  const tabOrder = await p.evaluate(async ()=>{
    const els=[]; document.activeElement.blur();
    for (let i=0;i<14;i++){
      await new Promise(r=>setTimeout(r,10));
      const e=document.activeElement;
      els.push(e===document.body?'(body)':((e.className||'').toString().split(' ')[0]||e.tagName));
    }
    return els;
  });
  const focusVisible = await p.evaluate(()=>{
    const btn=document.querySelector('.tab-btn'); btn.focus();
    const cs=getComputedStyle(btn);
    return { outline: cs.outlineStyle+' '+cs.outlineWidth, shadow: cs.boxShadow.slice(0,40) };
  });
  console.log('  видимый фокус на вкладке:', JSON.stringify(focusVisible));

  console.log('\n=== КОНТРАСТ ТЕКСТА (тёмная тема) ===');
  const contrast = await p.evaluate(()=>{
    const lum=(c)=>{const [r,g,b]=c.match(/\d+/g).map(Number).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return 0.2126*r+0.7152*g+0.0722*b;};
    const ratio=(a,b)=>{const l1=lum(a),l2=lum(b);return Math.round(((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05))*10)/10;};
    const bg=getComputedStyle(document.body).backgroundColor;
    const out={};
    [['.muted','var(--text-muted)'],['body','основной текст']].forEach(()=>{});
    const probe=(sel,name)=>{const el=document.querySelector(sel); if(!el) return; out[name]=ratio(getComputedStyle(el).color, bg);};
    probe('#user-title','заголовок');
    probe('.muted','приглушённый');
    probe('.panel-sub','подпись раздела');
    probe('.dl-meta','мелкая подпись');
    return out;
  });
  Object.entries(contrast).forEach(([k,v])=>console.log(`  ${k}: ${v}:1 ${v>=4.5?'✓':(v>=3?'(мелкий текст ниже нормы)':'✗ низкий')}`));
  await b.close();
})();
