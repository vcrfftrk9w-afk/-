'use strict';
/* =========================================================
   ICONS — единый набор SVG-иконок (24×24, обводка)
   Рисуются в текущем цвете, поэтому подхватывают тему и палитру.
   ========================================================= */

const Icons = (() => {

  const P = {
    home: '<path d="M3.2 10.6 12 3.4l8.8 7.2"/><path d="M5.6 9.6V19a1.8 1.8 0 0 0 1.8 1.8h2.7v-5.4h3.8v5.4h2.7A1.8 1.8 0 0 0 18.4 19V9.6"/>',
    tasks: '<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4.4"/><path d="M8.2 12.3l2.5 2.5 5.1-5.4"/>',
    focus: '<path d="M13.4 2.6 5.2 13.2h5.6l-1 8.2 8.2-10.8h-5.4z"/>',
    habits: '<path d="M12 3.2c3.4 2.8 5.2 5.9 5.2 8.9a5.2 5.2 0 0 1-10.4 0c0-1.7.6-3.2 1.7-4.5.1 1.5.9 2.4 1.8 2.4 1.1 0 1.7-1.1 1.7-2.7 0-1.4-.3-2.8-.6-4.1z"/><path d="M12 20.8a2.6 2.6 0 0 1-2.6-2.6c0-1.3.9-2.3 2.6-4 1.7 1.7 2.6 2.7 2.6 4a2.6 2.6 0 0 1-2.6 2.6z"/>',
    path: '<circle cx="12" cy="12" r="9"/><path d="M15.4 8.6 13.6 13.6 8.6 15.4 10.4 10.4z"/>',
    goals: '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4.4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
    lessons: '<path d="M4.2 5.6A2.4 2.4 0 0 1 6.6 3.2H19v14.2H6.6a2.4 2.4 0 0 0-2.4 2.4z"/><path d="M4.2 19.8a2.4 2.4 0 0 1 2.4-2.4H19v3.4H6.6a2.4 2.4 0 0 1-2.4-1z"/><path d="M8.4 7.6h6.4M8.4 10.8h4.4"/>',
    empire: '<path d="M3.4 9.8 12 4.2l8.6 5.6"/><path d="M6.2 11.6v6M10 11.6v6M14 11.6v6M17.8 11.6v6"/><path d="M3.8 20.6h16.4"/>',
    rewards: '<path d="M8 3.8h8v5.1a4 4 0 0 1-8 0z"/><path d="M8 5.6H5.4v1.2a3.4 3.4 0 0 0 2.7 3.3"/><path d="M16 5.6h2.6v1.2a3.4 3.4 0 0 1-2.7 3.3"/><path d="M12 13v3.6"/><path d="M8.6 20.4h6.8"/>',
    stats: '<path d="M4.6 20.2V12M9.7 20.2V5.4M14.8 20.2v-5.6M19.9 20.2V9"/>',
    more: '<circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none"/>',

    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M19.2 14.4a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.2a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1A1.6 1.6 0 0 0 10 3.1v-.2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    moon: '<path d="M20.4 13.6A8.4 8.4 0 1 1 10.4 3.6a6.6 6.6 0 0 0 10 10z"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M4.4 12H2.2M21.8 12h-2.2M6.4 6.4 4.8 4.8M19.2 19.2l-1.6-1.6M17.6 6.4l1.6-1.6M4.8 19.2l1.6-1.6"/>',
    play: '<path d="M7.5 4.8 19 12 7.5 19.2z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6.6" y="5" width="3.8" height="14" rx="1.4" fill="currentColor" stroke="none"/><rect x="13.6" y="5" width="3.8" height="14" rx="1.4" fill="currentColor" stroke="none"/>',
    shuffle: '<path d="M16.6 4.6 20 8l-3.4 3.4"/><path d="M20 8h-4a4.6 4.6 0 0 0-3.8 2L9 14.6a4.6 4.6 0 0 1-3.8 2H4"/><path d="M16.6 12.6 20 16l-3.4 3.4"/><path d="M4 7.4h1.2A4.6 4.6 0 0 1 9 9.4l.6.9"/><path d="M14 16h6"/>',
    sliders: '<path d="M5 20v-6M5 10.4V4M12 20v-8.6M12 7.8V4M19 20v-4.4M19 11.8V4"/><path d="M2.6 14h4.8M9.6 11.4h4.8M16.6 15.6h4.8"/>',
    plus: '<path d="M12 5.4v13.2M5.4 12h13.2"/>',
    check: '<path d="M5 12.8 9.6 17.4 19 7.6"/>',
    close: '<path d="M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6"/>',
    trash: '<path d="M4.6 6.8h14.8"/><path d="M9.4 6.8V5.2a1.6 1.6 0 0 1 1.6-1.6h2a1.6 1.6 0 0 1 1.6 1.6v1.6"/><path d="M6.6 6.8 7.4 19a1.8 1.8 0 0 0 1.8 1.6h5.6a1.8 1.8 0 0 0 1.8-1.6l.8-12.2"/>',
    bolt: '<path d="M13.4 2.6 5.2 13.2h5.6l-1 8.2 8.2-10.8h-5.4z"/>',
    music: '<path d="M9.4 18.2V6.4l9.2-2v11.4"/><circle cx="6.8" cy="18.2" r="2.6"/><circle cx="16" cy="15.8" r="2.6"/>',
    timer: '<circle cx="12" cy="13.4" r="7.8"/><path d="M12 9.4v4.2l2.6 1.8"/><path d="M9.4 2.6h5.2"/>',
    search: '<circle cx="11" cy="11" r="6.8"/><path d="M16.2 16.2 21 21"/>',
    command: '<path d="M8.4 3.6a2.4 2.4 0 1 1-2.4 2.4v12a2.4 2.4 0 1 1 2.4-2.4h7.2a2.4 2.4 0 1 1 2.4 2.4V6a2.4 2.4 0 1 1-2.4 2.4z"/>',
    fire: '<path d="M12 3.2c3.4 2.8 5.2 5.9 5.2 8.9a5.2 5.2 0 0 1-10.4 0c0-1.7.6-3.2 1.7-4.5.1 1.5.9 2.4 1.8 2.4 1.1 0 1.7-1.1 1.7-2.7 0-1.4-.3-2.8-.6-4.1z"/>',
    coin: '<ellipse cx="12" cy="7.4" rx="7.6" ry="3.4"/><path d="M4.4 7.4v9.2c0 1.9 3.4 3.4 7.6 3.4s7.6-1.5 7.6-3.4V7.4"/><path d="M4.4 12c0 1.9 3.4 3.4 7.6 3.4s7.6-1.5 7.6-3.4"/>',
    star: '<path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.8l5.9-.8z"/>',
    bank: '<path d="M3.4 9.8 12 4.2l8.6 5.6"/><path d="M6.2 11.6v6M10 11.6v6M14 11.6v6M17.8 11.6v6"/><path d="M3.8 20.6h16.4"/>',
  };

  function get(name, opts = {}) {
    const d = P[name] || P.more;
    const size = opts.size || 22;
    const sw = opts.stroke || 1.7;
    return `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none"
      stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">${d}</svg>`;
  }

  function has(name) { return !!P[name]; }

  return { get, has, names: Object.keys(P) };
})();
