/* Управление. Телефон: палец двигает карту, нажатие — выбрать/приказать, два пальца — масштаб,
   «Рамка» — выделение группы. ПК: левая кнопка — выбрать/рамка, правая — приказ (потянуть — двигать карту),
   колесо — масштаб, WASD/стрелки — камера, Esc — отмена, F — атака с движением, Q — вся армия, H — к базе, пробел — пауза. */
const Input = (() => {
  const pointers = new Map(), keys = new Set();
  const MOVE_TOL = 9;
  let g = null; // текущий жест

  function local(ev, el) { const r = el.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }

  function init(canvas, mini) {
    canvas.addEventListener('pointerdown', (ev) => down(ev, canvas));
    canvas.addEventListener('pointermove', (ev) => move(ev, canvas));
    canvas.addEventListener('pointerup', (ev) => up(ev, canvas));
    canvas.addEventListener('pointercancel', (ev) => { pointers.delete(ev.pointerId); g = null; UI.state.box = null; });
    canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
    canvas.addEventListener('wheel', (ev) => { ev.preventDefault(); const p = local(ev, canvas); Render.zoomAt(p.x, p.y, ev.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });

    const jump = (ev) => { const p = local(ev, mini), w = Render.miniToWorld(p.x, p.y); Render.centerOn(w.x, w.y); };
    mini.addEventListener('pointerdown', (ev) => { mini.setPointerCapture(ev.pointerId); jump(ev); });
    mini.addEventListener('pointermove', (ev) => { if (ev.buttons) jump(ev); });

    window.addEventListener('keydown', (ev) => {
      if (!Game.s || UI.state.ended) return;
      keys.add(ev.code); // code, а не key: работает на любой раскладке
      if (ev.code === 'Escape') { if (UI.state.placing) UI.cancelPlacing(); else if (UI.state.amove) UI.state.amove = false; else UI.select([]); }
      if (ev.code === 'KeyF') UI.state.amove = !UI.state.amove;
      if (ev.code === 'Space') { ev.preventDefault(); UI.setPaused(!UI.state.paused); }
      if (ev.code === 'KeyH') document.getElementById('t-home').click();
      if (ev.code === 'KeyQ') UI.selectArmy();
    });
    window.addEventListener('keyup', (ev) => keys.delete(ev.code));
    window.addEventListener('blur', () => keys.clear());
  }

  function down(ev, canvas) {
    if (!Game.s) return;
    canvas.setPointerCapture(ev.pointerId);
    const p = local(ev, canvas);
    pointers.set(ev.pointerId, { ...p, sx: p.x, sy: p.y });
    if (pointers.size === 2) { // второй палец — масштаб
      const [a, b] = [...pointers.values()];
      g = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      UI.state.box = null;
      return;
    }
    if (pointers.size > 2) return;
    const touch = ev.pointerType !== 'mouse';
    const mode = touch ? (UI.state.boxMode ? 'box' : 'pan') : ev.button === 0 ? 'box' : ev.button === 2 ? 'rpan' : 'pan';
    g = { mode, id: ev.pointerId, moved: false, touch, shift: ev.shiftKey, button: ev.button };
  }

  function move(ev, canvas) {
    if (!Game.s) return;
    const p = local(ev, canvas), cur = pointers.get(ev.pointerId);
    if (!cur) { if (ev.pointerType === 'mouse') UI.hover(Render.toWorld(p.x, p.y)); return; }
    const px = cur.x, py = cur.y;
    cur.x = p.x; cur.y = p.y;
    if (!g) return;
    if (g.mode === 'pinch') {
      if (pointers.size < 2) return;
      const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      Render.zoomAt(mx, my, d / g.d0); g.d0 = d;
      Render.cam.x -= (mx - g.mx) / Render.cam.z; Render.cam.y -= (my - g.my) / Render.cam.z; Render.clampCam();
      g.mx = mx; g.my = my;
      return;
    }
    if (ev.pointerId !== g.id) return;
    if (!g.moved && Math.hypot(p.x - cur.sx, p.y - cur.sy) > MOVE_TOL) g.moved = true;
    if (!g.moved) return;
    if (g.mode === 'pan' || g.mode === 'rpan') {
      Render.cam.x -= (p.x - px) / Render.cam.z; Render.cam.y -= (p.y - py) / Render.cam.z; Render.clampCam();
    } else if (g.mode === 'box') UI.state.box = { x0: Math.min(cur.sx, p.x), y0: Math.min(cur.sy, p.y), x1: Math.max(cur.sx, p.x), y1: Math.max(cur.sy, p.y) };
    if (ev.pointerType === 'mouse') UI.hover(Render.toWorld(p.x, p.y));
  }

  function up(ev, canvas) {
    const cur = pointers.get(ev.pointerId);
    pointers.delete(ev.pointerId);
    if (!g || !cur || !Game.s) return;
    if (g.mode === 'pinch') { if (!pointers.size) g = null; return; }
    if (ev.pointerId !== g.id) return;
    const w = Render.toWorld(cur.x, cur.y);
    if (!g.moved) {
      if (g.mode === 'rpan') UI.command(w);
      else if (g.button !== 1) UI.tap(w, { shift: g.shift, touch: g.touch });
    } else if (g.mode === 'box' && UI.state.box) {
      UI.boxSelect(Render.toWorld(cur.sx, cur.sy), w, g.shift);
    }
    UI.state.box = null;
    g = null;
  }

  function update(dt) {
    if (!Game.s || !keys.size) return;
    const v = (700 * dt) / Render.cam.z, on = (...c) => c.some((k) => keys.has(k));
    if (on('KeyW', 'ArrowUp')) Render.cam.y -= v;
    if (on('KeyS', 'ArrowDown')) Render.cam.y += v;
    if (on('KeyA', 'ArrowLeft')) Render.cam.x -= v;
    if (on('KeyD', 'ArrowRight')) Render.cam.x += v;
    Render.clampCam();
  }

  return { init, update };
})();
