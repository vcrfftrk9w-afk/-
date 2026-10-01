'use strict';
// Отрисовка мира: земля, объекты, существа, свет.

const R = {
  cv: null, ctx: null, light: null, lctx: null, w: 0, h: 0, dpr: 1, zoom: 1, camX: 0, camY: 0,

  init(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    this.light = document.createElement('canvas'); this.lctx = this.light.getContext('2d');
    this.resize();
  },
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.cv.width = Math.round(this.w * this.dpr); this.cv.height = Math.round(this.h * this.dpr);
    this.cv.style.width = this.w + 'px'; this.cv.style.height = this.h + 'px';
    this.light.width = Math.ceil(this.w / 2); this.light.height = Math.ceil(this.h / 2);
    this.zoom = clamp(Math.max(this.w, this.h) / 1250, 0.62, 1.5);
  },
  toWorld(sx, sy) { return { x: (sx - this.w / 2) / this.zoom + this.camX, y: (sy - this.h / 2) / this.zoom + this.camY }; },
  toScreen(x, y) { return { x: (x - this.camX) * this.zoom + this.w / 2, y: (y - this.camY) * this.zoom + this.h / 2 }; },

  frame(t) {
    const c = this.ctx, p = G.player, w = G.world;
    // камера
    const look = p.dead ? 0 : 40;
    const tx = p.x + Math.cos(p.ang) * look, ty = p.y + Math.sin(p.ang) * look;
    this.camX = lerp(this.camX || tx, tx, 0.15); this.camY = lerp(this.camY || ty, ty, 0.15);
    const sh = G.shake * 6;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#163a4d'; c.fillRect(0, 0, this.w, this.h);
    c.save();
    c.translate(this.w / 2 + rand(-sh, sh), this.h / 2 + rand(-sh, sh));
    c.scale(this.zoom, this.zoom);
    c.translate(-this.camX, -this.camY);
    const vw = this.w / this.zoom / 2 + 60, vh = this.h / this.zoom / 2 + 60;
    const x0 = this.camX - vw, x1 = this.camX + vw, y0 = this.camY - vh, y1 = this.camY + vh;

    // земля
    const CS = 16 * TILE;
    c.imageSmoothingEnabled = true;
    for (let cy = Math.max(0, Math.floor(y0 / CS)); cy <= Math.min(WT / 16 - 1, Math.floor(y1 / CS)); cy++) {
      for (let cx = Math.max(0, Math.floor(x0 / CS)); cx <= Math.min(WT / 16 - 1, Math.floor(x1 / CS)); cx++) {
        c.drawImage(w.chunk(cx, cy), cx * CS, cy * CS, CS + 0.5, CS + 0.5);
      }
    }
    this.waterGlints(c, x0, y0, x1, y1, t);

    // собрать видимые узлы
    const nodes = [], trees = [];
    w.queryNodes(x0 - 60, y0 - 60, x1 + 60, y1 + 60, (n) => {
      if (n.type === 'tree' || n.type === 'pine') trees.push(n); else nodes.push(n);
    });
    // низкие объекты
    for (const n of nodes) if (NODES[n.type].pick || n.type === 'radar') this.drawNode(c, n, t);
    for (const b of G.bags) if (b.x > x0 - 40 && b.x < x1 + 40 && b.y > y0 - 40 && b.y < y1 + 40) this.drawBag(c, b);
    // постройки
    for (const s of w.structs) if (s.x > x0 - 40 && s.x < x1 + 40 && s.y > y0 - 40 && s.y < y1 + 40) this.drawStruct(c, s, t);
    for (const n of nodes) if (!NODES[n.type].pick && n.type !== 'radar') this.drawNode(c, n, t);
    for (const n of trees) this.drawTrunk(c, n);
    // существа
    for (const a of G.animals) if (a.x > x0 && a.x < x1 && a.y > y0 && a.y < y1) this.drawAnimal(c, a);
    for (const n of G.npcs) if (n.x > x0 && n.x < x1 && n.y > y0 && n.y < y1) this.drawHuman(c, n.x, n.y, n.ang, n.walk, NPC_KINDS[n.kind].weapon, n.atk || 0, 'npc', n.kind, n.hitT > 0);
    if (!p.dead) {
      const held = G.heldItem();
      this.drawHuman(c, p.x, p.y, p.ang, p.moving ? p.walk : 0, held ? held.id : null, p.swing, 'player', p.armor && p.armor.id, false);
    }
    // снаряды
    for (const b of G.shots) this.drawShot(c, b);
    // частицы
    for (const q of G.parts) {
      const a = q.life / q.max;
      if (q.color === 'smoke') { c.fillStyle = `rgba(70,70,70,${a * 0.35})`; c.beginPath(); c.arc(q.x, q.y, q.size * (2 - a), 0, TAU); c.fill(); }
      else { c.globalAlpha = Math.min(1, a * 1.5); c.fillStyle = q.color; c.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size); c.globalAlpha = 1; }
    }
    // кроны
    for (const n of trees) this.drawCanopy(c, n, t, p);
    if (G.falling) this.drawFalling(c, G.falling);
    if (G.plane) this.drawPlane(c, G.plane);
    c.restore();

    this.drawLight(t);

    c.save();
    c.translate(this.w / 2, this.h / 2); c.scale(this.zoom, this.zoom); c.translate(-this.camX, -this.camY);
    if (G.ghost && !p.dead) this.drawGhost(c, G.ghost);
    this.drawHealthBars(c);
    c.restore();
    if (G.drop) this.drawDropMarker(c, G.drop);
  },

  waterGlints(c, x0, y0, x1, y1, t) {
    c.fillStyle = 'rgba(220,240,245,.18)';
    const step = 48;
    for (let y = Math.floor(y0 / step) * step; y < y1; y += step) for (let x = Math.floor(x0 / step) * step; x < x1; x += step) {
      const hsh = hash2(x / step, y / step, 5);
      if (hsh > 0.35) continue;
      const px = x + hsh * 40, py = y + hash2(x, y, 6) * 40;
      if (G.world.heightAt(px, py) > -0.02) continue;
      const ph = Math.sin(t * 1.4 + hsh * 50);
      if (ph < 0.3) continue;
      c.globalAlpha = (ph - 0.3) * 0.8;
      c.fillRect(px - 5, py, 10 + ph * 6, 1.5);
    }
    c.globalAlpha = 1;
  },

  rock(c, x, y, r, seed, base, light) {
    const pts = 9;
    c.fillStyle = 'rgba(0,0,0,.25)';
    c.beginPath(); c.ellipse(x + 3, y + 4, r * 1.05, r * 0.9, 0, 0, TAU); c.fill();
    c.beginPath();
    for (let i = 0; i < pts; i++) {
      const a = (i / pts) * TAU, k = 0.78 + hash2(i, seed, 3) * 0.3;
      const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath(); c.fillStyle = base; c.fill();
    c.fillStyle = light;
    c.beginPath(); c.ellipse(x - r * 0.25, y - r * 0.3, r * 0.5, r * 0.35, -0.5, 0, TAU); c.fill();
  },

  drawNode(c, n, t) {
    const sh = n.shake > 0 ? (n.shake -= 1 / 60, Math.sin(t * 60) * 2) : 0;
    const x = n.x + sh, y = n.y;
    switch (n.type) {
      case 'stone': this.rock(c, x, y, n.r, n.seed, '#8b8780', '#a6a299'); break;
      case 'metal':
        this.rock(c, x, y, n.r, n.seed, '#6f6a62', '#8a857b');
        c.fillStyle = '#c97b45';
        for (let i = 0; i < 6; i++) { const a = hash2(i, n.seed, 1) * TAU, d = hash2(i, n.seed, 2) * n.r * 0.6; c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 2.4, 0, TAU); c.fill(); }
        break;
      case 'sulfur':
        this.rock(c, x, y, n.r, n.seed, '#7a7462', '#948d77');
        c.fillStyle = '#e2cc3b';
        for (let i = 0; i < 6; i++) { const a = hash2(i, n.seed, 1) * TAU, d = hash2(i, n.seed, 2) * n.r * 0.6; c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 2.4, 0, TAU); c.fill(); }
        break;
      case 'hemp':
        c.strokeStyle = '#3d6a2a'; c.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + Math.sin(t + n.seed) * 0.08;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10); c.stroke();
          c.fillStyle = '#5d9a3a'; c.beginPath(); c.ellipse(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 4.5, 2, a, 0, TAU); c.fill();
        }
        c.fillStyle = '#86b84f'; c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill();
        break;
      case 'bush':
        c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(x + 2, y + 3, 13, 11, 0, 0, TAU); c.fill();
        c.fillStyle = '#3f6a32'; c.beginPath(); c.arc(x, y, 12, 0, TAU); c.fill();
        c.fillStyle = '#4f7d3c'; c.beginPath(); c.arc(x - 3, y - 3, 7, 0, TAU); c.fill();
        c.fillStyle = '#3a4b9a';
        for (let i = 0; i < 7; i++) { const a = hash2(i, n.seed, 4) * TAU, d = 3 + hash2(i, n.seed, 5) * 7; c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 2.2, 0, TAU); c.fill(); }
        break;
      case 'shroom':
        c.fillStyle = '#e9dfc8'; c.beginPath(); c.arc(x, y + 2, 2.5, 0, TAU); c.fill();
        c.fillStyle = '#a8442c'; c.beginPath(); c.arc(x, y, 5, 0, TAU); c.fill();
        c.fillStyle = '#f0e2c4'; c.beginPath(); c.arc(x - 1.5, y - 1.5, 1.2, 0, TAU); c.arc(x + 2, y + 0.5, 1, 0, TAU); c.fill();
        break;
      case 'barrel': {
        const hit = n.hp < NODES.barrel.hp;
        c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x + 3, y + 4, 12, 11, 0, 0, TAU); c.fill();
        c.fillStyle = hit ? '#3a6680' : '#3f6f8c'; c.beginPath(); c.arc(x, y, 12, 0, TAU); c.fill();
        c.strokeStyle = '#2b4c60'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 8.5, 0, TAU); c.stroke();
        c.fillStyle = '#b8642e'; c.beginPath(); c.arc(x + 3, y - 4, 2.5, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(x - 4, y - 4, 4, 0, TAU); c.fill();
        break;
      }
      case 'crate': case 'elite': case 'drop': {
        const elite = n.type !== 'crate', s = n.type === 'drop' ? 34 : elite ? 30 : 26;
        c.save(); c.translate(x, y); c.rotate((hash2(n.seed, 1, 1) - 0.5) * 0.4);
        c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(-s / 2 + 3, -s / 2 + 4, s, s);
        c.fillStyle = n.type === 'drop' ? '#4a5a6a' : elite ? '#4c5a35' : '#9b6a3e'; c.fillRect(-s / 2, -s / 2, s, s);
        c.strokeStyle = n.type === 'drop' ? '#2e3a46' : elite ? '#323c22' : '#6e4626'; c.lineWidth = 2.5;
        c.strokeRect(-s / 2 + 2, -s / 2 + 2, s - 4, s - 4);
        if (elite) { c.fillStyle = n.type === 'drop' ? '#d24b2a' : '#c9a33a'; c.fillRect(-s / 2, -3, s, 6); }
        else { c.beginPath(); c.moveTo(-s / 2 + 2, -s / 2 + 2); c.lineTo(s / 2 - 2, s / 2 - 2); c.stroke(); }
        if (n.type === 'drop') { c.fillStyle = '#d24b2a'; c.globalAlpha = 0.5 + Math.sin(t * 6) * 0.5; c.beginPath(); c.arc(0, 0, 4, 0, TAU); c.fill(); c.globalAlpha = 1; }
        c.restore();
        break;
      }
      case 'pump':
        c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x - 10, y - 12, 24, 28);
        c.fillStyle = '#b8322a'; c.fillRect(x - 12, y - 15, 24, 28);
        c.fillStyle = '#e8e0cc'; c.fillRect(x - 8, y - 11, 16, 8);
        c.fillStyle = '#3a3633'; c.fillRect(x + 8, y - 2, 6, 3);
        break;
      case 'radar': {
        c.save(); c.translate(x, y);
        c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(8, 10, 46, 0, TAU); c.fill();
        c.rotate(t * 0.25);
        c.fillStyle = '#c9c4b8'; c.beginPath(); c.arc(0, 0, 46, 0, TAU); c.fill();
        c.strokeStyle = '#8c877c'; c.lineWidth = 2;
        for (let r = 12; r < 46; r += 11) { c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); }
        for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(i / 6 * TAU) * 46, Math.sin(i / 6 * TAU) * 46); c.stroke(); }
        c.fillStyle = '#5d5a55'; c.beginPath(); c.arc(0, 0, 7, 0, TAU); c.fill();
        c.restore();
        break;
      }
    }
  },

  drawTrunk(c, n) {
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(n.x + 10, n.y + 12, n.type === 'pine' ? 22 : 28, n.type === 'pine' ? 18 : 22, 0.3, 0, TAU); c.fill();
    c.fillStyle = '#5b3d24'; c.beginPath(); c.arc(n.x, n.y, n.r * 0.85, 0, TAU); c.fill();
  },
  drawCanopy(c, n, t, p) {
    const near = !p.dead && dist2(p.x, p.y, n.x, n.y) < 44 * 44;
    const sway = Math.sin(t * 0.9 + n.seed) * 1.5 + (n.shake > 0 ? Math.sin(t * 50) * 2 : 0);
    const left = n.amt / n.max;
    c.globalAlpha = near ? 0.35 : 0.97;
    const s = 0.75 + 0.25 * left;
    if (n.type === 'pine') {
      const cols = ['#24432a', '#2d5232', '#38603a'];
      for (let i = 0; i < 3; i++) {
        const r = (25 - i * 7) * s;
        c.fillStyle = cols[i];
        c.beginPath();
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * TAU + i * 0.4 + n.seed;
          const rr = r * (k % 2 ? 0.8 : 1) * (0.92 + hash2(k, n.seed, i) * 0.16);
          const px = n.x + sway * (i + 1) * 0.4 + Math.cos(a) * rr, py = n.y - i * 3 + Math.sin(a) * rr;
          k ? c.lineTo(px, py) : c.moveTo(px, py);
        }
        c.closePath(); c.fill();
      }
      c.fillStyle = '#4a7444'; c.beginPath(); c.arc(n.x + sway * 1.5, n.y - 9, 3 * s, 0, TAU); c.fill();
    } else {
      const cols = ['#33552a', '#3f6a32', '#4f7d3c'];
      for (let i = 0; i < 3; i++) {
        c.fillStyle = cols[i];
        for (let k = 0; k < 4 - i; k++) {
          const a = hash2(k, n.seed, i) * TAU, d = (10 - i * 3) * s;
          c.beginPath(); c.arc(n.x + sway + Math.cos(a) * d - i * 2, n.y + Math.sin(a) * d - i * 3, (20 - i * 4) * s, 0, TAU); c.fill();
        }
      }
    }
    c.globalAlpha = 1;
  },

  drawStruct(c, s, t) {
    const x = s.tx * TILE, y = s.ty * TILE, T = TILE;
    const flash = s.hitT > 0 ? (s.hitT -= 1 / 60, true) : false;
    switch (s.type) {
      case 'concrete': {
        c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x + 4, y + 5, T, T);
        c.fillStyle = '#8f8b83'; c.fillRect(x, y, T, T);
        c.fillStyle = '#a19d94'; c.fillRect(x + 2, y + 2, T - 4, T - 10);
        c.fillStyle = 'rgba(0,0,0,.12)';
        const k = hash2(s.tx, s.ty, 9);
        if (k < 0.5) { c.fillRect(x + 6 + k * 14, y + 6, 2, 12); }
        break;
      }
      case 'wood_wall': case 'stone_wall': {
        const wood = s.type === 'wood_wall';
        c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x + 4, y + 5, T, T);
        c.fillStyle = flash ? '#fff' : wood ? '#8a5a32' : '#8b8780'; c.fillRect(x, y, T, T);
        c.strokeStyle = wood ? '#5e3c20' : '#5d5a55'; c.lineWidth = 1.5;
        if (wood) { for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x + i * 8, y + 1); c.lineTo(x + i * 8, y + T - 1); c.stroke(); } }
        else { for (let r = 0; r < 4; r++) { c.beginPath(); c.moveTo(x, y + r * 8); c.lineTo(x + T, y + r * 8); c.stroke(); for (let k = (r % 2) * 8; k < T; k += 16) { c.beginPath(); c.moveTo(x + k, y + r * 8); c.lineTo(x + k, y + r * 8 + 8); c.stroke(); } } }
        c.strokeStyle = 'rgba(0,0,0,.4)'; c.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
        this.damageCracks(c, s, x, y);
        break;
      }
      case 'wood_door':
        c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + 4, y + 5, T, T);
        if (s.open) {
          c.fillStyle = '#4e301a'; c.fillRect(x, y, 4, T); c.fillRect(x + T - 4, y, 4, T);
          c.fillStyle = '#7a4e2b'; c.save(); c.translate(x + 2, y + 2); c.rotate(-1.2); c.fillRect(0, 0, T - 4, 6); c.restore();
        } else {
          c.fillStyle = flash ? '#fff' : '#7a4e2b'; c.fillRect(x, y, T, T);
          c.strokeStyle = '#4e301a'; c.lineWidth = 2; c.strokeRect(x + 3, y + 3, T - 6, T - 6);
          c.fillStyle = '#c99a3a'; c.beginPath(); c.arc(x + T - 9, y + T / 2, 2.5, 0, TAU); c.fill();
        }
        this.damageCracks(c, s, x, y);
        break;
      case 'campfire': {
        for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; c.fillStyle = i % 2 ? '#7d7a74' : '#6a6761'; c.beginPath(); c.arc(s.x + Math.cos(a) * 11, s.y + Math.sin(a) * 11, 4.5, 0, TAU); c.fill(); }
        c.strokeStyle = '#4a2f1a'; c.lineWidth = 4;
        c.beginPath(); c.moveTo(s.x - 7, s.y - 5); c.lineTo(s.x + 7, s.y + 5); c.moveTo(s.x + 7, s.y - 5); c.lineTo(s.x - 7, s.y + 5); c.stroke();
        if (s.fire.on) {
          const f = 1 + Math.sin(t * 18) * 0.12 + Math.sin(t * 7) * 0.1;
          c.fillStyle = '#ff7a1e'; c.beginPath(); c.arc(s.x, s.y, 8 * f, 0, TAU); c.fill();
          c.fillStyle = '#ffd36a'; c.beginPath(); c.arc(s.x, s.y, 4 * f, 0, TAU); c.fill();
        }
        break;
      }
      case 'furnace':
        c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.arc(s.x + 4, s.y + 5, 15, 0, TAU); c.fill();
        c.fillStyle = flash ? '#fff' : '#7d7a74'; c.beginPath(); c.arc(s.x, s.y, 15, 0, TAU); c.fill();
        c.fillStyle = '#5d5a55'; c.beginPath(); c.arc(s.x, s.y, 9, 0, TAU); c.fill();
        c.fillStyle = s.fire.on ? `rgb(255,${120 + Math.sin(t * 10) * 30 | 0},40)` : '#2a2523';
        c.beginPath(); c.arc(s.x, s.y, 6, 0, TAU); c.fill();
        break;
      case 'box':
        c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x + 7, y + 9, T - 8, T - 10);
        c.fillStyle = flash ? '#fff' : '#9b6a3e'; c.fillRect(x + 4, y + 6, T - 8, T - 12);
        c.fillStyle = '#6e4626'; c.fillRect(x + 4, y + 12, T - 8, 3); c.fillRect(x + T / 2 - 2, y + 6, 4, T - 12);
        break;
      case 'sleeping_bag':
        c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x + 9, y + 3, 18, 30);
        c.fillStyle = '#3e6b6a'; c.beginPath(); c.roundRect ? c.roundRect(x + 7, y + 1, 18, 30, 6) : c.rect(x + 7, y + 1, 18, 30); c.fill();
        c.fillStyle = '#d8d2c4'; c.fillRect(x + 9, y + 3, 14, 7);
        break;
      case 'workbench':
        c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x + 5, y + 9, T, T - 8);
        c.fillStyle = flash ? '#fff' : '#8a5a32'; c.fillRect(x + 1, y + 5, T - 2, T - 10);
        c.fillStyle = '#9aa1a6'; c.fillRect(x + 5, y + 9, 10, 4);
        c.fillStyle = '#c3712f'; c.fillRect(x + 19, y + 8, 4, 10);
        c.strokeStyle = '#5e3c20'; c.lineWidth = 1.5; c.strokeRect(x + 1, y + 5, T - 2, T - 10);
        break;
      case 'barricade':
        c.fillStyle = flash ? '#fff' : '#6e4626'; c.fillRect(x + 2, y + 13, T - 4, 6);
        c.fillStyle = '#c9a97a';
        for (let i = 0; i < 4; i++) for (const d of [-1, 1]) { c.beginPath(); c.moveTo(x + 5 + i * 7, y + 16); c.lineTo(x + 8 + i * 7, y + 16 + d * 14); c.lineTo(x + 11 + i * 7, y + 16); c.closePath(); c.fill(); }
        break;
    }
  },
  damageCracks(c, s, x, y) {
    const k = s.hp / STRUCTS[s.type].hp;
    if (k > 0.7) return;
    c.strokeStyle = 'rgba(20,10,5,.6)'; c.lineWidth = 1.2;
    const n = k < 0.35 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const sx = x + 6 + hash2(s.tx, i, 1) * 20, sy = y + 4 + hash2(s.ty, i, 2) * 10;
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + 4, sy + 7); c.lineTo(sx + 1, sy + 13); c.lineTo(sx + 6, sy + 20); c.stroke();
    }
  },

  drawBag(c, b) {
    if (b.kind === 'corpse') {
      c.save(); c.translate(b.x, b.y); c.rotate(b.ang + Math.PI / 2);
      if (b.what === 'npc') {
        c.fillStyle = '#5e2a24'; c.beginPath(); c.ellipse(0, 0, 13, 9, 0, 0, TAU); c.fill();
        c.fillStyle = '#c99a78'; c.beginPath(); c.arc(0, -12, 6, 0, TAU); c.fill();
      } else {
        const d = ANIMALS[b.what];
        c.fillStyle = shade(d.color, 0.8); c.beginPath(); c.ellipse(0, 0, d.r * 0.75, d.r * 1.2, 0, 0, TAU); c.fill();
        c.fillStyle = '#7a1c1c'; c.beginPath(); c.ellipse(3, 3, d.r * 0.4, d.r * 0.3, 0, 0, TAU); c.fill();
      }
      c.restore();
      if (!b.items.length) return;
    }
    if (b.kind !== 'corpse') {
      c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(b.x + 2, b.y + 3, 10, 8, 0, 0, TAU); c.fill();
      c.fillStyle = b.kind === 'backpack' ? '#3e6b6a' : '#8a7a58'; c.beginPath(); c.arc(b.x, b.y, 9, 0, TAU); c.fill();
      c.fillStyle = b.kind === 'backpack' ? '#2b4c4b' : '#6a5c40'; c.fillRect(b.x - 5, b.y - 9, 10, 4);
    }
  },

  // Человек сверху: плечи, голова, руки с предметом.
  drawHuman(c, x, y, ang, walk, held, swing, who, extra, flash) {
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(3, 4, 14, 12, 0, 0, TAU); c.fill();
    c.rotate(ang);
    const bob = Math.sin(walk) * 3;
    const jacket = who === 'player' ? (extra === 'metal_armor' ? '#8c9398' : extra === 'wood_armor' ? '#8a5a32' : extra === 'burlap' ? '#a8946a' : '#4f5f45')
      : { spear: '#6a4a3a', bow: '#5a5a3a', revolver: '#3d3f45', shotgun: '#4a2e2a' }[extra];
    // руки
    const reach = swing > 0 ? Math.sin((1 - swing) * Math.PI) * 10 : 0;
    const twoHand = held && ITEMS[held] && (ITEMS[held].gun || held === 'spear');
    c.fillStyle = flash ? '#fff' : '#c99a78';
    const lh = twoHand ? [16, -5] : [9 - bob * 0.5, -12];
    const rh = twoHand ? [24, 3] : [10 + bob * 0.5 + reach, 12 - reach * 0.6];
    // предмет
    if (held) this.drawHeld(c, held, rh[0], rh[1], swing);
    c.beginPath(); c.arc(lh[0], lh[1], 4, 0, TAU); c.fill();
    c.beginPath(); c.arc(rh[0], rh[1], 4, 0, TAU); c.fill();
    // тело
    c.fillStyle = flash ? '#fff' : jacket;
    c.beginPath(); c.ellipse(0, 0, 9, 14, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(-2, 0, 6, 12, 0, 0, TAU); c.fill();
    // голова
    c.fillStyle = flash ? '#fff' : '#c99a78'; c.beginPath(); c.arc(1, 0, 7.5, 0, TAU); c.fill();
    if (who === 'player') { c.fillStyle = '#3a2a1e'; c.beginPath(); c.arc(-1, 0, 7.5, Math.PI * 0.55, Math.PI * 1.45); c.fill(); }
    else { c.fillStyle = '#7a2a22'; c.beginPath(); c.arc(0, 0, 7.8, Math.PI * 0.4, Math.PI * 1.6); c.fill(); c.fillStyle = '#2a2523'; c.fillRect(3, -4, 3, 8); }
    c.restore();
  },
  drawHeld(c, id, hx, hy, swing) {
    c.save(); c.translate(hx, hy);
    const sw = swing > 0 ? -Math.sin((1 - swing) * Math.PI) * 1.2 : 0;
    c.rotate(sw);
    switch (id) {
      case 'rock': c.fillStyle = '#8b8780'; c.beginPath(); c.arc(4, 0, 5, 0, TAU); c.fill(); break;
      case 'torch':
        c.fillStyle = '#6b4a2e'; c.fillRect(0, -2, 16, 4);
        c.fillStyle = '#ff8a2a'; c.beginPath(); c.arc(18 + Math.random(), 0, 5 + Math.random() * 1.5, 0, TAU); c.fill();
        c.fillStyle = '#ffe07a'; c.beginPath(); c.arc(18, 0, 2.5, 0, TAU); c.fill(); break;
      case 'stone_hatchet': case 'salvaged_axe': case 'hammer':
        c.fillStyle = '#6b4a2e'; c.fillRect(0, -2, 20, 4);
        c.fillStyle = id === 'salvaged_axe' ? '#a9b0b5' : id === 'hammer' ? '#9b7a52' : '#8b8780'; c.fillRect(15, -8, 7, id === 'hammer' ? 16 : 9); break;
      case 'stone_pickaxe': case 'salvaged_pick':
        c.fillStyle = '#6b4a2e'; c.fillRect(0, -2, 20, 4);
        c.strokeStyle = id === 'salvaged_pick' ? '#a9b0b5' : '#8b8780'; c.lineWidth = 4;
        c.beginPath(); c.arc(26, 0, 9, Math.PI * 0.6, Math.PI * 1.4); c.stroke(); break;
      case 'spear': c.fillStyle = '#8a5a32'; c.fillRect(-14, -1.5, 44, 3); c.fillStyle = '#c9a97a'; c.beginPath(); c.moveTo(36, 0); c.lineTo(29, -4); c.lineTo(29, 4); c.closePath(); c.fill(); break;
      case 'machete': c.fillStyle = '#3d3a36'; c.fillRect(0, -2, 7, 4); c.fillStyle = '#b6bdc2'; c.fillRect(7, -3, 18, 5); break;
      case 'bow':
        c.strokeStyle = '#8a5a32'; c.lineWidth = 3; c.beginPath(); c.arc(-4, 0, 16, -1.1, 1.1); c.stroke();
        c.strokeStyle = '#e8e0cc'; c.lineWidth = 1; c.beginPath(); c.moveTo(-4 + Math.cos(-1.1) * 16, Math.sin(-1.1) * 16); c.lineTo(-10, 0); c.lineTo(-4 + Math.cos(1.1) * 16, Math.sin(1.1) * 16); c.stroke(); break;
      case 'revolver': c.fillStyle = '#3a3836'; c.fillRect(0, -2.5, 18, 5); c.fillStyle = '#55524e'; c.fillRect(2, -4, 7, 8); break;
      case 'shotgun': c.fillStyle = '#7a5434'; c.fillRect(-10, -3, 14, 6); c.fillStyle = '#4a4744'; c.fillRect(4, -2.5, 24, 5); break;
      default: {
        const def = ITEMS[id];
        if (def && (def.use || def.deploy)) { c.fillStyle = def.deploy ? '#b59a72' : '#d8d2c4'; c.fillRect(0, -4, 8, 8); }
      }
    }
    c.restore();
  },

  drawAnimal(c, a) {
    const d = ANIMALS[a.type];
    c.save(); c.translate(a.x, a.y);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(3, 4, d.r * 1.3, d.r * 0.9, a.ang, 0, TAU); c.fill();
    c.rotate(a.ang);
    const leg = Math.sin(a.walk) * 4;
    const col = a.hitT > 0 ? '#fff' : d.color;
    // лапы
    c.fillStyle = shade(d.color, 0.7);
    for (const [lx, ly, s] of [[d.r * 0.7, d.r * 0.55, 1], [d.r * 0.7, -d.r * 0.55, -1], [-d.r * 0.7, d.r * 0.55, -1], [-d.r * 0.7, -d.r * 0.55, 1]]) {
      c.beginPath(); c.ellipse(lx + leg * s, ly, 4, 3, 0, 0, TAU); c.fill();
    }
    c.fillStyle = col;
    c.beginPath(); c.ellipse(0, 0, d.r * 1.25, d.r * 0.72, 0, 0, TAU); c.fill();
    const hx = d.r * 1.25 + (a.bite > 0 ? 4 : 0);
    c.beginPath(); c.ellipse(hx, 0, d.r * 0.55, d.r * 0.42, 0, 0, TAU); c.fill();
    if (a.type === 'deer') {
      c.strokeStyle = '#d9c7a0'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(hx - 2, -4); c.lineTo(hx - 8, -14); c.lineTo(hx - 4, -18); c.moveTo(hx - 6, -11); c.lineTo(hx - 12, -14);
      c.moveTo(hx - 2, 4); c.lineTo(hx - 8, 14); c.lineTo(hx - 4, 18); c.moveTo(hx - 6, 11); c.lineTo(hx - 12, 14); c.stroke();
      c.fillStyle = '#efe6d2'; c.beginPath(); c.arc(-d.r * 1.2, 0, 3, 0, TAU); c.fill();
    } else if (a.type === 'boar') {
      c.fillStyle = '#efe6d2'; c.beginPath(); c.moveTo(hx + 5, -3); c.lineTo(hx + 11, -6); c.lineTo(hx + 6, -1); c.moveTo(hx + 5, 3); c.lineTo(hx + 11, 6); c.lineTo(hx + 6, 1); c.fill();
      c.fillStyle = '#2e2824'; c.fillRect(-d.r, -2, d.r * 2, 4);
    } else if (a.type === 'wolf') {
      c.fillStyle = shade(d.color, 0.75); c.beginPath(); c.moveTo(hx - 2, -6); c.lineTo(hx - 7, -11); c.lineTo(hx + 1, -7); c.moveTo(hx - 2, 6); c.lineTo(hx - 7, 11); c.lineTo(hx + 1, 7); c.fill();
      c.beginPath(); c.ellipse(-d.r * 1.5, 0, 8, 3, 0, 0, TAU); c.fill();
    } else if (a.type === 'bear') {
      c.fillStyle = shade(d.color, 0.8); c.beginPath(); c.arc(hx - 4, -8, 4, 0, TAU); c.arc(hx - 4, 8, 4, 0, TAU); c.fill();
      c.fillStyle = '#2a1c12'; c.beginPath(); c.arc(hx + 7, 0, 3, 0, TAU); c.fill();
    }
    c.restore();
  },

  drawShot(c, b) {
    if (b.kind === 'arrow') {
      const a = Math.atan2(b.vy, b.vx);
      c.save(); c.translate(b.x, b.y); c.rotate(a);
      c.strokeStyle = '#d9c7a0'; c.lineWidth = 2; c.beginPath(); c.moveTo(-18, 0); c.lineTo(0, 0); c.stroke();
      c.fillStyle = '#8b8780'; c.beginPath(); c.moveTo(3, 0); c.lineTo(-3, -3); c.lineTo(-3, 3); c.fill();
      c.restore();
    } else {
      c.strokeStyle = b.from === 'p' ? 'rgba(255,230,150,.9)' : 'rgba(255,170,120,.9)';
      c.lineWidth = b.kind === 'pellet' ? 1.5 : 2;
      c.beginPath(); c.moveTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018); c.lineTo(b.x, b.y); c.stroke();
    }
  },

  drawPlane(c, pl) {
    c.save(); c.translate(pl.x + 60, pl.y + 80); c.rotate(pl.a);
    c.fillStyle = 'rgba(0,0,0,.25)';
    c.beginPath(); c.ellipse(0, 0, 70, 12, 0, 0, TAU); c.fill();
    c.fillRect(-10, -80, 30, 160); c.fillRect(-60, -30, 14, 60);
    c.restore();
  },
  drawFalling(c, f) {
    const s = 1 + f.z * 0.8;
    c.fillStyle = `rgba(0,0,0,${0.3 * (1 - f.z)})`; c.beginPath(); c.ellipse(f.x + 4, f.y + 4, 18, 14, 0, 0, TAU); c.fill();
    const y = f.y - f.z * 160;
    c.strokeStyle = 'rgba(240,240,240,.7)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(f.x - 14 * s, y - 36 * s); c.lineTo(f.x, y); c.lineTo(f.x + 14 * s, y - 36 * s); c.stroke();
    c.fillStyle = '#d24b2a'; c.beginPath(); c.ellipse(f.x, y - 40 * s, 30 * s, 14 * s, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#f0e8d8'; c.beginPath(); c.ellipse(f.x, y - 40 * s, 10 * s, 14 * s, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#4a5a6a'; c.fillRect(f.x - 12 * s, y - 12 * s, 24 * s, 24 * s);
  },

  drawGhost(c, g) {
    const x = g.tx * TILE, y = g.ty * TILE;
    c.fillStyle = g.ok ? 'rgba(120,200,255,.28)' : 'rgba(255,80,60,.3)';
    c.strokeStyle = g.ok ? 'rgba(160,220,255,.9)' : 'rgba(255,110,90,.9)';
    c.lineWidth = 2;
    c.fillRect(x, y, TILE, TILE); c.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    c.globalAlpha = 0.5;
    const img = UI.iconImg(g.id);
    if (img.complete) c.drawImage(img, x + 4, y + 4, TILE - 8, TILE - 8);
    c.globalAlpha = 1;
  },

  drawHealthBars(c) {
    const bar = (x, y, k) => {
      c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(x - 15, y, 30, 4);
      c.fillStyle = k > 0.5 ? '#8fbf5a' : k > 0.25 ? '#e0a33a' : '#d24b2a'; c.fillRect(x - 15, y, 30 * k, 4);
    };
    for (const a of G.animals) if (a.hp < ANIMALS[a.type].hp) bar(a.x, a.y - a.r - 12, a.hp / ANIMALS[a.type].hp);
    for (const n of G.npcs) if (n.hp < NPC_KINDS[n.kind].hp) bar(n.x, n.y - 24, n.hp / NPC_KINDS[n.kind].hp);
    const p = G.player;
    for (const s of G.world.structs) {
      if (s.owner !== 'player' || s.hp >= STRUCTS[s.type].hp) continue;
      if (dist2(s.x, s.y, p.x, p.y) > 160 * 160) continue;
      bar(s.x, s.y - 22, s.hp / STRUCTS[s.type].hp);
    }
  },

  drawDropMarker(c, d) {
    const s = this.toScreen(d.x, d.y);
    if (s.x > 0 && s.x < this.w && s.y > 0 && s.y < this.h) return;
    const cx = this.w / 2, cy = this.h / 2, a = Math.atan2(s.y - cy, s.x - cx);
    const r = Math.min(this.w, this.h) / 2 - 40;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = '#d24b2a'; c.beginPath(); c.moveTo(12, 0); c.lineTo(-6, -8); c.lineTo(-6, 8); c.fill();
    c.restore();
    c.fillStyle = '#f0e8d8'; c.font = '600 12px "PT Sans Narrow", sans-serif'; c.textAlign = 'center';
    c.fillText(Math.round(dist(G.player.x, G.player.y, d.x, d.y) / TILE) + ' м', x, y + 22);
  },

  // Ночной свет: тёмный слой с вырезанными пятнами от огня и факела.
  drawLight(t) {
    const dark = G.darkness();
    const c = this.ctx;
    if (G.flash > 0) { c.fillStyle = 'rgba(255,220,150,.08)'; c.fillRect(0, 0, this.w, this.h); }
    if (dark < 0.02) return;
    const l = this.lctx, W = this.light.width, H = this.light.height, k = this.zoom / 2;
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, W, H);
    l.fillStyle = `rgba(6,10,26,${dark})`;
    l.fillRect(0, 0, W, H);
    l.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a = 1) => {
      const s = this.toScreen(x, y);
      const sx = s.x / 2, sy = s.y / 2, rr = r * k;
      if (sx < -rr || sy < -rr || sx > W + rr || sy > H + rr) return;
      const g = l.createRadialGradient(sx, sy, 0, sx, sy, rr);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.55, `rgba(0,0,0,${a * 0.75})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g; l.beginPath(); l.arc(sx, sy, rr, 0, TAU); l.fill();
    };
    const p = G.player;
    if (!p.dead) {
      const held = G.heldItem();
      const flick = 1 + Math.sin(t * 13) * 0.03 + Math.sin(t * 7.3) * 0.03;
      if (held && ITEMS[held.id].light) hole(p.x + Math.cos(p.ang) * 18, p.y + Math.sin(p.ang) * 18, ITEMS[held.id].light * flick);
      else hole(p.x, p.y, 110, 0.75);
      if (G.flash > 0) hole(p.x, p.y, 260, 0.8);
    }
    for (const s of G.world.structs) {
      if (s.fire && s.fire.on) hole(s.x, s.y, STRUCTS[s.type].light * (1 + Math.sin(t * 11 + s.tx) * 0.04));
    }
    if (G.drop) hole(G.drop.x, G.drop.y, 90, 0.6 + Math.sin(t * 6) * 0.3);
    l.globalCompositeOperation = 'source-over';
    // тёплый отсвет костров
    c.drawImage(this.light, 0, 0, this.w, this.h);
    c.globalCompositeOperation = 'lighter';
    for (const s of G.world.structs) {
      if (!(s.fire && s.fire.on)) continue;
      const sc = this.toScreen(s.x, s.y), r = STRUCTS[s.type].light * this.zoom * 0.8;
      if (sc.x < -r || sc.y < -r || sc.x > this.w + r || sc.y > this.h + r) continue;
      const g = c.createRadialGradient(sc.x, sc.y, 0, sc.x, sc.y, r);
      g.addColorStop(0, `rgba(255,140,40,${0.22 * dark})`); g.addColorStop(1, 'rgba(255,120,30,0)');
      c.fillStyle = g; c.fillRect(sc.x - r, sc.y - r, r * 2, r * 2);
    }
    const held = G.heldItem();
    if (!p.dead && held && ITEMS[held.id].light) {
      const sc = this.toScreen(p.x, p.y), r = 220 * this.zoom;
      const g = c.createRadialGradient(sc.x, sc.y, 0, sc.x, sc.y, r);
      g.addColorStop(0, `rgba(255,150,60,${0.14 * dark})`); g.addColorStop(1, 'rgba(255,120,30,0)');
      c.fillStyle = g; c.fillRect(sc.x - r, sc.y - r, r * 2, r * 2);
    }
    c.globalCompositeOperation = 'source-over';
  },
};
