const { chromium } = require('playwright');
/* Будильник в APK: при запуске приложение само ставит будильники по графику —
   подъём (будни 07:00, выходные 07:30) и публикации за 10 минут (19:45, 20:50).
   Имитируем Android-мост и пятницу 22:00: следующий будильник — завтра в 07:30. */
const mock = `(() => {
  const R=Date, f=new R('2026-09-25T22:00:00').getTime(), s=R.now(); class FD extends R{constructor(...a){a.length?super(...a):super(f+R.now()-s)} static now(){return f+R.now()-s}} window.Date=FD;
  Object.defineProperty(window, 'Notification', { value: undefined, writable: true, configurable: true });
  const calls = window.__android = [];
  let notify = 'granted';
  const nextOf = (list) => {
    // как Alarms.nextTime в Java: ближайший день недели dow и минута min позже «сейчас»
    const now = new Date(); let best = null;
    list.forEach((a) => { for (let i = 0; i < 8; i++) { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, Math.floor(a.min / 60), a.min % 60);
      if (d.getDay() === a.dow && d.getTime() > now.getTime()) { if (!best || d < best.d) best = { d, a }; break; } } });
    return best;
  };
  let status = { exact: true, fullScreen: true, count: 0, next: 0, nextTitle: '', snooze: 0 };
  window.AndroidApp = {
    speak: () => {}, stopSpeaking: () => {}, saveFile: () => {}, notify: () => {},
    notifyState: () => notify, requestNotify: () => { notify = 'granted'; },
    setAlarms: (json) => { const list = JSON.parse(json); calls.push(['setAlarms', list]); const b = nextOf(list);
      status = Object.assign({}, status, { count: list.length, next: b ? b.d.getTime() : 0, nextTitle: b ? b.a.title : '' }); return JSON.stringify(status); },
    alarmStatus: () => JSON.stringify(status),
    testAlarm: () => calls.push(['testAlarm']),
    openSettings: (w) => calls.push(['openSettings', w]),
  };
})();`;
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  let ok = true; const check=(n,c,i)=>{ console.log((c?'✓ ':'✗ ')+n, i!==undefined?JSON.stringify(i).slice(0,300):''); if(!c) ok=false; };

  const ctx = await b.newContext({ viewport:{width:393,height:793} });
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(mock);
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(800);
  await p.evaluate(()=>{ State.s.onboarded=true; State.s.mode='adhd'; State.save(); location.reload(); });
  await p.waitForTimeout(3200);

  const first = await p.evaluate(()=>{ const c = window.__android.filter(x=>x[0]==='setAlarms'); return { n: c.length, list: c.length ? c[c.length-1][1] : [] }; });
  const wake = first.list.filter(a=>/Подъём/.test(a.title)), pub = first.list.filter(a=>/Через 10 минут/.test(a.title));
  check('при запуске будильники поставились сами', first.n >= 1, first.n);
  check('подъём на каждый день: будни 07:00, выходные 07:30', wake.length===7 && wake.every(a=>a.min===([0,6].includes(a.dow)?450:420)), wake.map(a=>a.dow+':'+a.min));
  check('публикации каждый день за 10 минут: 19:45 и 20:50', pub.length===14 && pub.every(a=>a.min===1185||a.min===1250) && pub.some(a=>/кино/.test(a.title)) && pub.some(a=>/orca/.test(a.title)), pub.slice(0,2));
  const toast = await p.evaluate(()=>Array.from(document.querySelectorAll('.toast')).map(t=>t.textContent).join(' | '));
  check('сказал, что будильник заведён', /Будильник заведён: завтра в 07:30/.test(toast), toast);

  // «Мои задания»: строка будильника и переход в настройки
  const line = await p.evaluate(()=>{ App.go && App.go('mytasks'); const el = document.querySelector('#mytasks-root .lv-alarm'); return el ? el.textContent.trim() : null; });
  check('на «Моих заданиях» видно, когда зазвонит', line && /Будильник: завтра в 07:30 · Подъём/.test(line), line);
  await p.click('#mytasks-root .lv-alarm'); await p.waitForTimeout(500);
  const sheet = await p.evaluate(()=>{ const m = document.querySelector('.remind-alarm'); return m ? { text: m.textContent.replace(/\s+/g,' '), boxes: m.querySelectorAll('[data-aopt]').length, manual: !!document.querySelector('.remind-clock:not([hidden])') } : null; });
  check('в «Напоминаниях» блок будильника с двумя переключателями', sheet && sheet.boxes===2 && /Следующий: завтра в 07:30/.test(sheet.text), sheet);
  check('подсказка «поставь будильник руками» спрятана', sheet && !sheet.manual);

  // выключить будильники публикаций — останется только подъём
  await p.click('[data-aopt="publish"]'); await p.waitForTimeout(300);
  const after = await p.evaluate(()=>{ const c = window.__android.filter(x=>x[0]==='setAlarms'); return { list: c[c.length-1][1].length, cfg: State.s.alarms }; });
  check('выключил публикации — остался только подъём', after.list===7 && after.cfg.publish===false && after.cfg.wake===true, after);

  // проверка звонка
  await p.click('#rm-alarm-test'); await p.waitForTimeout(200);
  check('кнопка «Проверить» заводит звонок через минуту', await p.evaluate(()=>window.__android.some(x=>x[0]==='testAlarm')));

  // после перезапуска приложение не спамит тостом второй раз, а будильники ставит снова
  await p.reload(); await p.waitForTimeout(3200);
  const again = await p.evaluate(()=>({ toast: Array.from(document.querySelectorAll('.toast')).map(t=>t.textContent).join(' | '), set: window.__android.filter(x=>x[0]==='setAlarms').length, list: window.__android.filter(x=>x[0]==='setAlarms').pop()[1].length }));
  check('после перезапуска будильники снова поставлены, без повторного тоста', again.set>=1 && again.list===7 && !/заведён/.test(again.toast), again);
  check('без ошибок на странице', errs.length===0, errs);
  await ctx.close();

  // в браузере и в Claude будильника нет — только подсказка про «Часы»
  const p2 = await b.newPage({ viewport:{width:393,height:793} });
  await p2.goto('http://localhost:8792/index.html'); await p2.waitForTimeout(800);
  const plain = await p2.evaluate(()=>{ State.s.onboarded=true; Remind.open(); return { block: !!document.querySelector('.remind-alarm'), manual: !!document.querySelector('.remind-clock:not([hidden])'), line: Remind.alarmLine() }; });
  check('в браузере — без блока будильника, с подсказкой про «Часы»', !plain.block && plain.manual && plain.line==='', plain);

  await b.close();
  console.log(ok ? '\nВСЁ ОК' : '\nЕСТЬ ОШИБКИ'); process.exit(ok ? 0 : 1);
})();
