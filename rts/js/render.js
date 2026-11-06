/* Отрисовка: местность, источники, здания, юниты, снаряды, эффекты, туман, мини-карта. */
const Render = (() => {
  let cv, ctx, mini, mctx, terrain = null, miniTerrain = null, fog = null, fctx = null, fimg = null, miniT = 0;
  const cam = { x: 0, y: 0, z: 1 };
  let dpr = 1, vw = 0, vh = 0;

  function init(canvas, miniCanvas) {
    cv = canvas; ctx = cv.getContext('2d');
    mini = miniCanvas; mctx = mini.getContext('2d');
    resize();
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = cv.clientWidth; vh = cv.clientHeight;
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    mini.width = mini.clientWidth * dpr; mini.height = mini.clientHeight * dpr;
    clampCam();
  }

  /* ---------- местность: рисуется один раз в картинку ---------- */
  function setMap(map) {
    const S = 16, W = map.W, H = map.H, T = map.terrain, w = W * S, h = H * S;
    terrain = document.createElement('canvas'); terrain.width = w; terrain.height = h;
    const tc = terrain.getContext('2d'), img = tc.createImageData(w, h), d = img.data;
    const rand = MapGen.rng(map.seed + 7), vary = new Float32Array(W * H).map(() => rand());
    const field = (pred) => Float32Array.from(T, (v) => (pred(v) ? 1 : 0));
    const water = field((v) => v === MapGen.WATER), rock = field((v) => v === MapGen.ROCK);
    const cl = (v, m) => (v < 0 ? 0 : v >= m ? m - 1 : v);
    const bil = (f, fx, fy) => {
      const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const a = f[cl(y0, H) * W + cl(x0, W)], b = f[cl(y0, H) * W + cl(x0 + 1, W)];
      const c = f[cl(y0 + 1, H) * W + cl(x0, W)], e = f[cl(y0 + 1, H) * W + cl(x0 + 1, W)];
      return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + e * tx) * ty;
    };
    for (let py = 0; py < h; py++) {
      const fy = (py + 0.5) / S - 0.5;
      for (let px = 0; px < w; px++) {
        const fx = (px + 0.5) / S - 0.5;
        const wv = bil(water, fx, fy), rv = bil(rock, fx, fy), nv = bil(vary, fx, fy);
        const g = (Math.sin(px * 12.9898 + py * 78.233) * 43758.5453) % 1 * 14; // зерно
        let r, gr, b;
        if (wv > 0.5) { const k = Math.min(1, (wv - 0.5) * 2.2); r = 46 - 24 * k; gr = 112 - 50 * k; b = 138 - 46 * k; }
        else if (wv > 0.36) { r = 150; gr = 138; b = 98; }                       // песчаный берег
        else if (rv > 0.5) { const k = Math.min(1, (rv - 0.5) * 2); r = 104 + 30 * k; gr = 100 + 26 * k; b = 92 + 22 * k; }
        else if (rv > 0.38) { r = 58; gr = 56; b = 50; }                         // тень у скал
        else { r = 62 + nv * 22; gr = 92 + nv * 22; b = 48 + nv * 8; }           // трава
        const i = (py * w + px) * 4;
        d[i] = r + g; d[i + 1] = gr + g; d[i + 2] = b + g * 0.6; d[i + 3] = 255;
      }
    }
    tc.putImageData(img, 0, 0);

    miniTerrain = document.createElement('canvas'); miniTerrain.width = W; miniTerrain.height = H;
    const mc = miniTerrain.getContext('2d'), mi = mc.createImageData(W, H);
    const pal = [[70, 98, 52], [36, 82, 112], [120, 116, 106]];
    T.forEach((v, i) => { mi.data.set(pal[v], i * 4); mi.data[i * 4 + 3] = 255; });
    mc.putImageData(mi, 0, 0);

    fog = document.createElement('canvas'); fog.width = W; fog.height = H;
    fctx = fog.getContext('2d'); fimg = fctx.createImageData(W, H);
  }

  /* ---------- камера ---------- */
  function clampCam() {
    const s = Game.s;
    if (!s) return;
    const mw = s.map.W * TILE, mh = s.map.H * TILE;
    cam.z = Math.max(Math.max(vw / mw, vh / mh, 0.35), Math.min(2.2, cam.z));
    cam.x = Math.max(0, Math.min(mw - vw / cam.z, cam.x));
    cam.y = Math.max(0, Math.min(mh - vh / cam.z, cam.y));
  }
  function centerOn(x, y) { cam.x = x - vw / cam.z / 2; cam.y = y - vh / cam.z / 2; clampCam(); }
  const toWorld = (sx, sy) => ({ x: sx / cam.z + cam.x, y: sy / cam.z + cam.y });
  const toScreen = (wx, wy) => ({ x: (wx - cam.x) * cam.z, y: (wy - cam.y) * cam.z });
  function zoomAt(sx, sy, factor) {
    const before = toWorld(sx, sy);
    cam.z *= factor; clampCam();
    const after = toWorld(sx, sy);
    cam.x += before.x - after.x; cam.y += before.y - after.y; clampCam();
  }

  /* ---------- кадр ---------- */
  function frame(s, ui, t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0d10'; ctx.fillRect(0, 0, cv.width, cv.height);
    if (!s) return;
    const z = cam.z * dpr;
    ctx.setTransform(z, 0, 0, z, -cam.x * z, -cam.y * z);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(terrain, 0, 0, s.map.W * TILE, s.map.H * TILE);
    const view = { x0: cam.x - 60, y0: cam.y - 60, x1: cam.x + vw / cam.z + 60, y1: cam.y + vh / cam.z + 60 };
    const inView = (e) => e.x > view.x0 && e.x < view.x1 && e.y > view.y0 && e.y < view.y1;
    const shown = s.ents.filter((e) => inView(e) && Game.visibleTo(0, e));
    const selected = new Set(ui.sel);

    for (const f of s.effects) if (f.type === 'scorch') drawEffect(f);
    for (const p of s.pools) drawPool(p, t);
    for (const e of shown) if (e.def.kind === 'building') drawEnt(e, t, selected.has(e));
    for (const e of shown) if (e.def.kind === 'unit' && !e.air) drawEnt(e, t, selected.has(e));
    for (const p of s.projectiles) if (!p.air) drawProjectile(p);
    for (const e of shown) if (e.air) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(e.x + 10, e.y + 16, e.radius, e.radius * 0.6, 0, 0, 7); ctx.fill(); }
    for (const e of shown) if (e.air) drawEnt(e, t, selected.has(e));
    for (const p of s.projectiles) if (p.air) drawProjectile(p);
    for (const f of s.effects) if (f.type !== 'scorch') drawEffect(f);
    for (const e of shown) if (selected.has(e) || e.hp < e.maxHp || (e.built !== undefined && e.built < 1)) drawBars(e);
    if (s.fogOn) drawFog(s);
    drawOverlay(s, ui);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (ui.box) {
      const b = ui.box;
      ctx.strokeStyle = '#7cf29a'; ctx.lineWidth = 1.5; ctx.fillStyle = 'rgba(124,242,154,0.12)';
      ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    }
    if (t - miniT > 0.2) { miniT = t; drawMini(s); }
  }

  function drawPool(p, t) {
    const x = (p.tx + 1) * TILE, y = (p.ty + 1) * TILE;
    ctx.fillStyle = 'rgba(15,22,20,0.75)'; ctx.beginPath(); ctx.arc(x, y, 27, 0, 7); ctx.fill();
    const g = ctx.createRadialGradient(x, y, 2, x, y, 24);
    g.addColorStop(0, `rgba(110,240,194,${0.75 + 0.2 * Math.sin(t * 2 + p.tx)})`); g.addColorStop(1, 'rgba(110,240,194,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 24, 0, 7); ctx.fill();
    ctx.fillStyle = '#b8ffe6';
    for (let i = 0; i < 5; i++) { const a = i * 1.26 + p.ty; ctx.fillRect(x + Math.cos(a) * 14 - 2, y + Math.sin(a) * 14 - 2, 4, 4); }
  }

  function drawEnt(e, t, sel) {
    ctx.save(); ctx.translate(e.x, e.y);
    if (sel) {
      ctx.strokeStyle = e.team === 0 ? '#7cf29a' : '#ff8a8a'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (e.def.kind === 'building') { const h = e.size * TILE / 2; ctx.rect(-h, -h, h * 2, h * 2); } else ctx.arc(0, 0, e.radius + 4, 0, 7);
      ctx.stroke();
    }
    const unfinished = e.built !== undefined && e.built < 1;
    if (unfinished) ctx.globalAlpha = 0.45 + e.built * 0.4;
    Sprites.draw(ctx, e, t);
    ctx.globalAlpha = 1;
    if (unfinished) { // строительные леса
      const h = e.size * TILE / 2 - 2;
      ctx.save(); ctx.beginPath(); ctx.rect(-h, -h, h * 2, h * 2); ctx.clip();
      ctx.strokeStyle = 'rgba(232,185,49,0.45)'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let k = -h * 2; k < h * 2; k += 10) { ctx.moveTo(k, -h); ctx.lineTo(k + h * 2, h); }
      ctx.stroke(); ctx.restore();
      ctx.strokeStyle = 'rgba(232,185,49,0.9)'; ctx.setLineDash([5, 4]); ctx.strokeRect(-h, -h, h * 2, h * 2); ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawBars(e) {
    const w = e.def.kind === 'building' ? e.size * TILE * 0.8 : e.radius * 2.2, y = e.y - (e.def.kind === 'building' ? e.size * TILE / 2 + 6 : e.radius + 8);
    const k = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - w / 2 - 1, y - 1, w + 2, 5);
    ctx.fillStyle = k > 0.6 ? '#5ad17a' : k > 0.3 ? '#f2c94c' : '#eb5757'; ctx.fillRect(e.x - w / 2, y, w * k, 3);
    const extra = e.built < 1 ? e.built : e.queue && e.queue.length ? e.prog / DEFS[e.queue[0]].buildTime : e.upg ? e.upg.t / e.def.upgrade.time : null;
    if (extra !== null && e.team === 0) { ctx.fillStyle = '#4cc9f0'; ctx.fillRect(e.x - w / 2, y + 4, w * Math.min(1, extra), 2.5); }
  }

  function drawProjectile(p) {
    if (p.w.arc) { // навесной снаряд: тень по земле, сам — выше на дуге
      const k = 1 - Math.hypot(p.tx - p.x, p.ty - p.y) / p.total, lift = Math.sin(k * Math.PI) * Math.min(90, p.total * 0.3);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffcf6e'; ctx.beginPath(); ctx.arc(p.x, p.y - lift, 3.5, 0, 7); ctx.fill();
      return;
    }
    const a = Math.atan2(p.ty - p.y, p.tx - p.x);
    ctx.strokeStyle = p.w.air && !p.w.ground ? '#ffe08a' : '#ffd27a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(a) * 8, p.y - Math.sin(a) * 8); ctx.stroke();
  }

  function drawEffect(f) {
    const k = f.t / f.life;
    if (f.type === 'boom') {
      const r = f.r * (0.35 + 0.65 * k), g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      g.addColorStop(0, `rgba(255,240,180,${1 - k})`); g.addColorStop(0.45, `rgba(255,140,40,${0.85 * (1 - k)})`); g.addColorStop(1, 'rgba(80,30,10,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.fill();
    } else if (f.type === 'smoke') {
      ctx.fillStyle = `rgba(60,60,64,${0.4 * (1 - k)})`; ctx.beginPath(); ctx.arc(f.x + k * 6, f.y - k * 14, f.r * (1 + k), 0, 7); ctx.fill();
    } else if (f.type === 'spark') {
      ctx.fillStyle = `rgba(255,220,120,${1 - k})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - k * 0.5), 0, 7); ctx.fill();
    } else if (f.type === 'flash') {
      ctx.fillStyle = `rgba(255,235,150,${1 - k})`; ctx.beginPath(); ctx.arc(f.x + Math.cos(f.a) * 3, f.y + Math.sin(f.a) * 3, f.r, 0, 7); ctx.fill();
    } else if (f.type === 'scorch') {
      ctx.fillStyle = `rgba(20,16,12,${0.35 * (1 - k)})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill();
    } else if (f.type === 'marker') {
      ctx.strokeStyle = f.color || `rgba(124,242,154,${1 - k})`; ctx.globalAlpha = 1 - k; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, 14 * (1 - k * 0.6), 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  function drawFog(s) {
    const { W, H } = s.map, d = fimg.data;
    for (let i = 0; i < W * H; i++) d[i * 4 + 3] = s.vis[i] ? 0 : s.seen[i] ? 120 : 236;
    fctx.putImageData(fimg, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fog, 0, 0, W * TILE, H * TILE);
  }

  function drawOverlay(s, ui) {
    for (const e of ui.sel) if (e.rally && e.team === 0) {
      ctx.strokeStyle = 'rgba(124,242,154,0.6)'; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.rally.x, e.rally.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#7cf29a'; ctx.fillRect(e.rally.x - 1, e.rally.y - 14, 2, 14); ctx.fillRect(e.rally.x, e.rally.y - 14, 9, 6);
    }
    if (!ui.ghost) return;
    const g = ui.ghost, def = DEFS[g.type], n = def.size;
    ctx.fillStyle = g.ok ? 'rgba(124,242,154,0.28)' : 'rgba(235,87,87,0.32)';
    ctx.strokeStyle = g.ok ? '#7cf29a' : '#eb5757'; ctx.lineWidth = 2;
    ctx.fillRect(g.tx * TILE, g.ty * TILE, n * TILE, n * TILE); ctx.strokeRect(g.tx * TILE, g.ty * TILE, n * TILE, n * TILE);
    if (def.weapon) { ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.arc((g.tx + n / 2) * TILE, (g.ty + n / 2) * TILE, def.weapon.range, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
  }

  function drawMini(s) {
    const w = mini.width, h = mini.height, sx = w / (s.map.W * TILE), sy = h / (s.map.H * TILE);
    mctx.imageSmoothingEnabled = false;
    mctx.drawImage(miniTerrain, 0, 0, w, h);
    mctx.fillStyle = '#6ef0c2';
    for (const p of s.pools) mctx.fillRect((p.tx + 0.5) * TILE * sx, (p.ty + 0.5) * TILE * sy, 3 * dpr, 3 * dpr);
    for (const e of s.ents) {
      if (!Game.visibleTo(0, e)) continue;
      mctx.fillStyle = TEAM_COLORS[e.team];
      const r = e.def.kind === 'building' ? 3.5 * dpr : 1.6 * dpr;
      mctx.fillRect(e.x * sx - r, e.y * sy - r, r * 2, r * 2);
    }
    if (s.fogOn) { mctx.imageSmoothingEnabled = true; mctx.drawImage(fog, 0, 0, w, h); }
    if (s.alert && s.time - s.alertT < 3 && Math.floor(s.time * 4) % 2) {
      mctx.strokeStyle = '#ff6b6b'; mctx.lineWidth = 2 * dpr;
      mctx.beginPath(); mctx.arc(s.alert.x * sx, s.alert.y * sy, 8 * dpr, 0, 7); mctx.stroke();
    }
    mctx.strokeStyle = '#ffffff'; mctx.lineWidth = 1 * dpr;
    mctx.strokeRect(cam.x * sx, cam.y * sy, (vw / cam.z) * sx, (vh / cam.z) * sy);
  }

  function miniToWorld(mx, my) {
    const s = Game.s;
    return { x: (mx / mini.clientWidth) * s.map.W * TILE, y: (my / mini.clientHeight) * s.map.H * TILE };
  }

  return { init, resize, setMap, frame, cam, centerOn, toWorld, toScreen, zoomAt, clampCam, miniToWorld,
    get size() { return { w: vw, h: vh }; } };
})();
