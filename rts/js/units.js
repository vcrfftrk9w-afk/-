/* Движение юнитов и выполнение приказов: ехать, атаковать, строить, охранять. */

function angDiff(a, b) { return Math.atan2(Math.sin(b - a), Math.cos(b - a)); }
function turnTo(a, b, step) { const d = angDiff(a, b); return Math.abs(d) <= step ? b : a + Math.sign(d) * step; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

const Units = (() => {
  const REPATH = 1;        // не чаще раза в секунду пересчитываем путь
  const LEASH = 140;       // насколько стоящий юнит отходит за врагом от своего места

  function setPath(u, wx, wy) {
    const s = Game.s, { W, H } = s.map;
    wx = Math.max(4, Math.min(W * TILE - 4, wx)); wy = Math.max(4, Math.min(H * TILE - 4, wy));
    u.stuckT = 0; u.repathT = REPATH; u.chk = { x: u.x, y: u.y, t: 0, n: 0 };
    if (u.air) { u.path = [{ x: wx, y: wy }]; return; }
    const pass = Game.passFn(u.def.move);
    const sx = Game.tileOf(u.x), sy = Game.tileOf(u.y), gx = Game.tileOf(wx), gy = Game.tileOf(wy);
    const cells = Path.find(W, H, pass, sx, sy, gx, gy);
    if (!cells) { u.path = []; return; }
    const pts = Path.smooth(W, H, pass, sx, sy, cells).map((c) => ({ x: (c.x + 0.5) * TILE, y: (c.y + 0.5) * TILE }));
    const end = cells.length ? cells[cells.length - 1] : { x: sx, y: sy };
    if (end.x === gx && end.y === gy) {
      if (pts.length) pts[pts.length - 1] = { x: wx, y: wy }; else pts.push({ x: wx, y: wy });
    }
    u.path = pts;
  }

  function okAt(pass, x, y) {
    const { W, H } = Game.s.map, tx = Game.tileOf(x), ty = Game.tileOf(y);
    return tx >= 0 && ty >= 0 && tx < W && ty < H && pass(tx, ty);
  }

  function tryMove(u, mx, my, pass) {
    if (!pass) { u.x += mx; u.y += my; return; }
    if (okAt(pass, u.x + mx, u.y + my)) { u.x += mx; u.y += my; }
    else if (okAt(pass, u.x + mx, u.y)) u.x += mx;
    else if (okAt(pass, u.x, u.y + my)) u.y += my;
  }

  // едем по точкам пути; true — приехали
  function moveAlong(u, dt, pass) {
    if (!u.path.length) return true;
    const wp = u.path[0], dx = wp.x - u.x, dy = wp.y - u.y, d = Math.hypot(dx, dy);
    if (d < (u.path.length === 1 ? 4 : 14)) { u.path.shift(); return !u.path.length; }
    const want = Math.atan2(dy, dx);
    u.angle = turnTo(u.angle, want, (u.air ? 4 : 5) * dt);
    const k = u.air ? 1 : Math.max(0, Math.cos(angDiff(u.angle, want))); // гусеницы: сначала разворот, потом газ
    const step = Math.min(u.def.speed * k * dt, d);
    tryMove(u, Math.cos(u.angle) * step, Math.sin(u.angle) * step, pass);
    checkStuck(u, dt);
    return false;
  }

  // застрял (упёрся в толпу или стену) — пересчитать путь, после трёх попыток сдаться
  function checkStuck(u, dt) {
    const c = u.chk || (u.chk = { x: u.x, y: u.y, t: 0, n: 0 });
    c.t += dt;
    if (c.t < 1.2) return;
    const moved = Math.hypot(u.x - c.x, u.y - c.y);
    c.t = 0; c.x = u.x; c.y = u.y;
    if (moved > 10) { c.n = 0; return; }
    if (++c.n >= 3) { u.path = []; return; }
    const end = u.path[u.path.length - 1];
    if (end) { const n = c.n; setPath(u, end.x, end.y); u.chk.n = n; }
  }

  function boxDist(u, b) {
    const h = (b.size * TILE) / 2;
    return Math.hypot(Math.max(0, Math.abs(u.x - b.x) - h), Math.max(0, Math.abs(u.y - b.y) - h));
  }

  function approach(u, t, dt, pass) {
    const w = u.def.weapon, d = dist(u, t) - (t.radius || 0);
    if (d <= w.range * 0.92) { u.path = []; return; } // в радиусе — стоим и стреляем
    u.repathT -= dt;
    if (u.repathT <= 0 || !u.path.length) setPath(u, t.x, t.y);
    moveAlong(u, dt, pass);
  }

  function construct(s, u, b, dt) {
    const bt = b.def.buildTime;
    b.built = Math.min(1, b.built + dt / bt);
    b.hp = Math.min(b.maxHp, b.hp + (b.maxHp * 0.9 * dt) / bt);
    u.turret = turnTo(u.turret, Math.atan2(b.y - u.y, b.x - u.x), 4 * dt);
    if (Math.random() < dt * 6) {
      const a = Math.random() * 6.28, r = Math.random() * b.size * 12;
      s.effects.push({ type: 'spark', x: b.x + Math.cos(a) * r, y: b.y + Math.sin(a) * r, r: 3, t: 0, life: 0.3 });
    }
  }

  function doBuild(s, u, dt, pass) {
    const b = u.order.target;
    if (!Game.alive(b) || b.built >= 1) { u.order = null; u.path = []; return; }
    if (boxDist(u, b) <= u.radius + 14) { u.path = []; construct(s, u, b, dt); return; }
    u.repathT -= dt;
    if (!u.path.length && u.repathT <= 0) setPath(u, b.x, b.y);
    moveAlong(u, dt, pass);
  }

  function doAttackMove(s, u, dt, pass) {
    const o = u.order;
    const t = u.def.weapon && Combat.seek(s, u, u.def.sight, dt);
    if (t) { o.chasing = true; approach(u, t, dt, pass); return; }
    if (o.chasing) { o.chasing = false; setPath(u, o.x, o.y); }
    if (moveAlong(u, dt, pass)) u.order = null;
  }

  // без приказа: стоим на месте, но отвечаем врагу рядом и возвращаемся обратно
  function idle(s, u, dt, pass) {
    if (!u.def.weapon) { moveAlong(u, dt, pass); return; }
    if (!u.anchor) u.anchor = { x: u.x, y: u.y };
    const t = Combat.seek(s, u, u.def.sight, dt);
    if (t && dist(t, u.anchor) < u.def.sight + LEASH) { approach(u, t, dt, pass); return; }
    u.repathT -= dt;
    if (dist(u, u.anchor) > 24 && !u.path.length && u.repathT <= 0) setPath(u, u.anchor.x, u.anchor.y);
    moveAlong(u, dt, pass);
  }

  function think(s, u, dt) {
    const pass = u.air ? null : Game.passFn(u.def.move);
    if (pass && !okAt(pass, u.x, u.y)) { // оказался под зданием — выбираемся на ближайшую свободную клетку
      const { W, H } = s.map, c = Path.nearestPassable(W, H, pass, Game.tileOf(u.x), Game.tileOf(u.y));
      if (c) { const a = Math.atan2((c.y + 0.5) * TILE - u.y, (c.x + 0.5) * TILE - u.x); u.x += Math.cos(a) * 80 * dt; u.y += Math.sin(a) * 80 * dt; }
      return;
    }
    const o = u.order;
    if (!o) return idle(s, u, dt, pass);
    if (o.type === 'move') { if (moveAlong(u, dt, pass)) u.order = null; }
    else if (o.type === 'attackMove') doAttackMove(s, u, dt, pass);
    else if (o.type === 'build') doBuild(s, u, dt, pass);
    else if (o.type === 'attack') {
      if (!Game.alive(o.target) || !Game.visibleTo(u.team, o.target)) { u.order = null; u.path = []; }
      else approach(u, o.target, dt, pass);
    }
  }

  // юниты не налезают друг на друга: раздвигаем, стоящие уступают едущим
  function separate(units, dt) {
    const k = Math.min(1, dt * 8);
    for (let i = 0; i < units.length; i++) {
      const a = units[i];
      for (let j = i + 1; j < units.length; j++) {
        const b = units[j];
        if (a.air !== b.air) continue;
        const dx = b.x - a.x, dy = b.y - a.y, min = a.radius + b.radius;
        if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d >= min) continue;
        const push = (min - d) * k, nx = dx / d, ny = dy / d;
        const wa = a.path.length && !b.path.length ? 0.2 : !a.path.length && b.path.length ? 0.8 : 0.5;
        const pa = a.air ? null : Game.passFn(a.def.move), pb = b.air ? null : Game.passFn(b.def.move);
        tryMove(a, -nx * push * wa, -ny * push * wa, pa);
        tryMove(b, nx * push * (1 - wa), ny * push * (1 - wa), pb);
      }
    }
  }

  function update(s, dt) {
    const units = s.ents.filter((e) => e.def.kind === 'unit' && !e.dead);
    for (const u of units) think(s, u, dt);
    separate(units, dt);
  }

  return { update, setPath };
})();
