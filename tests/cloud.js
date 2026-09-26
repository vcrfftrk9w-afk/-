const { chromium } = require('./_browser');
/* Имитация платформы: db + user. Хранилище живёт в Node и переживает
   перезагрузки страницы — ровно как настоящее облако. */
const STORE = {};
let writes = 0;
const mock = `
  (() => {
    const UID = 'u_test_person';
    const mkSnap = (id, body) => ({ id, exists: body !== null && body !== undefined, data: () => body ? JSON.parse(JSON.stringify(body)) : undefined,
                                    metadata: { fromCache:false, hasPendingWrites:false } });
    const doc = (path) => ({
      id: path.split('/').pop(), path,
      get: async () => mkSnap(path.split('/').pop(), await window.__cloudGet(path)),
      set: async (body) => { await window.__cloudSet(path, body); },
      update: async (body) => { await window.__cloudSet(path, body); },
      delete: async () => { await window.__cloudSet(path, null); },
      onSnapshot: (next) => { return () => {}; },
      collection: () => { throw new Error('nope'); },
    });
    const db = { doc, collection: () => { throw new Error('nope'); } };
    const user = { id: async () => UID, me: async () => ({ id: UID, name:'', isOwner:true, canEdit:true }),
                   isOwner: async () => true, canEdit: async () => true, can: async () => true };
    window.claude = { use: (name) => new Promise(r => setTimeout(() => r(name==='db'?db:name==='user'?user:null), 300)) };
  })();`;

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const run = async (label, fn) => {
    const ctx = await b.newContext({ viewport:{width:390,height:844} });   // новый контекст = пустая память браузера
    const p = await ctx.newPage();
    const errors=[]; p.on('pageerror',e=>errors.push(e.message));
    await p.exposeFunction('__cloudGet', (path) => STORE[path] === undefined ? null : STORE[path]);
    await p.exposeFunction('__cloudSet', (path, body) => { writes++; if (body === null) delete STORE[path]; else STORE[path] = JSON.parse(JSON.stringify(body)); });
    await p.addInitScript(mock);
    await p.goto('http://localhost:8792/index.html');
    const out = await fn(p);
    out.errors = errors;
    await ctx.close();
    return out;
  };

  console.log('=== ВХОД 1: новый человек ===');
  let r = await run('1', async (p) => {
    await p.waitForTimeout(3500);
    const onb = await p.isVisible('#onboarding');
    await p.fill('#ob-name','Саша');
    for (let i=0;i<3;i++){ await p.click('.ob-step.active [data-ob-next]'); await p.waitForTimeout(300); }
    await p.click('.ob-step.active [data-ob-next]'); await p.waitForTimeout(300);
    await p.fill('#ob-goal','Стать богатым');
    await p.click('#ob-start'); await p.waitForTimeout(1500);
    // уходим со страницы — должно дописаться в облако
    await p.evaluate(()=>{ document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange')); });
    await p.waitForTimeout(1500);
    return { анкета: onb, приложение: await p.isVisible('#app') };
  });
  console.log('  анкета показана:', r.анкета, '| приложение открылось:', r.приложение, '| ошибки:', r.errors.length?r.errors:'нет');
  console.log('  в облаке документов:', Object.keys(STORE).length, JSON.stringify(Object.keys(STORE)), '| записей:', writes);
  const core = STORE['data/users/u_test_person/core'];
  console.log('  имя в облаке:', core && core.name, '| onboarded:', core && core.onboarded);

  console.log('\n=== ВХОД 2: память браузера пустая (как в твоём окне) ===');
  r = await run('2', async (p) => {
    await p.waitForTimeout(1200);
    const loaderText = await p.textContent('.loader-text').catch(()=>null);
    await p.waitForTimeout(3500);
    return { текстЗагрузки: loaderText, анкета: await p.isVisible('#onboarding'), приложение: await p.isVisible('#app'),
             имя: await p.evaluate(()=>State.s.name), целей: await p.evaluate(()=>State.s.goals.length),
             графикСтоит: await p.evaluate(()=>Week.installed()), делСегодня: await p.evaluate(()=>State.s.tasks.filter(t=>!t.done).length) };
  });
  console.log('  пока грузилось:', r.текстЗагрузки);
  console.log('  анкета снова?', r.анкета ? '✗ ДА — баг не починен' : '✓ нет');
  console.log('  приложение сразу:', r.приложение ? '✓' : '✗');
  console.log('  имя:', r.имя, '| целей:', r.целей, '| график по дням установлен:', r.графикСтоит, '| дел на сегодня:', r.делСегодня);
  console.log('  ошибки:', r.errors.length?r.errors:'нет');

  console.log('\n=== ВХОД 3: снова пусто, проверяем, что прогресс копится ===');
  r = await run('3', async (p) => {
    await p.waitForTimeout(4500);
    await p.evaluate(()=>{ document.querySelectorAll('.modal:not(.hidden)').forEach(m=>m.classList.add('hidden')); });
    const t = await p.evaluate(()=>{ const t=State.s.tasks.find(x=>!x.done); Screens.tasks.complete(t); return t.title; });
    await p.click('body'); await p.waitForTimeout(500);
    await p.evaluate(()=>{ Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange')); });
    await p.waitForTimeout(1500);
    return { закрыл: t };
  });
  r = await run('4', async (p) => {
    await p.waitForTimeout(4500);
    return { выполнено: await p.evaluate(()=>State.s.tasks.filter(t=>t.done).length), имя: await p.evaluate(()=>State.s.name),
             анкета: await p.isVisible('#onboarding') };
  });
  console.log('  после ещё одного входа: выполнено задач', r.выполнено, '| имя', r.имя, '| анкета', r.анкета?'✗':'нет ✓');
  console.log('\nвсего записей в облако за 4 входа:', writes);
  await b.close();
})();
