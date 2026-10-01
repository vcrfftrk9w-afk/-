'use strict';
// Ввод, игровой цикл, сохранения, меню.

const SAVE_KEY = 'rust-island-save-v1';

const Input = {
  keys: {}, sx: 0, sy: 0, mouseDown: false, touch: false,
  use: false, reload: false, demolish: false,
  moveTouch: null, aimTouch: null, aimAng: 0, aimFire: false,

  state() {
    const k = this.keys, p = G.player;
    let mx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    let my = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
    let sprint = !!(k.ShiftLeft || k.ShiftRight);
    let aimAng, fire, wx, wy;
    if (this.touch) {
      if (this.moveTouch) { mx = this.moveTouch.dx; my = this.moveTouch.dy; sprint = Math.hypot(mx, my) > 0.92; }
      if (this.aimTouch && Math.hypot(this.aimTouch.dx, this.aimTouch.dy) > 0.2) this.aimAng = Math.atan2(this.aimTouch.dy, this.aimTouch.dx);
      else if (Math.hypot(mx, my) > 0.2) this.aimAng = Math.atan2(my, mx);
      aimAng = this.aimAng;
      fire = !!(this.aimTouch && Math.hypot(this.aimTouch.dx, this.aimTouch.dy) > 0.45);
      wx = p.x + Math.cos(aimAng) * 60; wy = p.y + Math.sin(aimAng) * 60;
    } else {
      const w = R.toWorld(this.sx, this.sy);
      wx = w.x; wy = w.y;
      aimAng = Math.atan2(wy - p.y, wx - p.x);
      fire = this.mouseDown;
    }
    const st = { mx, my, sprint, aimAng, fire, wx, wy, touch: this.touch, usePressed: this.use, reloadPressed: this.reload, demolishPressed: this.demolish, aiming: fire };
    this.use = this.reload = this.demolish = false;
    return st;
  },
};

