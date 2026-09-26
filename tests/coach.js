const { chromium } = require('./_browser');
const SP=require('os').tmpdir()+'/';
async function page(b, iso, opts={}) {
  const ctx = await b.newContext({ viewport:{width:390,height:844} });
  const p = await ctx.newPage();
  p.errors=[]; p.on('pageerror',e=>p.errors.push(e.message));
  await p.addInitScript(({iso, ai}) => {
    const fixed = new Date(iso).getTime(); const Real = Date; const start = Real.now();
    class FD extends Real { constructor(...a){ if(a.length===0) super(fixed + (Real.now()-start)); else super(...a);} static now(){ return fixed + (Real.now()-start);} }
    window.Date = FD;
    if (ai) {
      window.__prompts = [];
      const sample = async (input, o) => { window.__prompts.push(input); const text='Сейчас главное — 10 минут на заработок: открой Kwork и откликнись на 1 заказ.'; if (o && o.onText) o.onText({text, delta:text}); return {text, truncated:false}; };
      sample.json = async (input) => { window.__prompts.push(input); await new Promise(r=>setTimeout(r,300)); return { summary:'Сделано 9 из 16, обе публикации вовремя.', blocker:'Пропущен блок заработка после пар.', main:{what:'Откликнуться на 3 заказа по монтажу на Kwork', when:'10:00', first:'Открыть Kwork и вбить «монтаж видео»', why:'Первые деньги за навык, который уже есть.'}, tip:'Начни с 2 минут сразу после YouTube.' }; };
      window.claude = { use: async (n) => (n === 'sample' ? sample : null) };
    }
  }, {iso, ai: !!opts.ai});
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(900);
  await p.evaluate((mode)=>{ State.s.onboarded=true; State.s.mode=mode; State.save(); }, opts.mode||'adhd');
  await p.reload(); await p.waitForTimeout(opts.ai ? 2600 : 2400);
  await p.evaluate(()=>document.querySelectorAll('.modal.modal-open').forEach(m=>UI.closeModal('#'+m.id)));
  await p.waitForTimeout(300);
  return p;
}
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  let ok = true; const check=(name,cond,info)=>{ console.log((cond?'✓ ':'✗ ')+name, info!==undefined?JSON.stringify(info).slice(0,300):''); if(!cond) ok=false; };

  // 1. Понедельник 16:05 — тренировка A по шагам
  let p = await page(b, '2026-09-21T16:05:00');
  const note = await p.evaluate(()=>Coach.noteFor(Planner.blocks().find(b=>b.taskTitle==='Тренировка')));
  check('видно, какая сегодня тренировка', /Тренировка A: приседания/.test(note||''), note);
  await p.evaluate(()=>{ const b=Planner.blocks().find(x=>x.taskTitle==='Тренировка'); Coach.openTraining(b); }); await p.waitForTimeout(400);
  check('окно тренировки открывается', await p.evaluate(()=>/Тренировка A/.test(document.querySelector('#sheet-body').textContent)));
  await p.screenshot({path:SP+'v21_train.png'});
  await p.click('#co-go'); await p.waitForTimeout(300);
  const steps = await p.evaluate(()=>Coach.strengthSteps('A').length);
  await p.screenshot({path:SP+'v21_run.png'});
  for (let i=0;i<steps;i++) { await p.click('[data-run="next"]'); await p.waitForTimeout(40); }
  await p.waitForTimeout(500);
  const T = await p.evaluate(()=>({ log: State.s.workouts[State.todayKey()], done: State.s.tasks.some(t=>t.title==='Тренировка'&&t.done), move: Track.today().workout, sheet: document.querySelector('#sheet-body').textContent.slice(0,60) }));
  check(`все ${steps} шагов пройдены, тренировка записана и отмечена`, T.log && T.log.type==='A' && T.done && T.move>=20, T);
  check('без ошибок (тренировка)', !p.errors.length, p.errors);
  await p.context().close();

  // 2. Вторник 16:05 — прогулка
  p = await page(b, '2026-09-22T16:05:00');
  await p.evaluate(()=>Coach.openWalk(Planner.blocks().find(x=>x.taskTitle==='Прогулка и восстановление'))); await p.waitForTimeout(400);
  const W = await p.evaluate(()=>document.querySelector('#sheet-body h2').textContent);
  check('во вторник — прогулка', /Прогулка/.test(W), W);
  await p.click('#co-go'); await p.waitForTimeout(200);
  const clk = await p.evaluate(()=>document.querySelector('#run-left').textContent);
  await p.waitForTimeout(1300);
  const clk2 = await p.evaluate(()=>document.querySelector('#run-left').textContent);
  check('таймер шага идёт', clk!==clk2, [clk, clk2]);
  await p.evaluate(()=>UI.closeModal('#sheet-modal')); await p.waitForTimeout(600);
  check('закрыл окно — таймер остановился', await p.evaluate(()=>!Coach.running));
  await p.context().close();

  // 3. Понедельник 17:05 — готовка и покупки (обычный режим)
  p = await page(b, '2026-09-21T17:05:00', {mode:'normal'});
  await p.evaluate(()=>App.go('day')); await p.waitForTimeout(500);
  const card = await p.evaluate(()=>[...document.querySelectorAll('.day-coach .coach-tile b')].map(x=>x.textContent));
  check('карточка «Тело, еда, голова» на экране «День»', card.length===3, card);
  await p.click('.day-coach [data-coach="cook"]'); await p.waitForTimeout(400);
  const R = await p.evaluate(()=>({ name: document.querySelector('.recipe h3').textContent, ing: document.querySelectorAll('.recipe-cols ul li').length, steps: document.querySelectorAll('.recipe-cols ol li').length, wi: Coach.weekIndex() }));
  check('рецепт дня с продуктами и шагами', R.ing>=5 && R.steps>=4, R);
  await p.screenshot({path:SP+'v21_cook.png'});
  await p.click('#co-shop'); await p.waitForTimeout(500);
  const S = await p.evaluate(()=>({ n: document.querySelectorAll('.shop-list li').length, sample: [...document.querySelectorAll('.shop-list span')].slice(0,4).map(x=>x.textContent) }));
  check('список покупок на неделю собран', S.n>=15, S);
  await p.click('.shop-list input'); await p.waitForTimeout(200);
  const got = await p.evaluate(()=>Object.keys(State.s.shop.got).length);
  check('отметка в списке сохраняется', got===1, got);
  await p.evaluate(()=>UI.closeModal('#sheet-modal')); await p.waitForTimeout(300);
  await p.evaluate(()=>App.go('dashboard')); await p.waitForTimeout(400);
  check('карточка на главной (обычный режим)', await p.evaluate(()=>document.querySelectorAll('#coach-today .coach-tile').length===3));
  // вторник — день остатков
  const tue = await p.evaluate(()=>Coach.recipeFor(2).name);
  check('во вторник — без большой готовки', /Разогреть/.test(tue), tue);
  const menus = await p.evaluate(()=>[Coach.recipeFor(1, 0).name, Coach.recipeFor(1, 1).name]);
  check('меню чередуется по неделям', menus[0]!==menus[1], menus);
  check('без ошибок (готовка)', !p.errors.length, p.errors);
  await p.context().close();

  // 4. Понедельник 20:40 — разбор с ИИ (имитация ИИ)
  p = await page(b, '2026-09-21T20:40:00', {ai:true});
  const an = await p.evaluate(()=>(document.querySelector('.mt-row.now b')||{}).textContent);
  check('в 20:40 на главной идёт продуктивное время с ИИ', /ИИ/.test(an||''), an);
  await p.evaluate(()=>document.querySelector('.mt-row.now [data-mgo]').click()); await p.waitForTimeout(400);
  await p.click('#ai-run'); await p.waitForTimeout(900);
  const A = await p.evaluate(()=>({ main: (document.querySelector('.ai-main b')||{}).textContent, prompt: (window.__prompts[0]||'').slice(0,4000) }));
  check('ИИ ответил, главное на завтра показано', /Kwork/.test(A.main||''), A.main);
  check('ИИ получил данные дня и завтрашний график', /Дела сегодня по графику/.test(A.prompt) && /Завтра \(вторник\)/.test(A.prompt) && /ТТ видео — кино/.test(A.prompt));
  await p.screenshot({path:SP+'v21_ai.png'});
  await p.click('#ai-plan'); await p.waitForTimeout(500);
  const P = await p.evaluate(()=>{ const d=new Date(); d.setDate(d.getDate()+1); const k=State.dateKey(d);
    const t=State.s.tasks.find(x=>/Kwork/.test(x.title)); return { due: t&&t.due, k, sub: t&&t.subtasks[0]&&t.subtasks[0].text, log: State.s.aiLog.length, aiDone: State.s.tasks.some(x=>x.title==='Разбор с ИИ: что получилось и что дальше'&&x.done) }; });
  check('«Поставить на завтра» — задача на завтра с первым шагом, разбор отмечен', P.due===P.k && /Kwork/.test(P.sub||'') && P.log===1 && P.aiDone, P);
  // чат
  await p.evaluate(()=>Coach.openAI(null)); await p.waitForTimeout(300);
  await p.fill('#ai-q', 'что главное сейчас?'); await p.press('#ai-q', 'Enter'); await p.waitForTimeout(500);
  const chat = await p.evaluate(()=>[...document.querySelectorAll('.ai-bubble')].map(x=>x.textContent));
  check('чат с ИИ отвечает', chat.length===2 && /Kwork/.test(chat[1]), chat);
  // «Что главное» → кнопка ИИ
  await p.evaluate(()=>{ UI.closeModal('#sheet-modal'); }); await p.waitForTimeout(300);
  await p.evaluate(()=>Verdict.open()); await p.waitForTimeout(300);
  check('в разборе «Что главное» есть «Спросить ИИ»', await p.evaluate(()=>!!document.querySelector('#v-ai')));
  check('без ошибок (ИИ)', !p.errors.length, p.errors);
  await p.context().close();

  // 5. Без ИИ — встроенный разбор
  p = await page(b, '2026-09-21T20:40:00');
  await p.evaluate(()=>Coach.openAI(null)); await p.waitForTimeout(300);
  await p.click('#ai-run'); await p.waitForTimeout(700);
  const F = await p.evaluate(()=>(document.querySelector('.ai-fallback')||{}).textContent||'');
  check('без ИИ — встроенный разбор, а не ошибка', /встроенный/.test(F) && /Работа над заработком/.test(F), F.replace(/\s+/g,' ').slice(0,160));
  check('без ошибок (без ИИ)', !p.errors.length, p.errors);
  await p.context().close();

  console.log(ok ? '\n✓ тренировка, готовка и ИИ работают' : '\n✗ есть проблемы');
  await b.close();
})();
