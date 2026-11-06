/* «Модели» юнитов и зданий: рисуются кодом из простых фигур, цвет команды подставляется сам.
   Ноль = смотрит вправо (+x). Свой PNG вместо модели — поле image в config.js. */
const Sprites = (() => {
  const METAL = '#2b3038', METAL2 = '#3a414b', DARK = '#1a1d22', HAZARD = '#e8b931';
  const images = {};

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const m = (c) => Math.round(f >= 0 ? c + (255 - c) * f : c * (1 + f));
    return `rgb(${m(r)},${m(g)},${m(b)})`;
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
  }
  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

  function tracks(ctx, r, len, t, moving) {
    ctx.fillStyle = DARK;
    rr(ctx, -len, -r, len * 2, r * 0.45, 2); rr(ctx, -len, r * 0.55, len * 2, r * 0.45, 2);
    ctx.fillStyle = '#4a515c'; // звенья гусениц бегут, когда юнит едет
    const off = moving ? (t * 30) % 5 : 0;
    for (let x = -len + off; x < len; x += 5) { ctx.fillRect(x, -r, 1.5, r * 0.45); ctx.fillRect(x, r * 0.55, 1.5, r * 0.45); }
  }

  function barrel(ctx, from, len, w, recoil) {
    ctx.fillStyle = METAL2;
    ctx.fillRect(from - recoil * 3, -w / 2, len, w);
    ctx.fillStyle = DARK;
    ctx.fillRect(from + len - 3 - recoil * 3, -w / 2 - 0.5, 3, w + 1);
  }

  /* ---------- юниты: body рисуется в повороте корпуса, turret — в повороте башни ---------- */
  const UNITS = {
    tank: {
      body(ctx, r, c, t, e) { tracks(ctx, r, r * 1.1, t, e.path && e.path.length); ctx.fillStyle = shade(c, -0.25); rr(ctx, -r * 0.95, -r * 0.6, r * 1.9, r * 1.2, 3); ctx.fillStyle = shade(c, 0.1); ctx.fillRect(r * 0.55, -r * 0.5, r * 0.3, r); },
      turret(ctx, r, c, t, e) { barrel(ctx, r * 0.3, r * 1.2, 3.5, e.recoil); ctx.fillStyle = c; circle(ctx, 0, 0, r * 0.52); ctx.fillStyle = shade(c, 0.35); circle(ctx, -r * 0.12, -r * 0.12, r * 0.18); },
    },
    artillery: {
      body(ctx, r, c, t, e) { tracks(ctx, r, r * 1.2, t, e.path && e.path.length); ctx.fillStyle = shade(c, -0.3); rr(ctx, -r * 1.1, -r * 0.62, r * 2.1, r * 1.24, 2); ctx.fillStyle = HAZARD; ctx.fillRect(-r * 1.1, -r * 0.62, r * 0.25, r * 1.24); },
      turret(ctx, r, c, t, e) { barrel(ctx, 0, r * 1.9, 4.5, e.recoil * 1.5); ctx.fillStyle = c; rr(ctx, -r * 0.6, -r * 0.5, r * 1.1, r, 2); ctx.fillStyle = shade(c, -0.4); ctx.fillRect(-r * 0.45, -r * 0.2, r * 0.5, r * 0.4); },
    },
    hover: {
      body(ctx, r, c, t) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.25, r * 0.95, 0, 0, Math.PI * 2); ctx.fill(); // юбка
        ctx.fillStyle = shade(c, -0.15); ctx.beginPath(); ctx.ellipse(0, 0, r * 1.1, r * 0.78, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = DARK; circle(ctx, -r * 0.75, 0, r * 0.38);                           // вентилятор
        ctx.strokeStyle = '#8b95a3'; ctx.lineWidth = 1.5; ctx.beginPath();
        const a = t * 25; ctx.moveTo(-r * 0.75 + Math.cos(a) * r * 0.33, Math.sin(a) * r * 0.33); ctx.lineTo(-r * 0.75 - Math.cos(a) * r * 0.33, -Math.sin(a) * r * 0.33); ctx.stroke();
      },
      turret(ctx, r, c, t, e) { barrel(ctx, r * 0.2, r * 0.9, 2.5, e.recoil); ctx.fillStyle = shade(c, 0.2); circle(ctx, r * 0.15, 0, r * 0.35); },
    },
    flak: {
      body(ctx, r, c, t, e) { tracks(ctx, r, r * 1.05, t, e.path && e.path.length); ctx.fillStyle = shade(c, -0.25); rr(ctx, -r * 0.9, -r * 0.6, r * 1.8, r * 1.2, 3); },
      turret(ctx, r, c, t, e) {
        ctx.save(); ctx.translate(0, -2.5); barrel(ctx, r * 0.2, r * 1.15, 2, e.recoil); ctx.restore();
        ctx.save(); ctx.translate(0, 2.5); barrel(ctx, r * 0.2, r * 1.15, 2, e.recoil); ctx.restore();
        ctx.fillStyle = c; rr(ctx, -r * 0.5, -r * 0.48, r * 0.95, r * 0.96, 3);
        ctx.fillStyle = '#c9d1db'; ctx.beginPath(); ctx.arc(-r * 0.25, 0, r * 0.28, Math.PI * 0.5, Math.PI * 1.5); ctx.fill(); // радар
      },
    },
    builder: {
      body(ctx, r, c, t, e) {
        tracks(ctx, r, r, t, e.path && e.path.length);
        ctx.fillStyle = HAZARD; rr(ctx, -r * 0.9, -r * 0.6, r * 1.8, r * 1.2, 3);
        ctx.fillStyle = DARK; for (let i = -2; i < 3; i++) ctx.fillRect(i * r * 0.35 - 1, -r * 0.6, 2, r * 0.22);
        ctx.fillStyle = c; rr(ctx, r * 0.15, -r * 0.45, r * 0.65, r * 0.9, 2);                // кабина
      },
      turret(ctx, r, c, t, e) { // кран-манипулятор
        ctx.fillStyle = METAL2; ctx.fillRect(-r * 0.3, -1.5, r * 1.3, 3);
        ctx.fillStyle = HAZARD; circle(ctx, r * 1.0, 0, 2.2);
        ctx.fillStyle = METAL; circle(ctx, -r * 0.3, 0, r * 0.3);
        if (e.order && e.order.type === 'build' && !e.path.length && Math.sin(t * 30) > 0) { ctx.fillStyle = '#9fe8ff'; circle(ctx, r * 1.15, 0, 2.5); }
      },
    },
    gunship: {
      body(ctx, r, c) {
        ctx.fillStyle = shade(c, -0.25); ctx.fillRect(-r * 1.5, -1.5, r * 1.2, 3);           // хвост
        ctx.fillStyle = METAL2; ctx.fillRect(-r * 1.55, -r * 0.4, 3, r * 0.8);
        ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.85, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#9fd4ff'; ctx.beginPath(); ctx.ellipse(r * 0.45, 0, r * 0.3, r * 0.3, 0, -1.2, 1.2); ctx.fill(); // стекло кабины
        ctx.fillStyle = METAL2; ctx.fillRect(-r * 0.2, -r * 0.85, r * 0.4, r * 1.7);           // пилоны
      },
      turret(ctx, r, c, t, e) {
        barrel(ctx, r * 0.4, r * 0.6, 2, e.recoil);
      },
      top(ctx, r, c, t) { // винт поверх всего
        ctx.save(); ctx.rotate(t * 22);
        ctx.fillStyle = 'rgba(210,220,230,0.18)'; circle(ctx, 0, 0, r * 1.45);
        ctx.fillStyle = 'rgba(30,34,40,0.85)'; ctx.fillRect(-r * 1.45, -1.2, r * 2.9, 2.4); ctx.fillRect(-1.2, -r * 1.45, 2.4, r * 2.9);
        ctx.restore();
        ctx.fillStyle = DARK; circle(ctx, 0, 0, 2.2);
      },
    },
  };

  /* ---------- здания: рисуются от центра, h — половина стороны ---------- */
  function plate(ctx, h, c) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(ctx, -h + 3, -h + 4, h * 2 - 4, h * 2 - 4, 4);
    ctx.fillStyle = METAL; rr(ctx, -h + 2, -h + 2, h * 2 - 4, h * 2 - 4, 4);
    ctx.fillStyle = shade(c, -0.35);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.fillRect(sx * (h - 9) - 4, sy * (h - 9) - 4, 8, 8);
  }

  const BUILDINGS = {
    command(ctx, h, c, t, e) {
      plate(ctx, h, c);
      ctx.fillStyle = METAL2; rr(ctx, -h * 0.7, -h * 0.7, h * 1.4, h * 1.4, 6);
      ctx.fillStyle = c; circle(ctx, 0, 0, h * 0.5);
      ctx.fillStyle = shade(c, 0.4); circle(ctx, -h * 0.15, -h * 0.15, h * 0.16);
      ctx.save(); ctx.rotate(e.turret); barrel(ctx, h * 0.25, h * 0.55, 4, e.recoil); ctx.restore();
      ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.4 * Math.sin(t * 3)})`; circle(ctx, h * 0.62, -h * 0.62, 3);
    },
    factory(ctx, h, c, t, e) {
      plate(ctx, h, c);
      ctx.fillStyle = shade(c, -0.2); rr(ctx, -h * 0.75, -h * 0.75, h * 1.5, h * 1.1, 4);
      ctx.fillStyle = shade(c, 0.05); for (let i = 0; i < 4; i++) ctx.fillRect(-h * 0.65 + i * h * 0.34, -h * 0.65, h * 0.22, h * 0.9);
      ctx.fillStyle = DARK; ctx.fillRect(-h * 0.45, h * 0.4, h * 0.9, h * 0.5);                // ворота
      ctx.fillStyle = HAZARD; for (let i = 0; i < 5; i++) ctx.fillRect(-h * 0.45 + i * h * 0.2, h * 0.4, h * 0.1, 4);
      if (e.queue && e.queue.length) { ctx.fillStyle = Math.sin(t * 8) > 0 ? '#ffd166' : '#5c4a1a'; circle(ctx, h * 0.62, h * 0.62, 3.5); }
    },
    airfactory(ctx, h, c, t, e) {
      plate(ctx, h, c);
      ctx.fillStyle = '#4a515c'; circle(ctx, 0, 0, h * 0.72);
      ctx.fillStyle = c; ctx.fillRect(-h * 0.32, -h * 0.4, h * 0.14, h * 0.8); ctx.fillRect(h * 0.18, -h * 0.4, h * 0.14, h * 0.8); ctx.fillRect(-h * 0.2, -h * 0.07, h * 0.4, h * 0.14);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, on = e.queue && e.queue.length && Math.floor(t * 8) % 8 === i;
        ctx.fillStyle = on ? '#fff3a6' : '#7d8794'; circle(ctx, Math.cos(a) * h * 0.82, Math.sin(a) * h * 0.82, 2);
      }
    },
    turret(ctx, h, c, t, e) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; circle(ctx, 2, 3, h * 0.85);
      ctx.fillStyle = METAL; ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; ctx.lineTo(Math.cos(a) * h * 0.9, Math.sin(a) * h * 0.9); }
      ctx.fill();
      ctx.save(); ctx.rotate(e.turret);
      ctx.save(); ctx.translate(0, -3); barrel(ctx, h * 0.2, h * 0.75, 3, e.recoil); ctx.restore();
      ctx.save(); ctx.translate(0, 3); barrel(ctx, h * 0.2, h * 0.75, 3, e.recoil); ctx.restore();
      ctx.fillStyle = c; rr(ctx, -h * 0.45, -h * 0.42, h * 0.8, h * 0.84, 4);
      ctx.fillStyle = shade(c, -0.35); ctx.fillRect(-h * 0.35, -h * 0.1, h * 0.3, h * 0.2);
      ctx.restore();
    },
    extractor(ctx, h, c, t, e) {
      ctx.fillStyle = METAL; ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * h * 0.95, Math.sin(a) * h * 0.95); }
      ctx.fill();
      ctx.fillStyle = shade(c, -0.2); circle(ctx, 0, 0, h * 0.62);
      ctx.save(); ctx.rotate(e.built >= 1 ? t * (e.level > 1 ? 4 : 2) : 0);                 // бур
      ctx.fillStyle = METAL2; for (let i = 0; i < 3; i++) { ctx.rotate((Math.PI * 2) / 3); ctx.fillRect(0, -2.5, h * 0.55, 5); }
      ctx.restore();
      ctx.fillStyle = '#6ef0c2'; circle(ctx, 0, 0, h * 0.18 + (e.built >= 1 ? Math.sin(t * 5) * 1.2 : 0));
      if (e.level > 1) { ctx.strokeStyle = shade(c, 0.4); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, h * 0.78, 0, Math.PI * 2); ctx.stroke(); }
    },
  };

  function getImage(src) {
    if (!images[src]) { const im = new Image(); im.src = src; images[src] = im; }
    return images[src].complete && images[src].naturalWidth ? images[src] : null;
  }

  function drawImage(ctx, e, t) {
    const src = Array.isArray(e.def.image) ? e.def.image[e.team] || e.def.image[0] : e.def.image;
    const im = getImage(src);
    if (!im) return false;
    const size = e.def.kind === 'building' ? e.size * TILE : e.radius * 2.6;
    ctx.save(); if (e.def.kind === 'unit') ctx.rotate(e.angle);
    ctx.drawImage(im, -size / 2, -size / 2, size, size);
    ctx.restore();
    if (!Array.isArray(e.def.image)) { // одна картинка на обе команды — цвет показываем кольцом
      ctx.strokeStyle = TEAM_COLORS[e.team]; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, size * 0.55, 0, Math.PI * 2); ctx.stroke();
    }
    return true;
  }

  // ctx уже сдвинут в центр сущности
  function draw(ctx, e, t) {
    const c = TEAM_COLORS[e.team];
    if (e.def.image && drawImage(ctx, e, t)) return;
    if (e.def.kind === 'building') { BUILDINGS[e.def.shape](ctx, (e.size * TILE) / 2, c, t, e); return; }
    const m = UNITS[e.def.shape], r = e.radius;
    ctx.save(); ctx.rotate(e.angle); m.body(ctx, r, c, t, e); ctx.restore();
    ctx.save(); ctx.rotate(e.turret); m.turret(ctx, r, c, t, e); ctx.restore();
    if (m.top) m.top(ctx, r, c, t);
  }

  // картинка для кнопки: та же модель, без игры
  const iconCache = {};
  function icon(type, team = 0) {
    const key = type + team;
    if (iconCache[key]) return iconCache[key];
    const def = DEFS[type], cv = document.createElement('canvas'), S = 56;
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    const fake = { def, team, angle: -Math.PI / 2, turret: -Math.PI / 2, recoil: 0, radius: def.radius, size: def.size, built: 1, level: 1, queue: [], path: [] };
    const span = def.kind === 'building' ? def.size * TILE : def.radius * 3.2;
    ctx.translate(S / 2, S / 2); ctx.scale((S * 0.86) / span, (S * 0.86) / span);
    draw(ctx, fake, 0.3);
    iconCache[key] = cv.toDataURL();
    return iconCache[key];
  }

  return { draw, icon, shade };
})();
