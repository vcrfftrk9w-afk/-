'use strict';
// Игровая логика: игрок, животные, мародёры, снаряды, огонь, события.

const FISTS = { melee: { dmg: 6, range: 40, cd: 0.45 }, gather: { tree: 1, stone: 1 } };

const QUESTS = [
  { text: 'Добудьте 150 дерева: ЛКМ по дереву', done: (p) => invCount(p.inv, 'wood') >= 150 },
  { text: 'Создайте каменный топор: Tab → Создание', done: (p) => invCount(p.inv, 'stone_hatchet') > 0 },
  { text: 'Наберите 30 ткани: соберите коноплю (E)', done: (p) => invCount(p.inv, 'cloth') >= 30 },
  { text: 'Поставьте спальный мешок, чтобы возрождаться у него', done: (p) => !!p.bag },
  { text: 'Добудьте мясо и пожарьте его на костре', done: (p) => invCount(p.inv, 'cooked_meat') > 0 || G.stats.cooked > 0 },
  { text: 'Разбейте бочки и найдите 30 скрапа', done: (p) => invCount(p.inv, 'scrap') >= 30 },
  { text: 'Постройте печь и выплавьте 50 фрагментов металла', done: (p) => invCount(p.inv, 'metal') >= 50 },
  { text: 'Поставьте верстак', done: () => G.stats.bench > 0 },
  { text: 'Достаньте револьвер: создайте у верстака или найдите', done: (p) => invCount(p.inv, 'revolver') > 0 },
  { text: 'Обыщите военный ящик на Радарной станции', done: () => G.stats.elite > 0 },
  { text: 'Переживите три ночи', done: () => G.day >= 4 },
];

