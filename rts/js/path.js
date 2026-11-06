/* Поиск пути A* по клеткам карты. passable(x, y) решает, можно ли пройти клетку:
   у танка, ховера и вертолёта разные правила (см. Game.passFn). */
const Path = (() => {
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];

  function heap() {
    const a = [];
    return {
      size: () => a.length,
      push(node, f) {
        a.push([node, f]);
        let i = a.length - 1;
        while (i > 0) {
          const p = (i - 1) >> 1;
          if (a[p][1] <= a[i][1]) break;
          [a[p], a[i]] = [a[i], a[p]]; i = p;
        }
      },
      pop() {
        const top = a[0], last = a.pop();
        if (a.length) {
          a[0] = last;
          let i = 0;
          for (;;) {
            const l = i * 2 + 1, r = l + 1;
            let m = i;
            if (l < a.length && a[l][1] < a[m][1]) m = l;
            if (r < a.length && a[r][1] < a[m][1]) m = r;
            if (m === i) break;
            [a[m], a[i]] = [a[i], a[m]]; i = m;
          }
        }
        return top[0];
      },
    };
  }

  function nearestPassable(W, H, passable, x, y, maxR = 14) {
    if (x >= 0 && y >= 0 && x < W && y < H && passable(x, y)) return { x, y };
    for (let r = 1; r <= maxR; r++) {
      let best = null, bd = Infinity;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || !passable(nx, ny)) continue;
          const d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = { x: nx, y: ny }; }
        }
      if (best) return best;
    }
    return null;
  }

  /* Возвращает список клеток [{x, y}] от старта (не включая) до цели.
     Если цель недостижима — путь к ближайшей достижимой к ней клетке. */
  function find(W, H, passable, sx, sy, gx, gy) {
    const goal = nearestPassable(W, H, passable, gx, gy);
    if (!goal) return null;
    gx = goal.x; gy = goal.y;
    if (sx === gx && sy === gy) return [];
    const N = W * H, g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N), open = heap();
    const h = (x, y) => { const dx = Math.abs(x - gx), dy = Math.abs(y - gy); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    const start = sy * W + sx;
    g[start] = 0; open.push(start, h(sx, sy));
    let best = start, bestH = h(sx, sy);
    while (open.size()) {
      const cur = open.pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % W, cy = (cur / W) | 0;
      if (cx === gx && cy === gy) { best = cur; break; }
      const ch = h(cx, cy);
      if (ch < bestH) { bestH = ch; best = cur; }
      for (const [dx, dy, cost] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || !passable(nx, ny)) continue;
        if (dx && dy && (!passable(cx + dx, cy) || !passable(cx, cy + dy))) continue; // не срезаем углы
        const n = ny * W + nx, ng = g[cur] + cost;
        if (ng < g[n]) { g[n] = ng; came[n] = cur; open.push(n, ng + h(nx, ny)); }
      }
    }
    const out = [];
    for (let n = best; n !== start && n !== -1; n = came[n]) out.push({ x: n % W, y: (n / W) | 0 });
    return out.reverse();
  }

  // прямой проход между двумя точками (в клетках), с запасом по ширине юнита
  function lineClear(W, H, passable, x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), steps = Math.ceil(d * 4);
    const nx = d ? -(y1 - y0) / d * 0.35 : 0, ny = d ? (x1 - x0) / d * 0.35 : 0;
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      for (const s of [-1, 0, 1]) {
        const px = Math.floor(x + nx * s), py = Math.floor(y + ny * s);
        if (px < 0 || py < 0 || px >= W || py >= H || !passable(px, py)) return false;
      }
    }
    return true;
  }

  // выкидываем лишние повороты: юнит едет прямо, пока ничто не мешает
  function smooth(W, H, passable, sx, sy, cells) {
    const out = [];
    let ax = sx + 0.5, ay = sy + 0.5, i = 0;
    while (i < cells.length) {
      let j = i;
      while (j + 1 < cells.length && lineClear(W, H, passable, ax, ay, cells[j + 1].x + 0.5, cells[j + 1].y + 0.5)) j++;
      out.push(cells[j]);
      ax = cells[j].x + 0.5; ay = cells[j].y + 0.5;
      i = j + 1;
    }
    return out;
  }

  return { find, smooth, nearestPassable, lineClear };
})();
