const { chromium } = require('playwright');
/* Один аккаунт на все телефоны. Сервер (Supabase, функции ldm_*) подменён поддельным
   с теми же правилами. Android создаёт аккаунт — прогресс уходит в него; айфон входит
   один раз вместо анкеты — прогресс уже там; дело, отмеченное на айфоне, появляется на Android. */
const API = 'https://lgsharkholmydihgtvis.supabase.co/rest/v1/rpc/';
const server = { accounts: {}, sessions: {}, docs: {}, calls: [] };
let clock = 0;
function handle(fn, a) {
  server.calls.push(fn);
  const acc = (t) => server.sessions[t];
  const login = String(a.p_login || '').trim().toLowerCase();
  switch (fn) {
    case 'ldm_register':
      if (!/^[a-z0-9_.-]{3,32}$/.test(login)) return { ok: false, error: 'bad_login_format' };
      if ((a.p_password || '').length < 6) return { ok: false, error: 'bad_password' };
      if (server.accounts[login]) return { ok: false, error: 'login_taken' };
      server.accounts[login] = a.p_password;
      return session(login);
    case 'ldm_login':
      if (server.accounts[login] !== a.p_password) return { ok: false, error: 'bad_login' };
      return session(login);
    case 'ldm_get': {
      const l = acc(a.p_token); if (!l) return { ok: false, error: 'no_session' };
      const d = server.docs[l + '/' + a.p_name];
      return d ? { ok: true, exists: true, body: d.body, updated_at: d.at } : { ok: true, exists: false };
    }
    case 'ldm_set': {
      const l = acc(a.p_token); if (!l) return { ok: false, error: 'no_session' };
      const at = new Date(Date.UTC(2026, 8, 26) + (++clock) * 1000).toISOString();
      server.docs[l + '/' + a.p_name] = { body: a.p_body, at };
      return { ok: true, updated_at: at };
    }
    case 'ldm_logout': delete server.sessions[a.p_token]; return { ok: true };
    default: return { ok: false, error: 'unknown' };
  }
}
function session(login) { const t = 'tok' + Math.random().toString(16).slice(2); server.sessions[t] = login; return { ok: true, token: t, login }; }

