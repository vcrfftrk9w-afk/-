/* Интерфейс: выделение, что делает нажатие, панель приказов, верхняя строка, меню. */
const UI = (() => {
  const st = { sel: [], placing: null, ghost: null, box: null, boxMode: false, amove: false, paused: true, ended: false };
  const $ = (id) => document.getElementById(id);
  let sig = '', tick = 0, toastT = null, lastTap = { t: 0, type: null };
  const mine = () => st.sel.filter((e) => e.team === 0);
  const selUnits = () => mine().filter((e) => e.def.kind === 'unit');
  const selBuilders = () => selUnits().filter((e) => e.def.builds);

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2200);
  }

  function marker(x, y, color) { Game.s.effects.push({ type: 'marker', x, y, t: 0, life: 0.6, color }); }

  /* ---------- что выбрано под пальцем ---------- */
  function pick(w) {
    const s = Game.s, tol = 10 / Render.cam.z;
    let best = null, bd = Infinity;
    for (const e of s.ents) {
      if (!Game.visibleTo(0, e)) continue;
      let d;
      if (e.def.kind === 'building') { const h = e.size * TILE / 2; d = Math.abs(w.x - e.x) <= h && Math.abs(w.y - e.y) <= h ? 30 : Infinity; }
      else { d = Math.hypot(w.x - e.x, w.y - e.y); if (d > e.radius + tol) d = Infinity; else if (e.air) d -= 20; }
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function select(list) { st.sel = list; st.amove = false; cancelPlacing(); }

  function tap(w, { shift = false, touch = false } = {}) {
    if (st.placing) return tryPlace(w, touch);
    const e = pick(w), units = selUnits();
    if (st.amove && units.length) { Game.orderMove(units, w.x, w.y, true); marker(w.x, w.y, '#ff8a8a'); st.amove = false; return; }
    if (e && e.team === 0) {
      if (e.def.kind === 'building' && e.built < 1 && selBuilders().length) { selBuilders().forEach((b) => Game.orderAssist(b, e)); marker(e.x, e.y); return; }
      const now = performance.now();
      if (now - lastTap.t < 350 && lastTap.type === e.type && e.def.kind === 'unit') { selectSameOnScreen(e.type); lastTap.t = 0; return; }
      lastTap = { t: now, type: e.type };
      if (shift && e.def.kind === 'unit') select(st.sel.includes(e) ? st.sel.filter((x) => x !== e) : [...mine(), e]);
      else select([e]);
      return;
    }
    if (e && units.some((u) => u.def.weapon)) { Game.orderAttack(units, e); marker(e.x, e.y, '#ff8a8a'); return; }
    if (e) { select([e]); return; }
    if (units.length) { Game.orderMove(units, w.x, w.y); marker(w.x, w.y); return; }
    const b = mine()[0];
    if (b && b.def.produces && b.type !== 'command') { b.rally = { x: w.x, y: w.y }; toast('Точка сбора поставлена'); return; }
    select([]);
  }

  // правая кнопка мыши: приказ, без смены выделения
  function command(w) {
    if (st.placing) { cancelPlacing(); return; }
    const e = pick(w), units = selUnits();
    if (units.length) {
      if (e && e.team !== 0) { Game.orderAttack(units, e); marker(e.x, e.y, '#ff8a8a'); }
      else if (e && e.def.kind === 'building' && e.built < 1 && selBuilders().length) selBuilders().forEach((b) => Game.orderAssist(b, e));
      else { Game.orderMove(units, w.x, w.y, st.amove); marker(w.x, w.y, st.amove ? '#ff8a8a' : undefined); st.amove = false; }
      return;
    }
    const b = mine()[0];
    if (b && b.def.produces) { b.rally = { x: w.x, y: w.y }; marker(w.x, w.y); }
  }

  function boxSelect(a, b, shift) {
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    const got = Game.s.ents.filter((e) => e.team === 0 && e.def.kind === 'unit' && e.x >= x0 && e.x <= x1 && e.y >= y0 && e.y <= y1);
    select(shift ? [...new Set([...selUnits(), ...got])] : got);
  }

  function selectSameOnScreen(type) {
    const { w, h } = Render.size, a = Render.toWorld(0, 0), b = Render.toWorld(w, h);
    select(Game.s.ents.filter((e) => e.team === 0 && e.type === type && e.x > a.x && e.x < b.x && e.y > a.y && e.y < b.y));
  }

  function selectArmy() {
    const army = Game.s.ents.filter((e) => e.team === 0 && e.def.kind === 'unit' && e.def.weapon);
    select(army);
    if (!army.length) toast('Армии пока нет — постройте завод');
  }

  /* ---------- стройка ---------- */
  function cancelPlacing() { st.placing = null; st.ghost = null; }

  function ghostAt(w) {
    const type = st.placing, def = DEFS[type], n = def.size;
    let tx = Math.round(w.x / TILE - n / 2), ty = Math.round(w.y / TILE - n / 2);
    if (def.onPool) { const p = Game.snapPool(w.x, w.y); if (p) { tx = p.tx; ty = p.ty; } }
    const ok = Game.canPlace(type, 0, tx, ty);
    return { type, tx, ty, ok: ok === true, why: ok };
  }

  function hover(w) { if (st.placing) st.ghost = ghostAt(w); }

  // с пальца: первое нажатие показывает место, второе на то же место — строит
  function tryPlace(w, touch) {
    const g = ghostAt(w);
    if (touch && (!st.ghost || st.ghost.tx !== g.tx || st.ghost.ty !== g.ty)) {
      st.ghost = g; toast(g.ok ? 'Нажмите ещё раз — построить здесь' : g.why); return;
    }
    if (!g.ok) { st.ghost = g; toast(g.why); return; }
    const bs = selBuilders();
    const cx = (g.tx + DEFS[g.type].size / 2) * TILE, cy = (g.ty + DEFS[g.type].size / 2) * TILE;
    const first = bs.slice().sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
    const res = Game.orderBuild(first, g.type, g.tx, g.ty);
    if (typeof res === 'string') { toast(res); return; }
    bs.filter((b) => b !== first).forEach((b) => Game.orderAssist(b, res));
    marker(cx, cy);
    cancelPlacing();
  }

  /* ---------- панель приказов ---------- */
  const btn = (act, type, label, cost, extra = '') =>
    `<button class="act" data-act="${act}" data-type="${type}" ${cost ? `data-cost="${cost}"` : ''}>
      <img src="${Sprites.icon(type)}" alt=""><span class="lbl">${label}</span>${cost ? `<span class="cost">${cost}</span>` : ''}${extra}</button>`;

  function panelHTML() {
    const m = mine(), units = selUnits();
    if (!st.sel.length) return { info: '<div class="hint">Нажмите на юнита или здание. «Армия» — выбрать все войска.</div>', acts: '' };
    const e = st.sel[0];
    if (e.team !== 0) return { info: infoHTML(e, `Противник · ${TEAM_NAMES[e.team]}`), acts: '' };
    if (units.length) {
      const groups = {};
      for (const u of units) groups[u.type] = (groups[u.type] || 0) + 1;
      const txt = Object.entries(groups).map(([t, n]) => `${DEFS[t].name}${n > 1 ? ' ×' + n : ''}`).join(', ');
      const info = units.length === 1 ? infoHTML(units[0], DEFS[units[0].type].hint) : `<div class="name">${units.length} юнит.</div><div class="sub">${txt}</div>`;
      let acts = '';
      if (selBuilders().length) acts += selBuilders()[0].def.builds.map((t) => btn('build', t, DEFS[t].name, DEFS[t].cost)).join('');
      if (units.some((u) => u.def.weapon)) acts += '<button class="act txt" data-act="amove">⚔<span class="lbl">В атаку</span></button>';
      acts += '<button class="act txt" data-act="stop">■<span class="lbl">Стоп</span></button>';
      return { info, acts };
    }
    const b = m[0];
    let acts = '';
    if (b.built < 1) return { info: infoHTML(b, 'Строится…'), acts: '' };
    if (b.def.produces) {
      acts = b.def.produces.map((t) => btn('make', t, DEFS[t].name, DEFS[t].cost, '<span class="badge" hidden></span>')).join('');
      acts += '<button class="act txt" data-act="unqueue">↶<span class="lbl">Отменить</span></button>';
    }
    if (b.def.upgrade && b.level === 1) acts += btn('upgrade', b.type, b.upg ? 'Улучшается' : 'Улучшить', b.upg ? 0 : b.def.upgrade.cost);
    const hint = b.def.produces && b.type !== 'command' ? 'Нажмите на карту — точка сбора' : b.level > 1 ? 'Улучшен' : b.def.hint || '';
    return { info: infoHTML(b, hint), acts };
  }

  function infoHTML(e, sub) {
    return `<img class="big" src="${Sprites.icon(e.type, e.team)}" alt=""><div><div class="name">${e.def.name}</div>
      <div class="hp"><i style="width:${Math.round((e.hp / e.maxHp) * 100)}%"></i></div><div class="sub">${sub || ''}</div></div>`;
  }

  function signature() {
    return st.sel.map((e) => e.id + ':' + (e.built >= 1 ? 1 : 0) + (e.level || '') + (e.upg ? 'u' : '')).join(',');
  }

  function rebuildPanel() {
    const { info, acts } = panelHTML();
    $('info').innerHTML = info;
    $('acts').innerHTML = acts;
  }

  function refreshDynamic(s) {
    const c = s.credits[0];
    for (const b of document.querySelectorAll('#acts [data-cost]')) b.classList.toggle('poor', c < +b.dataset.cost);
    const f = mine()[0];
    if (f && f.queue) for (const b of document.querySelectorAll('#acts [data-act="make"]')) {
      const n = f.queue.filter((t) => t === b.dataset.type).length, badge = b.querySelector('.badge');
      badge.hidden = !n; badge.textContent = n;
      b.style.setProperty('--prog', f.queue[0] === b.dataset.type ? f.prog / DEFS[f.queue[0]].buildTime : 0);
    }
    const hp = document.querySelector('#info .hp i');
    if (hp && st.sel[0]) hp.style.width = Math.round((st.sel[0].hp / st.sel[0].maxHp) * 100) + '%';
    $('amove-flag').hidden = !st.amove;
  }

  function onAction(ev) {
    const el = ev.target.closest('.act');
    if (!el) return;
    const act = el.dataset.act, type = el.dataset.type, s = Game.s, f = mine()[0];
    if (act === 'build') {
      if (s.credits[0] < DEFS[type].cost) { toast('Не хватает кредитов'); return; }
      st.placing = type; st.ghost = null; toast(DEFS[type].onPool ? 'Нажмите на зелёный источник' : 'Выберите место на карте');
    } else if (act === 'make') { const r = Game.enqueue(f, type); if (r !== true) toast(r); }
    else if (act === 'unqueue') { if (f.queue.length) Game.dequeue(f, f.queue[f.queue.length - 1]); }
    else if (act === 'upgrade') { const r = Game.upgrade(f); if (r !== true) toast(r); sig = ''; }
    else if (act === 'stop') Game.orderStop(selUnits());
    else if (act === 'amove') { st.amove = !st.amove; if (st.amove) toast('Нажмите на карту: войска пойдут и будут бить всех по пути'); }
  }

  /* ---------- игра: старт, пауза, конец ---------- */
  function start(difficulty) {
    const s = Game.newGame({ difficulty });
    Render.setMap(s.map);
    const cc = s.ents.find((e) => e.team === 0 && e.type === 'command');
    Render.cam.z = 1; Render.centerOn(cc.x + 120, cc.y - 80);
    select([]); sig = 'x'; st.ended = false; st.paused = false; st.difficulty = difficulty;
    $('menu').hidden = true; $('end').hidden = true; $('pause').hidden = true; $('hud').hidden = false;
    toast('Выберите строителя и поставьте добытчик на зелёный источник');
  }

  function setPaused(p) { if (st.ended || !Game.s) return; st.paused = p; $('pause').hidden = !p; }

  function showEnd(s) {
    st.ended = true; st.paused = true;
    const win = s.winner === 0, m = Math.floor(s.time / 60), sec = String(Math.floor(s.time % 60)).padStart(2, '0');
    $('end-title').textContent = win ? 'Победа' : 'Поражение';
    $('end-text').textContent = win ? 'Штаб противника уничтожен.' : 'Ваш штаб уничтожен.';
    $('end-stats').innerHTML = `<div><b>${m}:${sec}</b>длилась битва</div><div><b>${s.stats[0].built}</b>юнитов построено</div>
      <div><b>${s.stats[1].lost}</b>врагов уничтожено</div><div><b>${s.stats[0].lost}</b>своих потеряно</div>`;
    $('end').hidden = false;
  }

  function update(dt) {
    const s = Game.s;
    if (!s) return;
    if (s.winner !== null && !st.ended) showEnd(s);
    if (st.sel.some((e) => e.dead)) st.sel = st.sel.filter((e) => !e.dead);
    tick -= dt;
    if (tick > 0) return;
    tick = 0.15;
    const sg = signature();
    if (sg !== sig) { sig = sg; rebuildPanel(); }
    refreshDynamic(s);
    const inc = Game.income(0), units = s.ents.filter((e) => e.team === 0 && e.def.kind === 'unit').length;
    $('credits').textContent = Math.floor(s.credits[0]);
    $('income').textContent = `+${inc.toFixed(0)}/с`;
    $('units').textContent = `${units}/${UNIT_CAP}`;
    $('clock').textContent = `${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, '0')}`;
  }

  function init() {
    $('acts').addEventListener('click', onAction);
    $('acts').addEventListener('contextmenu', (ev) => {   // правой кнопкой по юниту в очереди — убрать
      ev.preventDefault();
      const el = ev.target.closest('[data-act="make"]'), f = mine()[0];
      if (el && f) Game.dequeue(f, el.dataset.type);
    });
    for (const b of document.querySelectorAll('[data-diff]')) b.addEventListener('click', () => {
      document.querySelectorAll('[data-diff]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      st.difficulty = b.dataset.diff;
    });
    st.difficulty = 'normal';
    $('play').addEventListener('click', () => start(st.difficulty));
    $('again').addEventListener('click', () => start(st.difficulty));
    $('to-menu').addEventListener('click', () => { $('end').hidden = true; $('menu').hidden = false; });
    $('btn-pause').addEventListener('click', () => setPaused(true));
    $('resume').addEventListener('click', () => setPaused(false));
    $('restart').addEventListener('click', () => start(st.difficulty));
    $('quit').addEventListener('click', () => { $('pause').hidden = true; $('hud').hidden = true; $('menu').hidden = false; st.ended = true; });
    $('t-box').addEventListener('click', () => { st.boxMode = !st.boxMode; $('t-box').setAttribute('aria-pressed', st.boxMode); toast(st.boxMode ? 'Рамка: проведите пальцем, чтобы выделить группу' : 'Палец двигает карту'); });
    $('t-army').addEventListener('click', selectArmy);
    $('t-none').addEventListener('click', () => select([]));
    $('t-home').addEventListener('click', () => { const cc = Game.s.ents.find((e) => e.team === 0 && e.type === 'command'); if (cc) Render.centerOn(cc.x, cc.y); });
  }

  return { init, update, tap, command, hover, boxSelect, select, selectArmy, cancelPlacing, setPaused, toast, start, state: st };
})();
