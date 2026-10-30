// Draws the top-down sprites (units, turrets, buildings, effects) and packs them into two
// 1024 x 1024 atlases: atlas_base.png holds everything except the team-coloured parts, and
// atlas_team.png holds those parts in grey, to be tinted with ImageColor3 in game.
// Units face up. Also writes the cell layout to src/shared/SpriteData.luau.
// Usage: node tools/gen_sprites.js OUT_DIR
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2];
const ROOT = path.dirname(__dirname);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const result = await page.evaluate(() => {
    const SS = 4; // supersampling
    const C = {
      outline: '#14171c', track: '#2a2d32', tread: '#4b5058', metalHi: '#c3cad2', metal: '#929aa4',
      metalLo: '#5f6670', concrete: '#a3a7a8', concreteLo: '#7e8385', glass: '#8fd6ff', olive: '#5d6b46',
      glow: '#ffb44a', green: '#5dffb0', skin: '#e2b48a', black: '#101215', hazard: '#f2c230',
    };

    // a painter draws one sprite in one of three passes: shadow, base (no team parts) or team (only them)
    function painter(ctx, pass, unit, span) {
      const P = {};
      const s = unit * SS;
      const tr = (fn) => { ctx.save(); ctx.scale(s, s); fn(); ctx.restore(); };
      const shape = (build) => { const p = new Path2D(); build(p); return p; };
      P.rect = (x, y, w, h) => shape(p => p.rect(x, y, w, h));
      P.round = (x, y, w, h, r) => shape(p => p.roundRect(x, y, w, h, r));
      P.circle = (x, y, r) => shape(p => p.arc(x, y, r, 0, Math.PI * 2));
      P.ellipse = (x, y, rx, ry, rot = 0) => shape(p => p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2));
      P.poly = (pts) => shape(p => { p.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]); p.closePath(); });
      P.ngon = (x, y, r, n, rot = 0) => { const pts = []; for (let i = 0; i < n; i++) { const a = rot + i * Math.PI * 2 / n; pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r); } return P.poly(pts); };
      // a vertical gradient in sprite units
      P.vgrad = (y0, y1, c0, c1) => { const g = ctx.createLinearGradient(0, y0 * s, 0, y1 * s); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; };
      P.rgrad = (x, y, r, c0, c1) => { const g = ctx.createRadialGradient((x - r * 0.3) * s, (y - r * 0.3) * s, 0, x * s, y * s, r * s); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; };
      const grey = (v) => `rgb(${v},${v},${v})`;
      // a normal part: drawn in the base pass, cut out of the team pass
      P.fill = (p, color, stroke = C.outline, lw = 1.1) => {
        if (pass === 'shadow') return;
        ctx.save(); ctx.scale(s, s);
        if (pass === 'team') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = '#000'; ctx.fill(p);
          if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = '#000'; ctx.stroke(p); }
        } else {
          ctx.fillStyle = typeof color === 'function' ? color() : color; ctx.fill(p);
          if (stroke) { ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.strokeStyle = stroke; ctx.stroke(p); }
        }
        ctx.restore();
      };
      // a team-coloured part: grey shades in the team pass, cut out of the base pass
      P.team = (p, light = 235, dark = 160, stroke = C.outline, lw = 1.1) => {
        if (pass === 'shadow') return;
        ctx.save(); ctx.scale(s, s);
        if (pass === 'team') {
          const g = ctx.createLinearGradient(0, 0, 0, span);
          g.addColorStop(0, grey(light)); g.addColorStop(1, grey(dark));
          ctx.fillStyle = g; ctx.fill(p);
        } else {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = '#000'; ctx.fill(p);
          ctx.globalCompositeOperation = 'source-over';
          if (stroke) { ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.strokeStyle = stroke; ctx.stroke(p); }
        }
        if (pass === 'team' && stroke) { ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = lw; ctx.strokeStyle = '#000'; ctx.stroke(p); }
        ctx.restore();
      };
      // a soft shadow cast to the bottom right
      P.shadow = (p, off = 3, blur = 3, alpha = 0.42) => {
        if (pass !== 'shadow') return;
        ctx.save();
        ctx.filter = `blur(${blur * SS}px)`;
        ctx.translate(off * SS, off * SS); ctx.scale(s, s);
        ctx.fillStyle = `rgba(0,0,0,${alpha})`; ctx.fill(p);
        ctx.restore();
      };
      P.line = (pts, color, lw) => {
        if (pass === 'shadow') return;
        ctx.save(); ctx.scale(s, s);
        const p = new Path2D(); p.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
        if (pass === 'team') { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = '#000'; } else ctx.strokeStyle = color;
        ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke(p);
        ctx.restore();
      };
      P.C = C;
      return P;
    }

    const SPR = {};
    const u = (name, size, draw) => { SPR[name] = { size, draw }; };

    // ---------------------------------------------------------------- units (64 units, facing up)
    const tracks = (P, x0, x1, y0, y1) => {
      for (const x of [x0, x1]) {
        P.fill(P.round(x, y0, 8, y1 - y0, 2), P.C.track);
        for (let y = y0 + 1.5; y < y1 - 1; y += 3) P.fill(P.rect(x + 1, y, 6, 1.1), P.C.tread, null);
      }
    };
    u('tank', 1, P => {
      P.shadow(P.round(16, 10, 32, 44, 4));
      tracks(P, 16, 40, 10, 54);
      P.team(P.round(22, 13, 20, 38, 3), 240, 170);
      P.team(P.poly([22, 16, 25, 10, 39, 10, 42, 16]), 255, 225);
      P.fill(P.rect(25, 42, 14, 8), P.C.metalLo);
      for (let i = 0; i < 3; i++) P.fill(P.rect(26, 43.5 + i * 2.2, 12, 1), P.C.black, null);
    });
    u('tank_gun', 1, P => {
      P.shadow(P.circle(32, 33, 10), 3, 2);
      P.fill(P.rect(30.3, 4, 3.4, 26), () => P.vgrad(4, 30, P.C.metalLo, P.C.metal));
      P.fill(P.rect(29.2, 3, 5.6, 4), P.C.metalLo);
      P.team(P.ngon(32, 33, 10, 8, Math.PI / 8), 255, 190);
      P.fill(P.circle(35.5, 36, 3), P.C.metal);
      P.fill(P.rect(27, 28, 3, 6), P.C.metalLo, null);
    });
    u('scout', 1, P => {
      P.shadow(P.round(18, 12, 28, 40, 6));
      for (const [x, y] of [[17, 15], [41, 15], [17, 37], [41, 37]]) P.fill(P.round(x, y, 6, 11, 2), P.C.track);
      P.team(P.round(21, 12, 22, 38, 6), 240, 170);
      P.fill(P.poly([24, 18, 40, 18, 38, 24, 26, 24]), P.C.glass);
      P.fill(P.rect(25, 40, 14, 8), P.C.metalLo);
    });
    u('scout_gun', 1, P => {
      P.shadow(P.circle(32, 32, 6), 2, 2);
      P.fill(P.rect(31, 14, 2.2, 16), P.C.metalLo);
      P.fill(P.circle(32, 32, 5.5), P.C.metal);
      P.fill(P.circle(32, 32, 2.2), P.C.metalLo, null);
    });
    u('artillery', 1, P => {
      P.shadow(P.round(16, 12, 32, 42, 4));
      tracks(P, 16, 40, 12, 54);
      P.team(P.round(22, 14, 20, 38, 3), 230, 160);
      P.fill(P.rect(25, 44, 14, 6), P.C.metalLo);
      P.fill(P.round(26, 16, 12, 6, 2), P.C.olive);
    });
    u('artillery_gun', 1, P => {
      P.shadow(P.round(27, 2, 10, 40, 4), 3, 2);
      P.fill(P.rect(30, 1, 4, 32), () => P.vgrad(0, 33, P.C.metalLo, P.C.metalHi));
      P.fill(P.rect(28.5, 1, 7, 4), P.C.metalLo);
      P.team(P.round(25, 28, 14, 14, 4), 250, 190);
      P.fill(P.rect(29, 33, 6, 6), P.C.metal);
    });
    const soldier = (P, x, y, gun = true) => {
      P.shadow(P.ellipse(x, y, 7.5, 6), 2.5, 2);
      if (gun) P.fill(P.round(x + 3.2, y - 13, 2.4, 13, 1), P.C.black, null);
      P.team(P.ellipse(x, y + 0.8, 7.6, 5.2), 245, 150);
      P.fill(P.circle(x, y, 4.2), () => P.rgrad(x, y, 4.2, '#8a9a66', P.C.olive));
    };
    u('infantry', 1, P => { soldier(P, 20, 43); soldier(P, 44, 43); soldier(P, 32, 22); });
    u('rocket', 1, P => {
      for (const x of [21, 43]) {
        soldier(P, x, 38, false);
        P.fill(P.round(x + 3.5, 17, 5, 24, 2), P.C.olive);
        P.fill(P.rect(x + 3.5, 16, 5, 3.5), P.C.glow, null);
      }
    });
    u('fighter', 1, P => {
      const body = P.poly([32, 3, 36, 14, 36, 48, 33.5, 58, 30.5, 58, 28, 48, 28, 14]);
      const wingL = P.poly([28, 24, 5, 43, 6, 48, 28, 41]);
      const wingR = P.poly([36, 24, 59, 43, 58, 48, 36, 41]);
      const tailL = P.poly([28, 48, 17, 57, 18, 59, 29, 55]);
      const tailR = P.poly([36, 48, 47, 57, 46, 59, 35, 55]);
      for (const p of [body, wingL, wingR]) P.shadow(p, 7, 3, 0.3);
      P.fill(wingL, P.C.metal); P.fill(wingR, P.C.metal);
      P.team(P.poly([6, 43, 12, 39, 12, 46, 6, 48]), 240, 200, null);
      P.team(P.poly([58, 43, 52, 39, 52, 46, 58, 48]), 240, 200, null);
      P.fill(tailL, P.C.metalLo); P.fill(tailR, P.C.metalLo);
      P.team(body, 245, 175);
      P.fill(P.ellipse(32, 18, 2.6, 6), P.C.glass);
      P.fill(P.circle(32, 58.5, 2.4), P.C.glow, null);
    });
    u('gunship', 1, P => {
      P.shadow(P.ellipse(32, 32, 10, 16), 7, 3, 0.3);
      P.fill(P.rect(30.5, 40, 3, 20), P.C.metalLo);
      P.fill(P.rect(26, 57, 12, 2.5), P.C.metal);
      P.fill(P.round(17, 29, 30, 4.5, 2), P.C.metalLo);
      for (const x of [18, 42]) P.fill(P.round(x, 26, 4, 10, 2), P.C.olive);
      P.team(P.ellipse(32, 31, 8.5, 14), 245, 175);
      P.fill(P.ellipse(32, 21, 5, 5.5), P.C.glass);
    });
    u('rotor', 1, P => {
      P.fill(P.round(2, 30.5, 60, 3, 1.5), 'rgba(40,44,50,0.75)', null);
      P.fill(P.round(30.5, 2, 3, 60, 1.5), 'rgba(40,44,50,0.75)', null);
      P.fill(P.circle(32, 32, 3), P.C.metal);
    });
    u('explosion', 1, P => {
      const blobs = [[32, 32, 20], [22, 26, 11], [42, 25, 12], [40, 41, 11], [24, 41, 10]];
      for (const [x, y, r] of blobs) P.fill(P.circle(x, y, r), () => P.rgrad(x, y, r, '#fff6c0', '#ff8a1c'), null);
      for (const [x, y, r] of blobs) P.fill(P.circle(x, y, r * 0.55), 'rgba(255,255,220,0.8)', null);
      P.fill(P.circle(32, 32, 24), 'rgba(80,40,20,0)', 'rgba(60,40,30,0.35)', 3);
    });
    u('scorch', 1, P => {
      P.fill(P.ellipse(32, 32, 22, 17), 'rgba(20,16,12,0.55)', null);
      P.fill(P.ellipse(30, 33, 13, 10), 'rgba(10,8,6,0.5)', null);
    });

    // ---------------------------------------------------------------- buildings (128 units, footprint = cell)
    u('cc', 2, P => {
      P.shadow(P.ngon(64, 64, 58, 8, Math.PI / 8), 5, 5);
      P.fill(P.ngon(64, 64, 58, 8, Math.PI / 8), () => P.vgrad(6, 122, P.C.concrete, P.C.concreteLo), P.C.outline, 1.6);
      for (const [x, y] of [[22, 22], [106, 22], [22, 106], [106, 106]]) {
        P.fill(P.circle(x, y, 11), P.C.metal, P.C.outline, 1.4);
        P.team(P.circle(x, y, 6), 255, 200);
      }
      P.team(P.ngon(64, 64, 44, 8, Math.PI / 8), 225, 160, P.C.outline, 1.4);
      P.fill(P.ngon(64, 64, 34, 8, Math.PI / 8), P.C.metalLo, P.C.outline, 1.2);
      P.fill(P.circle(64, 64, 26), () => P.rgrad(64, 64, 26, P.C.metalHi, P.C.metal), P.C.outline, 1.4);
      P.team(P.circle(64, 64, 15), 255, 200);
      P.fill(P.circle(64, 64, 5), P.C.glass);
      P.fill(P.rect(56, 98, 16, 10), P.C.black);
      P.line([64, 64, 88, 40], P.C.metalHi, 2);
      P.fill(P.circle(88, 40, 3), '#ff4a3a', null);
    });
    u('extractor', 2, P => {
      P.shadow(P.circle(64, 64, 44), 4, 4);
      for (const a of [0.8, 2.35, 3.9, 5.5]) P.fill(P.round(64 + Math.cos(a) * 38 - 7, 64 + Math.sin(a) * 38 - 7, 14, 14, 3), P.C.metalLo);
      P.fill(P.circle(64, 64, 36), () => P.vgrad(28, 100, P.C.metalHi, P.C.metal), P.C.outline, 1.4);
      P.team(P.circle(64, 64, 26), 240, 170);
      P.fill(P.circle(64, 64, 15), P.C.metalLo);
      P.fill(P.circle(64, 64, 9), () => P.rgrad(64, 64, 9, '#e8fff4', P.C.green), null);
      P.fill(P.round(92, 30, 20, 30, 5), P.C.metal);
      P.line([84, 52, 98, 42], P.C.metalLo, 4);
    });
    u('barracks', 2, P => {
      P.shadow(P.round(14, 18, 100, 92, 6), 5, 4);
      P.fill(P.round(10, 14, 108, 100, 8), P.C.concreteLo, P.C.outline, 1.4);
      P.fill(P.round(20, 24, 88, 58, 4), () => P.vgrad(24, 82, '#7c8a62', '#5a6646'), P.C.outline, 1.4);
      for (let i = 0; i < 4; i++) P.team(P.rect(24 + i * 22, 28, 14, 50), 230, 170, null);
      P.fill(P.rect(54, 82, 20, 14), P.C.black);
      for (let i = 0; i < 6; i++) P.fill(P.round(18 + i * 16, 100, 13, 7, 3), '#b59c6b');
    });
    u('tankf', 2, P => {
      P.shadow(P.round(10, 10, 108, 108, 6), 5, 5);
      P.fill(P.round(6, 6, 116, 116, 6), P.C.concreteLo, P.C.outline, 1.4);
      P.fill(P.round(14, 12, 100, 74, 4), () => P.vgrad(12, 86, P.C.metalHi, P.C.metal), P.C.outline, 1.4);
      P.team(P.rect(14, 30, 100, 12), 235, 175);
      P.team(P.rect(14, 58, 100, 6), 235, 175, null);
      for (const x of [28, 52, 76, 100]) P.fill(P.circle(x, 20, 5), P.C.metalLo);
      P.fill(P.rect(34, 86, 60, 30), P.C.black);
      for (let i = 0; i < 6; i++) P.fill(P.poly([34 + i * 10, 86, 40 + i * 10, 86, 34 + i * 10 + 10, 92, 34 + i * 10 + 4, 92]), P.C.hazard, null);
      P.fill(P.round(98, 92, 14, 20, 3), '#8a5a44');
    });
    u('air', 2, P => {
      P.shadow(P.round(10, 10, 108, 108, 6), 5, 5);
      P.fill(P.round(6, 6, 116, 116, 6), () => P.vgrad(6, 122, '#7a7f84', '#5c6166'), P.C.outline, 1.4);
      P.fill(P.circle(64, 64, 40), '#4d5257', '#e8e8e8', 2);
      P.line([50, 46, 50, 82], '#f2f2f2', 5); P.line([78, 46, 78, 82], '#f2f2f2', 5); P.line([50, 64, 78, 64], '#f2f2f2', 5);
      for (const [x, y] of [[16, 16], [112, 16], [16, 112], [112, 112]]) P.team(P.circle(x, y, 5), 255, 220);
      P.team(P.rect(6, 56, 8, 16), 235, 180, null); P.team(P.rect(114, 56, 8, 16), 235, 180, null);
    });
    u('tower', 2, P => {
      P.shadow(P.ngon(64, 64, 46, 8, Math.PI / 8), 4, 4);
      P.fill(P.ngon(64, 64, 46, 8, Math.PI / 8), () => P.vgrad(18, 110, P.C.concrete, P.C.concreteLo), P.C.outline, 1.4);
      P.team(P.ngon(64, 64, 34, 8, Math.PI / 8), 225, 160);
      P.fill(P.circle(64, 64, 24), P.C.metalLo);
    });
    u('tower_gun', 1, P => {
      P.shadow(P.circle(32, 33, 12), 3, 2);
      P.fill(P.rect(28, 3, 3, 24), P.C.metalLo); P.fill(P.rect(33, 3, 3, 24), P.C.metalLo);
      P.fill(P.round(24, 22, 16, 20, 4), () => P.vgrad(22, 42, P.C.metalHi, P.C.metal));
      P.team(P.rect(26, 34, 12, 5), 250, 200, null);
    });
    u('aa', 2, P => {
      P.shadow(P.circle(64, 64, 46), 4, 4);
      P.fill(P.circle(64, 64, 46), () => P.vgrad(18, 110, P.C.concrete, P.C.concreteLo), P.C.outline, 1.4);
      P.team(P.circle(64, 64, 34), 225, 160);
      P.fill(P.circle(64, 64, 22), P.C.metalLo);
    });
    u('aa_gun', 1, P => {
      P.shadow(P.circle(32, 32, 11), 3, 2);
      for (const x of [25, 30, 35, 40]) P.fill(P.rect(x - 1, 6, 2.2, 22), P.C.metalLo, null);
      P.fill(P.round(22, 24, 20, 16, 5), P.C.metal);
      P.team(P.circle(32, 32, 5), 255, 210);
      P.fill(P.ellipse(32, 46, 7, 3.5), P.C.metalHi);
    });
    u('fabricator', 2, P => {
      P.shadow(P.round(14, 14, 100, 100, 10), 5, 4);
      P.fill(P.round(10, 10, 108, 108, 10), () => P.vgrad(10, 118, P.C.metalHi, P.C.metal), P.C.outline, 1.4);
      for (const [x, y] of [[18, 18], [86, 18], [18, 86], [86, 86]]) P.team(P.round(x, y, 24, 24, 5), 235, 170);
      P.fill(P.circle(64, 64, 28), P.C.metalLo, P.C.outline, 1.4);
      P.fill(P.circle(64, 64, 18), () => P.rgrad(64, 64, 18, '#f4fffc', '#3ee0d0'), null);
    });

    // ---------------------------------------------------------------- packing
    const ATLAS = 1024;
    const base = document.createElement('canvas'); base.width = base.height = ATLAS;
    const team = document.createElement('canvas'); team.width = team.height = ATLAS;
    const bx = base.getContext('2d'), tx = team.getContext('2d');
    // units are drawn on a 64-unit grid into 128 px cells (two rows at the top),
    // buildings on a 128-unit grid into 256 px cells below them
    const SMALL = 128, BIG = 256;
    const cells = {};
    let xs = 0, ys = 0, xb = 0, yb = 2 * SMALL;
    for (const [name, spr] of Object.entries(SPR)) {
      const px = spr.size === 1 ? SMALL : BIG;
      let cx, cy;
      if (px === SMALL) { cx = xs; cy = ys; xs += SMALL; if (xs >= ATLAS) { xs = 0; ys += SMALL; } }
      else { cx = xb; cy = yb; xb += BIG; if (xb >= ATLAS) { xb = 0; yb += BIG; } }
      const unit = px / (spr.size === 1 ? 64 : 128);
      const render = (pass) => {
        const c = document.createElement('canvas'); c.width = c.height = px * SS; const ctx = c.getContext('2d');
        spr.draw(painter(ctx, pass, unit, px / unit));
        return c;
      };
      const shadow = render('shadow'), b = render('base'), t = render('team');
      const comp = document.createElement('canvas'); comp.width = comp.height = px * SS; const cc = comp.getContext('2d');
      cc.drawImage(shadow, 0, 0); cc.drawImage(b, 0, 0);
      bx.imageSmoothingQuality = 'high'; tx.imageSmoothingQuality = 'high';
      bx.drawImage(comp, cx, cy, px, px);
      tx.drawImage(t, cx, cy, px, px);
      cells[name] = [cx, cy, px];
    }
    // preview: everything tinted green and red on grass
    const prev = document.createElement('canvas'); prev.width = ATLAS; prev.height = ATLAS; const pv = prev.getContext('2d');
    pv.fillStyle = '#5e9a3c'; pv.fillRect(0, 0, ATLAS, ATLAS);
    const tinted = (color) => {
      const c = document.createElement('canvas'); c.width = c.height = ATLAS; const x = c.getContext('2d');
      x.drawImage(team, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = color; x.fillRect(0, 0, ATLAS, ATLAS);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(team, 0, 0); return c;
    };
    pv.drawImage(base, 0, 0); pv.drawImage(tinted('#3fae4a'), 0, 0);
    return { base: base.toDataURL('image/png'), team: team.toDataURL('image/png'), preview: prev.toDataURL('image/png'), cells };
  });
  const save = (name, url) => fs.writeFileSync(path.join(OUT, name), Buffer.from(url.split(',')[1], 'base64'));
  fs.mkdirSync(OUT, { recursive: true });
  save('atlas_base.png', result.base);
  save('atlas_team.png', result.team);
  save('atlas_preview.png', result.preview);
  const lines = ['-- Generated by tools/gen_sprites.js. Do not edit by hand.',
    '-- Sprite cells in the atlases: x, y, size in pixels. Units face up.', 'return {'];
  for (const [name, [x, y, s]] of Object.entries(result.cells)) lines.push(`\t${name} = { ${x}, ${y}, ${s} },`);
  lines.push('}', '');
  fs.writeFileSync(path.join(ROOT, 'src', 'shared', 'SpriteData.luau'), lines.join('\n'));
  console.log('sprites', Object.keys(result.cells).length);
  await browser.close();
})();