const G = {
  world: null, player: null, animals: [], npcs: [], shots: [], parts: [], marks: [], bags: [],
  notes: [], toasts: [], time: 0.05, day: 1, ui: null, focus: null, ghost: null,
  stats: { kills: 0, cooked: 0, bench: 0, elite: 0, deaths: 0 },
  quest: 0, flash: 0, hurt: 0, shake: 0, hit: 0, plane: null, drop: null,
  airdropT: 300, raidNight: 0, npcRespawn: [], tick: 0, started: false,

  // ---------- старт ----------
  newGame(seed) {
    this.world = new World(seed);
    this.animals = []; this.npcs = []; this.shots = []; this.parts = []; this.bags = []; this.marks = [];
    this.notes = []; this.toasts = []; this.time = 0.05; this.day = 1; this.quest = 0;
    this.stats = { kills: 0, cooked: 0, bench: 0, elite: 0, deaths: 0 };
    this.airdropT = rand(300, 420); this.plane = null; this.drop = null; this.raidNight = 0; this.npcRespawn = [];
    const sp = this.world.randomBeach();
    this.player = this.makePlayer(sp.x, sp.y);
    this.spawnInitial();
    this.started = true;
  },

  makePlayer(x, y) {
    const p = { x, y, r: 12, ang: 0, hp: 100, food: 60, water: 60, inv: new Array(INV_SIZE).fill(null), armor: null,
      sel: 0, cd: 0, swing: 0, reload: 0, bleed: 0, queue: [], bag: null, dead: false, walk: 0, moving: false, regenT: 0 };
    p.inv[0] = makeStack('rock'); p.inv[1] = makeStack('torch'); p.inv[2] = makeStack('bandage', 1);
    return p;
  },

  spawnInitial() {
    const w = this.world;
    for (const s of w.npcSpawns) this.spawnNpc(s.kind, s.x, s.y, s);
    for (let i = 0; i < 6; i++) this.spawnRoamer();
    this.fillAnimals(true);
  },

  // ---------- общие помощники ----------
  sfx(name, x, y, vol = 1) {
    const p = this.player;
    const d = x === undefined ? 0 : dist(x, y, p.x, p.y);
    Sound.play(name, vol * clamp(1 - d / 1000, 0, 1));
  },
  note(id, n) {
    const ex = this.notes.find((q) => q.id === id && q.t > 1);
    if (ex) { ex.n += n; ex.t = 3; } else this.notes.push({ id, n, t: 3 });
    if (this.notes.length > 6) this.notes.shift();
    UI.dirty = true;
  },
  toast(text, kind = '') {
    this.toasts.push({ text, kind, t: 4.5 });
    if (this.toasts.length > 4) this.toasts.shift();
  },
  give(stack, silent) {
    const n0 = stack.n;
    const left = invAdd(this.player.inv, stack);
    if (n0 - left > 0 && !silent) this.note(stack.id, n0 - left);
    if (left > 0) {
      this.dropBag(this.player.x, this.player.y, [Object.assign({}, stack, { n: left })]);
      this.toast('Инвентарь полон — вещи выпали рядом');
    }
    UI.dirty = true;
  },
  dropBag(x, y, items, kind = 'bag', what) {
    if (!items.length) return null;
    const near = this.bags.find((b) => b.kind === 'bag' && kind === 'bag' && dist2(b.x, b.y, x, y) < 30 * 30);
    if (near) { for (const s of items) contAdd(near.items, 36, s); near.t = 600; return near; }
    const b = { x: x + rand(-6, 6), y: y + rand(-6, 6), items, kind, what, t: kind === 'backpack' ? 1200 : 420, ang: rand(0, TAU) };
    this.bags.push(b);
    return b;
  },
  particles(x, y, n, color, speed = 120, life = 0.6, size = 3, grav = 0) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(speed * 0.3, speed);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(life * 0.6, life), max: life, size: rand(size * 0.6, size), color, grav });
    }
    if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
  },
  hourOf() { return (6 + this.time * 24) % 24; },
  darkness() {
    const h = this.hourOf();
    const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    if (h >= 7 && h < 18) return 0;
    if (h >= 18 && h < 21.5) return ss(18, 21.5, h) * 0.9;
    if (h >= 4.5 && h < 7) return (1 - ss(4.5, 7, h)) * 0.9;
    return 0.9;
  },
  isNight() { return this.darkness() > 0.5; },
  heldItem() { return this.player.inv[this.player.sel]; },
  nearBench(x, y) { return !!this.world.nearStruct(x, y, 4 * TILE, (s) => s.type === 'workbench'); },
  makeNoise(x, y, r) {
    for (const n of this.npcs) {
      if (n.dead || n.state === 'combat') continue;
      if (dist2(n.x, n.y, x, y) < r * r) { n.state = 'search'; n.last = { x, y }; n.t = 8; }
    }
  },

  // ---------- шаг игры ----------
  update(dt, input) {
    if (!this.started) return;
    const p = this.player;
    this.time += dt / DAY_LEN;
    if (this.time >= 1) { this.time -= 1; this.day++; this.toast(`День ${this.day}`); }
    this.tick += dt;

    if (!p.dead) this.updatePlayer(dt, input);
    this.world.update(dt, p.x, p.y);
    for (const a of this.animals) if (!a.dead) this.updateAnimal(a, dt);
    for (const n of this.npcs) if (!n.dead) this.updateNpc(n, dt);
    this.animals = this.animals.filter((a) => !a.dead);
    this.npcs = this.npcs.filter((n) => !n.dead);
    this.updateShots(dt);
    this.updateFires(dt);
    this.updateEvents(dt);

    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.life -= dt;
      if (q.life <= 0) { this.parts.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.grav * dt;
      q.vx *= 1 - 3 * dt; q.vy *= 1 - 3 * dt;
    }
    for (let i = this.bags.length - 1; i >= 0; i--) {
      const b = this.bags[i];
      b.t -= dt;
      if (b.t <= 0 || (!b.items.length && !(this.ui && this.ui.ref === b))) this.bags.splice(i, 1);
    }
    for (const q of this.notes) q.t -= dt;
    if (this.notes.length && this.notes[0].t <= 0) { this.notes = this.notes.filter((q) => q.t > 0); UI.dirty = true; }
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    this.hurt = Math.max(0, this.hurt - dt * 1.5);
    this.flash = Math.max(0, this.flash - dt);
    this.hit = Math.max(0, this.hit - dt);
    this.shake = Math.max(0, this.shake - dt * 12);

    if ((this.tick % 1) < dt) {
      this.fillAnimals(false);
      if (this.quest < QUESTS.length && !p.dead && QUESTS[this.quest].done(p)) {
        this.toast('Задание выполнено: ' + QUESTS[this.quest].text, 'good');
        this.quest++;
        this.sfx('craft');
      }
      Sound.windLevel(this.isNight() ? 0.06 : 0.03);
    }
  },

  // ---------- игрок ----------
  updatePlayer(dt, input) {
    const p = this.player, w = this.world;
    // движение
    let mx = input.mx, my = input.my;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const h = w.heightAt(p.x, p.y);
    const sprint = input.sprint && p.food > 2 && p.water > 2 && ml > 0.1;
    let spd = sprint ? 230 : 150;
    if (h < SHORE) spd *= 0.6;
    if (input.aiming) spd *= 0.85;
    p.moving = ml > 0.1;
    if (p.moving) {
      this.move(p, mx * spd * dt, my * spd * dt);
      p.walk += dt * (sprint ? 13 : 9);
    }
    p.ang = input.aimAng;

    // голод и жажда
    const k = sprint ? 1.7 : 1;
    p.food = Math.max(0, p.food - dt * k / 11);
    p.water = Math.max(0, p.water - dt * k / 7.5);
    if (p.food <= 0 || p.water <= 0) this.damagePlayer(dt * 0.8, 'starve', true);
    if (p.bleed > 0) { p.bleed -= dt; this.damagePlayer(dt * 1.2, 'bleed', true); if (Math.random() < dt * 3) this.particles(p.x, p.y, 1, '#8a1c1c', 20, 1.5, 3); }
    const warm = w.nearStruct(p.x, p.y, 130, (s) => s.fire && s.fire.on && s.type === 'campfire');
    p.comfort = !!warm;
    p.regenT += dt;
    if (p.regenT > 1) {
      p.regenT = 0;
      if (p.food > 60 && p.water > 60 && p.hp < 100 && p.bleed <= 0) p.hp = Math.min(100, p.hp + (warm ? 1.5 : 0.5));
    }
    if (h < SHORE && h > DEEP && Math.random() < dt * 6 && p.moving) this.particles(p.x, p.y, 1, 'rgba(220,240,240,.7)', 40, 0.5, 3);

    // перезарядка
    if (p.reload > 0) {
      p.reload -= dt;
      if (p.reload <= 0) this.finishReload();
    }
    p.cd -= dt;
    p.swing = Math.max(0, p.swing - dt * 4);

    // крафт
    if (p.queue.length) {
      const q = p.queue[0];
      q.t -= dt;
      if (q.t <= 0) {
        p.queue.shift();
        this.give(makeStack(q.r.out, q.r.n));
        this.sfx('craft');
      }
      UI.queueDirty = true;
    }

    // постройка
    const held = this.heldItem();
    this.ghost = null;
    if (held && ITEMS[held.id].deploy) {
      let gx = input.wx, gy = input.wy;
      const d = dist(p.x, p.y, gx, gy), maxD = TILE * 3.2;
      if (input.touch || d > maxD) {
        const dd = input.touch ? TILE * 1.6 : maxD;
        gx = p.x + Math.cos(p.ang) * dd; gy = p.y + Math.sin(p.ang) * dd;
      }
      const tx = Math.floor(gx / TILE), ty = Math.floor(gy / TILE);
      const ok = w.canPlace(held.id, tx, ty, [p, ...this.animals, ...this.npcs]);
      this.ghost = { id: held.id, tx, ty, ok };
    }

    // действие
    if (input.fire && !this.ui && p.cd <= 0) this.useHeld();
    if (input.reloadPressed) this.startReload();
    if (input.demolishPressed) this.demolish();

    // фокус взаимодействия
    this.focus = this.findFocus();
    if (input.usePressed && !this.ui) this.interact();
  },

  move(e, dx, dy) {
    const w = this.world;
    let blocker = null;
    if (dx) { const b = w.blocked(e.x + dx, e.y, e.r); if (!b) e.x += dx; else blocker = b; }
    if (dy) { const b = w.blocked(e.x, e.y + dy, e.r); if (!b) e.y += dy; else blocker = blocker || b; }
    // столкновения между существами
    if (e !== this.player && !this.player.dead) this.push(e, this.player);
    return blocker;
  },
  push(a, b) {
    const rr = a.r + b.r, d2 = dist2(a.x, a.y, b.x, b.y);
    if (d2 < rr * rr && d2 > 0.01) {
      const d = Math.sqrt(d2), o = (rr - d) / 2;
      const nx = (a.x - b.x) / d, ny = (a.y - b.y) / d;
      if (!this.world.blocked(a.x + nx * o, a.y + ny * o, a.r)) { a.x += nx * o; a.y += ny * o; }
    }
  },

  damagePlayer(dmg, src, quiet) {
    const p = this.player;
    if (p.dead) return;
    if (!quiet && p.armor) dmg *= 1 - ITEMS[p.armor.id].armor;
    p.hp -= dmg;
    if (!quiet) {
      this.hurt = Math.min(1, this.hurt + dmg / 30);
      this.shake = Math.min(1, this.shake + dmg / 25);
      this.sfx('hurt');
      this.particles(p.x, p.y, 6, '#9b2020', 120, 0.5, 3);
      if ((src === 'melee' || src === 'arrow' || src === 'animal') && Math.random() < 0.35) p.bleed = Math.max(p.bleed, 6);
    }
    if (p.hp <= 0) this.killPlayer(src);
  },

  killPlayer(src) {
    const p = this.player;
    p.dead = true; p.hp = 0;
    this.stats.deaths++;
    const items = p.inv.filter(Boolean);
    if (p.armor) items.push(p.armor);
    this.dropBag(p.x, p.y, items.map((s) => Object.assign({}, s)), 'backpack');
    p.inv = new Array(INV_SIZE).fill(null); p.armor = null; p.queue = [];
    this.sfx('death');
    const why = { starve: 'Голод и жажда', bleed: 'Кровотечение', animal: 'Дикий зверь', melee: 'Мародёр', bullet: 'Пуля мародёра', arrow: 'Стрела мародёра', spikes: 'Колючая баррикада' };
    this.deathCause = why[src] || 'Остров';
    this.ui = null;
    UI.showDeath();
  },

  respawn(atBag) {
    const p = this.player;
    let pos = null;
    if (atBag && p.bag && !p.bag.dead) pos = { x: p.bag.x, y: p.bag.y + TILE };
    if (!pos || this.world.blocked(pos.x, pos.y, p.r)) pos = atBag && p.bag && !p.bag.dead ? this.freeNear(p.bag.x, p.bag.y) : this.world.randomBeach();
    const np = this.makePlayer(pos.x, pos.y);
    np.bag = p.bag && !p.bag.dead ? p.bag : null;
    np.hp = 70; np.food = 45; np.water = 45;
    this.player = np;
    UI.dirty = true;
  },
  freeNear(x, y) {
    for (let r = 32; r < 200; r += 16) for (let a = 0; a < TAU; a += 0.5) {
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (!this.world.blocked(px, py, 13)) return { x: px, y: py };
    }
    return this.world.randomBeach();
  },

  // ---------- использование предмета ----------
  useHeld() {
    const p = this.player, s = this.heldItem();
    const def = s ? ITEMS[s.id] : null;
    if (def && def.deploy) return this.place();
    if (def && def.gun) return this.shoot(s, def.gun);
    if (def && def.use) { p.cd = 0.4; return this.consume(p.sel); }
    this.swing(def && def.melee ? def : FISTS);
  },

  consume(slot, fromArmorList) {
    const p = this.player, s = p.inv[slot];
    if (!s) return;
    const u = ITEMS[s.id].use;
    if (!u) return;
    if (u.food && p.food >= 99 && !u.hp) { this.toast('Вы сыты'); return; }
    if (u.water && !u.food && p.water >= 99) { this.toast('Вы не хотите пить'); return; }
    if (u.food) p.food = clamp(p.food + u.food, 0, 100);
    if (u.water) p.water = clamp(p.water + u.water, 0, 100);
    if (u.hp) { if (u.hp < 0) this.damagePlayer(-u.hp, 'food', true); else p.hp = Math.min(100, p.hp + u.hp); }
    if (u.bleed) p.bleed = 0;
    s.n--; if (s.n <= 0) p.inv[slot] = null;
    this.sfx(ITEMS[s.id].cat === 'med' ? 'craft' : s.id === 'water_bottle' ? 'drink' : 'eat');
    UI.dirty = true;
  },

  swing(def) {
    const p = this.player, m = def.melee;
    p.cd = m.cd; p.swing = 1;
    this.sfx('swing', p.x, p.y, 0.7);
    const t = this.meleeTarget(p.x, p.y, p.ang, m.range);
    if (!t) return;
    const hx = p.x + Math.cos(p.ang) * Math.min(m.range, t.d), hy = p.y + Math.sin(p.ang) * Math.min(m.range, t.d);
    if (t.kind === 'node') this.hitNode(t.o, def, hx, hy);
    else if (t.kind === 'animal') { this.damageAnimal(t.o, m.dmg, p); this.sfx('flesh', hx, hy); }
    else if (t.kind === 'npc') { this.damageNpc(t.o, m.dmg); this.sfx('flesh', hx, hy); }
    else if (t.kind === 'struct') this.hitStruct(t.o, def, hx, hy);
  },

  meleeTarget(x, y, ang, range) {
    let best = null;
    const consider = (kind, o, ox, oy, r) => {
      const d = dist(x, y, ox, oy) - r;
      if (d > range) return;
      const a = Math.atan2(oy - y, ox - x);
      if (Math.abs(angleDiff(ang, a)) > 0.85 && d > 6) return;
      if (!best || d < best.d) best = { kind, o, d: Math.max(0, d) };
    };
    this.world.queryNodes(x - range - 40, y - range - 40, x + range + 40, y + range + 40, (n) => {
      const def = NODES[n.type];
      if (def.amt || def.hp) consider('node', n, n.x, n.y, n.r);
    });
    for (const a of this.animals) consider('animal', a, a.x, a.y, a.r);
    for (const n of this.npcs) consider('npc', n, n.x, n.y, n.r);
    for (let d = 14; d <= range + 6; d += 10) {
      const sx = x + Math.cos(ang) * d, sy = y + Math.sin(ang) * d;
      const s = this.world.structAt(sx, sy);
      if (s && (STRUCTS[s.type].solid || STRUCTS[s.type].door || d < range)) { consider('struct', s, sx, sy, 0); break; }
    }
    return best;
  },

  hitNode(n, def, hx, hy) {
    const nd = NODES[n.type];
    if (nd.hp) { // бочка
      n.hp -= def.melee.dmg;
      this.particles(hx, hy, 5, '#3f6f8c', 100, 0.4, 3);
      this.sfx('stone', hx, hy, 0.6);
      if (n.hp <= 0) this.breakBarrel(n);
      return;
    }
    const key = nd.gatherAs || n.type;
    const rate = (def.gather || {})[key] || 0;
    const isWood = key === 'tree';
    this.particles(hx, hy, 5, isWood ? '#a87a4a' : '#9a958c', 110, 0.45, 3);
    this.sfx(isWood ? 'wood' : 'stone', hx, hy);
    n.shake = 0.2;
    if (!rate) { this.toast(isWood ? 'Нужен инструмент получше' : 'Нужна кирка или булыжник'); return; }
    const take = Math.min(rate, n.amt);
    n.amt -= take;
    this.give(makeStack(nd.res, take));
    if (nd.extra && Math.random() < 0.5) this.give(makeStack(nd.extra, Math.ceil(take * 0.6)));
    if (n.amt <= 0) {
      this.particles(n.x, n.y, 18, isWood ? '#5d7a3a' : '#8b8780', 180, 0.8, 4);
      this.sfx('break', n.x, n.y);
      this.world.removeNode(n, 240);
    }
  },

  breakBarrel(n) {
    this.particles(n.x, n.y, 14, '#4d7a96', 160, 0.6, 4);
    this.sfx('break', n.x, n.y);
    this.dropBag(n.x, n.y, rollLoot('barrel', 1));
    this.world.removeNode(n, 200);
  },

  hitStruct(s, def, hx, hy) {
    const sd = STRUCTS[s.type];
    this.sfx(sd.mat === 'wood' ? 'wood' : 'stone', hx, hy, 0.8);
    this.particles(hx, hy, 4, sd.mat === 'wood' ? '#a87a4a' : '#9a958c', 90, 0.4, 3);
    if (def.hammer && s.owner === 'player') {
      if (s.hp >= sd.hp) { this.toast('Постройка цела'); return; }
      const mat = sd.mat === 'stone' ? 'stone' : sd.mat === 'cloth' ? 'cloth' : 'wood';
      if (!invRemove(this.player.inv, mat, 10)) { this.toast(`Для ремонта нужно 10 ед.: ${ITEMS[mat].name}`); return; }
      s.hp = Math.min(sd.hp, s.hp + sd.hp * 0.12);
      UI.dirty = true;
    }
  },

  damageStruct(s, dmg) {
    if (!s || s.dead || STRUCTS[s.type].fixed) return;
    s.hp -= dmg;
    s.hitT = 0.2;
    if (s.hp <= 0) {
      this.sfx('break', s.x, s.y);
      this.particles(s.x, s.y, 16, STRUCTS[s.type].mat === 'wood' ? '#8a5a32' : '#8b8780', 160, 0.7, 4);
      if (s.items && s.items.length) this.dropBag(s.x, s.y, s.items);
      if (s.fire) this.dropFire(s);
      this.world.removeStruct(s);
      if (this.player.bag === s) { this.player.bag = null; this.toast('Ваш спальный мешок уничтожен', 'bad'); }
      else if (s.owner === 'player') this.toast('Постройка разрушена', 'bad');
    }
  },
  dropFire(s) {
    const f = s.fire, items = [];
    if (f.fuel) items.push(makeStack('wood', f.fuel));
    for (const k in f.input) if (f.input[k]) items.push(makeStack(k, f.input[k]));
    for (const k in f.output) if (f.output[k]) items.push(makeStack(k, f.output[k]));
    this.dropBag(s.x, s.y, items);
  },

  demolish() {
    const p = this.player, s = this.heldItem();
    if (!s || !ITEMS[s.id].hammer) { this.toast('Возьмите молоток, чтобы разбирать постройки'); return; }
    const t = this.meleeTarget(p.x, p.y, p.ang, 60);
    if (!t || t.kind !== 'struct' || t.o.owner !== 'player') { this.toast('Наведитесь на свою постройку'); return; }
    const st = t.o, ref = STRUCTS[st.type].refund || {};
    for (const id in ref) this.give(makeStack(id, Math.round(ref[id] * (st.hp / STRUCTS[st.type].hp))));
    if (st.items && st.items.length) this.dropBag(st.x, st.y, st.items);
    if (st.fire) this.dropFire(st);
    this.world.removeStruct(st);
    if (p.bag === st) p.bag = null;
    this.sfx('break', st.x, st.y);
  },

  place() {
    const p = this.player, g = this.ghost, s = this.heldItem();
    p.cd = 0.25;
    if (!g || !g.ok) { this.toast('Здесь нельзя строить'); return; }
    const st = this.world.addStruct(g.id, g.tx, g.ty);
    s.n--; if (s.n <= 0) p.inv[p.sel] = null;
    this.sfx('build', st.x, st.y);
    this.particles(st.x, st.y, 8, '#b59a72', 80, 0.5, 3);
    if (g.id === 'sleeping_bag') { p.bag = st; this.toast('Точка возрождения сохранена', 'good'); }
    if (g.id === 'workbench') this.stats.bench++;
    UI.dirty = true;
  },

  // ---------- стрельба ----------
  shoot(s, gun) {
    const p = this.player;
    if (p.reload > 0) return;
    if (s.mag <= 0) {
      if (invCount(p.inv, gun.ammo) > 0) this.startReload();
      else { this.sfx('empty'); this.toast(`Нет боеприпасов: ${ITEMS[gun.ammo].name}`); p.cd = 0.4; }
      return;
    }
    s.mag--;
    p.cd = gun.cd;
    const n = gun.pellets || 1;
    const mx = p.x + Math.cos(p.ang) * 18, my = p.y + Math.sin(p.ang) * 18;
    for (let i = 0; i < n; i++) {
      const a = p.ang + rand(-gun.spread, gun.spread) * (p.moving ? 1.6 : 1);
      const sp = gun.speed * rand(0.92, 1.05);
      this.shots.push({ x: mx, y: my, px: mx, py: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: gun.dmg, from: 'p', kind: gun.proj, life: gun.range || 1.1 });
    }
    this.sfx(gun.sound);
    if (gun.proj !== 'arrow') { this.flash = 0.06; this.shake = Math.min(1, this.shake + (gun.pellets ? 0.6 : 0.3)); this.makeNoise(p.x, p.y, 750); }
    this.particles(mx, my, gun.proj === 'arrow' ? 0 : 4, '#ffd27a', 140, 0.15, 2);
    if (s.mag <= 0 && invCount(p.inv, gun.ammo) > 0 && gun.mag === 1) this.startReload();
    UI.dirty = true;
  },

  startReload() {
    const p = this.player, s = this.heldItem();
    if (!s || !ITEMS[s.id].gun || p.reload > 0) return;
    const gun = ITEMS[s.id].gun;
    if (s.mag >= gun.mag) return;
    if (invCount(p.inv, gun.ammo) <= 0) { this.toast(`Нет боеприпасов: ${ITEMS[gun.ammo].name}`); return; }
    p.reload = gun.reload; p.reloadSlot = p.sel; p.reloadMax = gun.reload;
    this.sfx('reload');
  },
  finishReload() {
    const p = this.player, s = p.inv[p.reloadSlot];
    if (!s || !ITEMS[s.id].gun) return;
    const gun = ITEMS[s.id].gun;
    const take = Math.min(gun.mag - s.mag, invCount(p.inv, gun.ammo));
    invRemove(p.inv, gun.ammo, take);
    s.mag += take;
    UI.dirty = true;
  },

  updateShots(dt) {
    const w = this.world, p = this.player;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const b = this.shots[i];
      b.life -= dt;
      b.px = b.x; b.py = b.y;
      const steps = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 8);
      let dead = b.life <= 0;
      for (let k = 0; k < steps && !dead; k++) {
        b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
        if (b.x < 0 || b.y < 0 || b.x > WORLD || b.y > WORLD) { dead = true; break; }
        const s = w.structAt(b.x, b.y);
        if (s && w.blocksShots(s)) {
          if (b.from === 'n' && s.owner === 'player') this.damageStruct(s, b.dmg * 0.6);
          this.particles(b.x, b.y, 3, STRUCTS[s.type].mat === 'wood' ? '#a87a4a' : '#bbb', 80, 0.3, 2);
          dead = true; break;
        }
        let hitNode = null;
        w.queryNodes(b.x - 30, b.y - 30, b.x + 30, b.y + 30, (n) => {
          if (NODES[n.type].block && dist2(n.x, n.y, b.x, b.y) < n.r * n.r) { hitNode = n; return false; }
        });
        if (hitNode) {
          if (hitNode.type === 'barrel' && b.from === 'p') { hitNode.hp -= b.dmg; if (hitNode.hp <= 0) this.breakBarrel(hitNode); }
          this.particles(b.x, b.y, 3, '#9a958c', 80, 0.3, 2);
          dead = true; break;
        }
        if (b.from === 'p') {
          for (const a of this.animals) if (dist2(a.x, a.y, b.x, b.y) < a.r * a.r) { this.damageAnimal(a, b.dmg, p); dead = true; break; }
          if (dead) break;
          for (const n of this.npcs) if (dist2(n.x, n.y, b.x, b.y) < n.r * n.r) { this.damageNpc(n, b.dmg); dead = true; break; }
        } else if (!p.dead && dist2(p.x, p.y, b.x, b.y) < p.r * p.r) {
          this.damagePlayer(b.dmg, b.kind === 'arrow' ? 'arrow' : 'bullet');
          dead = true;
        }
      }
      if (dead) this.shots.splice(i, 1);
    }
  },

  // ---------- взаимодействие ----------
  findFocus() {
    const p = this.player, w = this.world, R = 52;
    let best = null, bd = Infinity;
    const fx = p.x + Math.cos(p.ang) * 14, fy = p.y + Math.sin(p.ang) * 14;
    const consider = (o, x, y, r, label) => {
      const d = dist(fx, fy, x, y) - r;
      if (d < R && d < bd) { bd = d; best = { o, label }; }
    };
    w.queryNodes(p.x - 80, p.y - 80, p.x + 80, p.y + 80, (n) => {
      const nd = NODES[n.type];
      if (nd.pick || nd.container) consider({ node: n }, n.x, n.y, n.r, nd.label);
    });
    for (const b of this.bags) {
      const label = b.kind === 'corpse' ? (b.what === 'npc' ? 'Обыскать тело' : 'Разделать тушу') : b.kind === 'backpack' ? 'Забрать свой рюкзак' : 'Открыть мешок';
      consider({ bag: b }, b.x, b.y, 10, label);
    }
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    for (let y = ty - 2; y <= ty + 2; y++) for (let x = tx - 2; x <= tx + 2; x++) {
      const s = w.structAtTile(x, y);
      if (!s) continue;
      const sd = STRUCTS[s.type];
      if (sd.door) consider({ struct: s }, s.x, s.y, 12, s.open ? 'Закрыть дверь' : 'Открыть дверь');
      else if (sd.fire) consider({ struct: s }, s.x, s.y, 14, s.type === 'campfire' ? 'Открыть костёр' : 'Открыть печь');
      else if (sd.storage) consider({ struct: s }, s.x, s.y, 14, 'Открыть ящик');
    }
    if (!best) {
      const wx = p.x + Math.cos(p.ang) * 26, wy = p.y + Math.sin(p.ang) * 26;
      if (w.heightAt(wx, wy) < SHORE || w.heightAt(p.x, p.y) < SHORE) best = { o: { water: true }, label: 'Пить воду' };
    }
    return best;
  },

  interact() {
    const f = this.focus, p = this.player;
    if (!f) return;
    const o = f.o;
    if (o.water) {
      if (p.water >= 99) { this.toast('Вы не хотите пить'); return; }
      p.water = Math.min(100, p.water + 18);
      this.sfx('drink');
      return;
    }
    if (o.node) {
      const n = o.node, nd = NODES[n.type];
      if (nd.pick) {
        for (const id in nd.pick) this.give(makeStack(id, randi(nd.pick[id][0], nd.pick[id][1])));
        this.sfx('pickup');
        this.world.removeNode(n, 180);
        return;
      }
      if (nd.container) {
        if (n.type === 'elite' || n.type === 'drop') this.stats.elite++;
        UI.openContainer(n, n.type === 'drop' ? 'Аирдроп' : n.type === 'elite' ? 'Военный ящик' : 'Деревянный ящик', 12);
        return;
      }
    }
    if (o.bag) {
      const b = o.bag;
      UI.openContainer(b, b.kind === 'corpse' ? (b.what === 'npc' ? 'Тело мародёра' : 'Туша: ' + ANIMALS[b.what].name) : b.kind === 'backpack' ? 'Ваш рюкзак' : 'Мешок', 36);
      return;
    }
    if (o.struct) {
      const s = o.struct, sd = STRUCTS[s.type];
      if (sd.door) {
        if (s.open) {
          // не закрывать дверь на себе
          const blockers = [p, ...this.animals, ...this.npcs].some((e) => circleRect(e.x, e.y, e.r, s.tx * TILE + 2, s.ty * TILE + 2, TILE - 4, TILE - 4));
          if (blockers) return;
        }
        s.open = !s.open;
        this.sfx('door', s.x, s.y);
      } else if (sd.fire) UI.openFire(s);
      else if (sd.storage) UI.openContainer(s, 'Деревянный ящик', sd.storage);
    }
  },

  // Закрытие контейнера: пустые ящики исчезают и появятся позже в другом месте.
  closeContainer(ref) {
    if (ref && ref.type && NODES[ref.type] && NODES[ref.type].container && !ref.items.length) {
      this.world.removeNode(ref, ref.type === 'drop' ? 0 : 300);
      if (ref === this.drop) this.drop = null;
    }
  },

  // ---------- крафт ----------
  craft(r, times = 1) {
    const p = this.player;
    if (r.bench && !this.nearBench(p.x, p.y)) { this.toast('Нужен верстак рядом'); return false; }
    let made = 0;
    for (let i = 0; i < times; i++) {
      if (!hasCost(p.inv, r.cost)) break;
      payCost(p.inv, r.cost);
      p.queue.push({ r, t: r.time, max: r.time });
      made++;
    }
    if (!made) { this.toast('Не хватает ресурсов'); return false; }
    this.sfx('click');
    UI.dirty = true;
    return true;
  },
  cancelCraft(i) {
    const p = this.player, q = p.queue[i];
    if (!q) return;
    p.queue.splice(i, 1);
    for (const id in q.r.cost) this.give(makeStack(id, q.r.cost[id]), true);
    UI.dirty = true;
  },

  // ---------- огонь: костёр и печь ----------
  updateFires(dt) {
    for (const s of this.world.structs) {
      const f = s.fire;
      if (!f || !f.on) continue;
      if (f.fuel <= 0) { f.on = false; continue; }
      const furnace = s.type === 'furnace';
      f.burn += dt;
      const per = furnace ? 1.2 : 3;
      if (f.burn >= per) {
        f.burn -= per; f.fuel--;
        if (furnace) f.output.charcoal = (f.output.charcoal || 0) + 1;
      }
      f.t += dt;
      const rate = furnace ? 0.5 : 2.5;
      const conv = furnace ? { metal_ore: 'metal', sulfur_ore: 'sulfur' } : { raw_meat: 'cooked_meat' };
      while (f.t >= rate) {
        f.t -= rate;
        const src = Object.keys(conv).find((k) => f.input[k] > 0);
        if (!src) break;
        f.input[src]--;
        f.output[conv[src]] = (f.output[conv[src]] || 0) + 1;
        if (src === 'raw_meat') this.stats.cooked++;
      }
      if (Math.random() < dt * 4) this.parts.push({ x: s.x + rand(-4, 4), y: s.y - 4, vx: rand(-6, 6), vy: rand(-30, -18), life: 2, max: 2, size: rand(4, 7), color: 'smoke', grav: 0 });
      if (this.ui && this.ui.fire === s) UI.fireDirty = true;
    }
  },

  // ---------- животные ----------
  fillAnimals(initial) {
    const p = this.player, night = this.isNight();
    const want = { deer: 14, boar: 9, wolf: night ? 13 : 7, bear: 3 };
    const homes = { deer: ['grass', 'forest'], boar: ['forest', 'grass'], wolf: ['forest', 'grass', 'rock'], bear: ['forest'] };
    for (const type in want) {
      const have = this.animals.filter((a) => a.type === type).length;
      if (have >= want[type]) continue;
      if (!initial && Math.random() > 0.15) continue;
      const n = initial ? want[type] - have : 1;
      for (let i = 0; i < n; i++) {
        const pos = this.world.randomLand(initial ? 500 : 900, p.x, p.y, homes[type]);
        if (pos) this.spawnAnimal(type, pos.x, pos.y);
      }
    }
  },
  spawnAnimal(type, x, y) {
    const d = ANIMALS[type];
    this.animals.push({ type, x, y, r: d.r, hp: d.hp, ang: rand(0, TAU), state: 'wander', t: 0, cd: 0, dir: rand(0, TAU), go: false, angry: 0, walk: 0, hitT: 0 });
  },
  damageAnimal(a, dmg, by) {
    a.hp -= dmg; a.hitT = 0.15; a.angry = 12;
    this.hit = 0.15;
    this.particles(a.x, a.y, 7, '#9b2020', 130, 0.5, 3);
    if (a.hp <= 0) {
      a.dead = true;
      const loot = [];
      for (const id in ANIMALS[a.type].loot) { const [lo, hi] = ANIMALS[a.type].loot[id]; loot.push(makeStack(id, randi(lo, hi))); }
      const b = this.dropBag(a.x, a.y, loot, 'corpse', a.type);
      if (b) b.ang = a.ang;
      this.stats.kills++;
    } else if (ANIMALS[a.type].behavior === 'hunt' && Math.random() < 0.4) this.sfx('growl', a.x, a.y, 0.7);
  },
  updateAnimal(a, dt) {
    const d = ANIMALS[a.type], p = this.player;
    a.cd -= dt; a.t -= dt; a.angry -= dt; a.hitT -= dt;
    const dp = p.dead ? 1e9 : dist(a.x, a.y, p.x, p.y);
    if (dp > 2600) return; // далеко — спит
    let mode = 'wander';
    if (d.behavior === 'flee') { if (dp < 190 || a.angry > 0) mode = 'flee'; }
    else if (d.behavior === 'defend') { if (a.angry > 0) mode = a.hp < d.hp * 0.25 ? 'flee' : 'chase'; else if (dp < 70) a.angry = 8; }
    else if (d.behavior === 'hunt') {
      const sight = d.sight * (this.isNight() ? 1.35 : 1);
      if (a.hp < d.hp * 0.2) mode = 'flee';
      else if (dp < sight || (a.angry > 0 && dp < sight * 2)) mode = 'chase';
    }
    let speed = d.speed, dir = a.dir, go = false;
    if (mode === 'flee') { dir = Math.atan2(a.y - p.y, a.x - p.x) + Math.sin(this.tick * 2 + a.x) * 0.4; speed = d.run; go = true; }
    else if (mode === 'chase') {
      dir = Math.atan2(p.y - a.y, p.x - a.x); speed = d.run; go = dp > a.r + p.r + 4;
      if (dp < a.r + p.r + 10 && a.cd <= 0) {
        a.cd = d.cd; a.bite = 0.25;
        this.damagePlayer(d.dmg, 'animal');
      }
    } else {
      if (a.t <= 0) { a.t = rand(1.5, 5); a.go = Math.random() < 0.6; a.dir = rand(0, TAU); }
      dir = a.dir; go = a.go; speed = d.speed * 0.6;
    }
    a.bite = Math.max(0, (a.bite || 0) - dt);
    if (go) {
      const b = this.move(a, Math.cos(dir) * speed * dt, Math.sin(dir) * speed * dt);
      if (b) {
        if (b.kind === 'struct' && STRUCTS[b.s.type].spikes) { a.hp -= 20 * dt; if (a.hp <= 0) this.damageAnimal(a, 1, null); }
        if (mode === 'wander') a.t = 0; else a.dir = dir + rand(-1.5, 1.5);
      }
      a.ang += angleDiff(a.ang, dir) * Math.min(1, dt * 8);
      a.walk += dt * speed / 12;
    }
  },

  // ---------- мародёры ----------
  spawnNpc(kind, x, y, spawn) {
    const d = NPC_KINDS[kind];
    const n = { kind, x, y, r: 12, hp: d.hp, ang: rand(0, TAU), state: 'idle', t: 0, cd: rand(0.5, 1.5), burst: 0, home: { x, y }, spawn, walk: 0, strafe: 1, strafeT: 0, hitT: 0, dir: 0, go: false };
    this.npcs.push(n);
    return n;
  },
  spawnRoamer() {
    const p = this.player;
    const pos = this.world.randomLand(900, p.x, p.y, ['grass', 'forest', 'sand']);
    if (pos) this.spawnNpc(Math.random() < 0.55 ? 'spear' : 'bow', pos.x, pos.y, { roam: true });
  },
  damageNpc(n, dmg) {
    const d = NPC_KINDS[n.kind];
    n.hp -= dmg * (1 - d.armor); n.hitT = 0.15;
    this.hit = 0.15;
    this.particles(n.x, n.y, 7, '#9b2020', 130, 0.5, 3);
    if (n.state !== 'combat') { n.state = 'search'; n.last = { x: this.player.x, y: this.player.y }; n.t = 10; }
    if (n.hp <= 0) {
      n.dead = true;
      this.stats.kills++;
      const b = this.dropBag(n.x, n.y, rollFrom(NPC_LOOT[n.kind]), 'corpse', 'npc');
      if (b) { b.ang = n.ang; b.npcKind = n.kind; }
      if (n.spawn && !n.spawn.raid) this.npcRespawn.push({ spawn: n.spawn, kind: n.kind, t: n.spawn.roam ? 120 : 180 });
    }
  },
  updateNpc(n, dt) {
    const d = NPC_KINDS[n.kind], p = this.player, w = this.world;
    n.cd -= dt; n.t -= dt; n.hitT -= dt; n.strafeT -= dt; n.atk = Math.max(0, (n.atk || 0) - dt * 4);
    const dp = p.dead ? 1e9 : dist(n.x, n.y, p.x, p.y);
    if (dp > 2600 && n.state !== 'raid') return;
    const held = this.heldItem();
    const lit = held && ITEMS[held.id].light;
    const sight = this.isNight() ? (lit ? 520 : 230) : 430;
    const sees = !p.dead && dp < sight && !w.lineBlocked(n.x, n.y, p.x, p.y);
    if (sees) { n.state = 'combat'; n.last = { x: p.x, y: p.y }; n.t = 6; }
    else if (n.state === 'combat') { n.state = 'search'; n.t = 8; }

    let dir = n.dir, go = false, speed = d.speed;
    if (n.state === 'combat') {
      const toP = Math.atan2(p.y - n.y, p.x - n.x);
      n.ang = toP;
      if (n.strafeT <= 0) { n.strafeT = rand(0.8, 2); n.strafe = Math.random() < 0.5 ? -1 : 1; }
      if (d.ranged) {
        let fwd = 0;
        if (dp > d.pref + 60) fwd = 1; else if (dp < d.pref - 60) fwd = -1;
        const vx = Math.cos(toP) * fwd + Math.cos(toP + Math.PI / 2) * n.strafe * 0.7;
        const vy = Math.sin(toP) * fwd + Math.sin(toP + Math.PI / 2) * n.strafe * 0.7;
        dir = Math.atan2(vy, vx); go = true; speed = d.speed * 0.8;
        if (n.cd <= 0 && dp < sight) this.npcShoot(n, d, toP);
      } else {
        dir = toP; go = dp > d.range - 8;
        if (dp < d.range && n.cd <= 0) { n.cd = d.cd; n.atk = 1; this.damagePlayer(d.dmg, 'melee'); this.sfx('swing', n.x, n.y); }
      }
    } else if (n.state === 'search' || n.state === 'raid') {
      const tgt = n.state === 'raid' && !p.dead ? p : n.last;
      if (tgt) {
        dir = Math.atan2(tgt.y - n.y, tgt.x - n.x); n.ang = dir; go = dist(n.x, n.y, tgt.x, tgt.y) > 30;
        if (!go && n.state === 'search') n.t = Math.min(n.t, 1);
      }
      if (n.state === 'search' && n.t <= 0) n.state = 'idle';
      if (n.state === 'raid' && p.dead) n.state = 'idle';
    } else {
      if (n.t <= 0) {
        n.t = rand(2, 5); n.go = Math.random() < 0.55;
        const hx = n.home.x - n.x, hy = n.home.y - n.y;
        n.dir = Math.hypot(hx, hy) > (n.spawn && n.spawn.roam ? 500 : 180) ? Math.atan2(hy, hx) : rand(0, TAU);
      }
      dir = n.dir; go = n.go; speed = d.speed * 0.45; if (go) n.ang += angleDiff(n.ang, dir) * Math.min(1, dt * 6);
    }
    if (go) {
      const b = this.move(n, Math.cos(dir) * speed * dt, Math.sin(dir) * speed * dt);
      n.walk += dt * speed / 12;
      if (b && b.kind === 'struct' && b.s.owner === 'player' && n.state !== 'idle') {
        if (STRUCTS[b.s.type].spikes) { n.hp -= 15 * dt; if (n.hp <= 0) this.damageNpc(n, 1); }
        if (n.cd <= 0) { n.cd = 1.1; n.atk = 1; this.damageStruct(b.s, 22); this.sfx(STRUCTS[b.s.type].mat === 'wood' ? 'wood' : 'stone', b.s.x, b.s.y); }
      } else if (b) { n.dir = dir + (Math.random() < 0.5 ? 1.2 : -1.2); n.t = Math.min(n.t, 0.6); }
    }
  },
  npcShoot(n, d, ang) {
    const p = this.player;
    const lead = 0.15 * (p.moving ? 1 : 0);
    const a = ang + rand(-0.09, 0.09) + (p.moving ? rand(-lead, lead) : 0);
    const kind = d.weapon === 'bow' ? 'arrow' : d.weapon === 'shotgun' ? 'pellet' : 'bullet';
    const sp = kind === 'arrow' ? 620 : kind === 'pellet' ? 850 : 1000;
    const nP = d.pellets || 1;
    for (let i = 0; i < nP; i++) {
      const aa = a + (nP > 1 ? rand(-0.22, 0.22) : 0);
      this.shots.push({ x: n.x + Math.cos(aa) * 16, y: n.y + Math.sin(aa) * 16, px: n.x, py: n.y, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, dmg: d.dmg, from: 'n', kind, life: kind === 'pellet' ? 0.45 : 1 });
    }
    n.atk = 1;
    if (d.burst) {
      n.burst = (n.burst || 0) + 1;
      if (n.burst >= d.burst) { n.burst = 0; n.cd = d.cd * 2.2; } else n.cd = d.cd * 0.45;
    } else n.cd = d.cd * rand(0.9, 1.3);
    this.sfx(kind === 'arrow' ? 'bow' : 'npcgun', n.x, n.y);
  },

  // ---------- события ----------
  updateEvents(dt) {
    const p = this.player;
    // возрождение мародёров
    for (let i = this.npcRespawn.length - 1; i >= 0; i--) {
      const r = this.npcRespawn[i];
      r.t -= dt;
      if (r.t > 0) continue;
      if (r.spawn.roam) { this.spawnRoamer(); this.npcRespawn.splice(i, 1); continue; }
      if (dist(r.spawn.x, r.spawn.y, p.x, p.y) < 600) { r.t = 20; continue; }
      this.spawnNpc(r.kind, r.spawn.x, r.spawn.y, r.spawn);
      this.npcRespawn.splice(i, 1);
    }
    // ночной налёт на лагерь
    const mine = this.world.structs.filter((s) => s.owner === 'player');
    if (this.isNight() && this.raidNight !== this.day && mine.length >= 4 && !p.dead) {
      const base = mine[0];
      if (dist(base.x, base.y, p.x, p.y) < 700 && Math.random() < dt / 40) {
        this.raidNight = this.day;
        const n = 2 + Math.min(3, Math.floor(this.day / 3));
        const a0 = rand(0, TAU);
        for (let i = 0; i < n; i++) {
          for (let k = 0; k < 20; k++) {
            const a = a0 + rand(-0.6, 0.6), r = rand(650, 800);
            const x = base.x + Math.cos(a) * r, y = base.y + Math.sin(a) * r;
            if (!this.world.blocked(x, y, 14) && this.world.heightAt(x, y) > SHORE) {
              const kind = this.day > 4 ? pick(['revolver', 'shotgun', 'spear', 'bow']) : pick(['spear', 'spear', 'bow']);
              const npc = this.spawnNpc(kind, x, y, { raid: true });
              npc.state = 'raid';
              break;
            }
          }
        }
        this.toast('Мародёры идут на ваш лагерь!', 'bad');
        this.sfx('alert');
      }
    }
    // аирдроп
    this.airdropT -= dt;
    if (this.airdropT <= 0 && !this.plane) {
      this.airdropT = rand(480, 660);
      const tgt = this.world.randomLand(0, 0, 0, ['grass', 'sand', 'forest']);
      if (tgt) {
        const a = rand(0, TAU), L = WORLD;
        this.plane = { x: tgt.x - Math.cos(a) * L, y: tgt.y - Math.sin(a) * L, a, tx: tgt.x, ty: tgt.y, dropped: false, t: 0 };
        this.toast('Слышен самолёт — скоро сброс груза', 'good');
        this.sfx('plane');
      }
    }
    if (this.plane) {
      const pl = this.plane, sp = 380;
      pl.x += Math.cos(pl.a) * sp * dt; pl.y += Math.sin(pl.a) * sp * dt; pl.t += dt;
      if (!pl.dropped && dist(pl.x, pl.y, pl.tx, pl.ty) < 30) {
        pl.dropped = true;
        this.falling = { x: pl.tx, y: pl.ty, z: 1, t: 0 };
      }
      if (pl.t > (WORLD * 2) / sp) this.plane = null;
    }
    if (this.falling) {
      const f = this.falling;
      f.t += dt; f.z = Math.max(0, 1 - f.t / 9);
      f.x += Math.sin(f.t * 1.3) * 10 * dt;
      if (f.z <= 0) {
        this.falling = null;
        this.drop = this.world.addNode('drop', f.x, f.y);
        this.drop.items = [...rollLoot('elite', 3), ...rollLoot('crate', 2)].slice(0, 12);
        this.sfx('break', f.x, f.y);
        this.particles(f.x, f.y, 20, '#c8b48a', 160, 0.8, 4);
        // мародёры спешат к грузу
        this.npcs.filter((n) => n.spawn && n.spawn.roam).slice(0, 3).forEach((n) => { n.state = 'search'; n.last = { x: f.x, y: f.y }; n.t = 90; });
      }
    }
    if (this.drop && this.drop.dead) this.drop = null;
  },
};

NODES.drop = { r: 18, solid: true, block: true, container: 'elite', label: 'Открыть аирдроп' };
