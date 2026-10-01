'use strict';
// Интерфейс поверх холста: HUD, инвентарь, крафт, контейнеры, печи, карта.

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

const UI = {
  dirty: true, queueDirty: true, fireDirty: true, sel: null, imgs: {}, cat: 'tools', confirmNew: false,

  init() {
    const hb = $('#hotbar');
    hb.innerHTML = Array.from({ length: HOTBAR }, (_, i) => `<button class="slot" data-hot="${i}" aria-label="Ячейка ${i + 1}"><b class="key">${i + 1}</b></button>`).join('');
    hb.addEventListener('click', (e) => {
      const b = e.target.closest('[data-hot]');
      if (!b) return;
      G.player.sel = +b.dataset.hot; G.player.reload = 0; this.dirty = true;
    });
    $('#panel').addEventListener('click', (e) => this.onPanelClick(e));
    $('#panel').addEventListener('contextmenu', (e) => { e.preventDefault(); this.onPanelClick(e, true); });
    $('#cats').innerHTML = RECIPE_CATS.map((c) => `<button data-cat="${c.id}">${c.name}</button>`).join('');
  },

  iconImg(id) {
    if (!this.imgs[id]) { const im = new Image(); im.src = Icons.get(id); this.imgs[id] = im; }
    return this.imgs[id];
  },

  slot(s, attrs, extra = '') {
    if (!s) return `<button class="slot empty" ${attrs}>${extra}</button>`;
    const def = ITEMS[s.id];
    const n = def.gun ? `<i class="mag">${s.mag}/${def.gun.mag}</i>` : s.n > 1 ? `<i>${fmtNum(s.n)}</i>` : '';
    return `<button class="slot" ${attrs} title="${esc(def.name)}"><img src="${Icons.get(s.id)}" alt="">${n}${extra}</button>`;
  },

  // ---------- HUD ----------
  frame() {
    const p = G.player;
    if (!p) return;
    this.setBar('hp', p.hp); this.setBar('food', p.food); this.setBar('water', p.water);
    const chips = [];
    if (p.bleed > 0) chips.push('<span class="chip bad">Кровотечение</span>');
    if (p.food <= 0 || p.water <= 0) chips.push('<span class="chip bad">Истощение</span>');
    if (p.comfort) chips.push('<span class="chip good">Тепло костра</span>');
    if (G.nearBench(p.x, p.y)) chips.push('<span class="chip">Верстак</span>');
    const ch = chips.join('');
    if (ch !== this._chips) { $('#chips').innerHTML = ch; this._chips = ch; }

    const h = G.hourOf(), hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    const clock = `День ${G.day} · ${String(hh).padStart(2, '0')}:${String(mm - mm % 5).padStart(2, '0')}`;
    if (clock !== this._clock) { $('#clock').textContent = clock; this._clock = clock; $('#clock').classList.toggle('night', G.isNight()); }
    const q = G.quest < QUESTS.length ? QUESTS[G.quest].text : 'Все задания выполнены. Остров ваш.';
    if (q !== this._quest) { $('#quest').textContent = q; this._quest = q; }

    const f = G.focus && !G.ui && !p.dead ? G.focus.label : '';
    if (f !== this._prompt) { $('#prompt').innerHTML = f ? `<kbd>${Input.touch ? '✋' : 'E'}</kbd> ${esc(f)}` : ''; $('#prompt').hidden = !f; this._prompt = f; }

    // перезарядка
    const rl = p.reload > 0 ? 1 - p.reload / p.reloadMax : 0;
    $('#reload').hidden = !(p.reload > 0);
    if (p.reload > 0) $('#reload i').style.width = (rl * 100) + '%';

    const toasts = G.toasts.map((t) => `<div class="toast ${t.kind}" style="opacity:${Math.min(1, t.t)}">${esc(t.text)}</div>`).join('');
    if (toasts !== this._toasts) { $('#toasts').innerHTML = toasts; this._toasts = toasts; }

    if (this.dirty) { this.renderHotbar(); this.renderNotes(); if (G.ui) this.renderPanel(); this.dirty = false; this.queueDirty = true; }
    if (this.queueDirty) { this.renderQueue(); this.queueDirty = false; }
    if (this.fireDirty && G.ui && G.ui.fire) { this.renderPanel(); this.fireDirty = false; }
    this.drawMinimap();
  },
  setBar(id, v) {
    const k = Math.round(v);
    if (this['_' + id] === k) return;
    this['_' + id] = k;
    $(`#b-${id} i`).style.width = clamp(v, 0, 100) + '%';
    $(`#b-${id} b`).textContent = k;
    $(`#b-${id}`).classList.toggle('low', v < 20);
  },

  renderHotbar() {
    const p = G.player;
    document.querySelectorAll('#hotbar .slot').forEach((el, i) => {
      const s = p.inv[i];
      const def = s && ITEMS[s.id];
      el.className = 'slot' + (i === p.sel ? ' on' : '') + (s ? '' : ' empty');
      el.innerHTML = `<b class="key">${i + 1}</b>` + (s ? `<img src="${Icons.get(s.id)}" alt="">` + (def.gun ? `<i class="mag">${s.mag}/${def.gun.mag}</i>` : s.n > 1 ? `<i>${fmtNum(s.n)}</i>` : '') : '');
    });
    const held = G.heldItem();
    let label = held ? ITEMS[held.id].name : 'Кулаки';
    if (held && ITEMS[held.id].gun) label += ` · запас ${invCount(p.inv, ITEMS[held.id].gun.ammo)}`;
    if (held && ITEMS[held.id].deploy) label += Input.touch ? ' · правый стик — поставить' : ' · ЛКМ — поставить';
    $('#heldname').textContent = label;
  },
  renderNotes() {
    $('#notes').innerHTML = G.notes.map((q) => `<div class="note"><img src="${Icons.get(q.id)}" alt=""><span>+${q.n}</span> ${esc(ITEMS[q.id].name)}</div>`).join('');
  },
  renderQueue() {
    const q = G.player.queue;
    $('#queue').innerHTML = q.slice(0, 5).map((c, i) => `<div class="qi${i ? '' : ' now'}"><img src="${Icons.get(c.r.out)}" alt=""><i style="width:${i ? 0 : (1 - c.t / c.max) * 100}%"></i>${i ? '' : `<b>${Math.ceil(c.t)}с</b>`}</div>`).join('') + (q.length > 5 ? `<div class="qi more">+${q.length - 5}</div>` : '');
    if (G.ui && G.ui.type === 'craft') {
      const el = $('#cqueue');
      if (el) el.innerHTML = q.length ? q.map((c, i) => `<button class="qrow" data-cancel="${i}"><img src="${Icons.get(c.r.out)}" alt="">${esc(ITEMS[c.r.out].name)}${c.r.n > 1 ? ' ×' + c.r.n : ''}<span>${i ? 'в очереди' : Math.ceil(c.t) + ' с'}</span><em>Отменить</em></button>`).join('') : '<p class="muted">Очередь пуста. Создание продолжается, пока вы играете.</p>';
    }
  },

  drawMinimap() {
    const cv = $('#minimap'), c = cv.getContext('2d'), p = G.player;
    const S = cv.width, view = 1400, k = S / view;
    const mm = G.world.minimap, mk = mm.width / WORLD;
    c.fillStyle = '#163a4d'; c.fillRect(0, 0, S, S);
    c.imageSmoothingEnabled = false;
    c.drawImage(mm, (p.x - view / 2) * mk, (p.y - view / 2) * mk, view * mk, view * mk, 0, 0, S, S);
    const to = (x, y) => [(x - p.x) * k + S / 2, (y - p.y) * k + S / 2];
    for (const s of G.world.structs) if (s.owner === 'player') { const [x, y] = to(s.x, s.y); c.fillStyle = '#e8e0cc'; c.fillRect(x - 1.5, y - 1.5, 3, 3); }
    if (p.bag) { const [x, y] = to(p.bag.x, p.bag.y); c.fillStyle = '#7fd0c8'; c.beginPath(); c.arc(x, y, 4, 0, TAU); c.fill(); }
    if (G.drop) { const [x, y] = to(G.drop.x, G.drop.y); c.fillStyle = '#d24b2a'; c.beginPath(); c.arc(clamp(x, 5, S - 5), clamp(y, 5, S - 5), 5, 0, TAU); c.fill(); }
    c.save(); c.translate(S / 2, S / 2); c.rotate(p.ang);
    c.fillStyle = '#ffd36a'; c.beginPath(); c.moveTo(7, 0); c.lineTo(-5, -5); c.lineTo(-3, 0); c.lineTo(-5, 5); c.closePath(); c.fill();
    c.restore();
  },

  // ---------- панели ----------
  openInventory() { G.ui = { type: 'craft' }; this.sel = null; this.show(); },
  openContainer(ref, title, cap) { G.ui = { type: 'cont', ref, title, cap }; this.sel = null; this.show(); Sound.play('click'); },
  openFire(s) { G.ui = { type: 'fire', fire: s }; this.sel = null; this.show(); Sound.play('click'); },
  show() { $('#panel').hidden = false; this.dirty = true; this.renderPanel(); },
  close() {
    if (G.ui && G.ui.type === 'cont') G.closeContainer(G.ui.ref);
    G.ui = null; this.sel = null;
    $('#panel').hidden = true;
    $('#bigmap').hidden = true;
  },

  renderPanel() {
    const ui = G.ui;
    if (!ui || ui.type === 'map') return;
    const p = G.player;
    // инвентарь
    const main = [];
    for (let i = HOTBAR; i < INV_SIZE; i++) main.push(this.slot(p.inv[i], `data-inv="${i}" class="${this.isSel('inv', i)}"`));
    const hot = [];
    for (let i = 0; i < HOTBAR; i++) hot.push(this.slot(p.inv[i], `data-inv="${i}"`, `<b class="key">${i + 1}</b>`));
    const armor = this.slot(p.armor, 'data-armor="1"', p.armor ? '' : '<small>Броня</small>');
    $('#invgrid').innerHTML = main.join('');
    $('#invhot').innerHTML = hot.join('');
    $('#armor').innerHTML = armor;
    document.querySelectorAll('#invgrid .slot, #invhot .slot').forEach((el) => el.classList.toggle('sel', this.sel && this.sel.i === +el.dataset.inv));
    this.renderInfo();

    const side = $('#side');
    $('#cats').hidden = ui.type !== 'craft';
    if (ui.type === 'craft') side.innerHTML = this.craftHTML();
    else if (ui.type === 'cont') side.innerHTML = this.contHTML(ui);
    else if (ui.type === 'fire') side.innerHTML = this.fireHTML(ui.fire);
    document.querySelectorAll('#cats button').forEach((b) => b.classList.toggle('on', b.dataset.cat === this.cat));
    if (ui.type === 'craft') this.renderQueue();
  },
  isSel(where, i) { return this.sel && this.sel.where === where && this.sel.i === i ? 'sel' : ''; },

  renderInfo() {
    const box = $('#info'), p = G.player;
    const s = this.sel ? p.inv[this.sel.i] : null;
    if (!s) {
      box.innerHTML = G.ui && G.ui.type === 'cont'
        ? '<p class="muted">Нажмите на предмет, чтобы переложить его. ПКМ работает так же.</p>'
        : `<p class="muted">${Input.touch ? 'Нажмите на предмет, затем на другую ячейку, чтобы переложить.' : 'Нажмите на предмет, затем на ячейку — переложить. ПКМ — использовать или надеть.'}</p>`;
      return;
    }
    const def = ITEMS[s.id];
    const btns = [];
    if (def.use) btns.push('<button data-act="use">Использовать</button>');
    if (def.armor) btns.push('<button data-act="wear">Надеть</button>');
    if (s.n > 1) btns.push('<button data-act="split">Разделить</button>');
    btns.push('<button data-act="drop" class="ghost">Выбросить</button>');
    let stats = '';
    if (def.melee) stats += `<span>Урон ${def.melee.dmg}</span>`;
    if (def.gun) stats += `<span>Урон ${def.gun.dmg}${def.gun.pellets ? '×' + def.gun.pellets : ''}</span><span>Магазин ${def.gun.mag}</span>`;
    if (def.armor) stats += `<span>Защита ${Math.round(def.armor * 100)}%</span>`;
    if (def.use) { const u = def.use; if (u.food) stats += `<span>Еда ${u.food > 0 ? '+' : ''}${u.food}</span>`; if (u.water) stats += `<span>Вода +${u.water}</span>`; if (u.hp) stats += `<span>Здоровье ${u.hp > 0 ? '+' : ''}${u.hp}</span>`; }
    box.innerHTML = `<div class="ititle"><img src="${Icons.get(s.id)}" alt=""><div><h4>${esc(def.name)}</h4><p>${esc(def.desc || '')}</p></div></div>${stats ? `<div class="stats">${stats}</div>` : ''}<div class="acts">${btns.join('')}</div>`;
  },

  craftHTML() {
    const p = G.player, bench = G.nearBench(p.x, p.y);
    const rows = RECIPES.filter((r) => r.cat === this.cat).map((r) => {
      const idx = RECIPES.indexOf(r);
      const can = hasCost(p.inv, r.cost) && (!r.bench || bench);
      const cost = Object.entries(r.cost).map(([id, n]) => `<span class="${invCount(p.inv, id) >= n ? '' : 'miss'}"><img src="${Icons.get(id)}" alt="">${n}</span>`).join('');
      return `<div class="rec ${can ? '' : 'off'}">
        <img class="ri" src="${Icons.get(r.out)}" alt="">
        <div class="rb"><h5>${esc(ITEMS[r.out].name)}${r.n > 1 ? ` <em>×${r.n}</em>` : ''}${r.bench ? ` <small class="${bench ? 'ok' : ''}">верстак</small>` : ''}</h5><div class="cost">${cost}<span class="t">${r.time} с</span></div></div>
        <div class="rbtn"><button data-craft="${idx}" ${can ? '' : 'disabled'}>Создать</button><button data-craft5="${idx}" class="ghost" ${hasCost(p.inv, r.cost, 5) && (!r.bench || bench) ? '' : 'disabled'}>×5</button></div>
      </div>`;
    }).join('');
    return `<h3>Создание</h3><div class="recs">${rows}</div><h3 class="sub">Очередь</h3><div id="cqueue"></div>`;
  },

  contHTML(ui) {
    const items = ui.ref.items;
    const cells = [];
    for (let i = 0; i < ui.cap; i++) cells.push(this.slot(items[i], `data-cont="${i}"`));
    return `<h3>${esc(ui.title)}</h3><div class="grid cont">${cells.join('')}</div>
      <div class="acts"><button data-act="takeall" ${items.length ? '' : 'disabled'}>Забрать всё</button></div>
      <p class="muted">Нажмите на предмет в контейнере — заберёте его. Нажмите на свой — положите.</p>`;
  },

  fireHTML(s) {
    const f = s.fire, furnace = s.type === 'furnace', p = G.player;
    const ins = furnace ? ['metal_ore', 'sulfur_ore'] : ['raw_meat'];
    const outs = furnace ? ['metal', 'sulfur', 'charcoal'] : ['cooked_meat'];
    const cell = (id, n) => `<div class="fc"><img src="${Icons.get(id)}" alt=""><b>${n || 0}</b><small>${esc(ITEMS[id].name)}</small></div>`;
    const prog = f.on ? Math.round((f.t / (furnace ? 0.5 : 2.5)) * 100) : 0;
    const outCount = outs.reduce((a, id) => a + (f.output[id] || 0), 0);
    return `<h3>${furnace ? 'Печь' : 'Костёр'} <span class="state ${f.on ? 'on' : ''}">${f.on ? 'горит' : 'потушен'}</span></h3>
      <div class="fire">
        <div><h6>Топливо</h6>${cell('wood', f.fuel)}</div>
        <div><h6>${furnace ? 'Руда' : 'Сырое'}</h6>${ins.map((id) => cell(id, f.input[id])).join('')}</div>
        <div class="arrow"><i style="width:${prog}%"></i></div>
        <div><h6>Готово</h6>${outs.map((id) => cell(id, f.output[id])).join('')}</div>
      </div>
      <div class="acts wrap">
        <button data-fire="wood" ${invCount(p.inv, 'wood') ? '' : 'disabled'}>+ Дерево</button>
        <button data-fire="input" ${ins.some((id) => invCount(p.inv, id)) ? '' : 'disabled'}>+ ${furnace ? 'Вся руда' : 'Всё мясо'}</button>
        <button data-fire="toggle" ${f.on || f.fuel ? '' : 'disabled'}>${f.on ? 'Потушить' : 'Разжечь'}</button>
        <button data-fire="take" ${outCount ? '' : 'disabled'}>Забрать готовое</button>
      </div>
      <p class="muted">${furnace ? 'Печь плавит руду и оставляет уголь. 1 дерево сгорает за 1,2 с.' : 'Костёр жарит мясо и согревает: рядом с ним здоровье восстанавливается быстрее.'} «+ Дерево» кладёт по 100.</p>`;
  },

  // ---------- клики ----------
  onPanelClick(e, right) {
    const p = G.player, t = e.target;
    if (t.closest('#pclose')) { this.close(); return; }
    const cat = t.closest('[data-cat]');
    if (cat) { this.cat = cat.dataset.cat; this.renderPanel(); return; }
    const cr = t.closest('[data-craft]');
    if (cr) { G.craft(RECIPES[+cr.dataset.craft], 1); this.renderPanel(); return; }
    const cr5 = t.closest('[data-craft5]');
    if (cr5) { G.craft(RECIPES[+cr5.dataset.craft5], 5); this.renderPanel(); return; }
    const cq = t.closest('[data-cancel]');
    if (cq) { G.cancelCraft(+cq.dataset.cancel); this.renderPanel(); return; }
    const fb = t.closest('[data-fire]');
    if (fb) { this.fireAct(fb.dataset.fire); return; }
    const act = t.closest('[data-act]');
    if (act) { this.act(act.dataset.act); return; }
    const ar = t.closest('[data-armor]');
    if (ar) {
      if (p.armor) { const left = invAdd(p.inv, p.armor); if (!left) p.armor = null; else G.toast('Нет места в инвентаре'); }
      this.dirty = true; return;
    }
    const cs = t.closest('[data-cont]');
    if (cs && G.ui.type === 'cont') {
      const items = G.ui.ref.items, i = +cs.dataset.cont, s = items[i];
      if (!s) return;
      const n0 = s.n, left = invAdd(p.inv, s);
      if (n0 - left) G.note(s.id, n0 - left);
      if (!left) items.splice(i, 1); else { s.n = left; G.toast('Нет места в инвентаре'); }
      Sound.play('pickup');
      this.dirty = true; return;
    }
    const is = t.closest('[data-inv]');
    if (is) {
      const i = +is.dataset.inv, s = p.inv[i];
      if (G.ui.type === 'cont') {
        if (!s) return;
        const left = contAdd(G.ui.ref.items, G.ui.cap, s);
        if (!left) p.inv[i] = null; else { s.n = left; G.toast('Контейнер полон'); }
        Sound.play('click'); this.sel = null; this.dirty = true; return;
      }
      if (right) { if (s) this.quick(i); return; }
      if (this.sel) {
        const j = this.sel.i;
        if (j !== i) this.moveSlot(j, i);
        this.sel = null;
      } else if (s) this.sel = { where: 'inv', i };
      this.dirty = true;
    }
  },

  moveSlot(a, b) {
    const inv = G.player.inv, sa = inv[a], sb = inv[b];
    if (sb && sa && sb.id === sa.id && ITEMS[sa.id].stack > 1) {
      const k = Math.min(ITEMS[sa.id].stack - sb.n, sa.n);
      sb.n += k; sa.n -= k; if (!sa.n) inv[a] = null;
    } else { inv[a] = sb; inv[b] = sa; }
    if (G.player.reload > 0) G.player.reload = 0;
    Sound.play('click');
  },

  quick(i) {
    const p = G.player, s = p.inv[i], def = ITEMS[s.id];
    if (def.use) G.consume(i);
    else if (def.armor) this.wear(i);
    else {
      // перекинуть между поясом и рюкзаком
      const range = i < HOTBAR ? [HOTBAR, INV_SIZE] : [0, HOTBAR];
      for (let j = range[0]; j < range[1]; j++) if (!p.inv[j]) { p.inv[j] = s; p.inv[i] = null; break; }
    }
    this.dirty = true;
  },
  wear(i) {
    const p = G.player, s = p.inv[i];
    p.inv[i] = p.armor; p.armor = s;
    Sound.play('build');
    this.sel = null; this.dirty = true;
  },

  act(a) {
    const p = G.player;
    if (a === 'takeall' && G.ui.type === 'cont') {
      const items = G.ui.ref.items;
      for (let i = items.length - 1; i >= 0; i--) {
        const s = items[i], n0 = s.n;
        const left = invAdd(p.inv, s);
        if (n0 - left) G.note(s.id, n0 - left);
        if (!left) items.splice(i, 1); else s.n = left;
      }
      if (items.length) G.toast('Не всё влезло в инвентарь');
      Sound.play('pickup');
      this.dirty = true;
      if (!items.length) this.close();
      return;
    }
    if (!this.sel) return;
    const i = this.sel.i, s = p.inv[i];
    if (!s) return;
    if (a === 'use') G.consume(i);
    else if (a === 'wear') this.wear(i);
    else if (a === 'split') {
      const half = Math.floor(s.n / 2);
      const j = p.inv.findIndex((x, k) => !x && k >= HOTBAR) >= 0 ? p.inv.findIndex((x, k) => !x && k >= HOTBAR) : p.inv.findIndex((x) => !x);
      if (j < 0) { G.toast('Нет свободной ячейки'); return; }
      s.n -= half; p.inv[j] = Object.assign({}, s, { n: half });
    } else if (a === 'drop') {
      G.dropBag(p.x + Math.cos(p.ang) * 20, p.y + Math.sin(p.ang) * 20, [s]);
      p.inv[i] = null; this.sel = null;
    }
    if (!p.inv[i]) this.sel = null;
    this.dirty = true;
  },

  fireAct(a) {
    const p = G.player, s = G.ui.fire, f = s.fire, furnace = s.type === 'furnace';
    if (a === 'wood') { const n = Math.min(100, invCount(p.inv, 'wood')); invRemove(p.inv, 'wood', n); f.fuel += n; if (!f.on && n) f.on = true; }
    else if (a === 'input') {
      for (const id of furnace ? ['metal_ore', 'sulfur_ore'] : ['raw_meat']) { const n = invCount(p.inv, id); invRemove(p.inv, id, n); f.input[id] = (f.input[id] || 0) + n; }
      if (!f.on && f.fuel) f.on = true;
    } else if (a === 'toggle') f.on = !f.on && f.fuel > 0;
    else if (a === 'take') {
      for (const id in f.output) if (f.output[id]) { G.give(makeStack(id, f.output[id])); f.output[id] = 0; }
      Sound.play('pickup');
    }
    Sound.play('click');
    this.dirty = true;
  },

  // ---------- экраны ----------
  showDeath() {
    $('#death').hidden = false;
    $('#cause').textContent = G.deathCause;
    $('#d-bag').disabled = !(G.player.bag && !G.player.bag.dead);
    $('#d-stats').textContent = `Прожито дней: ${G.day} · Убито: ${G.stats.kills} · Смертей: ${G.stats.deaths}`;
    $('#panel').hidden = true;
  },
  toggleMap() {
    const m = $('#bigmap');
    if (!m.hidden) { m.hidden = true; G.ui = null; return; }
    this.close();
    G.ui = { type: 'map' };
    m.hidden = false;
    const cv = $('#bigmapcv'), c = cv.getContext('2d'), S = cv.width, k = S / WORLD;
    c.imageSmoothingEnabled = true;
    c.drawImage(G.world.minimap, 0, 0, S, S);
    c.font = '600 14px "PT Sans Narrow", sans-serif'; c.textAlign = 'center';
    for (const mo of G.world.monuments) {
      const x = (mo.x0 + mo.w / 2) * TILE * k, y = (mo.y0 + mo.h / 2) * TILE * k;
      c.fillStyle = 'rgba(20,18,16,.75)'; const w = c.measureText(mo.name).width + 12; c.fillRect(x - w / 2, y - 22, w, 20);
      c.fillStyle = '#f0e8d8'; c.fillText(mo.name, x, y - 7);
      c.fillStyle = '#c3712f'; c.beginPath(); c.arc(x, y + 4, 4, 0, TAU); c.fill();
    }
    for (const s of G.world.structs) if (s.owner === 'player') { c.fillStyle = '#e8e0cc'; c.fillRect(s.x * k - 2, s.y * k - 2, 4, 4); }
    const p = G.player;
    if (p.bag) { c.fillStyle = '#7fd0c8'; c.beginPath(); c.arc(p.bag.x * k, p.bag.y * k, 6, 0, TAU); c.fill(); }
    if (G.drop) { c.fillStyle = '#d24b2a'; c.beginPath(); c.arc(G.drop.x * k, G.drop.y * k, 7, 0, TAU); c.fill(); c.fillStyle = '#f0e8d8'; c.fillText('Аирдроп', G.drop.x * k, G.drop.y * k - 12); }
    c.save(); c.translate(p.x * k, p.y * k); c.rotate(p.ang);
    c.fillStyle = '#ffd36a'; c.strokeStyle = '#1a1714'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(10, 0); c.lineTo(-7, -7); c.lineTo(-4, 0); c.lineTo(-7, 7); c.closePath(); c.stroke(); c.fill();
    c.restore();
  },
};
