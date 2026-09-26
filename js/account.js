'use strict';
/* =========================================================
   ACCOUNT — один аккаунт на все телефоны.

   Приложение для Android (APK) и сайт на айфоне живут вне Claude,
   и своего облака у них нет — прогресс был бы на каждом телефоне свой.
   Аккаунт — это логин и пароль, которые вводятся ОДИН раз на телефоне:
   дальше телефон помнит ключ входа и сам синхронизирует прогресс
   через базу (Supabase, функции public.ldm_*). Отметил дело на Android —
   через несколько секунд оно отмечено и на айфоне.

   Для облака (cloud.js) аккаунт выглядит так же, как облако Claude:
   db.doc(path).get / set / onSnapshot. Внутри Claude аккаунт не нужен.
   ========================================================= */

const Account = (() => {
  const API = 'https://lgsharkholmydihgtvis.supabase.co/rest/v1/rpc/';
  const KEY = 'sb_publishable_LOhVqfH3mpiVFnziN1lj8w_S3qQFc5B'; // публичный ключ: даёт только вызвать функции ldm_*
  const STORE = 'ldm_account_v1';
  const POLL = 10000; // другой телефон мог что-то отметить — проверяем раз в 10 секунд и при возврате в приложение

  let acc = load();
  const lastSeen = {}; // updated_at документов, которые мы уже видели или сами записали

  function load() {
    try { const a = JSON.parse(localStorage.getItem(STORE)); return a && a.token ? a : null; } catch (e) { return null; }
  }
  function keep(a) {
    acc = a;
    try { if (a) localStorage.setItem(STORE, JSON.stringify(a)); else localStorage.removeItem(STORE); } catch (e) { /* приватный режим */ }
  }

  const inClaude = () => typeof window !== 'undefined' && !!window.claude && typeof window.claude.use === 'function';
  const available = () => !inClaude();

  const fail = (code, msg) => Object.assign(new Error(msg || code), { code });

  async function rpc(fn, args, ms) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), ms || 12000);
    try {
      const r = await fetch(API + fn, {
        method: 'POST',
        headers: { apikey: KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
        signal: ctl ? ctl.signal : undefined,
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) throw fail('unavailable', 'http ' + r.status);
      return j;
    } catch (e) {
      throw e && e.code ? e : fail('unavailable', 'network');
    } finally {
      clearTimeout(t);
    }
  }

  function device() {
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    if (window.AndroidApp) return 'android-app';
    if (/iPhone|iPad/i.test(ua)) return 'iphone';
    if (/Android/i.test(ua)) return 'android';
    return 'web';
  }

  /* create=true — новый аккаунт, иначе вход; ответ { ok, login } или { ok:false, error } */
  async function signIn(login, password, create) {
    let j;
    try {
      j = await rpc(create ? 'ldm_register' : 'ldm_login', { p_login: login, p_password: password, p_device: device() });
    } catch (e) {
      return { ok: false, error: 'network' };
    }
    if (!j.ok) return j;
    keep({ token: j.token, login: j.login });
    return { ok: true, login: j.login };
  }

  async function signOut() {
    const a = acc;
    keep(null);
    Object.keys(lastSeen).forEach((k) => delete lastSeen[k]);
    if (a) { try { await rpc('ldm_logout', { p_token: a.token }, 6000); } catch (e) { /* ключ и так забыт на телефоне */ } }
  }

  /* ключ входа отозван (вышел на другом устройстве, аккаунт удалён) — забываем его */
  function lost() {
    keep(null);
    try { UI.toast('Вход в аккаунт слетел — войди ещё раз, прогресс на телефоне цел', 'warn', '☁️'); } catch (e) {}
  }

  const snap = (j) => ({
    exists: !!j.exists,
    data: () => j.body,
    metadata: { hasPendingWrites: false, fromCache: false },
    updatedAt: j.updated_at || null,
  });

  async function getDoc(name) {
    if (!acc) throw fail('revoked');
    const j = await rpc('ldm_get', { p_token: acc.token, p_name: name });
    if (!j.ok) {
      if (j.error === 'no_session') { lost(); throw fail('revoked'); }
      throw fail('unavailable', j.error);
    }
    return snap(j);
  }

  async function setDoc(name, body) {
    if (!acc) throw fail('revoked');
    const j = await rpc('ldm_set', { p_token: acc.token, p_name: name, p_body: body });
    if (!j.ok) {
      if (j.error === 'no_session') { lost(); throw fail('revoked'); }
      throw fail('unavailable', j.error);
    }
    lastSeen[name] = j.updated_at; // своя запись — не «изменение с другого телефона»
  }

  function doc(path) {
    const name = String(path).split('/').pop();
    return {
      get: () => getDoc(name).then((s) => { lastSeen[name] = s.updatedAt; return s; }),
      set: (body) => setDoc(name, body),
      update: (body) => setDoc(name, body),
      onSnapshot(cb, onError) {
        let stopped = false;
        const tick = async () => {
          if (stopped || !acc || (typeof document !== 'undefined' && document.hidden)) return;
          try {
            const s = await getDoc(name);
            if (s.exists && s.updatedAt && s.updatedAt !== lastSeen[name]) { lastSeen[name] = s.updatedAt; cb(s); }
          } catch (e) {
            if (e.code === 'revoked') { stopped = true; if (onError) onError(e); }
          }
        };
        const iv = setInterval(tick, POLL);
        const wake = () => { if (!document.hidden) tick(); };
        document.addEventListener('visibilitychange', wake);
        window.addEventListener('online', wake);
        window.addEventListener('focus', wake);
        return () => {
          stopped = true;
          clearInterval(iv);
          document.removeEventListener('visibilitychange', wake);
          window.removeEventListener('online', wake);
          window.removeEventListener('focus', wake);
        };
      },
    };
  }

  /* для cloud.js: то же, что облако Claude отдаёт через claude.use('db') и claude.use('user') */
  function backend() {
    if (!acc || !available()) return null;
    const login = acc.login;
    return { db: { doc }, user: { id: async () => 'acc:' + login } };
  }

  /* ---------- экран входа ---------- */
  const ERR = {
    login_taken: 'Такой логин уже занят. Придумай другой — или нажми «Вход», если это твой.',
    bad_login: 'Неверный логин или пароль.',
    locked: 'Слишком много попыток. Подожди 15 минут и попробуй снова.',
    bad_login_format: 'Логин — латинские буквы, цифры, точка, дефис или _, от 3 до 32 символов.',
    bad_password: 'Пароль — минимум 6 символов.',
    network: 'Нет связи с сервером. Проверь интернет и нажми ещё раз.',
  };

  const SKIP_KEY = 'ldm_auth_skip';
  const skipped = () => { try { return localStorage.getItem(SKIP_KEY) === '1'; } catch (e) { return false; } };
  /* показать экран входа при запуске: вне Claude, не вошёл и не выбрал «без аккаунта» */
  const needGate = () => available() && !acc && !skipped();

  const seg = (mode, a, b) => `
    <div class="seg acc-seg" role="group" aria-label="Аккаунт">
      <button type="button" class="seg-btn ${mode === 'create' ? 'sel' : ''}" data-accmode="create">${a}</button>
      <button type="button" class="seg-btn ${mode === 'login' ? 'sel' : ''}" data-accmode="login">${b}</button>
    </div>`;

  const formHTML = (mode) => `
    <form class="acc-form" id="acc-form" autocomplete="on">
      <label class="field"><span>Логин</span>
        <input id="acc-login" name="username" type="text" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username" maxlength="32" placeholder="например, lenivec2026" required>
      </label>
      <label class="field"><span>Пароль ${mode === 'create' ? '(минимум 6 символов)' : ''}</span>
        <input id="acc-pass" name="password" type="password" autocomplete="${mode === 'create' ? 'new-password' : 'current-password'}" maxlength="72" required>
      </label>
      <p class="acc-err" id="acc-err" role="alert"></p>
      <button class="btn btn-primary btn-lg btn-block" id="acc-go" type="submit">${mode === 'create' ? 'Зарегистрироваться' : 'Войти'}</button>
    </form>
    ${mode === 'create' ? '<p class="muted small">Запиши логин и пароль в заметки — они понадобятся один раз на втором телефоне.</p>' : '<p class="muted small">Тот же логин и пароль, что на другом телефоне. Весь прогресс сразу будет здесь.</p>'}`;

  /* форма: переключатель регистрация/вход, ошибки по-русски, onDone({ ok, login, created }) */
  function bindForm(root, getMode, setMode, onDone) {
    root.querySelectorAll('[data-accmode]').forEach((b) => { b.onclick = () => setMode(b.dataset.accmode); });
    const form = root.querySelector('#acc-form');
    if (!form) return;
    const errEl = root.querySelector('#acc-err');
    const go = root.querySelector('#acc-go');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const create = getMode() === 'create';
      const login = root.querySelector('#acc-login').value.trim();
      const pass = root.querySelector('#acc-pass').value;
      errEl.textContent = '';
      go.disabled = true;
      go.textContent = '⏳ Секунду…';
      const res = await signIn(login, pass, create);
      if (!res.ok) {
        errEl.textContent = ERR[res.error] || 'Не получилось. Попробуй ещё раз.';
        go.disabled = false;
        go.textContent = create ? 'Зарегистрироваться' : 'Войти';
        return;
      }
      try { localStorage.removeItem(SKIP_KEY); } catch (e2) {}
      onDone(Object.assign({ created: create }, res));
    };
  }

  /* ---------- первый экран: регистрация или вход ---------- */
  function gate(root, opts) {
    let mode = 'create';
    const render = () => {
      root.innerHTML = `
        <div class="auth-gate">
          <div class="ob-emoji">🦥</div>
          <h1>Из Ленивца<br>в Миллионеры</h1>
          <p class="muted">Один аккаунт на Android и айфон. Зарегистрируйся один раз — задания, уровень и серия будут общими на всех телефонах.</p>
          ${seg(mode, 'Регистрация', 'Вход')}
          ${formHTML(mode)}
          <button type="button" class="auth-skip" id="auth-skip">Продолжить без аккаунта</button>
        </div>`;
      bindForm(root, () => mode, (m) => { mode = m; render(); }, opts.onDone);
      root.querySelector('#auth-skip').onclick = () => {
        try { localStorage.setItem(SKIP_KEY, '1'); } catch (e) {}
        opts.onSkip();
      };
    };
    render();
  }

  /* ---------- окно аккаунта внутри приложения ---------- */
  function open(opts) {
    const o = opts || {};
    let mode = o.mode || (acc ? 'me' : 'create');
    const render = () => {
      const body = UI.sheet(mode === 'me' ? `
        <div class="acc-sheet">
          <div class="why-tag">Один аккаунт на все телефоны</div>
          <h2>☁️ Ты вошёл как <b>${UI.esc(acc ? acc.login : '')}</b></h2>
          <p class="muted">Прогресс сам синхронизируется между телефонами: отметил дело на одном — секунд через 10 оно отмечено на другом. Входить заново не нужно.</p>
          <p class="acc-state">${typeof Cloud !== 'undefined' && Cloud.ready ? '✅ Синхронизация работает' : '⏳ Нет связи — сохраню, когда появится интернет'}</p>
          <p class="muted small">На другом телефоне открой приложение → «Вход» → этот же логин и пароль.</p>
          <button class="btn btn-ghost btn-block" id="acc-out">Выйти из аккаунта на этом телефоне</button>
        </div>` : `
        <div class="acc-sheet">
          <div class="why-tag">Входишь один раз — дальше телефон помнит</div>
          <h2>☁️ Один аккаунт на все телефоны</h2>
          <p class="muted">Отметил дело на Android — оно появится и на айфоне. Уровень, серия и задания — общие.</p>
          ${seg(mode, 'Регистрация', 'Вход')}
          ${formHTML(mode)}
        </div>`);

      const out = body.querySelector('#acc-out');
      if (out) {
        out.onclick = async () => {
          await signOut();
          if (typeof Cloud !== 'undefined') Cloud.reset();
          UI.closeModal('#sheet-modal');
          UI.toast('Вышел из аккаунта. Прогресс остался на этом телефоне', 'default', '☁️');
          if (typeof App !== 'undefined') App.renderActive();
        };
        return;
      }
      bindForm(body, () => mode, (m) => { mode = m; render(); }, (res) => {
        UI.closeModal('#sheet-modal');
        if (typeof App !== 'undefined' && App.accountConnected) App.accountConnected(res.created);
        if (o.onDone) o.onDone(res);
      });
      setTimeout(() => { const f = body.querySelector('#acc-login'); if (f) f.focus(); }, 250);
    };
    render();
  }

  /* строка на «Моих заданиях»: позвать войти или показать, что всё синхронизируется */
  function line() {
    if (!available()) return '';
    if (acc) return `<button class="lv-account on" data-account>☁️ ${UI.esc(acc.login)} · прогресс общий на всех телефонах</button>`;
    return `<button class="lv-account" data-account>☁️ Войти — и прогресс будет на всех телефонах</button>`;
  }

  /* в анкете (если выбрал «без аккаунта») — всё ещё можно войти */
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      const b = document.getElementById('ob-account');
      if (!b || !available()) return;
      b.hidden = false;
      b.onclick = () => open({ mode: 'login' });
    });
  }

  return {
    available, backend, signIn, signOut, open, line, gate, needGate,
    get signedIn() { return !!acc; },
    get login() { return acc ? acc.login : null; },
  };
})();
