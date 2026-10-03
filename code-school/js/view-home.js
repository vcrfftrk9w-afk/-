/* Главная: приветствие, «продолжить», карта курса по модулям. */
(function () {
  function ring(pct, size) {
    const r = (size - 10) / 2, c = 2 * Math.PI * r;
    return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}"/>
    </svg><span class="ring-txt">${pct}%</span>`;
  }

  function render(root) {
    const s = Store.s;
    const ov = Course.overall();
    const cur = Course.current();
    const lv = Progress.levelInfo(s.xp);
    const first = ov.done === 0;
    const greet = s.name ? `Привет, ${UI.esc(s.name)}!` : 'Привет, будущий разработчик игр!';
    root.innerHTML = `
    <section class="hero">
      <div class="hero-text">
        <h1>${first ? 'Научись программировать игры <span class="grad">с нуля</span>' : greet}</h1>
        <p class="lead">${first
          ? 'Всё объясняется по-русски и простыми словами. Английский знать не нужно: каждое слово в коде переводится — просто наведи на него или поставь курсор.'
          : `Ты прошёл ${ov.done} из ${ov.total} уроков. ${ov.pct < 100 ? 'Продолжаем!' : 'Курс пройден — ты молодец! 🏆'}`}</p>
        <div class="hero-btns">
          ${cur ? `<a class="btn primary big" href="#/lesson/${cur.id}">${first ? '🚀 Начать первый урок' : '▶ Продолжить: ' + UI.esc(cur.title)}</a>` : `<a class="btn primary big" href="#/profile">🏆 Получить сертификат</a>`}
          <a class="btn big" href="#/sandbox">🧪 Песочница</a>
        </div>
        ${first ? `<ul class="hero-points">
          <li>🎮 <b>${Course.modules().length} модулей, ${ov.total} уроков</b> — от первой строчки кода до своих игр: змейка, арканоид, Flappy Bird, платформер, космический шутер</li>
          <li>💻 Код пишется и запускается прямо здесь — ничего устанавливать не нужно</li>
          <li>🤖 Каждое задание проверяется автоматически, ошибки объясняются по-русски</li>
          <li>🏆 Опыт, уровни, достижения и сертификат в конце</li>
        </ul>` : ''}
      </div>
      <div class="hero-card">
        <div class="ring-wrap">${ring(ov.pct, 132)}</div>
        <div class="hero-level"><span class="lv-icon">${lv.icon}</span><div><b>${lv.title}</b><small>Уровень ${lv.n} · ${s.xp} XP</small></div></div>
        <div class="bar"><i style="width:${lv.pct}%"></i></div>
        <small class="muted">${lv.max ? 'Максимальный уровень!' : `До «${lv.nextTitle}»: ${lv.to - s.xp} XP`}</small>
        <div class="hero-stats">
          <div><b>🔥 ${s.streak.count || 0}</b><small>дней подряд</small></div>
          <div><b>✅ ${ov.done}</b><small>уроков</small></div>
          <div><b>🏅 ${Object.keys(s.ach).filter((k) => s.ach[k] && s.ach[k] !== true).length}</b><small>наград</small></div>
        </div>
      </div>
    </section>
    <h2 class="section-title">🗺️ Карта курса</h2>
    <div class="modules">${Course.modules().map((m, mi) => moduleCard(m, mi, cur)).join('')}</div>
    <footer class="foot">ИгроКод · учись в своём темпе · прогресс сохраняется в этом браузере (в профиле можно перенести на другое устройство)</footer>`;
    root.querySelectorAll('.mod-toggle').forEach((b) => b.addEventListener('click', () => {
      const card = b.closest('.module');
      card.classList.toggle('open');
      b.setAttribute('aria-expanded', card.classList.contains('open'));
    }));
  }

  function moduleCard(m, mi, cur) {
    const p = Course.moduleProgress(m);
    const isCur = cur && cur._m === m;
    const open = isCur || (mi === 0 && p.done === 0);
    const locked = !Course.isUnlocked(m.lessons[0].id);
    return `<article class="module ${open ? 'open' : ''} ${p.pct === 100 ? 'complete' : ''} ${locked ? 'locked' : ''} ${m.project ? 'project' : ''}" style="--mc:${m.color || 'var(--accent)'}">
      <button class="mod-toggle" type="button" aria-expanded="${open}">
        <span class="mod-icon">${m.icon}</span>
        <span class="mod-info"><small>${m.project ? 'Игровой проект' : 'Модуль ' + (mi + 1)}</small><b>${UI.esc(m.title)}</b><span class="mod-desc">${UI.esc(m.desc)}</span></span>
        <span class="mod-prog">${p.pct === 100 ? '<span class="done-badge">✓</span>' : locked ? '🔒' : `<span class="mini-ring" style="--p:${p.pct}"></span>`}<small>${p.done}/${p.total}</small></span>
      </button>
      <ol class="lessons">${m.lessons.map((l, li) => {
        const done = Course.isDone(l.id);
        const un = Course.isUnlocked(l.id);
        const isNow = cur && cur.id === l.id;
        const kind = l.task ? (l.task.canvas ? '🎨' : '💻') : '📖';
        return `<li class="${done ? 'done' : ''} ${isNow ? 'now' : ''} ${un ? '' : 'locked'}">
          ${un ? `<a href="#/lesson/${l.id}">` : '<span>'}
          <span class="l-dot">${done ? '✓' : un ? li + 1 : '🔒'}</span>
          <span class="l-title">${UI.esc(l.title)}</span>
          <span class="l-kind" title="${l.task ? (l.task.canvas ? 'Рисуем на холсте' : 'Задание с кодом') : 'Теория'}">${kind}</span>
          ${un ? '</a>' : '</span>'}
        </li>`;
      }).join('')}</ol>
    </article>`;
  }

  window.ViewHome = { render };
})();
