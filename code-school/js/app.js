/* Переходы между экранами (#/, #/lesson/id, #/sandbox, #/dict, #/profile), шапка и тема. */
(function () {
  const main = () => document.getElementById('main');
  let leaving = null;

  function applyTheme() {
    const t = Store.s.settings.theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }

  function refreshHeader() {
    const s = Store.s;
    const lv = Progress.levelInfo(s.xp);
    const box = document.getElementById('hdr-stats');
    if (!box) return;
    box.innerHTML = `<span class="hs" title="Дней подряд">🔥 ${s.streak.count || 0}</span>` +
      `<a class="hs lvl" href="#/profile" title="${lv.title}: ${s.xp} XP"><span>${lv.icon}</span><span class="hs-xp">${s.xp} XP</span><i style="width:${lv.pct}%"></i></a>`;
  }

  function route() {
    if (leaving) { try { leaving(); } catch (e) {} leaving = null; }
    UI.hideTip();
    const h = location.hash.replace(/^#\/?/, '');
    const [page, arg] = h.split('/');
    const root = main();
    document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.page === (page || 'home') || (page === 'lesson' && a.dataset.page === 'home')));
    document.body.dataset.page = page || 'home';
    root.classList.remove('enter');
    void root.offsetWidth;
    root.classList.add('enter');
    if (page === 'lesson' && arg) { ViewLesson.render(root, decodeURIComponent(arg)); leaving = ViewLesson.leave; }
    else if (page === 'sandbox') { ViewExtra.renderSandbox(root); leaving = ViewExtra.leave; }
    else if (page === 'dict') ViewExtra.renderDict(root);
    else if (page === 'profile') ViewExtra.renderProfile(root);
    else ViewHome.render(root);
    window.scrollTo({ top: 0 });
    refreshHeader();
    root.focus({ preventScroll: true });
  }

  function start() {
    applyTheme();
    matchMedia('(prefers-color-scheme: dark)').addEventListener && matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    window.addEventListener('hashchange', route);
    Store.onChange(refreshHeader);
    route();
    Progress.checkAchievements();
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  window.App = { route, refreshHeader, applyTheme };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