const App = {
  mode: 'menu', last: 0, saveT: 0, t: 0,

  boot(hot) {
    R.init($('#game'));
    UI.init();
    Input.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    document.body.classList.toggle('touch', Input.touch);
    const saved = hot && hot.save ? hot.save : store.get(SAVE_KEY);
    let loaded = false;
    if (saved) { try { this.load(JSON.parse(saved)); loaded = true; } catch (e) { loaded = false; } }
    if (!loaded) G.newGame((Math.random() * 1e9) | 0);
    $('#m-continue').hidden = !loaded;
    $('#m-new').textContent = loaded ? 'Новый остров' : 'Высадиться на остров';
    this.bindInput();
    this.bindMenus();
    if (hot && hot.mode === 'play') this.play();
    window.addEventListener('resize', () => R.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.mode === 'play') { this.save(); this.pause(); } });
    window.claude?.hot?.snapshot?.(() => ({ save: this.serialize(), mode: this.mode }));
    requestAnimationFrame((t) => this.loop(t));
  },

  loop(t) {
    const dt = Math.min(0.05, (t - (this.last || t)) / 1000);
    this.last = t; this.t += dt;
    if (this.mode === 'play' && G.ui?.type !== 'map') {
      G.update(dt, Input.state());
      this.saveT += dt;
      if (this.saveT > 30) { this.saveT = 0; this.save(); }
    } else if (this.mode === 'menu') {
      // медленный облёт острова за меню
      G.player.ang += dt * 0.08;
    }
    R.frame(this.t);
    if (this.mode === 'play') {
      UI.frame();
      this.drawCrosshair();
      const v = G.hurt * 0.9 + (G.player.hp < 25 && !G.player.dead ? 0.35 + Math.sin(this.t * 5) * 0.15 : 0);
      $('#vignette').style.boxShadow = `inset 0 0 160px 40px rgba(170,20,10,${clamp(v, 0, 0.9)})`;
    }
    requestAnimationFrame((tt) => this.loop(tt));
  },

  drawCrosshair() {
    const c = R.ctx, p = G.player;
    if (p.dead || G.ui) return;
    let x, y;
    if (Input.touch) {
      const s = R.toScreen(p.x + Math.cos(p.ang) * 70, p.y + Math.sin(p.ang) * 70);
      x = s.x; y = s.y;
    } else { x = Input.sx; y = Input.sy; }
    c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(x, y, 3, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.arc(x, y, 4.5, 0, TAU); c.stroke();
    if (G.hit > 0) {
      c.strokeStyle = `rgba(255,90,60,${G.hit / 0.15})`; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x - 10, y - 10); c.lineTo(x - 5, y - 5); c.moveTo(x + 10, y - 10); c.lineTo(x + 5, y - 5);
      c.moveTo(x - 10, y + 10); c.lineTo(x - 5, y + 5); c.moveTo(x + 10, y + 10); c.lineTo(x + 5, y + 5); c.stroke();
    }
  },

  // ---------- режимы ----------
  play() {
    Sound.init();
    this.mode = 'play';
    $('#menu').hidden = true; $('#pause').hidden = true; $('#hud').hidden = false;
    UI.dirty = true;
    if (G.player.dead) UI.showDeath();
    if (!this.greeted) {
      this.greeted = true;
      G.toast(Input.touch ? 'Левый стик — ходить, правый — бить и стрелять' : 'WASD — ходить, ЛКМ — бить, E — подобрать, Tab — рюкзак');
    }
  },
  pause() {
    if (this.mode !== 'play') return;
    UI.close();
    this.mode = 'pause';
    $('#pause').hidden = false;
    $('#p-saved').textContent = 'Игра сохраняется автоматически.';
  },
  toMenu() {
    this.save();
    this.mode = 'menu';
    $('#pause').hidden = true; $('#hud').hidden = true; $('#death').hidden = true;
    $('#menu').hidden = false;
    $('#m-continue').hidden = false;
    $('#m-new').textContent = 'Новый остров';
  },

  // ---------- сохранение ----------
  serialize() {
    const p = G.player, w = G.world;
    return JSON.stringify({
      v: 1, seed: w.seed, time: G.time, day: G.day, quest: G.quest, stats: G.stats, airdropT: G.airdropT,
      player: { x: p.x, y: p.y, hp: p.hp, food: p.food, water: p.water, inv: p.inv, armor: p.armor, sel: p.sel, dead: p.dead,
        bag: p.bag ? [p.bag.tx, p.bag.ty] : null, queue: p.queue.map((q) => ({ i: RECIPES.indexOf(q.r), t: q.t })) },
      structs: w.structs.filter((s) => s.owner === 'player').map((s) => ({ type: s.type, tx: s.tx, ty: s.ty, hp: s.hp, open: s.open, items: s.items, fire: s.fire })),
      bags: G.bags.filter((b) => b.kind === 'backpack').map((b) => ({ x: b.x, y: b.y, items: b.items, t: b.t })),
    });
  },
  save() {
    if (!G.started) return;
    store.set(SAVE_KEY, this.serialize());
  },
  load(d) {
    if (!d || d.v !== 1) throw new Error('old save');
    G.newGame(d.seed);
    const w = G.world;
    G.time = d.time; G.day = d.day; G.quest = d.quest || 0; Object.assign(G.stats, d.stats || {}); G.airdropT = d.airdropT || 300;
    for (const s of d.structs) {
      if (w.structAtTile(s.tx, s.ty)) continue;
      const st = w.addStruct(s.type, s.tx, s.ty);
      st.hp = s.hp; if (s.open !== undefined) st.open = s.open;
      if (s.items) st.items = s.items;
      if (s.fire) st.fire = s.fire;
    }
    const p = G.player, sp = d.player;
    Object.assign(p, { x: sp.x, y: sp.y, hp: sp.hp, food: sp.food, water: sp.water, armor: sp.armor, sel: sp.sel, dead: sp.dead });
    p.inv = Array.from({ length: INV_SIZE }, (_, i) => sp.inv[i] || null);
    p.queue = (sp.queue || []).filter((q) => RECIPES[q.i]).map((q) => ({ r: RECIPES[q.i], t: q.t, max: RECIPES[q.i].time }));
    p.bag = sp.bag ? w.structAtTile(sp.bag[0], sp.bag[1]) : null;
    for (const b of d.bags || []) G.bags.push({ x: b.x, y: b.y, items: b.items, t: b.t, kind: 'backpack', ang: 0 });
    // убрать тех, кто появился прямо рядом с загруженной позицией
    G.npcs = G.npcs.filter((n) => !(n.spawn && n.spawn.roam) || dist(n.x, n.y, p.x, p.y) > 700);
    G.animals = G.animals.filter((a) => dist(a.x, a.y, p.x, p.y) > 450);
    R.camX = p.x; R.camY = p.y;
  },

  // ---------- ввод ----------
  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (this.mode !== 'play') { if (e.code === 'Escape' && this.mode === 'pause') this.play(); return; }
      if (e.repeat && ['KeyE', 'Tab', 'KeyI', 'KeyM', 'Escape'].includes(e.code)) return;
      Input.keys[e.code] = true;
      const p = G.player;
      if (p.dead) return;
      if (e.code === 'Escape') { if (G.ui) UI.close(); else this.pause(); return; }
      if (e.code === 'Tab' || e.code === 'KeyI' || e.code === 'KeyQ') { if (G.ui && G.ui.type !== 'map') UI.close(); else { $('#bigmap').hidden = true; UI.openInventory(); } return; }
      if (e.code === 'KeyM') { UI.toggleMap(); return; }
      if (e.code === 'KeyE') { if (G.ui && G.ui.type !== 'map') UI.close(); else Input.use = true; return; }
      if (e.code === 'KeyR') Input.reload = true;
      if (e.code === 'KeyX') Input.demolish = true;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= HOTBAR) { p.sel = n - 1; p.reload = 0; UI.dirty = true; }
    });
    window.addEventListener('keyup', (e) => { Input.keys[e.code] = false; });
    window.addEventListener('blur', () => { Input.keys = {}; Input.mouseDown = false; });
    const cv = $('#game');
    window.addEventListener('mousemove', (e) => { Input.sx = e.clientX; Input.sy = e.clientY; });
    cv.addEventListener('mousedown', (e) => { if (e.button === 0 && !Input.touch) { Input.mouseDown = true; Sound.init(); } });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) Input.mouseDown = false; });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => {
      if (this.mode !== 'play' || G.ui) return;
      const p = G.player;
      p.sel = (p.sel + (e.deltaY > 0 ? 1 : HOTBAR - 1)) % HOTBAR; p.reload = 0;
      UI.dirty = true;
    }, { passive: true });

    // сенсорные стики
    const stick = (el, x, y) => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.classList.add('on'); };
    const knob = (el, dx, dy) => { el.firstElementChild.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`; };
    cv.addEventListener('touchstart', (e) => {
      if (this.mode !== 'play') return;
      e.preventDefault();
      Sound.init();
      for (const t of e.changedTouches) {
        const left = t.clientX < R.w / 2;
        const rec = { id: t.identifier, ox: t.clientX, oy: t.clientY, dx: 0, dy: 0 };
        if (left && !Input.moveTouch) { Input.moveTouch = rec; stick($('#stickL'), t.clientX, t.clientY); }
        else if (!left && !Input.aimTouch) { Input.aimTouch = rec; stick($('#stickR'), t.clientX, t.clientY); }
      }
    }, { passive: false });
    cv.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        for (const [rec, el] of [[Input.moveTouch, '#stickL'], [Input.aimTouch, '#stickR']]) {
          if (!rec || rec.id !== t.identifier) continue;
          let dx = (t.clientX - rec.ox) / 50, dy = (t.clientY - rec.oy) / 50;
          const l = Math.hypot(dx, dy);
          if (l > 1) { dx /= l; dy /= l; }
          rec.dx = dx; rec.dy = dy;
          knob($(el), dx, dy);
        }
      }
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (Input.moveTouch && Input.moveTouch.id === t.identifier) { Input.moveTouch = null; $('#stickL').classList.remove('on'); }
        if (Input.aimTouch && Input.aimTouch.id === t.identifier) { Input.aimTouch = null; $('#stickR').classList.remove('on'); }
      }
    };
    cv.addEventListener('touchend', end);
    cv.addEventListener('touchcancel', end);
    const tap = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); if (this.mode === 'play' && !G.player.dead) fn(); });
    tap('#t-use', () => { if (G.ui && G.ui.type !== 'map') UI.close(); else Input.use = true; });
    tap('#t-reload', () => { Input.reload = true; });
    tap('#t-inv', () => { if (G.ui) UI.close(); else UI.openInventory(); });
    tap('#t-map', () => UI.toggleMap());
    tap('#t-pause', () => this.pause());
    $('#bigmap').addEventListener('click', () => { if (G.ui && G.ui.type === 'map') UI.toggleMap(); });
  },

  bindMenus() {
    const soundLabel = () => { const t = 'Звук: ' + (Sound.muted ? 'выкл' : 'вкл'); $('#m-sound').textContent = t; $('#p-sound').textContent = t; };
    Sound.muted = store.get('rust-island-muted') === '1';
    soundLabel();
    const toggleSound = () => { Sound.setMuted(!Sound.muted); store.set('rust-island-muted', Sound.muted ? '1' : '0'); soundLabel(); };
    $('#m-sound').addEventListener('click', toggleSound);
    $('#p-sound').addEventListener('click', toggleSound);
    $('#m-continue').addEventListener('click', () => this.play());
    $('#m-new').addEventListener('click', () => {
      const hasSave = !$('#m-continue').hidden;
      if (hasSave && !UI.confirmNew) { UI.confirmNew = true; $('#m-confirm').hidden = false; return; }
      UI.confirmNew = false; $('#m-confirm').hidden = true;
      if (hasSave) { G.newGame((Math.random() * 1e9) | 0); R.camX = G.player.x; R.camY = G.player.y; }
      this.greeted = false;
      this.play();
      this.save();
    });
    $('#p-resume').addEventListener('click', () => this.play());
    $('#p-menu').addEventListener('click', () => this.toMenu());
    $('#d-bag').addEventListener('click', () => { G.respawn(true); $('#death').hidden = true; UI.dirty = true; this.save(); });
    $('#d-beach').addEventListener('click', () => { G.respawn(false); $('#death').hidden = true; UI.dirty = true; this.save(); });
  },
};

if (window.claude?.hot?.ready) window.claude.hot.ready((data) => App.boot(data));
else App.boot(window.claude?.hot?.data ?? null);
