/* Все проверки, кроме tests/account.js, — про человека без аккаунта:
   он нажал «Продолжить без аккаунта», поэтому экран входа при запуске не показывается.
   Подключается вместо require('playwright'). */
const pw = require('playwright');

const SKIP = () => { try { localStorage.setItem('ldm_auth_skip', '1'); } catch (e) {} };
const launch = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = async (...args) => {
  const b = await launch(...args);
  const newContext = b.newContext.bind(b);
  b.newContext = async (...o) => { const c = await newContext(...o); await c.addInitScript(SKIP); return c; };
  return b;
};

module.exports = pw;
