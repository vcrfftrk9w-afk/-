/* Компьютерный противник. Раз в секунду «думает»: строители, стройка, заводы, армия.
   Отдаёт те же приказы, что и игрок, — через Game.order*, Game.enqueue. */
const AI = (() => {
  const LEVELS = {
    easy:   { income: 0.75, think: 2,   wave: 8, grow: 1, maxWave: 14 },
    normal: { income: 1,    think: 1.2, wave: 6, grow: 2, maxWave: 20 },
    hard:   { income: 1.35, think: 0.8, wave: 5, grow: 2, maxWave: 26 },
  };
  const DEFEND_RADIUS = 480;

  function create(team, level) {
    const lv = LEVELS[level] || LEVELS.normal;
    return { team, lv, t: 1, wave: lv.wave };
  }

  function update(s, ai, dt) {
    ai.t -= dt;
    if (ai.t > 0) return;
    ai.t = ai.lv.think;
    const mine = s.ents.filter((e) => e.team === ai.team && !e.dead);
    const cc = mine.find((e) => e.type === 'command');
    if (!cc) return;
    builders(s, ai, cc, mine);
    for (const e of mine) if (e.type === 'extractor' && s.credits[ai.team] > 900) Game.upgrade(e);
    produce(s, ai, mine);
    army(s, ai, cc, mine);
  }

  const count = (mine, type) => mine.filter((e) => e.type === type).length;

  function builders(s, ai, cc, mine) {
    const list = mine.filter((e) => e.type === 'builder');
    const want = s.time < 150 ? 2 : 3;
    if (list.length + cc.queue.length < want) Game.enqueue(cc, 'builder');
    const unfinished = mine.filter((e) => e.def.kind === 'building' && e.built < 1);
    const plan = [...mine]; // заказанное за этот ход, чтобы второй строитель не строил то же
    for (const b of list) {
      if (b.order) continue;
      const lone = unfinished.find((u) => !list.some((x) => x.order && x.order.target === u));
      if (lone) { Game.orderAssist(b, lone); continue; }
      const task = pickBuild(s, ai, cc, plan);
      if (!task) return;
      const built = Game.orderBuild(b, task.type, task.tx, task.ty);
      if (typeof built === 'string') return;
      plan.push(built);
    }
  }

  function pickBuild(s, ai, cc, mine) {
    const c = s.credits[ai.team], ext = count(mine, 'extractor');
    const pool = ext < 2 || c >= DEFS.extractor.cost ? freePool(s, ai, cc) : null;
    if (ext < 2 && pool) return pool;
    if (!count(mine, 'factory')) return spot(s, ai, cc, 'factory', 0);
    if (pool && ext < 3 + s.time / 90) return pool;
    if (s.time > 200 && !count(mine, 'airfactory') && ext >= 3) return spot(s, ai, cc, 'airfactory', 0);
    if (count(mine, 'turret') < Math.min(4, Math.floor(s.time / 150))) return spot(s, ai, cc, 'turret', 5);
    if (count(mine, 'factory') < 2 && s.time > 300 && c > 1400) return spot(s, ai, cc, 'factory', 0);
    return null;
  }

  // ближайший свободный источник, возле которого нет вражеской армии
  function freePool(s, ai, cc) {
    const reach = 18 + s.time / 20;
    let best = null, bd = Infinity;
    for (const p of s.pools) {
      if (p.ext) continue;
      const px = (p.tx + 1) * TILE, py = (p.ty + 1) * TILE, d = Math.hypot(px - cc.x, py - cc.y) / TILE;
      if (d > reach || d >= bd) continue;
      const danger = s.ents.some((e) => e.team !== ai.team && e.def.weapon && e.def.kind === 'unit' && Math.hypot(e.x - px, e.y - py) < 300);
      if (danger || Game.canPlace('extractor', ai.team, p.tx, p.ty) !== true) continue;
      bd = d; best = { type: 'extractor', tx: p.tx, ty: p.ty };
    }
    return best;
  }

  // место для здания по спирали вокруг штаба; ahead > 0 — сдвиг в сторону врага (для турелей)
  function spot(s, ai, cc, type, ahead) {
    const n = DEFS[type].size, enemy = s.ents.find((e) => e.type === 'command' && e.team !== ai.team);
    let cx = Game.tileOf(cc.x), cy = Game.tileOf(cc.y);
    if (enemy && ahead) { const a = Math.atan2(enemy.y - cc.y, enemy.x - cc.x); cx += Math.round(Math.cos(a) * ahead); cy += Math.round(Math.sin(a) * ahead); }
    for (let r = 3; r < 16; r++)
      for (let i = 0; i < r * 8; i++) {
        const a = (i / (r * 8)) * Math.PI * 2 + s.time;
        const tx = Math.round(cx + Math.cos(a) * r) - (n >> 1), ty = Math.round(cy + Math.sin(a) * r) - (n >> 1);
        // рамка в клетку вокруг здания — чтобы база не превратилась в лабиринт
        if (Game.canPlace(type, ai.team, tx, ty) === true && roomy(s, tx - 1, ty - 1, n + 2)) return { type, tx, ty };
      }
    return null;
  }

  function roomy(s, tx, ty, n) {
    const { W, H } = s.map;
    for (let y = ty; y < ty + n; y++)
      for (let x = tx; x < tx + n; x++)
        if (x < 0 || y < 0 || x >= W || y >= H || s.occ[y * W + x] || s.map.terrain[y * W + x] !== MapGen.LAND) return false;
    return true;
  }

  function produce(s, ai, mine) {
    const foeAir = s.ents.filter((e) => e.team !== ai.team && e.air).length;
    const flak = count(mine, 'flak');
    for (const f of mine) {
      if (f.built < 1 || !f.queue || f.queue.length >= 2 || f.type === 'command') continue;
      let type;
      if (f.type === 'airfactory') type = 'gunship';
      else if (foeAir > flak * 1.5 && Math.random() < 0.6) type = 'flak';
      else {
        const r = Math.random();
        type = r < 0.5 ? 'tank' : r < 0.72 ? 'hover' : s.time > 180 ? 'artillery' : 'tank';
      }
      Game.enqueue(f, type);
    }
  }

  function army(s, ai, cc, mine) {
    const troops = mine.filter((e) => e.def.kind === 'unit' && e.def.weapon);
    const homeB = mine.filter((e) => e.def.kind === 'building');
    // защита: враг у наших зданий — все свободные бойцы туда
    const threat = s.ents.find((e) => e.team !== ai.team && e.def.kind === 'unit' && e.def.weapon &&
      homeB.some((b) => Math.hypot(b.x - e.x, b.y - e.y) < DEFEND_RADIUS));
    if (threat) {
      const near = troops.filter((u) => !u.order || u.order.type !== 'attackMove' || dist(u, cc) < DEFEND_RADIUS * 1.5);
      Game.orderMove(near.filter((u) => !u.order), threat.x, threat.y, true);
      return;
    }
    const idle = troops.filter((u) => !u.order);
    const home = idle.filter((u) => dist(u, cc) < 700), away = idle.filter((u) => dist(u, cc) >= 700);
    const target = enemyTarget(s, ai, away.length ? away[0] : cc);
    if (!target) return;
    if (away.length) Game.orderMove(away, target.x, target.y, true);       // волна дошла — к следующей цели
    if (home.length >= ai.wave) {
      Game.orderMove(home, target.x, target.y, true);
      ai.wave = Math.min(ai.lv.maxWave, ai.wave + ai.lv.grow);
    }
  }

  function enemyTarget(s, ai, from) {
    let best = null, bd = Infinity;
    for (const e of s.ents) {
      if (e.team === ai.team || e.def.kind !== 'building') continue;
      const d = dist(e, from);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  return { create, update, LEVELS };
})();
