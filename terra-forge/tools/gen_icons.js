// Rasterises tools/icons.js into a compact palette+alpha format for the Roblox build.
// Usage: node tools/gen_icons.js <out.json>
const { chromium } = require('playwright');
const fs = require('fs');
const { SLOT, UNIT, UI } = require('./icons.js');
const OUT = process.argv[2];
const SIZE = 64, SS = 8, OUTLINE = '#0a0d14';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const result = await p.evaluate(({ SLOT, UNIT, UI, SIZE, SS, OUTLINE }) => {
    const KEYS = [[255,0,0],[0,255,0],[0,0,255],[255,255,0],[255,0,255],[0,255,255],[255,255,255],[0,0,0],[128,0,0],[0,128,0],[0,0,128],[128,128,0],[128,0,128],[0,128,128],[128,128,128],[255,128,0]];
    const key = i => `rgb(${KEYS[i].join(',')})`;
    const hi = SIZE * SS;
    function raster(parts, vb, pad, outline) {
      const pal = [];
      const idx = v => { let i = pal.indexOf(v); if (i < 0) { i = pal.length; pal.push(v); } return i; };
      if (outline) idx(OUTLINE);
      const c = document.createElement('canvas'); c.width = c.height = hi; const x = c.getContext('2d');
      const scale = (hi - 2 * pad * SS) / vb;
      const drawParts = (ctx, colorOf) => {
        ctx.save(); ctx.translate(pad * SS, pad * SS); ctx.scale(scale, scale);
        for (const pt of parts) {
          const path = new Path2D(pt.d);
          if (pt.s) { ctx.strokeStyle = colorOf(pt.s); ctx.lineWidth = pt.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(path); }
          else { ctx.fillStyle = colorOf(pt.f); ctx.fill(path); }
        }
        ctx.restore();
      };
      if (outline) {
        const sil = document.createElement('canvas'); sil.width = sil.height = hi; const sx = sil.getContext('2d');
        drawParts(sx, () => key(0));
        const r = 2.2 * SS;
        for (let a = 0; a < 16; a++) { const ang = a * Math.PI / 8; x.drawImage(sil, Math.cos(ang) * r, Math.sin(ang) * r); }
      }
      drawParts(x, v => key(idx(v)));
      const px = x.getImageData(0, 0, hi, hi).data;
      const out = new Uint8Array(SIZE * SIZE);
      for (let oy = 0; oy < SIZE; oy++) for (let ox = 0; ox < SIZE; ox++) {
        const counts = new Array(16).fill(0); let asum = 0;
        for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) {
          const k = ((oy * SS + dy) * hi + ox * SS + dx) * 4, a = px[k + 3]; asum += a;
          if (a < 128) continue;
          let best = 0, bd = 1e9;
          for (let i = 0; i < pal.length; i++) { const q = KEYS[i], d = (q[0] - px[k]) ** 2 + (q[1] - px[k + 1]) ** 2 + (q[2] - px[k + 2]) ** 2; if (d < bd) { bd = d; best = i; } }
          counts[best]++;
        }
        const a4 = Math.round(asum / (SS * SS) / 255 * 15);
        let bi = 0; for (let i = 1; i < 16; i++) if (counts[i] > counts[bi]) bi = i;
        out[oy * SIZE + ox] = a4 ? (bi << 4) | a4 : 0;
      }
      let bin = ''; for (const v of out) bin += String.fromCharCode(v);
      return { palette: pal, data: btoa(bin) };
    }
    const res = {};
    for (const [name, parts] of Object.entries(UNIT)) res[name] = raster(parts.map(([s, d]) => ({ f: s, d })), 32, 3, true);
    for (const [name, parts] of Object.entries(UI)) res[name] = raster(parts, 24, 1, false);
    return res;
  }, { SLOT, UNIT, UI, SIZE, SS, OUTLINE });
  fs.writeFileSync(OUT, JSON.stringify({ size: SIZE, slots: SLOT, icons: result }));
  console.log('icons', Object.keys(result).length);
  await b.close();
})();
