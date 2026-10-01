'use strict';
// Генерация острова, ресурсные узлы, постройки и столкновения.

const HRES = 2;                  // отсчётов высоты на клетку
const GN = WT * HRES + 1;
const CELL = 128;                // ячейка пространственного хэша
const CN = Math.ceil(WORLD / CELL);
const DEEP = -0.06;              // глубже — не пройти
const SHORE = 0.0;
const SAND = 0.035;
const ROCK = 0.44;

class World {
  constructor(seed) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.h = new Float32Array(GN * GN);
    this.m = new Float32Array(GN * GN);
    this.cells = Array.from({ length: CN * CN }, () => []);
    this.structMap = new Map();
    this.structs = [];
    this.monuments = [];
    this.occ = new Uint8Array(WT * WT);
    this.respawn = [];
    this.chunks = new Map();
    this.npcSpawns = [];
    this.nodeCount = {};
    this.genHeight();
    this.genMonuments();
    this.genNodes();
    this.minimap = this.renderMinimap();
  }

  genHeight() {
    const s = this.seed;
    for (let gy = 0; gy < GN; gy++) {
      for (let gx = 0; gx < GN; gx++) {
        const tx = gx / HRES, ty = gy / HRES;
        const nx = tx / WT * 2 - 1, ny = ty / WT * 2 - 1;
        const warp = (fbm(tx / 40, ty / 40, s + 9, 3) - 0.5) * 0.35;
        const d = Math.sqrt(nx * nx + ny * ny) + warp;
        const e = fbm(tx / 30, ty / 30, s, 5);
        const ridge = 1 - Math.abs(fbm(tx / 22, ty / 22, s + 5, 4) * 2 - 1);
        let h = (e - 0.5) * 1.35 + 0.4 - 0.95 * Math.pow(Math.max(0, d), 2.4) + (ridge - 0.6) * 0.18;
        this.h[gy * GN + gx] = h;
        this.m[gy * GN + gx] = fbm(tx / 18, ty / 18, s + 77, 4);
      }
    }
  }

  sample(arr, px, py) {
    const gx = clamp(px / TILE * HRES, 0, GN - 1.001), gy = clamp(py / TILE * HRES, 0, GN - 1.001);
    const x0 = gx | 0, y0 = gy | 0, fx = gx - x0, fy = gy - y0;
    const i = y0 * GN + x0;
    return lerp(lerp(arr[i], arr[i + 1], fx), lerp(arr[i + GN], arr[i + GN + 1], fx), fy);
  }
  heightAt(px, py) { return this.sample(this.h, px, py); }
  moistAt(px, py) { return this.sample(this.m, px, py); }

  monumentAt(px, py) {
    for (const mo of this.monuments) {
      if (px >= mo.x0 * TILE && py >= mo.y0 * TILE && px < (mo.x0 + mo.w) * TILE && py < (mo.y0 + mo.h) * TILE) return mo;
    }
    return null;
  }

  biomeAt(px, py) {
    if (this.monumentAt(px, py)) return 'concrete';
    const h = this.heightAt(px, py);
    if (h < DEEP) return 'deep';
    if (h < SHORE) return 'shallow';
    if (h < SAND) return 'sand';
    if (h > ROCK) return 'rock';
    return this.moistAt(px, py) > 0.53 ? 'forest' : 'grass';
  }

  // ---------- памятники ----------
  findSpot(w, h, minDistFromOthers, loose) {
    for (let tries = 0; tries < 1500; tries++) {
      const x0 = 12 + Math.floor(this.rng() * (WT - w - 24));
      const y0 = 12 + Math.floor(this.rng() * (WT - h - 24));
      let ok = true;
      for (let y = -1; y <= h && ok; y++) {
        for (let x = -1; x <= w && ok; x++) {
          const hh = this.heightAt((x0 + x + 0.5) * TILE, (y0 + y + 0.5) * TILE);
          if (hh < (loose ? 0.01 : 0.06) || hh > (loose ? 0.7 : 0.5)) ok = false;
        }
      }
      if (!ok) continue;
      for (const mo of this.monuments) {
        if (dist(mo.x0 + mo.w / 2, mo.y0 + mo.h / 2, x0 + w / 2, y0 + h / 2) < minDistFromOthers) ok = false;
      }
      if (ok) return { x0, y0 };
    }
    return null;
  }

  genMonuments() {
    let radar = this.findSpot(18, 18, 0);
    if (!radar) radar = this.findSpot(18, 18, 0, true);
    if (radar) this.buildRadar(radar.x0, radar.y0);
    for (let i = 0; i < 2; i++) {
      const g = this.findSpot(11, 9, 38);
      if (g) this.buildGas(g.x0, g.y0);
    }
  }

  markMonument(mo) {
    this.monuments.push(mo);
    for (let y = mo.y0 - 1; y <= mo.y0 + mo.h; y++) for (let x = mo.x0 - 1; x <= mo.x0 + mo.w; x++) {
      if (x >= 0 && y >= 0 && x < WT && y < WT) this.occ[y * WT + x] = 1;
    }
  }

  wallLine(x0, y0, x1, y1, gaps = []) {
    const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
    let x = x0, y = y0, i = 0;
    for (;;) {
      if (!gaps.includes(i)) this.addStruct('concrete', x, y, 'world');
      if (x === x1 && y === y1) break;
      x += dx; y += dy; i++;
    }
  }

  buildRadar(x0, y0) {
    const w = 18, h = 18;
    const mo = { name: 'Радарная станция', kind: 'radar', x0, y0, w, h };
    this.markMonument(mo);
    const r = this.rng;
    const broken = () => [8, 9, 10].concat([Math.floor(r() * 6) + 1, Math.floor(r() * 5) + 12]);
    this.wallLine(x0, y0, x0 + w - 1, y0, broken());
    this.wallLine(x0, y0 + h - 1, x0 + w - 1, y0 + h - 1, broken());
    this.wallLine(x0, y0 + 1, x0, y0 + h - 2, broken().map((v) => v - 1));
    this.wallLine(x0 + w - 1, y0 + 1, x0 + w - 1, y0 + h - 2, broken().map((v) => v - 1));
    // здание
    const bx = x0 + 3, by = y0 + 8, bw = 8, bh = 6;
    this.wallLine(bx, by, bx + bw - 1, by);
    this.wallLine(bx, by + bh - 1, bx + bw - 1, by + bh - 1, [3, 4]);
    this.wallLine(bx, by + 1, bx, by + bh - 2);
    this.wallLine(bx + bw - 1, by + 1, bx + bw - 1, by + bh - 2, [2]);
    this.addNode('elite', (bx + 1.5) * TILE, (by + 1.5) * TILE);
    this.addNode('elite', (bx + bw - 2.5) * TILE, (by + 1.5) * TILE);
    this.addNode('crate', (bx + 1.5) * TILE, (by + bh - 2.5) * TILE);
    // радар
    this.addNode('radar', (x0 + 13) * TILE, (y0 + 5) * TILE);
    this.addNode('pump', (x0 + 13) * TILE, (y0 + 5) * TILE);
    const spots = [[3, 3], [7, 3], [15, 10], [14, 14], [3, 15], [8, 15], [12, 9]];
    spots.forEach(([sx, sy], i) => this.addNode(i < 3 ? 'crate' : 'barrel', (x0 + sx + 0.5) * TILE, (y0 + sy + 0.5) * TILE));
    for (const [sx, sy] of [[6, 2], [16, 3], [2, 6], [15, 16], [10, 16]]) this.addNode('barrel', (x0 + sx + 0.5) * TILE, (y0 + sy + 0.5) * TILE);
    const kinds = ['revolver', 'shotgun', 'revolver', 'bow', 'shotgun', 'revolver'];
    kinds.forEach((k, i) => this.npcSpawns.push({ kind: k, x: (x0 + 3 + (i * 5) % 13) * TILE, y: (y0 + 3 + ((i * 7) % 13)) * TILE, home: mo }));
  }

  buildGas(x0, y0) {
    const w = 11, h = 9;
    const mo = { name: 'Заброшенная заправка', kind: 'gas', x0, y0, w, h };
    this.markMonument(mo);
    const bx = x0 + 1, by = y0 + 1, bw = 5, bh = 4;
    this.wallLine(bx, by, bx + bw - 1, by);
    this.wallLine(bx, by + bh - 1, bx + bw - 1, by + bh - 1, [2]);
    this.wallLine(bx, by + 1, bx, by + bh - 2);
    this.wallLine(bx + bw - 1, by + 1, bx + bw - 1, by + bh - 2);
    this.addNode('crate', (bx + 1.5) * TILE, (by + 1.5) * TILE);
    this.addNode('crate', (bx + 3.5) * TILE, (by + 1.5) * TILE);
    this.addNode('pump', (x0 + 8) * TILE, (y0 + 3) * TILE);
    this.addNode('pump', (x0 + 8) * TILE, (y0 + 6) * TILE);
    for (const [sx, sy] of [[1, 7], [4, 7], [10, 1], [10, 8]]) this.addNode('barrel', (x0 + sx + 0.5) * TILE, (y0 + sy + 0.5) * TILE);
    this.npcSpawns.push({ kind: 'bow', x: (x0 + 6) * TILE, y: (y0 + 6) * TILE, home: mo });
    this.npcSpawns.push({ kind: 'spear', x: (x0 + 9) * TILE, y: (y0 + 4) * TILE, home: mo });
  }

  // ---------- узлы ----------
  addNode(type, x, y, extra) {
    const def = NODES[type];
    const n = { type, x, y, r: def.r, seed: (Math.random() * 1e6) | 0, dead: false };
    if (def.amt) n.amt = n.max = randi(def.amt[0], def.amt[1]);
    if (def.hp) n.hp = def.hp;
    if (def.container) n.items = rollLoot(def.container, def.container === 'elite' ? 3 : 2);
    if (extra) Object.assign(n, extra);
    const ci = this.cellIndex(x, y);
    n.cell = ci;
    this.cells[ci].push(n);
    this.nodeCount[type] = (this.nodeCount[type] || 0) + 1;
    return n;
  }
  cellIndex(x, y) { return clamp((y / CELL) | 0, 0, CN - 1) * CN + clamp((x / CELL) | 0, 0, CN - 1); }

  removeNode(n, respawnSec) {
    if (n.dead) return;
    n.dead = true;
    const c = this.cells[n.cell];
    const i = c.indexOf(n);
    if (i >= 0) c.splice(i, 1);
    this.nodeCount[n.type]--;
    if (respawnSec) this.respawn.push({ type: n.type, t: respawnSec });
  }

  queryNodes(x0, y0, x1, y1, cb) {
    const cx0 = clamp((x0 / CELL) | 0, 0, CN - 1), cx1 = clamp((x1 / CELL) | 0, 0, CN - 1);
    const cy0 = clamp((y0 / CELL) | 0, 0, CN - 1), cy1 = clamp((y1 / CELL) | 0, 0, CN - 1);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const c = this.cells[cy * CN + cx];
      for (let i = 0; i < c.length; i++) if (cb(c[i]) === false) return;
    }
  }

  nodeTypeFor(biome, r) {
    switch (biome) {
      case 'forest':
        if (r < 0.15) return hash2(r * 1e6 | 0, 1, 2) < 0.55 ? 'pine' : 'tree';
        if (r < 0.165) return 'hemp';
        if (r < 0.18) return 'bush';
        if (r < 0.2) return 'shroom';
        if (r < 0.204) return 'stone';
        if (r < 0.207) return 'barrel';
        return null;
      case 'grass':
        if (r < 0.03) return 'tree';
        if (r < 0.055) return 'hemp';
        if (r < 0.065) return 'bush';
        if (r < 0.073) return 'stone';
        if (r < 0.077) return 'barrel';
        if (r < 0.0785) return 'crate';
        return null;
      case 'sand':
        if (r < 0.006) return 'stone';
        if (r < 0.011) return 'barrel';
        if (r < 0.0125) return 'crate';
        return null;
      case 'rock':
        if (r < 0.045) return 'stone';
        if (r < 0.08) return 'metal';
        if (r < 0.105) return 'sulfur';
        if (r < 0.11) return 'pine';
        if (r < 0.113) return 'barrel';
        return null;
    }
    return null;
  }

  genNodes() {
    const r = this.rng;
    for (let ty = 2; ty < WT - 2; ty++) for (let tx = 2; tx < WT - 2; tx++) {
      if (this.occ[ty * WT + tx]) continue;
      const px = (tx + 0.5) * TILE, py = (ty + 0.5) * TILE;
      const type = this.nodeTypeFor(this.biomeAt(px, py), r());
      if (!type) continue;
      this.addNode(type, px + (r() - 0.5) * 14, py + (r() - 0.5) * 14);
      this.occ[ty * WT + tx] = 2;
    }
    this.target = Object.assign({}, this.nodeCount);
  }

  // Возвращает удалённые узлы на случайные подходящие места.
  update(dt, avoidX, avoidY) {
    for (let i = this.respawn.length - 1; i >= 0; i--) {
      const rs = this.respawn[i];
      rs.t -= dt;
      if (rs.t > 0) continue;
      this.respawn.splice(i, 1);
      if (NODES[rs.type].container || rs.type === 'barrel') {
        if (this.monuments.length && Math.random() < 0.4) { this.respawnInMonument(rs.type); continue; }
      }
      for (let k = 0; k < 40; k++) {
        const tx = randi(3, WT - 4), ty = randi(3, WT - 4);
        const px = (tx + 0.5) * TILE, py = (ty + 0.5) * TILE;
        if (dist2(px, py, avoidX, avoidY) < 500 * 500) continue;
        const b = this.biomeAt(px, py);
        if (b === 'deep' || b === 'shallow' || b === 'concrete') continue;
        if (this.structAtTile(tx, ty) || this.nodeNear(px, py, 30)) continue;
        if (this.typeFits(rs.type, b)) { this.addNode(rs.type, px, py); break; }
      }
    }
  }
  respawnInMonument(type) {
    const mo = pick(this.monuments);
    for (let k = 0; k < 30; k++) {
      const tx = randi(mo.x0 + 1, mo.x0 + mo.w - 2), ty = randi(mo.y0 + 1, mo.y0 + mo.h - 2);
      const px = (tx + 0.5) * TILE, py = (ty + 0.5) * TILE;
      if (this.structAtTile(tx, ty) || this.nodeNear(px, py, 30)) continue;
      this.addNode(mo.kind === 'radar' && type === 'crate' && Math.random() < 0.3 ? 'elite' : type, px, py);
      return;
    }
  }
  typeFits(type, b) {
    const map = { tree: ['forest', 'grass'], pine: ['forest', 'rock'], hemp: ['forest', 'grass'], bush: ['forest', 'grass'], shroom: ['forest'], stone: ['rock', 'grass', 'forest', 'sand'], metal: ['rock'], sulfur: ['rock'], barrel: ['grass', 'sand', 'forest', 'rock'], crate: ['grass', 'sand'], elite: ['grass'] };
    return (map[type] || []).includes(b);
  }
  nodeNear(x, y, r) {
    let found = null;
    this.queryNodes(x - r - 30, y - r - 30, x + r + 30, y + r + 30, (n) => {
      if (dist2(n.x, n.y, x, y) < (r + n.r) * (r + n.r)) { found = n; return false; }
    });
    return found;
  }

  // ---------- постройки ----------
  structAtTile(tx, ty) { return this.structMap.get(ty * WT + tx) || null; }
  structAt(px, py) { return this.structAtTile(Math.floor(px / TILE), Math.floor(py / TILE)); }

  addStruct(type, tx, ty, owner = 'player') {
    const def = STRUCTS[type];
    const s = { type, tx, ty, x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, hp: def.hp, owner };
    if (def.door) s.open = false;
    if (def.storage) s.items = [];
    if (def.fire) s.fire = { on: false, fuel: 0, input: {}, output: {}, t: 0, burn: 0 };
    this.structMap.set(ty * WT + tx, s);
    this.structs.push(s);
    if (type !== 'concrete') this.invalidateChunk(s.x, s.y);
    return s;
  }
  removeStruct(s) {
    this.structMap.delete(s.ty * WT + s.tx);
    const i = this.structs.indexOf(s);
    if (i >= 0) this.structs.splice(i, 1);
    s.dead = true;
  }
  invalidateChunk() { /* постройки рисуются поверх, кэш земли не меняется */ }

  isSolidStruct(s) {
    if (!s) return false;
    const def = STRUCTS[s.type];
    if (def.door) return !s.open;
    return !!def.solid;
  }
  blocksShots(s) {
    if (!s) return false;
    const def = STRUCTS[s.type];
    if (def.door) return !s.open;
    return !!def.shots;
  }

  // Что мешает окружности стоять в точке.
  blocked(x, y, r, opts = {}) {
    if (x < r || y < r || x > WORLD - r || y > WORLD - r) return { kind: 'edge' };
    if (this.heightAt(x, y) < DEEP) return { kind: 'water' };
    const tx0 = Math.floor((x - r) / TILE), tx1 = Math.floor((x + r) / TILE);
    const ty0 = Math.floor((y - r) / TILE), ty1 = Math.floor((y + r) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const s = this.structAtTile(tx, ty);
      if (s && this.isSolidStruct(s) && circleRect(x, y, r, tx * TILE + 2, ty * TILE + 2, TILE - 4, TILE - 4)) return { kind: 'struct', s };
    }
    let hit = null;
    this.queryNodes(x - r - 24, y - r - 24, x + r + 24, y + r + 24, (n) => {
      if (!NODES[n.type].solid) return;
      const rr = n.r + r;
      if (dist2(n.x, n.y, x, y) < rr * rr) { hit = { kind: 'node', n }; return false; }
    });
    return hit;
  }

  // Первая постройка, перекрывающая выстрел/взгляд.
  lineBlocked(x0, y0, x1, y1) {
    const d = dist(x0, y0, x1, y1), steps = Math.ceil(d / 10);
    for (let i = 1; i < steps; i++) {
      const t = i / steps, x = lerp(x0, x1, t), y = lerp(y0, y1, t);
      const s = this.structAt(x, y);
      if (s && this.blocksShots(s)) return s;
    }
    return null;
  }

  nearStruct(x, y, r, pred) {
    let best = null, bd = r * r;
    for (const s of this.structs) {
      if (!pred(s)) continue;
      const d = dist2(s.x, s.y, x, y);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  canPlace(type, tx, ty, ents) {
    if (tx < 1 || ty < 1 || tx >= WT - 1 || ty >= WT - 1) return false;
    const px = (tx + 0.5) * TILE, py = (ty + 0.5) * TILE;
    const b = this.biomeAt(px, py);
    if (b === 'deep' || b === 'shallow' || b === 'concrete') return false;
    for (const [ox, oy] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) if (this.heightAt(px + ox, py + oy) < SHORE) return false;
    if (this.structAtTile(tx, ty)) return false;
    let bad = false;
    this.queryNodes(px - 60, py - 60, px + 60, py + 60, (n) => {
      if (NODES[n.type].decor && !NODES[n.type].solid) return;
      if (circleRect(n.x, n.y, Math.max(n.r, 6), tx * TILE, ty * TILE, TILE, TILE)) { bad = true; return false; }
    });
    if (bad) return false;
    const solid = STRUCTS[type].solid || STRUCTS[type].door;
    if (solid) for (const e of ents) if (!e.dead && circleRect(e.x, e.y, e.r, tx * TILE, ty * TILE, TILE, TILE)) return false;
    return true;
  }

  randomBeach() {
    for (let k = 0; k < 2000; k++) {
      const x = rand(TILE * 4, WORLD - TILE * 4), y = rand(TILE * 4, WORLD - TILE * 4);
      const h = this.heightAt(x, y);
      if (h > 0.005 && h < SAND && !this.blocked(x, y, 14) && !this.monumentAt(x, y)) return { x, y };
    }
    return { x: WORLD / 2, y: WORLD / 2 };
  }

  randomLand(minFrom, fx, fy, biomes) {
    for (let k = 0; k < 300; k++) {
      const x = rand(TILE * 4, WORLD - TILE * 4), y = rand(TILE * 4, WORLD - TILE * 4);
      if (minFrom && dist2(x, y, fx, fy) < minFrom * minFrom) continue;
      const b = this.biomeAt(x, y);
      if (biomes ? !biomes.includes(b) : (b === 'deep' || b === 'shallow')) continue;
      if (this.blocked(x, y, 16)) continue;
      return { x, y };
    }
    return null;
  }

  // ---------- отрисовка земли ----------
  groundColor(px, py) {
    const h = this.heightAt(px, py), m = this.moistAt(px, py);
    const g = hash2(px >> 1, py >> 1, 7) - 0.5;          // зерно
    const p = valueNoise(px / 26, py / 26, 13) - 0.5;      // пятна
    let r, gg, b;
    if (h < SHORE) {
      const t = clamp((h + 0.32) / 0.32, 0, 1);
      r = lerp(18, 64, t * t); gg = lerp(52, 142, t * t); b = lerp(74, 146, t);
      if (h > -0.014) { const f = 1 - Math.abs(h + 0.007) / 0.007; if (f > 0) { r = lerp(r, 210, f * 0.55); gg = lerp(gg, 228, f * 0.55); b = lerp(b, 222, f * 0.55); } }
      r += p * 8; gg += p * 10; b += p * 10;
    } else {
      // песок → трава/лес → скала
      const sand = [203, 184, 138], grass = [104, 135, 62], dry = [139, 146, 74], forest = [58, 88, 42], rock = [124, 118, 106], peak = [168, 161, 147];
      const fm = clamp((m - 0.47) / 0.12, 0, 1);
      const dm = clamp((0.4 - m) / 0.1, 0, 1);
      let veg = [lerp(grass[0], forest[0], fm), lerp(grass[1], forest[1], fm), lerp(grass[2], forest[2], fm)];
      veg = [lerp(veg[0], dry[0], dm), lerp(veg[1], dry[1], dm), lerp(veg[2], dry[2], dm)];
      const ts = clamp((h - SAND + 0.008) / 0.016, 0, 1);
      let c = [lerp(sand[0], veg[0], ts), lerp(sand[1], veg[1], ts), lerp(sand[2], veg[2], ts)];
      const tr = clamp((h - ROCK + 0.02) / 0.04, 0, 1);
      const tp = clamp((h - 0.5) / 0.15, 0, 1);
      const rk = [lerp(rock[0], peak[0], tp), lerp(rock[1], peak[1], tp), lerp(rock[2], peak[2], tp)];
      c = [lerp(c[0], rk[0], tr), lerp(c[1], rk[1], tr), lerp(c[2], rk[2], tr)];
      r = c[0] + p * 14; gg = c[1] + p * 16; b = c[2] + p * 8;
      // отмывка рельефа
      const sh = (this.heightAt(px - 6, py - 6) - this.heightAt(px + 6, py + 6)) * 900;
      const k = clamp(1 + sh * 0.5, 0.8, 1.18);
      r *= k; gg *= k; b *= k;
      if (h < 0.006) { const wet = 1 - h / 0.006; r *= 1 - wet * 0.18; gg *= 1 - wet * 0.14; b *= 1 - wet * 0.08; }
    }
    const mo = this.monumentAt(px, py);
    if (mo) {
      const lx = px / TILE, ly = py / TILE;
      const seam = (lx % 2 < 0.07 || ly % 2 < 0.07) ? 0.8 : 1;
      const stain = 1 + (valueNoise(px / 18, py / 18, 31) - 0.5) * 0.25;
      r = 112 * seam * stain; gg = 110 * seam * stain; b = 104 * seam * stain;
      if (mo.kind === 'gas' && ly - mo.y0 > 5.5 && ly - mo.y0 < 6.5) { r = 180; gg = 150; b = 60; }
    }
    return [r + g * 10, gg + g * 10, b + g * 10];
  }

  chunk(cx, cy) {
    const key = cy * 1000 + cx;
    let c = this.chunks.get(key);
    if (c) return c;
    const CS = 16 * TILE, RES = 256, step = CS / RES;
    c = document.createElement('canvas');
    c.width = c.height = RES;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(RES, RES);
    const d = img.data;
    for (let y = 0; y < RES; y++) for (let x = 0; x < RES; x++) {
      const col = this.groundColor(cx * CS + x * step, cy * CS + y * step);
      const i = (y * RES + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // травинки и камешки
    const rnd = mulberry32(this.seed + key);
    for (let i = 0; i < 260; i++) {
      const x = rnd() * RES, y = rnd() * RES;
      const wx = cx * CS + x * step, wy = cy * CS + y * step;
      const b = this.biomeAt(wx, wy);
      if (b === 'grass' || b === 'forest') {
        ctx.strokeStyle = b === 'forest' ? 'rgba(30,52,22,.55)' : 'rgba(60,86,34,.6)';
        ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 1, y - 2.5); ctx.moveTo(x, y); ctx.lineTo(x + 1.2, y - 2.2); ctx.stroke();
      } else if (b === 'rock' || b === 'sand') {
        ctx.fillStyle = b === 'rock' ? 'rgba(70,66,58,.5)' : 'rgba(150,130,95,.5)';
        ctx.fillRect(x, y, 1.2, 1);
      }
    }
    this.chunks.set(key, c);
    return c;
  }

  renderMinimap() {
    const S = 320;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    const k = WORLD / S;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const px = (x + 0.5) * k, py = (y + 0.5) * k;
      const h = this.heightAt(px, py), m = this.moistAt(px, py);
      let col;
      if (this.monumentAt(px, py)) col = [128, 124, 116];
      else if (h < DEEP) col = [22, 58, 78];
      else if (h < SHORE) col = [48, 112, 122];
      else if (h < SAND) col = [196, 178, 132];
      else if (h > ROCK) col = [126, 120, 108];
      else col = m > 0.53 ? [60, 90, 44] : [104, 132, 64];
      const i = (y * S + x) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
}
