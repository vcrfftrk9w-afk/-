/* Запуск и главный цикл: логика 30 раз в секунду (одинаково на любом телефоне), картинка — сколько тянет экран. */
(() => {
  const STEP = 1 / 30;
  const canvas = document.getElementById('view'), mini = document.getElementById('mini');
  Render.init(canvas, mini);
  UI.init();
  Input.init(canvas, mini);
  window.addEventListener('resize', () => Render.resize());
  document.addEventListener('visibilitychange', () => { if (document.hidden) UI.setPaused(true); });

  let last = performance.now(), acc = 0;
  function loop(now) {
    const real = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (!UI.state.paused) {
      acc += real;
      while (acc >= STEP) { Game.update(STEP); acc -= STEP; }
    }
    Input.update(real);
    Render.frame(Game.s, UI.state, now / 1000);
    UI.update(real);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // для проверок (tests/rts.js): прокрутить партию без отрисовки
  window.RTS = {
    Game, AI, UI, Render, Path, MapGen,
    simulate(seconds) { for (let t = 0; t < seconds && Game.s.winner === null; t += STEP) Game.update(STEP); return Game.s; },
  };
})();
