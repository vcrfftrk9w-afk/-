const { chromium } = require('playwright');
/* APK-версия: приложение открыто в Android WebView, где нет голоса, уведомлений и скачивания.
   js/android.js подключает их к мосту window.AndroidApp. Имитируем WebView: убираем
   speechSynthesis и Notification, подставляем поддельный AndroidApp и смотрим, что он получает. */
const webViewMock = `(() => {
  Object.defineProperty(window, 'speechSynthesis', { value: undefined, writable: true, configurable: true });
  Object.defineProperty(window, 'Notification', { value: undefined, writable: true, configurable: true });
  const calls = window.__android = [];
  let state = 'default';
  window.AndroidApp = {
    speak: (text, rate) => calls.push(['speak', text, rate]),
    stopSpeaking: () => calls.push(['stop']),
    notifyState: () => state,
    requestNotify: () => { calls.push(['request']); setTimeout(() => { state = 'granted'; }, 300); },
    notify: (title, body) => calls.push(['notify', title, body]),
    saveFile: (name, mime, text) => calls.push(['save', name, mime, text]),
  };
})();`;
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  let ok = true; const check=(n,c,i)=>{ console.log((c?'✓ ':'✗ ')+n, i!==undefined?JSON.stringify(i).slice(0,300):''); if(!c) ok=false; };

  const ctx = await b.newContext({ viewport:{width:393,height:793} });
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(webViewMock);
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(1500);

  check('мост включился', await p.evaluate(()=>document.documentElement.classList.contains('in-android')));

  // голос тренера идёт в синтез речи Android
  const speak = await p.evaluate(()=>{ State.s.voice = true; Coach.say('Отжимания · 10 раз'); return window.__android.filter(c=>c[0]==='speak'||c[0]==='stop'); });
  check('голос тренера — через Android', speak.some(c=>c[0]==='speak' && /Отжимания\. 10 раз/.test(c[1]) && c[2]>0), speak);

  // уведомления: сначала спрашиваем разрешение, потом показываем
  const perm = await p.evaluate(async()=>{ const before = Notification.permission; const r = await Notification.requestPermission(); new Notification('⏰ Пора', { body: 'Тренировка через 5 минут' }); return { before, r, after: Notification.permission, calls: window.__android.filter(c=>c[0]==='request'||c[0]==='notify') }; });
  check('разрешение на уведомления спрашивается', perm.before==='default' && perm.r==='granted' && perm.after==='granted', perm);
  check('уведомление уходит в Android', perm.calls.some(c=>c[0]==='notify' && c[1]==='⏰ Пора' && c[2]==='Тренировка через 5 минут'), perm.calls);

  // скачивание (как у резервной копии и календаря) сохраняется в «Загрузки»
  const saved = await p.evaluate(async()=>{
    const blob = new Blob(['{"ok":true}'], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'lenivec-backup.json'; document.body.appendChild(a); a.click(); a.remove();
    await new Promise(r=>setTimeout(r,400)); return window.__android.filter(c=>c[0]==='save');
  });
  check('файл сохраняется через Android', saved.length===1 && saved[0][1]==='lenivec-backup.json' && /json/.test(saved[0][2]) && saved[0][3]==='{"ok":true}', saved);

  // обычная ссылка без download не перехватывается
  const plain = await p.evaluate(()=>{ const a=document.createElement('a'); a.href='#x'; document.body.appendChild(a); a.click(); a.remove(); return { hash: location.hash, saves: window.__android.filter(c=>c[0]==='save').length }; });
  check('обычные ссылки работают как раньше', plain.hash==='#x' && plain.saves===1, plain);
  check('без ошибок на странице', errs.length===0, errs);
  await ctx.close();

  // в обычном браузере мост ничего не трогает
  const p2 = await b.newPage();
  await p2.goto('http://localhost:8792/index.html'); await p2.waitForTimeout(800);
  const plainBrowser = await p2.evaluate(()=>({ cls: document.documentElement.classList.contains('in-android'), voice: typeof speechSynthesis.speak, native: /native code/.test(HTMLAnchorElement.prototype.click.toString()) }));
  check('в браузере всё как было', !plainBrowser.cls && plainBrowser.voice==='function' && plainBrowser.native, plainBrowser);

  await b.close();
  console.log(ok ? '\nВСЁ ОК' : '\nЕСТЬ ОШИБКИ'); process.exit(ok ? 0 : 1);
})();