async function phone(b, name) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 793 } });
  await ctx.route(API + '*', async (route) => {
    const fn = route.request().url().split('/').pop();
    const body = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(handle(fn, body)) });
  });
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(name + ': ' + e.message));
  return p;
}
const closeModals = (p) => p.evaluate(() => document.querySelectorAll('.modal.modal-open').forEach((m) => { if (m.id !== 'sheet-modal') UI.closeModal('#' + m.id); })).then(() => p.waitForTimeout(350));
const quests = (p) => p.evaluate(() => { const k = State.todayKey(); return ['kino', 'orca'].filter((id) => Levels.isDone(id, k)); });

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let ok = true; const check = (n, c, i) => { console.log((c ? '✓ ' : '✗ ') + n, i !== undefined ? JSON.stringify(i).slice(0, 300) : ''); if (!c) ok = false; };

  // --- Android: уже пользуется, прогресс на телефоне; создаёт аккаунт ---
  const A = await phone(b, 'android');
  await A.goto('http://localhost:8792/index.html'); await A.waitForTimeout(800);
  await A.evaluate(() => { State.s.onboarded = true; State.s.name = 'Тест'; State.s.mode = 'adhd'; State.save(); location.reload(); });
  await A.waitForTimeout(2500);
  const line0 = await A.textContent('#mytasks-root .lv-account');
  check('на «Моих заданиях» зовёт войти', /Войти/.test(line0), line0);
  await A.click('#mytasks-root [data-lvdone="kino"]'); await A.waitForTimeout(600); await closeModals(A);
  await A.click('#mytasks-root .lv-account'); await A.waitForTimeout(400);
  await A.fill('#acc-login', 'Lenivec'); await A.fill('#acc-pass', '123');
  await A.click('#acc-go'); await A.waitForTimeout(400);
  check('короткий пароль — понятная ошибка', /минимум 6/.test(await A.textContent('#acc-err')));
  await A.fill('#acc-pass', 'secret123');
  await A.click('#acc-go'); await A.waitForTimeout(1500);
  const core = server.docs['lenivec/core'];
  check('аккаунт создан, прогресс телефона ушёл в аккаунт', !!core && core.body.onboarded && core.body.name === 'Тест', core && Object.keys(core.body).length);
  const line1 = await A.textContent('#mytasks-root .lv-account');
  check('строка показывает аккаунт', /lenivec · прогресс общий/.test(line1), line1);

  // --- айфон: новый телефон, вместо анкеты — «У меня уже есть аккаунт» ---
  const I = await phone(b, 'iphone');
  await I.goto('http://localhost:8792/index.html'); await I.waitForTimeout(2200);
  check('в анкете есть «У меня уже есть аккаунт»', await I.isVisible('#ob-account'));
  await I.click('#ob-account'); await I.waitForTimeout(300);
  await I.fill('#acc-login', 'lenivec'); await I.fill('#acc-pass', 'wrong-pass');
  await I.click('#acc-go'); await I.waitForTimeout(400);
  check('неверный пароль — понятная ошибка', /Неверный логин или пароль/.test(await I.textContent('#acc-err')));
  await I.fill('#acc-pass', 'secret123');
  await I.click('#acc-go'); await I.waitForTimeout(1800);
  const iState = await I.evaluate(() => ({ ob: document.querySelector('#onboarding').classList.contains('hidden'), name: State.s.name, onb: State.s.onboarded }));
  check('вошёл — анкеты нет, прогресс из аккаунта на айфоне', iState.ob && iState.onb && iState.name === 'Тест', iState);
  check('отметка «кино» с Android видна на айфоне', (await quests(I)).includes('kino'), await quests(I));

  // --- айфон отмечает «orca» — через несколько секунд это на Android ---
  await closeModals(I);
  await I.click('#mytasks-root [data-lvdone="orca"]'); await I.waitForTimeout(600); await closeModals(I); await I.waitForTimeout(3500);
  check('айфон отправил отметку в аккаунт', JSON.stringify(server.docs['lenivec/core'].body).includes('"orca"'));
  // Android всё это время лежал открытым и сохранялся сам (таймеры) — это не должно перебить свежую отметку
  await A.evaluate(() => { State.save(); State.save(); });
  await A.evaluate(() => window.dispatchEvent(new Event('focus'))); await A.waitForTimeout(1500);
  check('Android подтянул отметку с айфона', (await quests(A)).includes('orca'), await quests(A));

  // --- телефон перезапустили: входить заново не нужно ---
  await I.reload(); await I.waitForTimeout(2500);
  const again = await I.evaluate(() => ({ signed: Account.signedIn, login: Account.login, cloud: Cloud.ready, ob: document.querySelector('#onboarding').classList.contains('hidden') }));
  check('после перезапуска — всё ещё в аккаунте, без входа', again.signed && again.login === 'lenivec' && again.cloud && again.ob, again);

  // --- выход на Android не трогает прогресс телефона ---
  await closeModals(A);
  await A.click('#mytasks-root .lv-account'); await A.waitForTimeout(300);
  await A.click('#acc-out'); await A.waitForTimeout(500);
  const out = await A.evaluate(() => ({ signed: Account.signedIn, cloud: Cloud.status, name: State.s.name, line: document.querySelector('#mytasks-root .lv-account').textContent }));
  check('вышел — прогресс на телефоне остался, строка снова зовёт войти', !out.signed && out.cloud === 'off' && out.name === 'Тест' && /Войти/.test(out.line), out);

  // --- занятый логин ---
  await A.click('#mytasks-root .lv-account'); await A.waitForTimeout(300);
  await A.fill('#acc-login', 'lenivec'); await A.fill('#acc-pass', 'secret123');
  await A.click('#acc-go'); await A.waitForTimeout(400);
  check('занятый логин — подсказка войти', /уже занят/.test(await A.textContent('#acc-err')));

  check('без ошибок на страницах', A.errs.length === 0 && I.errs.length === 0, A.errs.concat(I.errs));

  // --- внутри Claude аккаунт не нужен: там своё облако ---
  const C = await b.newPage({ viewport: { width: 393, height: 793 } });
  await C.addInitScript(() => { window.claude = { use: () => Promise.resolve(null) }; });
  await C.goto('http://localhost:8792/index.html'); await C.waitForTimeout(1500);
  const inClaude = await C.evaluate(() => ({ btn: !document.getElementById('ob-account').hidden, line: Account.line(), avail: Account.available() }));
  check('в Claude — без аккаунта и без кнопок входа', !inClaude.btn && inClaude.line === '' && !inClaude.avail, inClaude);

  await b.close();
  console.log(ok ? '\nВСЁ ОК' : '\nЕСТЬ ОШИБКИ'); process.exit(ok ? 0 : 1);
})();
