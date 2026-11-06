/* Ядро: состояние партии, приказы, экономика, производство, туман войны, победа.
   Движение — units.js, стрельба — combat.js, противник — ai.js. */
const Game = (() => {
  let s = null; // текущая партия

  const tileOf = (v) => Math.floor(v / TILE);
  const alive = (e) => e && !e.dead && e.hp > 0;
  const center = (tx, size) => (tx + size / 2) * TILE;

  function newGame({ seed = Date.now() % 100000, difficulty = 'normal', aiTeams = [1] } = {}) {
    const map = MapGen.generate(seed);
    s = {
      map, seed, difficulty, time: 0, nextId: 0, ents: [], byId: new Map(), projectiles: [], effects: [],
      credits: [START_CREDITS, START_CREDITS], occ: new Int32Array(map.W * map.H),
      pools: map.pools.map((p) => ({ ...p, ext: 0 })),
      fogOn: !aiTeams.includes(0), vis: new Uint8Array(map.W * map.H), seen: new Uint8Array(map.W * map.H), fogT: 0,
      ais: aiTeams.map((t) => AI.create(t, difficulty)),
      winner: null, stats: [{ built: 0, lost: 0, kills: 0 }, { built: 0, lost: 0, kills: 0 }], alertT: -99, alert: null,
    };
    map.bases.forEach((b, team) => {
      placeBuilding('command', team, b.tx, b.ty, 1);
      const pass = passFn('land');
      for (let i = 0; i < 2; i++) {
        const t = Path.nearestPassable(map.W, map.H, pass, b.tx + 1 + (team ? -2 : 2) + i, b.ty + 1 + (team ? 3 : -3));
        if (t) spawnUnit('builder', team, (t.x + 0.5) * TILE, (t.y + 0.5) * TILE);
      }
    });
    updateFog(true);
    return s;
  }

  function passFn(move) {
    const { W, terrain } = s.map, occ = s.occ;
    if (move === 'air') return () => true;
    if (move === 'hover') return (x, y) => terrain[y * W + x] !== MapGen.ROCK && !occ[y * W + x];
    return (x, y) => terrain[y * W + x] === MapGen.LAND && !occ[y * W + x];
  }

  function makeEnt(type, team, x, y) {
    const def = DEFS[type];
    const face = team === 0 ? -Math.PI / 4 : (Math.PI * 3) / 4;
    const e = { id: ++s.nextId, type, def, team, x, y, hp: def.hp, maxHp: def.hp, angle: face, turret: face,
      cooldown: 0, recoil: 0, scanT: Math.random() * 0.3, target: null, dead: false, lastHit: -99 };
    s.ents.push(e); s.byId.set(e.id, e);
    return e;
  }

  function spawnUnit(type, team, x, y) {
    const e = makeEnt(type, team, x, y);
    Object.assign(e, { radius: e.def.radius, air: e.def.move === 'air', path: [], order: null, stuckT: 0, anchor: null });
    s.stats[team].built++;
    return e;
  }

  function placeBuilding(type, team, tx, ty, built = 0) {
    const def = DEFS[type], n = def.size;
    const e = makeEnt(type, team, center(tx, n), center(ty, n));
    Object.assign(e, { tx, ty, size: n, radius: (n * TILE) / 2 - 2, built, queue: [], prog: 0, level: 1, upg: null, rally: null });
    if (!built) e.hp = Math.max(1, def.hp * 0.1);
    for (let y = ty; y < ty + n; y++) for (let x = tx; x < tx + n; x++) s.occ[y * s.map.W + x] = e.id;
    if (def.onPool) { const p = poolAt(tx, ty); if (p) p.ext = e.id; }
    return e;
  }

  const poolAt = (tx, ty) => s.pools.find((p) => p.tx === tx && p.ty === ty);
  const overlapsPool = (tx, ty, n) => s.pools.some((p) => p.tx < tx + n && p.tx + 2 > tx && p.ty < ty + n && p.ty + 2 > ty);

  /* Можно ли поставить здание: true или текст причины */
  function canPlace(type, team, tx, ty) {
    const def = DEFS[type], n = def.size, { W, H, terrain } = s.map;
    if (tx < 0 || ty < 0 || tx + n > W || ty + n > H) return 'За краем карты';
    for (let y = ty; y < ty + n; y++)
      for (let x = tx; x < tx + n; x++) {
        const i = y * W + x;
        if (terrain[i] !== MapGen.LAND) return 'Строить можно только на суше';
        if (s.occ[i]) return 'Место занято';
        if (team === 0 && s.fogOn && !s.seen[i]) return 'Сначала разведайте место';
      }
    if (def.onPool) {
      const p = poolAt(tx, ty);
      if (!p) return 'Добытчик ставится на источник';
      if (p.ext) return 'Источник уже занят';
    } else if (overlapsPool(tx, ty, n)) return 'Не загораживайте источник';
    return true;
  }

  // ближайший к точке свободный источник — чтобы не целиться пальцем в клетку
  function snapPool(wx, wy) {
    let best = null, bd = 3.5 * TILE;
    for (const p of s.pools) {
      const d = Math.hypot(center(p.tx, 2) - wx, center(p.ty, 2) - wy);
      if (!p.ext && d < bd) { bd = d; best = p; }
    }
    return best;
  }

  const unitCount = (team) => s.ents.filter((e) => e.team === team && e.def.kind === 'unit' && !e.dead).length
    + s.ents.reduce((n, e) => n + (e.team === team && e.queue ? e.queue.length : 0), 0);

  /* ---------- приказы (одни и те же для игрока и для ИИ) ---------- */

  function orderMove(units, wx, wy, attackMove = false) {
    const list = units.filter((u) => u.def.kind === 'unit' && alive(u));
    // раскладываем юнитов сеткой вокруг точки, чтобы не толкались в одной
    const cols = Math.ceil(Math.sqrt(list.length)), gap = 28;
    const slots = list.map((_, i) => ({ x: wx + ((i % cols) - (cols - 1) / 2) * gap, y: wy + (Math.floor(i / cols) - (cols - 1) / 2) * gap }));
    const sorted = [...list].sort((a, b) => Math.hypot(a.x - wx, a.y - wy) - Math.hypot(b.x - wx, b.y - wy));
    sorted.forEach((u, i) => {
      u.order = { type: attackMove ? 'attackMove' : 'move', x: slots[i].x, y: slots[i].y };
      u.anchor = null;
      Units.setPath(u, slots[i].x, slots[i].y);
    });
  }

  function orderAttack(units, target) {
    for (const u of units) {
      if (u.def.kind !== 'unit' || !u.def.weapon || !Combat.canHit(u.def.weapon, target)) continue;
      u.order = { type: 'attack', target }; u.anchor = null;
      Units.setPath(u, target.x, target.y);
    }
  }

  function orderBuild(builder, type, tx, ty) {
    const def = DEFS[type];
    if (!builder.def.builds || !builder.def.builds.includes(type)) return 'Этот юнит не строит';
    const ok = canPlace(type, builder.team, tx, ty);
    if (ok !== true) return ok;
    if (s.credits[builder.team] < def.cost) return 'Не хватает кредитов';
    s.credits[builder.team] -= def.cost;
    const b = placeBuilding(type, builder.team, tx, ty, 0);
    orderAssist(builder, b);
    return b;
  }

  function orderAssist(builder, b) {
    if (!builder.def.builds || b.built >= 1 || b.team !== builder.team) return;
    builder.order = { type: 'build', target: b }; builder.anchor = null;
    Units.setPath(builder, b.x, b.y);
  }

  function orderStop(units) { for (const u of units) if (u.path) { u.order = null; u.path = []; u.anchor = null; } }

  function enqueue(f, type) {
    const def = DEFS[type];
    if (f.built < 1 || !f.def.produces || !f.def.produces.includes(type)) return 'Здесь это не строится';
    if (f.queue.length >= 9) return 'Очередь заполнена';
    if (unitCount(f.team) >= UNIT_CAP) return `Предел — ${UNIT_CAP} юнитов`;
    if (s.credits[f.team] < def.cost) return 'Не хватает кредитов';
    s.credits[f.team] -= def.cost;
    f.queue.push(type);
    return true;
  }

  function dequeue(f, type) {
    const i = f.queue.lastIndexOf(type);
    if (i < 0) return;
    f.queue.splice(i, 1);
    if (i === 0) f.prog = 0;
    s.credits[f.team] += DEFS[type].cost;
  }

  function upgrade(b) {
    const up = b.def.upgrade;
    if (!up || b.level > 1 || b.upg || b.built < 1) return 'Нельзя улучшить';
    if (s.credits[b.team] < up.cost) return 'Не хватает кредитов';
    s.credits[b.team] -= up.cost;
    b.upg = { t: 0 };
    return true;
  }

  function income(team) {
    let sum = 0;
    for (const e of s.ents) {
      if (e.team !== team || e.dead || e.def.kind !== 'building' || e.built < 1) continue;
      sum += e.level > 1 ? e.def.upgrade.income : e.def.income || 0;
    }
    const ai = s.ais.find((a) => a.team === team);
    return sum * (ai ? ai.lv.income : 1);
  }

  /* ---------- шаг симуляции ---------- */

  function update(dt) {
    if (!s || s.winner !== null) return;
    s.time += dt;
    for (const team of [0, 1]) s.credits[team] += income(team) * dt;
    for (const ai of s.ais) AI.update(s, ai, dt);
    for (const e of s.ents) if (e.def.kind === 'building' && !e.dead) updateBuilding(e, dt);
    Units.update(s, dt);
    Combat.update(s, dt);
    removeDead();
    s.fogT -= dt;
    if (s.fogT <= 0) { s.fogT = 0.2; updateFog(); }
  }

  function updateBuilding(b, dt) {
    if (b.built < 1) return;
    if (b.upg) {
      b.upg.t += dt;
      if (b.upg.t >= b.def.upgrade.time) {
        b.level = 2; b.upg = null;
        b.hp += b.def.upgrade.hp - b.maxHp; b.maxHp = b.def.upgrade.hp;
      }
    }
    if (!b.queue.length) return;
    b.prog += dt;
    if (b.prog >= DEFS[b.queue[0]].buildTime) {
      const type = b.queue.shift();
      b.prog = 0;
      releaseUnit(b, type);
    }
  }

  function releaseUnit(b, type) {
    const def = DEFS[type], { W, H } = s.map;
    let x = b.x, y = b.y + (b.size / 2) * TILE + 12;
    if (def.move !== 'air') {
      const t = Path.nearestPassable(W, H, passFn(def.move), b.tx + 1, b.ty + b.size) || { x: b.tx, y: b.ty + b.size };
      x = (t.x + 0.5) * TILE; y = (t.y + 0.5) * TILE;
    }
    const u = spawnUnit(type, b.team, x, y);
    const toMid = Math.atan2(s.map.H * TILE / 2 - b.y, s.map.W * TILE / 2 - b.x);
    const r = b.rally || { x: x + Math.cos(toMid) * 70 + (Math.random() - 0.5) * 40, y: y + Math.sin(toMid) * 70 + (Math.random() - 0.5) * 40 };
    u.angle = u.turret = toMid;
    orderMove([u], r.x, r.y, false);
  }

  function removeDead() {
    let any = false;
    for (const e of s.ents) {
      if (e.dead || e.hp > 0) continue;
      e.dead = true; any = true;
      s.stats[e.team].lost++;
      if (e.lastBy !== undefined) s.stats[e.lastBy].kills++;
      const big = e.def.kind === 'building';
      s.effects.push({ type: 'boom', x: e.x, y: e.y, r: big ? e.size * 18 : e.radius * 2.4, t: 0, life: big ? 1.1 : 0.6 });
      if (big) {
        for (let y = e.ty; y < e.ty + e.size; y++) for (let x = e.tx; x < e.tx + e.size; x++) s.occ[y * s.map.W + x] = 0;
        const p = s.pools.find((q) => q.ext === e.id);
        if (p) p.ext = 0;
        if (e.type === 'command') s.winner = 1 - e.team;
      }
      s.byId.delete(e.id);
    }
    if (any) s.ents = s.ents.filter((e) => !e.dead);
  }

  function updateFog(force) {
    if (!s.fogOn && !force) return;
    const { W, H } = s.map;
    s.vis.fill(0);
    for (const e of s.ents) {
      if (e.team !== 0 || e.dead) continue;
      const r = (e.def.sight || 200) / TILE, cx = e.x / TILE, cy = e.y / TILE;
      for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, cy + r); y++)
        for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, cx + r); x++)
          if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) { s.vis[y * W + x] = 1; s.seen[y * W + x] = 1; }
    }
  }

  // видит ли команда цель (ИИ видит всё — так проще; игрок — только сквозь туман)
  function visibleTo(team, e) {
    if (team !== 0 || !s.fogOn) return true;
    const i = tileOf(e.y) * s.map.W + tileOf(e.x);
    return e.def.kind === 'building' ? !!s.seen[i] : !!s.vis[i];
  }

  return {
    newGame, update, passFn, canPlace, snapPool, orderMove, orderAttack, orderBuild, orderAssist, orderStop,
    enqueue, dequeue, upgrade, income, unitCount, visibleTo, alive, tileOf, spawnUnit, placeBuilding,
    get s() { return s; },
  };
})();
