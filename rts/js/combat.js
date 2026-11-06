/* Бой: выбор цели, поворот башни, выстрел, полёт снаряда, урон, взрывы. */
const Combat = (() => {
  const SCAN = 0.25;        // как часто оружие ищет новую цель, секунд
  const AIM = 0.12;         // насколько точно башня должна смотреть на цель, чтобы выстрелить (радианы)

  const canHit = (w, t) => (t.air ? !!w.air : w.ground !== false);
  const gap = (e, t) => dist(e, t) - (t.radius || 0);

  function nearestEnemy(s, e, range) {
    const w = e.def.weapon;
    let best = null, bs = Infinity;
    for (const t of s.ents) {
      if (t.team === e.team || t.dead || !canHit(w, t)) continue;
      const d = gap(e, t);
      if (d > range || (w.minRange && d < w.minRange)) continue;
      if (!Game.visibleTo(e.team, t)) continue;
      // сначала бьём то, что стреляет в ответ, здания — потом
      const score = d + (t.def.kind === 'building' ? 90 : 0) + (t.def.weapon ? 0 : 40);
      if (score < bs) { bs = score; best = t; }
    }
    return best;
  }

  // поиск врага в радиусе обзора для движения (не чаще SCAN), результат кешируется на юните
  function seek(s, u, range, dt) {
    u.seekT = (u.seekT || 0) - dt;
    if (u.seekT <= 0 || (u.seekRes && !Game.alive(u.seekRes))) { u.seekT = SCAN; u.seekRes = nearestEnemy(s, u, range); }
    return u.seekRes && Game.alive(u.seekRes) ? u.seekRes : null;
  }

  function inRange(e, t, w) {
    const d = gap(e, t);
    return d <= w.range && !(w.minRange && d < w.minRange) && canHit(w, t);
  }

  function pickTarget(s, e, w) {
    const o = e.order;
    if (o && o.type === 'attack' && Game.alive(o.target) && inRange(e, o.target, w)) return o.target;
    if (e.scanT <= 0) { e.scanT = SCAN; e.target = nearestEnemy(s, e, w.range); }
    const t = e.target;
    return t && Game.alive(t) && inRange(e, t, w) ? t : null;
  }

  function fire(s, e, t, w) {
    e.cooldown = w.reload; e.recoil = 1;
    const mx = e.x + Math.cos(e.turret) * (e.radius + 4), my = e.y + Math.sin(e.turret) * (e.radius + 4);
    const miss = w.arc ? 18 : 0;
    const p = { x: mx, y: my, sx: mx, sy: my, tx: t.x + (Math.random() - 0.5) * miss, ty: t.y + (Math.random() - 0.5) * miss,
      target: t, w, team: e.team, t: 0, air: t.air };
    p.total = Math.max(1, Math.hypot(p.tx - mx, p.ty - my));
    s.projectiles.push(p);
    s.effects.push({ type: 'flash', x: mx, y: my, a: e.turret, r: w.arc ? 10 : 6, t: 0, life: 0.08 });
  }

  function damage(s, t, dmg, team) {
    t.hp -= dmg; t.lastBy = team; t.lastHit = s.time;
    if (t.team === 0 && s.time - s.alertT > 10) { s.alert = { x: t.x, y: t.y }; s.alertT = s.time; }
  }

  function impact(s, p) {
    const w = p.w;
    if (w.splash) {
      for (const t of s.ents) {
        if (t.team === p.team || t.dead || t.air) continue;
        const d = Math.hypot(t.x - p.tx, t.y - p.ty) - (t.radius || 0);
        if (d < w.splash) damage(s, t, w.damage * (1 - 0.5 * Math.max(0, d) / w.splash), p.team);
      }
      s.effects.push({ type: 'boom', x: p.tx, y: p.ty, r: w.splash * 0.8, t: 0, life: 0.5 });
      s.effects.push({ type: 'scorch', x: p.tx, y: p.ty, r: w.splash * 0.5, t: 0, life: 8 });
    } else {
      if (Game.alive(p.target)) damage(s, p.target, w.damage, p.team);
      s.effects.push({ type: 'spark', x: p.tx, y: p.ty, r: 5, t: 0, life: 0.2 });
    }
  }

  function updateProjectiles(s, dt) {
    for (const p of s.projectiles) {
      if (!p.w.arc && Game.alive(p.target)) { p.tx = p.target.x; p.ty = p.target.y; } // прямой выстрел ведёт цель
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), step = p.w.projSpeed * dt;
      p.t += dt;
      if (d <= step) { p.x = p.tx; p.y = p.ty; impact(s, p); p.done = true; }
      else { p.x += (dx / d) * step; p.y += (dy / d) * step; }
      if (p.t > 4) p.done = true;
    }
    s.projectiles = s.projectiles.filter((p) => !p.done);
  }

  function updateEffects(s, dt) {
    for (const e of s.ents) {
      // горящая техника и здания дымят
      if (e.hp < e.maxHp * 0.4 && Math.random() < dt * (e.def.kind === 'building' ? 5 : 2.5))
        s.effects.push({ type: 'smoke', x: e.x + (Math.random() - 0.5) * e.radius, y: e.y + (Math.random() - 0.5) * e.radius,
          r: 4 + Math.random() * 4, t: 0, life: 1.4 + Math.random() });
    }
    for (const f of s.effects) f.t += dt;
    s.effects = s.effects.filter((f) => f.t < f.life);
  }

  function update(s, dt) {
    for (const e of s.ents) {
      if (e.dead) continue;
      e.recoil = Math.max(0, e.recoil - dt * 5);
      const w = e.def.weapon;
      if (!w || (e.def.kind === 'building' && e.built < 1)) continue;
      e.cooldown -= dt; e.scanT -= dt;
      const t = pickTarget(s, e, w);
      if (t) {
        const want = Math.atan2(t.y - e.y, t.x - e.x);
        e.turret = turnTo(e.turret, want, w.turnRate * dt);
        if (Math.abs(angDiff(e.turret, want)) < AIM && e.cooldown <= 0) fire(s, e, t, w);
      } else if (e.def.kind === 'unit') e.turret = turnTo(e.turret, e.angle, 2 * dt);
    }
    updateProjectiles(s, dt);
    updateEffects(s, dt);
  }

  return { update, canHit, nearestEnemy, seek };
})();
