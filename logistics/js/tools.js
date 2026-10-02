/* Тренажёры: калькуляторы и симуляторы. Каждый — { id, icon, title, desc, render(), bind(root) }. */
window.TOOLS = (function () {
  const num = (v, d = 0) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : d; };
  const fmt = (n, d = 0) => (isFinite(n) ? n.toLocaleString('ru-RU', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '—');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const field = (id, label, val, extra = '') => `<label class="fld"><span>${label}</span><input id="${id}" type="number" step="any" value="${val}" ${extra}></label>`;

  /* Простой линейный график в SVG. series: [{name, color, pts:[[x,y]], dash}] */
  function lineChart(series, opt = {}) {
    const W = 640, H = 260, P = { l: 52, r: 12, t: 12, b: 28 };
    const xs = series.flatMap((s) => s.pts.map((p) => p[0]));
    const ys = series.flatMap((s) => s.pts.map((p) => p[1])).concat(opt.yMin != null ? [opt.yMin] : []);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    let y0 = Math.min(0, ...ys), y1 = Math.max(...ys) * 1.08 || 1;
    const X = (x) => P.l + ((x - x0) / (x1 - x0 || 1)) * (W - P.l - P.r);
    const Y = (y) => H - P.b - ((y - y0) / (y1 - y0 || 1)) * (H - P.t - P.b);
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = y0 + ((y1 - y0) * i) / 4;
      g += `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${P.l - 6}" y="${Y(v) + 4}" class="ax" text-anchor="end">${fmt(v)}</text>`;
    }
    for (let i = 0; i <= 5; i++) {
      const v = x0 + ((x1 - x0) * i) / 5;
      g += `<text x="${X(v)}" y="${H - 8}" class="ax" text-anchor="middle">${fmt(v)}</text>`;
    }
    (opt.hlines || []).forEach((h) => { g += `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(h.y)}" y2="${Y(h.y)}" stroke="${h.color}" stroke-dasharray="6 4" stroke-width="1.5"/><text x="${W - P.r - 4}" y="${Y(h.y) - 5}" text-anchor="end" class="ax" fill="${h.color}">${h.label}</text>`; });
    (opt.vline != null) && (g += `<line x1="${X(opt.vline)}" x2="${X(opt.vline)}" y1="${P.t}" y2="${H - P.b}" stroke="var(--accent)" stroke-dasharray="4 4"/>`);
    const paths = series.map((s) => `<polyline fill="none" stroke="${s.color}" stroke-width="${s.w || 2.5}" ${s.dash ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round" points="${s.pts.map((p) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}"/>`).join('');
    const legend = series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('');
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label || 'График')}">${g}${paths}</svg><div class="legend">${legend}</div></div>`;
  }

  const tools = [];

  /* ---------- EOQ ---------- */
  tools.push({
    id: 'eoq', icon: '🧮', title: 'Формула Уилсона (EOQ)', desc: 'Оптимальный размер заказа и график затрат',
    render: () => `
      <div class="grid2">${field('D', 'Годовой спрос D, шт.', 12000)}${field('S', 'Затраты на 1 заказ S, ₽', 2000)}${field('C', 'Цена единицы, ₽', 150)}${field('I', 'Ставка хранения, % в год', 20)}</div>
      <div id="out"></div>`,
    bind(root) {
      const calc = () => {
        const D = num(root.querySelector('#D').value), S = num(root.querySelector('#S').value), C = num(root.querySelector('#C').value), I = num(root.querySelector('#I').value) / 100;
        const H = C * I;
        if (D <= 0 || S <= 0 || H <= 0) { root.querySelector('#out').innerHTML = '<p class="warn">Введите положительные значения.</p>'; return; }
        const Q = Math.sqrt((2 * D * S) / H), N = D / Q, T = 365 / N, TC = N * S + (Q / 2) * H;
        const pts = (f) => { const a = []; for (let q = Q * 0.2; q <= Q * 3; q += Q * 0.05) a.push([q, f(q)]); return a; };
        root.querySelector('#out').innerHTML = `
          <div class="stats">
            <div class="stat big"><b>${fmt(Q)}</b><span>EOQ, шт.</span></div>
            <div class="stat"><b>${fmt(N, 1)}</b><span>заказов в год</span></div>
            <div class="stat"><b>${fmt(T)}</b><span>дней между заказами</span></div>
            <div class="stat"><b>${fmt(TC)} ₽</b><span>общие затраты в год</span></div>
          </div>
          <p class="muted">H = ${fmt(C)} × ${fmt(I * 100)}% = ${fmt(H, 2)} ₽/шт./год. EOQ = √(2 × ${fmt(D)} × ${fmt(S)} / ${fmt(H, 2)})</p>
          ${lineChart([
            { name: 'Затраты на заказы', color: '#f59e0b', pts: pts((q) => (D / q) * S) },
            { name: 'Затраты на хранение', color: '#3b82f6', pts: pts((q) => (q / 2) * H) },
            { name: 'Общие затраты', color: '#10b981', w: 3.5, pts: pts((q) => (D / q) * S + (q / 2) * H) }
          ], { vline: Q, label: 'Затраты в зависимости от размера заказа' })}
          <p class="muted">По оси X — размер заказа. Пунктир — EOQ: здесь общие затраты минимальны, а затраты на заказы и хранение равны.</p>`;
      };
      root.addEventListener('input', calc); calc();
    }
  });

  /* ---------- Страховой запас и ROP ---------- */
  const Z = { 90: 1.28, 95: 1.645, 97.5: 1.96, 98: 2.05, 99: 2.33, 99.5: 2.576, 99.9: 3.09 };
  tools.push({
    id: 'ss', icon: '🛡️', title: 'Страховой запас и точка заказа', desc: 'SS, ROP и «пила» запасов',
    render: () => `
      <div class="grid2">${field('d', 'Средний спрос в день, шт.', 40)}${field('sd', 'Ст. отклонение спроса в день σd', 10)}${field('L', 'Срок поставки L, дней', 9)}${field('sL', 'Ст. отклонение срока σL, дней', 0)}${field('Q', 'Размер заказа Q, шт.', 600)}
      <label class="fld"><span>Уровень сервиса</span><select id="SL">${Object.keys(Z).sort((a, b) => a - b).map((k) => `<option value="${k}" ${k == 95 ? 'selected' : ''}>${k}% (Z = ${Z[k]})</option>`).join('')}</select></label></div>
      <div id="out"></div>`,
    bind(root) {
      const calc = () => {
        const g = (id) => num(root.querySelector('#' + id).value);
        const d = g('d'), sd = g('sd'), L = g('L'), sL = g('sL'), Q = g('Q'), z = Z[root.querySelector('#SL').value];
        const SS = z * Math.sqrt(L * sd * sd + d * d * sL * sL), ROP = d * L + SS;
        const pts = []; let inv = SS + Q, t = 0;
        const cyc = Q / Math.max(d, 0.0001);
        for (let c = 0; c < 3; c++) { pts.push([t, SS + Q]); t += cyc; pts.push([t, SS]); }
        root.querySelector('#out').innerHTML = `
          <div class="stats">
            <div class="stat big"><b>${fmt(Math.ceil(SS))}</b><span>страховой запас, шт.</span></div>
            <div class="stat big"><b>${fmt(Math.ceil(ROP))}</b><span>точка заказа, шт.</span></div>
            <div class="stat"><b>${fmt(SS / Math.max(d, 0.0001), 1)}</b><span>дней покрытия SS</span></div>
            <div class="stat"><b>${fmt(SS + Q / 2)}</b><span>средний запас, шт.</span></div>
          </div>
          <p class="muted">SS = ${z} × √(${fmt(L)} × ${fmt(sd)}² + ${fmt(d)}² × ${fmt(sL)}²). ROP = ${fmt(d)} × ${fmt(L)} + SS. Когда остаток опускается до ${fmt(Math.ceil(ROP))} — делаем заказ.</p>
          ${lineChart([{ name: 'Запас на складе (идеальная «пила»)', color: '#3b82f6', pts }], { hlines: [{ y: ROP, color: '#f59e0b', label: 'ROP' }, { y: SS, color: '#ef4444', label: 'Страховой запас' }], label: 'Пила запасов' })}
          <p class="muted">По оси X — дни. Попробуйте поднять уровень сервиса с 95% до 99,9% и посмотрите, как растёт запас.</p>`;
        void inv;
      };
      root.addEventListener('input', calc); root.addEventListener('change', calc); calc();
    }
  });

  /* ---------- ABC / XYZ ---------- */
  const SAMPLE = `Кофе зерновой; 520; 480; 510; 530; 500; 495
Чай чёрный; 210; 190; 260; 180; 230; 200
Сахар 1 кг; 300; 310; 295; 305; 290; 300
Кружка термо; 40; 10; 85; 5; 60; 20
Сироп ванильный; 60; 75; 50; 90; 45; 70
Печенье; 150; 140; 160; 155; 145; 150
Капсулы; 900; 870; 950; 910; 880; 920
Кофемолка; 3; 0; 8; 1; 0; 6
Фильтры бумажные; 80; 85; 78; 90; 82; 79
Шоколад горький; 120; 60; 200; 90; 150; 40`;
  tools.push({
    id: 'abc', icon: '🔤', title: 'ABC / XYZ анализ', desc: 'Классификация ассортимента по обороту и стабильности',
    render: () => `
      <p class="muted">Каждая строка: <code>Название; продажи период 1; период 2; …</code> (в штуках или рублях). Можно вставить из Excel — разделитель «;» или табуляция.</p>
      <textarea id="data" rows="9" spellcheck="false">${SAMPLE}</textarea>
      <div class="row"><button class="btn" id="run">Рассчитать</button><button class="btn ghost" id="sample">Пример</button></div>
      <div id="out"></div>`,
    bind(root) {
      const run = () => {
        const rows = root.querySelector('#data').value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
          const p = l.split(/[;\t]/).map((s) => s.trim());
          const vals = p.slice(1).map((v) => num(v, NaN)).filter((v) => isFinite(v));
          return { name: p[0] || '—', vals };
        }).filter((r) => r.vals.length);
        if (!rows.length) { root.querySelector('#out').innerHTML = '<p class="warn">Нет данных.</p>'; return; }
        rows.forEach((r) => {
          r.sum = r.vals.reduce((a, b) => a + b, 0);
          const m = r.sum / r.vals.length;
          const sd = Math.sqrt(r.vals.reduce((a, b) => a + (b - m) ** 2, 0) / r.vals.length);
          r.cv = m > 0 ? (sd / m) * 100 : 999;
          r.xyz = r.cv <= 10 ? 'X' : r.cv <= 25 ? 'Y' : 'Z';
        });
        const total = rows.reduce((a, r) => a + r.sum, 0) || 1;
        rows.sort((a, b) => b.sum - a.sum);
        let cum = 0;
        rows.forEach((r) => { const before = cum; cum += r.sum / total * 100; r.share = r.sum / total * 100; r.cum = cum; r.abc = before < 80 ? 'A' : before < 95 ? 'B' : 'C'; });
        const M = {}; rows.forEach((r) => { const k = r.abc + r.xyz; (M[k] = M[k] || []).push(r.name); });
        const tip = { AX: 'Автопополнение, минимальный SS', AY: 'Повышенный SS, сезонность', AZ: 'Индивидуально, под заказ', BX: 'Стандартные правила', BY: 'Стандарт + сезон', BZ: 'Осторожно, под заказ', CX: 'Редкие крупные заказы', CY: 'Минимальный контроль', CZ: 'Кандидат на вывод' };
        root.querySelector('#out').innerHTML = `
          <div class="tblwrap"><table class="tbl"><tr><th>Товар</th><th>Сумма</th><th>Доля</th><th>Накоп.</th><th>CV</th><th>Группа</th></tr>
          ${rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${fmt(r.sum)}</td><td>${fmt(r.share, 1)}%</td><td>${fmt(r.cum, 1)}%</td><td>${r.cv >= 999 ? '—' : fmt(r.cv, 1) + '%'}</td><td><span class="tag t${r.abc}">${r.abc}${r.xyz}</span></td></tr>`).join('')}</table></div>
          <h4>Матрица ABC × XYZ</h4>
          <div class="matrix">${['A', 'B', 'C'].map((a) => ['X', 'Y', 'Z'].map((x) => `<div class="cell t${a}"><b>${a}${x}</b><small>${tip[a + x]}</small><span>${(M[a + x] || []).map(esc).join(', ') || '—'}</span></div>`).join('')).join('')}</div>`;
      };
      root.querySelector('#run').onclick = run;
      root.querySelector('#sample').onclick = () => { root.querySelector('#data').value = SAMPLE; run(); };
      run();
    }
  });

  /* ---------- Платный вес ---------- */
  const MODES = { air: ['✈️ Авиа (÷6000)', 6000], express: ['📮 Экспресс (÷5000)', 5000], road: ['🚛 Авто (1 м³ = 333 кг)', 3000], rail: ['🚂 Ж/Д сборный (1 м³ = 250 кг)', 4000], sea: ['🚢 Море LCL (1 м³ = 1000 кг)', 1000] };
  tools.push({
    id: 'weight', icon: '⚖️', title: 'Платный (объёмный) вес', desc: 'За что на самом деле заплатите перевозчику',
    render: () => `
      <div class="grid2">${field('l', 'Длина, см', 60)}${field('w', 'Ширина, см', 40)}${field('h', 'Высота, см', 40)}${field('kg', 'Вес одного места, кг', 8)}${field('n', 'Количество мест', 10)}
      <label class="fld"><span>Вид перевозки</span><select id="mode">${Object.entries(MODES).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></label></div>
      <div id="out"></div>`,
    bind(root) {
      const calc = () => {
        const g = (id) => num(root.querySelector('#' + id).value);
        const l = g('l'), w = g('w'), h = g('h'), kg = g('kg'), n = Math.max(1, Math.round(g('n')));
        const mode = root.querySelector('#mode').value, div = MODES[mode][1];
        const vol = (l * w * h) / 1e6 * n;
        const volW = (l * w * h) / div * n;
        const real = kg * n, charge = Math.max(real, volW);
        root.querySelector('#out').innerHTML = `
          <div class="stats">
            <div class="stat"><b>${fmt(vol, 3)} м³</b><span>объём</span></div>
            <div class="stat"><b>${fmt(real, 1)} кг</b><span>фактический вес</span></div>
            <div class="stat"><b>${fmt(volW, 1)} кг</b><span>объёмный вес</span></div>
            <div class="stat big"><b>${fmt(charge, 1)} кг</b><span>платный вес (${charge > real ? 'по объёму' : 'по факту'})</span></div>
          </div>
          <p class="muted">${charge > real ? '📦 Груз «лёгкий и объёмный»: платите за воздух. Попробуйте уменьшить упаковку!' : '🧱 Груз «тяжёлый»: оплата по фактическому весу.'} Плотность груза: ${fmt(real / (vol || 1))} кг/м³.</p>`;
      };
      root.addEventListener('input', calc); root.addEventListener('change', calc); calc();
    }
  });

  /* ---------- Загрузка машины паллетами ---------- */
  const PAL = { eur: ['Европаллета 1200×800', 1.2, 3], fin: ['Финпаллета 1200×1000', 1.0, 2], us: ['Американская 1200×1200', 1.2, 2] };
  const TRUCKS = { euro: ['Еврофура 13,6 м / 20 т', 13.6, 20000], t10: ['10-тонник 7,2 м', 7.2, 10000], t5: ['5-тонник 6,0 м', 6.0, 5000], gaz: ['Газель 4,2 м / 1,5 т', 4.2, 1500] };
  tools.push({
    id: 'truck', icon: '🚚', title: 'Загрузка машины', desc: 'Сколько паллет влезет и сколько машин нужно',
    render: () => `
      <div class="grid2">${field('n', 'Количество паллет', 40)}${field('kg', 'Вес одной паллеты, кг', 450)}
      <label class="fld"><span>Тип паллет</span><select id="pal">${Object.entries(PAL).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></label>
      <label class="fld"><span>Машина</span><select id="truck">${Object.entries(TRUCKS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></label>
      <label class="fld chk"><input type="checkbox" id="st"> <span>Можно ставить в 2 яруса</span></label></div>
      <div id="out"></div>`,
    bind(root) {
      const calc = () => {
        const n = Math.max(0, Math.round(num(root.querySelector('#n').value))), kg = num(root.querySelector('#kg').value);
        const [pn, rowLen, across] = PAL[root.querySelector('#pal').value];
        const [tn, len, cap] = TRUCKS[root.querySelector('#truck').value];
        const tiers = root.querySelector('#st').checked ? 2 : 1;
        const perTruckVol = Math.floor(len / rowLen + 1e-9) * across * tiers;
        const perTruckW = kg > 0 ? Math.floor(cap / kg) : Infinity;
        const per = Math.max(0, Math.min(perTruckVol, perTruckW));
        const trucks = per ? Math.ceil(n / per) : Infinity;
        const ldm = (rowLen * (2.4 / across)) / 2.4 * n / tiers;
        const first = Math.min(n, per);
        const cells = Math.floor(len / rowLen + 1e-9) * across;
        let viz = '';
        for (let i = 0; i < cells; i++) { const k = i < Math.ceil(first / tiers) ? (tiers === 2 && i < first - Math.ceil(first / tiers) ? 'p2' : 'p1') : ''; viz += `<div class="pal ${k}"></div>`; }
        root.querySelector('#out').innerHTML = `
          <div class="stats">
            <div class="stat"><b>${perTruckVol}</b><span>паллет влезает по месту</span></div>
            <div class="stat"><b>${perTruckW === Infinity ? '∞' : perTruckW}</b><span>паллет по грузоподъёмности</span></div>
            <div class="stat big"><b>${trucks === Infinity ? '—' : trucks}</b><span>машин нужно</span></div>
            <div class="stat"><b>${fmt(ldm, 1)}</b><span>LDM всего</span></div>
          </div>
          <p class="muted">${perTruckW < perTruckVol ? '⚠️ Ограничение — вес: машина «выбирает» тонны раньше, чем заканчивается место.' : 'Ограничение — место в кузове.'} Первая машина: ${first} паллет, загрузка по весу ${fmt(first * kg / cap * 100)}%.</p>
          <div class="truck"><div class="cab">🚛</div><div class="body" style="grid-template-columns:repeat(${Math.floor(len / rowLen + 1e-9)},1fr);grid-template-rows:repeat(${across},1fr)">${viz}</div></div>
          <p class="muted small">Вид сверху: ${esc(pn)}, ${esc(tn)}. Тёмные — два яруса.</p>`;
      };
      root.addEventListener('input', calc); root.addEventListener('change', calc); calc();
    }
  });

  /* ---------- Incoterms ---------- */
  const STEPS = ['Упаковка и маркировка', 'Погрузка на складе продавца', 'Экспортная таможня', 'Доставка до порта/терминала отправления', 'Погрузка на основной транспорт', 'Основная перевозка (фрахт)', 'Страховка груза', 'Импортная таможня и пошлины', 'Доставка до места назначения', 'Выгрузка у покупателя'];
  const TERMS = {
    EXW: ['SBBBBBbBBB', 0, 'Любой', 'Покупатель забирает товар со склада продавца и всё делает сам.'],
    FCA: ['SSSSBBbBBB', 3, 'Любой', 'Продавец передаёт груз перевозчику покупателя и делает экспортную очистку.'],
    FAS: ['SSSSBBbBBB', 3, 'Море', 'Груз размещён у борта судна в порту отгрузки.'],
    FOB: ['SSSSSBbBBB', 4, 'Море', 'Груз погружен на борт судна. Дальше — риск и расходы покупателя.'],
    CFR: ['SSSSSSbBBB', 4, 'Море', 'Продавец оплачивает фрахт до порта назначения, но риск переходит при погрузке на борт.'],
    CIF: ['SSSSSSSBBB', 4, 'Море', 'CFR + страховка (минимальное покрытие ICC C). Риск — при погрузке на борт.'],
    CPT: ['SSSSSSbBBB', 3, 'Любой', 'Продавец оплачивает перевозку до места назначения, риск переходит при передаче первому перевозчику.'],
    CIP: ['SSSSSSSBBB', 3, 'Любой', 'CPT + страховка (максимальное покрытие ICC A).'],
    DAP: ['SSSSSSsBSB', 8, 'Любой', 'Продавец доставляет до места назначения, без разгрузки и импортной очистки.'],
    DPU: ['SSSSSSsBSS', 9, 'Любой', 'Продавец доставляет и разгружает в месте назначения.'],
    DDP: ['SSSSSSsSSB', 8, 'Любой', 'Продавец делает всё, включая импортную таможню и пошлины.']
  };
  tools.push({
    id: 'inco', icon: '🌐', title: 'Incoterms 2020', desc: 'Кто платит и где переходит риск — наглядно',
    render: () => `
      <div class="chips" id="terms">${Object.keys(TERMS).map((t, i) => `<button class="chip ${i === 3 ? 'on' : ''}" data-t="${t}">${t}</button>`).join('')}</div>
      <div id="out"></div>`,
    bind(root) {
      const show = (t) => {
        const [p, risk, mode, desc] = TERMS[t];
        root.querySelectorAll('#terms .chip').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
        root.querySelector('#out').innerHTML = `
          <p><b>${t}</b> · ${mode === 'Море' ? '🚢 только море и внутренние водные пути' : '🌍 любой вид транспорта'}<br>${desc}</p>
          <div class="inco">${STEPS.map((s, i) => {
            const c = p[i], who = c.toUpperCase() === 'S' ? 'Продавец' : 'Покупатель';
            return `<div class="istep ${c.toUpperCase() === 'S' ? 'sel' : 'buy'} ${c === c.toLowerCase() ? 'opt' : ''}"><span class="n">${i + 1}</span><span class="s">${s}</span><span class="w">${who}${c === c.toLowerCase() ? ' (не обязан)' : ''}</span></div>${i === risk ? '<div class="risk">⚡ Здесь риск переходит от продавца к покупателю</div>' : ''}`;
          }).join('')}</div>
          <p class="muted small">🟦 платит продавец · 🟧 платит покупатель · бледным — не обязанность по правилам, но обычно делает эта сторона в своих интересах.</p>`;
      };
      root.querySelector('#terms').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) show(b.dataset.t); };
      show('FOB');
    }
  });

  /* ---------- Таможенные платежи ---------- */
  tools.push({
    id: 'customs', icon: '🛃', title: 'Таможенные платежи', desc: 'Пошлина, акциз и НДС при импорте (упрощённо)',
    render: () => `
      <div class="grid2">${field('price', 'Стоимость товара по инвойсу, ₽', 1000000)}${field('frt', 'Доставка и страховка до границы, ₽', 150000)}${field('duty', 'Ставка пошлины, %', 10)}${field('exc', 'Акциз, ₽', 0)}${field('vat', 'НДС, %', 20)}${field('fee', 'Таможенный сбор, ₽ (по действующей шкале)', 0)}</div>
      <div id="out"></div>`,
    bind(root) {
      const calc = () => {
        const g = (id) => num(root.querySelector('#' + id).value);
        const ts = g('price') + g('frt'), duty = ts * g('duty') / 100, exc = g('exc'), vat = (ts + duty + exc) * g('vat') / 100, fee = g('fee');
        const tot = duty + exc + vat + fee;
        root.querySelector('#out').innerHTML = `
          <div class="stats">
            <div class="stat"><b>${fmt(ts)} ₽</b><span>таможенная стоимость</span></div>
            <div class="stat"><b>${fmt(duty)} ₽</b><span>пошлина</span></div>
            <div class="stat"><b>${fmt(vat)} ₽</b><span>НДС</span></div>
            <div class="stat big"><b>${fmt(tot)} ₽</b><span>итого платежей (${fmt(tot / (ts || 1) * 100, 1)}% от ТС)</span></div>
          </div>
          <p class="muted">НДС = (ТС + пошлина + акциз) × ${fmt(g('vat'))}%. Учебный расчёт: реальные ставки зависят от кода ТН ВЭД, страны происхождения и льгот; сбор — по действующей шкале.</p>`;
      };
      root.addEventListener('input', calc); calc();
    }
  });

  /* ---------- Эффект хлыста ---------- */
  const TIERS = [['Магазин', '#3b82f6'], ['Оптовик', '#10b981'], ['Дистрибьютор', '#f59e0b'], ['Завод', '#ef4444']];
  tools.push({
    id: 'bullwhip', icon: '🌊', title: 'Симулятор эффекта хлыста', desc: 'Как маленький скачок спроса раскачивает завод',
    render: () => `
      <div class="grid2">
        <label class="fld"><span>Спрос покупателей</span><select id="pat"><option value="step">Скачок: 100 → 120 на 5-й неделе</option><option value="noise">Случайные колебания ±10%</option><option value="promo">Акция на 8–9 неделе</option></select></label>
        <label class="fld"><span>Срок поставки, недель: <b id="Lv">2</b></span><input id="L" type="range" min="1" max="6" value="2"></label>
        <label class="fld"><span>Реакция прогноза α: <b id="av">0.5</b></span><input id="a" type="range" min="0.1" max="0.9" step="0.1" value="0.5"></label>
        <label class="fld chk"><input type="checkbox" id="pos"> <span>Все видят реальные продажи (POS-данные)</span></label>
        <label class="fld chk"><input type="checkbox" id="batch"> <span>Заказы партиями по 200 шт.</span></label>
      </div>
      <div id="out"></div>`,
    bind(root) {
      const calc = () => {
        const L = +root.querySelector('#L').value, a = +root.querySelector('#a').value;
        root.querySelector('#Lv').textContent = L; root.querySelector('#av').textContent = a;
        const pos = root.querySelector('#pos').checked, batch = root.querySelector('#batch').checked, pat = root.querySelector('#pat').value;
        const W = 30; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        const cust = []; for (let t = 0; t < W; t++) cust.push(pat === 'step' ? (t < 5 ? 100 : 120) : pat === 'noise' ? Math.round(100 + (rnd() - 0.5) * 20) : (t === 8 || t === 9 ? 160 : 100));
        const orders = TIERS.map(() => []);
        const F = TIERS.map(() => 100), Sprev = TIERS.map(() => 100 * (L + 1)), back = TIERS.map(() => 0), Fpos = { v: 100 };
        for (let t = 0; t < W; t++) {
          Fpos.v = a * cust[t] + (1 - a) * Fpos.v;
          for (let i = 0; i < TIERS.length; i++) {
            const D = i === 0 ? cust[t] : orders[i - 1][t];
            F[i] = a * D + (1 - a) * F[i];
            const f = pos ? Fpos.v : F[i];
            const S = f * (L + 1);
            let O = Math.max(0, D + (S - Sprev[i])); Sprev[i] = S;
            if (batch) { back[i] += O; O = Math.floor(back[i] / 200) * 200; back[i] -= O; }
            orders[i].push(O);
          }
        }
        const sd = (arr) => { const m = arr.reduce((x, y) => x + y, 0) / arr.length; return Math.sqrt(arr.reduce((x, y) => x + (y - m) ** 2, 0) / arr.length); };
        const base = sd(cust) || 1;
        root.querySelector('#out').innerHTML = `
          ${lineChart([{ name: 'Покупатели', color: '#94a3b8', dash: true, pts: cust.map((v, t) => [t + 1, v]) }].concat(TIERS.map((ti, i) => ({ name: ti[0], color: ti[1], pts: orders[i].map((v, t) => [t + 1, v]) }))), { label: 'Заказы по звеньям цепи' })}
          <div class="stats">${TIERS.map((ti, i) => `<div class="stat"><b style="color:${ti[1]}">×${fmt(sd(orders[i]) / base, 1)}</b><span>${ti[0]}: размах заказов к спросу</span></div>`).join('')}</div>
          <p class="muted">По оси X — недели. Чем больше «×», тем сильнее хлыст. Попробуйте включить POS-данные и уменьшить срок поставки.</p>`;
      };
      root.addEventListener('input', calc); root.addEventListener('change', calc); calc();
    }
  });

  /* ---------- Маршрутизация ---------- */
  tools.push({
    id: 'route', icon: '🗺️', title: 'Игра «Маршрутизация»', desc: 'Постройте маршрут лучше алгоритма',
    render: () => `
      <p class="muted">Курьер выезжает со склада 🏠 и должен объехать все точки. Кликайте точки по порядку — постройте свой маршрут. Потом сравните с алгоритмами.</p>
      <div class="row"><label class="fld inline"><span>Точек</span><select id="cnt"><option>6</option><option selected>9</option><option>12</option><option>15</option></select></label>
      <button class="btn ghost" id="new">🎲 Новая карта</button><button class="btn ghost" id="undo">↩ Отменить</button><button class="btn ghost" id="nn">Ближайший сосед</button><button class="btn ghost" id="opt">2-opt</button></div>
      <div class="map"><svg id="svg" viewBox="0 0 100 70"></svg></div>
      <div id="out"></div>`,
    bind(root, api) {
      let P = [], my = [], shown = null;
      const D = (a, b) => Math.hypot(P[a].x - P[b].x, P[a].y - P[b].y);
      const len = (r) => r.reduce((s, v, i) => s + D(v, r[(i + 1) % r.length]), 0) * 5;
      const nn = () => { const r = [0], left = new Set(P.map((_, i) => i).slice(1)); while (left.size) { const c = r[r.length - 1]; let b = null; left.forEach((j) => { if (b === null || D(c, j) < D(c, b)) b = j; }); r.push(b); left.delete(b); } return r; };
      const opt2 = (r) => { r = r.slice(); let imp = true; while (imp) { imp = false; for (let i = 1; i < r.length - 1; i++) for (let k = i + 1; k < r.length; k++) { const a = r[i - 1], b = r[i], c = r[k], d = r[(k + 1) % r.length]; if (D(a, c) + D(b, d) < D(a, b) + D(c, d) - 1e-9) { r = r.slice(0, i).concat(r.slice(i, k + 1).reverse(), r.slice(k + 1)); imp = true; } } } return r; };
      const gen = () => { const n = +root.querySelector('#cnt').value; P = [{ x: 50, y: 35 }]; while (P.length <= n) { const p = { x: 6 + Math.random() * 88, y: 6 + Math.random() * 58 }; if (P.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 9)) P.push(p); } my = [0]; shown = null; draw(); };
      const path = (r, cls) => `<polyline class="${cls}" points="${r.concat(r.length === P.length ? [r[0]] : []).map((i) => P[i].x + ',' + P[i].y).join(' ')}"/>`;
      const draw = () => {
        let s = '';
        if (shown) s += path(shown.r, 'algo');
        if (my.length > 1) s += path(my, 'mine');
        P.forEach((p, i) => { s += i === 0 ? `<text x="${p.x}" y="${p.y + 2.2}" text-anchor="middle" font-size="6">🏠</text>` : `<g data-i="${i}" class="pt ${my.includes(i) ? 'done' : ''}"><circle cx="${p.x}" cy="${p.y}" r="3.2"/><text x="${p.x}" y="${p.y + 1.2}" text-anchor="middle">${my.includes(i) ? my.indexOf(i) : ''}</text></g>`; });
        root.querySelector('#svg').innerHTML = s;
        const done = my.length === P.length;
        const best = len(opt2(nn()));
        let o = `<div class="stats"><div class="stat"><b>${done ? fmt(len(my), 1) + ' км' : `${my.length - 1}/${P.length - 1}`}</b><span>ваш маршрут</span></div>`;
        if (shown) o += `<div class="stat"><b>${fmt(len(shown.r), 1)} км</b><span>${shown.name}</span></div>`;
        if (done) {
          const diff = (len(my) / best - 1) * 100;
          o += `<div class="stat big"><b>${diff <= 0.5 ? '🏆 Оптимум!' : '+' + fmt(diff, 1) + '%'}</b><span>к лучшему решению (2-opt)</span></div>`;
          if (diff <= 2 && api) api.achieve('route');
        }
        root.querySelector('#out').innerHTML = o + '</div>';
      };
      root.querySelector('#svg').addEventListener('click', (e) => {
        const g = e.target.closest('[data-i]'); if (!g) return; const i = +g.dataset.i;
        if (!my.includes(i)) { my.push(i); draw(); }
      });
      root.querySelector('#new').onclick = gen; root.querySelector('#cnt').onchange = gen;
      root.querySelector('#undo').onclick = () => { if (my.length > 1) my.pop(); draw(); };
      root.querySelector('#nn').onclick = () => { shown = { name: 'ближайший сосед', r: nn() }; draw(); };
      root.querySelector('#opt').onclick = () => { shown = { name: 'ближайший сосед + 2-opt', r: opt2(nn()) }; draw(); };
      gen();
    }
  });

  return tools;
})();
