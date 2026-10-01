'use strict';
// Иконки предметов рисуются на холсте один раз и кэшируются как data URL.

const Icons = (() => {
  const cache = {};
  const S = 64;

  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function blob(c, x, y, r, col, seed, pts = 9) {
    c.beginPath();
    for (let i = 0; i < pts; i++) {
      const a = (i / pts) * TAU, k = 0.78 + hash2(i, seed, 3) * 0.3;
      const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath(); c.fillStyle = col; c.fill();
  }
  function specks(c, col, n, seed, cx = 32, cy = 34, r = 16) {
    c.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const a = hash2(i, seed, 1) * TAU, d = Math.sqrt(hash2(i, seed, 2)) * r;
      c.beginPath(); c.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2 + hash2(i, seed, 4) * 2, 0, TAU); c.fill();
    }
  }
  function handle(c, col = '#8a5a32') {
    c.save(); c.translate(32, 32); c.rotate(-0.78);
    c.fillStyle = col; rr(c, -3.5, -22, 7, 46, 3); c.fill();
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(-3.5, 10, 7, 4);
    c.restore();
  }
  function pouch(c, col, label) {
    c.fillStyle = col; rr(c, 14, 18, 36, 34, 8); c.fill();
    c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(14, 26, 36, 3);
    c.fillStyle = shade(col, 0.7); rr(c, 22, 12, 20, 9, 3); c.fill();
    if (label) { c.fillStyle = '#1a1714'; c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.fillText(label, 32, 46); }
  }
  function wallTile(c, base, line, bricks) {
    c.fillStyle = base; rr(c, 10, 10, 44, 44, 4); c.fill();
    c.strokeStyle = line; c.lineWidth = 2;
    if (bricks) {
      for (let y = 0; y < 4; y++) {
        c.beginPath(); c.moveTo(10, 10 + y * 11); c.lineTo(54, 10 + y * 11); c.stroke();
        for (let x = (y % 2) * 11; x < 44; x += 22) { c.beginPath(); c.moveTo(10 + x, 10 + y * 11); c.lineTo(10 + x, 21 + y * 11); c.stroke(); }
      }
    } else {
      for (let x = 1; x < 4; x++) { c.beginPath(); c.moveTo(10 + x * 11, 10); c.lineTo(10 + x * 11, 54); c.stroke(); }
    }
  }

  const draw = {
    wood(c) { for (let i = 0; i < 3; i++) { const y = 22 + i * 10; c.fillStyle = '#8a5a32'; rr(c, 10, y, 40, 10, 5); c.fill(); c.fillStyle = '#d9b07a'; c.beginPath(); c.arc(50, y + 5, 5, 0, TAU); c.fill(); c.strokeStyle = '#8a5a32'; c.lineWidth = 1; c.beginPath(); c.arc(50, y + 5, 2.5, 0, TAU); c.stroke(); } },
    stone(c) { blob(c, 32, 34, 20, '#8b8780', 1); blob(c, 28, 30, 12, '#a9a59d', 2); },
    metal_ore(c) { blob(c, 32, 34, 20, '#6f6a62', 3); specks(c, '#c97b45', 9, 5); },
    sulfur_ore(c) { blob(c, 32, 34, 20, '#7a7462', 4); specks(c, '#e2cc3b', 9, 6); },
    metal(c) { for (let i = 0; i < 4; i++) { c.save(); c.translate(20 + (i % 2) * 22, 22 + (i >> 1) * 20); c.rotate(i * 0.7); c.fillStyle = i % 2 ? '#9aa1a6' : '#7c8489'; c.beginPath(); c.moveTo(-9, -6); c.lineTo(8, -8); c.lineTo(10, 6); c.lineTo(-6, 8); c.closePath(); c.fill(); c.restore(); } },
    sulfur(c) { c.fillStyle = '#e8d23f'; c.beginPath(); c.moveTo(10, 50); c.quadraticCurveTo(32, 6, 54, 50); c.closePath(); c.fill(); specks(c, '#c4ab1d', 6, 9, 32, 40, 10); },
    charcoal(c) { blob(c, 24, 36, 12, '#2b2826', 7); blob(c, 40, 32, 13, '#3a3633', 8); blob(c, 34, 44, 9, '#221f1d', 9); },
    gunpowder(c) { pouch(c, '#4b4a46'); c.fillStyle = '#1b1a18'; c.beginPath(); c.arc(32, 38, 8, 0, TAU); c.fill(); },
    cloth(c) { c.fillStyle = '#b9a57c'; rr(c, 12, 16, 40, 32, 4); c.fill(); c.strokeStyle = '#8f7c55'; c.lineWidth = 2; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(12, 22 + i * 7); c.lineTo(52, 22 + i * 7); c.stroke(); } },
    scrap(c) { c.strokeStyle = '#9ba3a8'; c.lineWidth = 5; c.beginPath(); c.arc(26, 30, 10, 0, TAU); c.stroke(); c.fillStyle = '#7b6a5a'; c.save(); c.translate(40, 40); c.rotate(0.5); c.fillRect(-10, -4, 20, 8); c.restore(); c.fillStyle = '#c3712f'; c.beginPath(); c.arc(42, 22, 5, 0, TAU); c.fill(); },
    raw_meat(c) { blob(c, 32, 34, 19, '#b5444a', 11); blob(c, 30, 32, 11, '#d6707a', 12); c.fillStyle = '#f2e8dc'; c.beginPath(); c.arc(44, 26, 4, 0, TAU); c.fill(); },
    cooked_meat(c) { blob(c, 32, 34, 19, '#7a4325', 11); blob(c, 30, 32, 11, '#9b5a31', 12); c.strokeStyle = '#4a2814'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(20 + i * 8, 24); c.lineTo(26 + i * 8, 44); c.stroke(); } },
    berries(c) { const p = [[24, 30], [36, 28], [30, 40], [42, 39], [22, 42]]; for (const [x, y] of p) { c.fillStyle = '#3a4b9a'; c.beginPath(); c.arc(x, y, 7, 0, TAU); c.fill(); c.fillStyle = '#7d8fd6'; c.beginPath(); c.arc(x - 2, y - 2, 2, 0, TAU); c.fill(); } c.fillStyle = '#4f7a35'; c.beginPath(); c.ellipse(32, 20, 9, 4, -0.4, 0, TAU); c.fill(); },
    mushroom(c) { c.fillStyle = '#e9dfc8'; rr(c, 27, 30, 10, 20, 4); c.fill(); c.fillStyle = '#a8442c'; c.beginPath(); c.ellipse(32, 30, 18, 12, 0, Math.PI, 0); c.fill(); c.fillStyle = '#f0e2c4'; specks(c, '#f0e2c4', 4, 2, 32, 24, 9); },
    canned(c) { c.fillStyle = '#9aa1a6'; rr(c, 16, 14, 32, 38, 5); c.fill(); c.fillStyle = '#b34a2c'; c.fillRect(16, 24, 32, 18); c.fillStyle = '#f2e3c4'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText('МЯСО', 32, 37); },
    water_bottle(c) { c.fillStyle = '#5f9fc2'; rr(c, 20, 18, 24, 36, 7); c.fill(); c.fillStyle = '#2d6d93'; c.fillRect(26, 9, 12, 10); c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(24, 24, 4, 24); },
    bandage(c) { c.fillStyle = '#efe9dd'; rr(c, 10, 24, 44, 18, 6); c.fill(); c.fillStyle = '#c8bfae'; for (let i = 0; i < 4; i++) c.fillRect(16 + i * 10, 24, 2, 18); c.fillStyle = '#b8323a'; c.fillRect(28, 26, 8, 14); },
    medkit(c) { c.fillStyle = '#d8d2c4'; rr(c, 10, 16, 44, 36, 6); c.fill(); c.fillStyle = '#b8323a'; c.fillRect(28, 22, 8, 24); c.fillRect(20, 30, 24, 8); c.fillStyle = '#8f8a7e'; c.fillRect(24, 11, 16, 6); },
    rock(c) { blob(c, 32, 34, 18, '#8b8780', 21); blob(c, 28, 30, 9, '#a9a59d', 22); },
    torch(c) { handle(c); c.save(); c.translate(32, 32); c.rotate(-0.78); c.fillStyle = '#d9c7a0'; c.fillRect(-5, -26, 10, 9); c.fillStyle = '#ff9a2e'; c.beginPath(); c.ellipse(0, -32, 7, 10, 0, 0, TAU); c.fill(); c.fillStyle = '#ffe07a'; c.beginPath(); c.ellipse(0, -30, 3.5, 6, 0, 0, TAU); c.fill(); c.restore(); },
    stone_hatchet(c) { handle(c); c.save(); c.translate(32, 32); c.rotate(-0.78); blob(c, 8, -16, 11, '#8b8780', 31, 7); c.restore(); },
    stone_pickaxe(c) { handle(c); c.save(); c.translate(32, 32); c.rotate(-0.78); c.fillStyle = '#8b8780'; c.beginPath(); c.moveTo(-20, -14); c.quadraticCurveTo(0, -26, 20, -14); c.lineTo(16, -11); c.quadraticCurveTo(0, -18, -16, -11); c.closePath(); c.fill(); c.restore(); },
    salvaged_axe(c) { handle(c, '#5d5a55'); c.save(); c.translate(32, 32); c.rotate(-0.78); c.fillStyle = '#a9b0b5'; c.beginPath(); c.moveTo(2, -24); c.lineTo(20, -28); c.lineTo(22, -6); c.lineTo(2, -10); c.closePath(); c.fill(); c.fillStyle = '#c3712f'; c.fillRect(-1, -24, 6, 6); c.restore(); },
    salvaged_pick(c) { handle(c, '#5d5a55'); c.save(); c.translate(32, 32); c.rotate(-0.78); c.fillStyle = '#a9b0b5'; c.beginPath(); c.moveTo(-22, -12); c.lineTo(0, -24); c.lineTo(22, -12); c.lineTo(0, -18); c.closePath(); c.fill(); c.restore(); },
    hammer(c) { handle(c); c.save(); c.translate(32, 32); c.rotate(-0.78); c.fillStyle = '#9b7a52'; rr(c, -12, -28, 24, 12, 3); c.fill(); c.restore(); },
    spear(c) { c.save(); c.translate(32, 32); c.rotate(-0.78); c.fillStyle = '#8a5a32'; rr(c, -2.5, -26, 5, 54, 2); c.fill(); c.fillStyle = '#c9a97a'; c.beginPath(); c.moveTo(0, -31); c.lineTo(4, -22); c.lineTo(-4, -22); c.closePath(); c.fill(); c.restore(); },
    machete(c) { c.save(); c.translate(32, 32); c.rotate(-0.78); c.fillStyle = '#3d3a36'; rr(c, -3, 10, 6, 16, 2); c.fill(); c.fillStyle = '#b6bdc2'; c.beginPath(); c.moveTo(-4, 10); c.lineTo(-5, -22); c.quadraticCurveTo(2, -30, 7, -24); c.lineTo(4, 10); c.closePath(); c.fill(); c.restore(); },
    bow(c) { c.strokeStyle = '#8a5a32'; c.lineWidth = 5; c.beginPath(); c.arc(18, 32, 24, -1.15, 1.15); c.stroke(); c.strokeStyle = '#e8e0cc'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(18 + Math.cos(-1.15) * 24, 32 + Math.sin(-1.15) * 24); c.lineTo(18 + Math.cos(1.15) * 24, 32 + Math.sin(1.15) * 24); c.stroke(); },
    revolver(c) { c.fillStyle = '#4a4744'; rr(c, 10, 22, 38, 9, 3); c.fill(); c.fillStyle = '#5d5955'; c.beginPath(); c.arc(30, 30, 8, 0, TAU); c.fill(); c.fillStyle = '#6b4a2e'; c.beginPath(); c.moveTo(38, 30); c.lineTo(50, 30); c.lineTo(54, 50); c.lineTo(42, 50); c.closePath(); c.fill(); },
    shotgun(c) { c.save(); c.translate(32, 32); c.rotate(-0.5); c.fillStyle = '#5d5955'; rr(c, -28, -4, 40, 7, 3); c.fill(); c.fillStyle = '#7a5434'; c.beginPath(); c.moveTo(10, -5); c.lineTo(28, -2); c.lineTo(28, 10); c.lineTo(10, 4); c.closePath(); c.fill(); c.fillStyle = '#c3712f'; c.fillRect(-10, -5, 5, 9); c.restore(); },
    arrow(c) { c.save(); c.translate(32, 32); c.rotate(-0.78); c.fillStyle = '#c9a97a'; c.fillRect(-1.5, -24, 3, 48); c.fillStyle = '#8b8780'; c.beginPath(); c.moveTo(0, -30); c.lineTo(5, -20); c.lineTo(-5, -20); c.closePath(); c.fill(); c.fillStyle = '#e8e0cc'; c.fillRect(-5, 16, 10, 8); c.restore(); },
    pistol_ammo(c) { for (let i = 0; i < 3; i++) { const x = 18 + i * 12; c.fillStyle = '#c99a3a'; rr(c, x, 26, 9, 24, 2); c.fill(); c.fillStyle = '#9aa1a6'; c.beginPath(); c.ellipse(x + 4.5, 26, 4.5, 7, 0, Math.PI, 0); c.fill(); } },
    shell(c) { for (let i = 0; i < 2; i++) { const x = 18 + i * 16; c.fillStyle = '#b8323a'; rr(c, x, 18, 13, 26, 2); c.fill(); c.fillStyle = '#c99a3a'; c.fillRect(x, 40, 13, 10); } },
    burlap(c) { c.fillStyle = '#a8946a'; c.beginPath(); c.moveTo(14, 18); c.lineTo(26, 12); c.lineTo(38, 12); c.lineTo(50, 18); c.lineTo(54, 30); c.lineTo(46, 30); c.lineTo(46, 54); c.lineTo(18, 54); c.lineTo(18, 30); c.lineTo(10, 30); c.closePath(); c.fill(); c.strokeStyle = '#7e6c48'; c.lineWidth = 2; c.stroke(); },
    wood_armor(c) { c.fillStyle = '#8a5a32'; rr(c, 14, 12, 36, 42, 6); c.fill(); c.strokeStyle = '#5e3c20'; c.lineWidth = 2; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(14 + i * 9, 12); c.lineTo(14 + i * 9, 54); c.stroke(); } c.fillStyle = '#3a2a1a'; c.fillRect(14, 30, 36, 4); },
    metal_armor(c) { c.fillStyle = '#8c9398'; rr(c, 14, 12, 36, 42, 8); c.fill(); c.fillStyle = '#b6bdc2'; rr(c, 20, 18, 24, 14, 4); c.fill(); c.fillStyle = '#c3712f'; c.beginPath(); c.arc(22, 46, 3, 0, TAU); c.arc(42, 46, 3, 0, TAU); c.fill(); },
    wood_wall(c) { wallTile(c, '#8a5a32', '#5e3c20', false); },
    stone_wall(c) { wallTile(c, '#8b8780', '#5d5a55', true); },
    wood_door(c) { wallTile(c, '#7a4e2b', '#4e301a', false); c.fillStyle = '#c99a3a'; c.beginPath(); c.arc(44, 34, 3.5, 0, TAU); c.fill(); },
    campfire(c) { for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; blob(c, 32 + Math.cos(a) * 18, 36 + Math.sin(a) * 14, 6, '#7d7a74', 40 + i, 6); } c.fillStyle = '#ff8a2a'; c.beginPath(); c.ellipse(32, 32, 9, 14, 0, 0, TAU); c.fill(); c.fillStyle = '#ffd36a'; c.beginPath(); c.ellipse(32, 35, 4, 7, 0, 0, TAU); c.fill(); },
    furnace(c) { c.fillStyle = '#7d7a74'; rr(c, 12, 10, 40, 44, 6); c.fill(); c.fillStyle = '#2a2523'; rr(c, 20, 32, 24, 14, 3); c.fill(); c.fillStyle = '#ff8a2a'; c.fillRect(22, 38, 20, 6); c.fillStyle = '#5d5a55'; c.fillRect(26, 4, 12, 8); },
    box(c) { c.fillStyle = '#9b6a3e'; rr(c, 10, 16, 44, 34, 3); c.fill(); c.fillStyle = '#6e4626'; c.fillRect(10, 26, 44, 4); c.fillRect(28, 16, 8, 34); c.fillStyle = '#c99a3a'; c.fillRect(29, 28, 6, 6); },
    sleeping_bag(c) { c.fillStyle = '#3e6b6a'; rr(c, 18, 8, 28, 48, 10); c.fill(); c.fillStyle = '#d8d2c4'; rr(c, 21, 11, 22, 12, 6); c.fill(); c.strokeStyle = '#2b4c4b'; c.lineWidth = 2; c.beginPath(); c.moveTo(18, 30); c.lineTo(46, 30); c.stroke(); },
    workbench(c) { c.fillStyle = '#8a5a32'; rr(c, 8, 18, 48, 16, 3); c.fill(); c.fillStyle = '#5e3c20'; c.fillRect(12, 34, 6, 18); c.fillRect(46, 34, 6, 18); c.fillStyle = '#9aa1a6'; c.fillRect(16, 12, 14, 6); c.fillStyle = '#c3712f'; c.fillRect(36, 10, 6, 8); },
    barricade(c) { c.fillStyle = '#8a5a32'; c.fillRect(8, 38, 48, 8); c.fillStyle = '#c9a97a'; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(10 + i * 10, 40); c.lineTo(14 + i * 10, 12); c.lineTo(18 + i * 10, 40); c.closePath(); c.fill(); } },
  };

  function get(id) {
    if (cache[id]) return cache[id];
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowOffsetY = 2; c.shadowBlur = 3;
    (draw[id] || ((cc) => { cc.fillStyle = '#c3712f'; rr(cc, 14, 14, 36, 36, 6); cc.fill(); }))(c);
    cache[id] = cv.toDataURL();
    return cache[id];
  }
  return { get };
})();
