/* Генерация карты: суша, вода, скалы и источники ресурсов.
   Карта центрально-симметрична — у обеих сторон одинаковые условия. */
const MapGen = (() => {
  const LAND = 0, WATER = 1, ROCK = 2;

  // детерминированный генератор случайных чисел: один seed — одна и та же карта
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // гладкий шум: случайные значения в узлах сетки, плавно смешанные между ними
  function valueNoise(W, H, cell, rand) {
    const gw = Math.ceil(W / cell) + 2;
    const g = new Float32Array(gw * (Math.ceil(H / cell) + 2)).map(() => rand());
    return (x, y) => {
      const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = fx - ix, ty = fy - iy;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  }

  function fbm(W, H, rand) {
    const n1 = valueNoise(W, H, 14, rand), n2 = valueNoise(W, H, 7, rand), n3 = valueNoise(W, H, 3, rand);
    return (x, y) => n1(x, y) * 0.55 + n2(x, y) * 0.3 + n3(x, y) * 0.15;
  }

  function setSym(m, x, y, v) {
    if (x < 0 || y < 0 || x >= m.W || y >= m.H) return;
    m.terrain[y * m.W + x] = v;
    m.terrain[(m.H - 1 - y) * m.W + (m.W - 1 - x)] = v;
  }

  function clearCircle(m, cx, cy, r) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) setSym(m, x, y, LAND);
  }

  function reachable(m, sx, sy, gx, gy) {
    const seen = new Uint8Array(m.W * m.H), q = [sy * m.W + sx];
    seen[q[0]] = 1;
    for (let i = 0; i < q.length; i++) {
      const x = q[i] % m.W, y = (q[i] / m.W) | 0;
      if (x === gx && y === gy) return true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, n = ny * m.W + nx;
        if (nx < 0 || ny < 0 || nx >= m.W || ny >= m.H || seen[n] || m.terrain[n] !== LAND) continue;
        seen[n] = 1; q.push(n);
      }
    }
    return false;
  }

  // если вода и скалы отрезали базы друг от друга — прокладываем извилистый перешеек
  function carveRoad(m, a, b, rand) {
    const steps = Math.hypot(b.x - a.x, b.y - a.y) * 2;
    let wob = 0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      wob += (rand() - 0.5) * 0.6;
      wob = Math.max(-4, Math.min(4, wob));
      const x = a.x + (b.x - a.x) * t + wob, y = a.y + (b.y - a.y) * t + wob;
      clearCircle(m, x, y, 1.6);
    }
  }

  function addPool(m, tx, ty) {
    clearCircle(m, tx + 0.5, ty + 0.5, 2.2);
    m.pools.push({ tx, ty }, { tx: m.W - 2 - tx, ty: m.H - 2 - ty });
  }

  function farFromPools(m, tx, ty, d) {
    return m.pools.every((p) => Math.hypot(p.tx - tx, p.ty - ty) >= d);
  }

  function generate(seed, W = 72, H = 72) {
    const rand = rng(seed);
    const water = fbm(W, H, rand), rock = fbm(W, H, rand);
    const m = { W, H, seed, terrain: new Uint8Array(W * H), pools: [], bases: [] };
    for (let i = 0; i <= (W * H) >> 1; i++) {
      const x = i % W, y = (i / W) | 0;
      const v = water(x, y) < 0.34 ? WATER : rock(x, y) > 0.69 ? ROCK : LAND;
      setSym(m, x, y, v);
    }
    // базы: игрок внизу слева, противник — зеркально вверху справа
    const base = { x: 9, y: H - 10 };
    clearCircle(m, base.x, base.y, 8);
    m.bases.push({ tx: base.x - 1, ty: base.y - 1 }, { tx: W - 3 - (base.x - 1), ty: H - 3 - (base.y - 1) });

    addPool(m, base.x + 4, base.y - 7);
    addPool(m, base.x + 6, base.y + 1);
    let tries = 0;
    while (m.pools.length < 10 && tries++ < 400) {
      const tx = 6 + Math.floor(rand() * (W - 14)), ty = 6 + Math.floor(rand() * (H - 14));
      const nearPlayer = Math.hypot(tx - base.x, ty - base.y) < Math.hypot(tx - (W - base.x), ty - (H - base.y));
      if (!nearPlayer || Math.hypot(tx - base.x, ty - base.y) < 14 || !farFromPools(m, tx, ty, 9)) continue;
      if (Math.hypot(tx - (W - 2 - tx), ty - (H - 2 - ty)) < 9) continue;
      addPool(m, tx, ty);
    }
    const enemy = { x: W - 1 - base.x, y: H - 1 - base.y };
    if (!reachable(m, base.x, base.y, enemy.x, enemy.y)) carveRoad(m, base, enemy, rand);
    return m;
  }

  return { generate, rng, LAND, WATER, ROCK };
})();
